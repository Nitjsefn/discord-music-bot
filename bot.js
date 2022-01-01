const {prefix, token} = require("./bot.json");
const { Client, Intents } = require('discord.js');
const { resourceUsage, listenerCount } = require("process");
const { resourceLimits } = require("worker_threads");
const DCVoice = require('@discordjs/voice');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const { log } = console;
const fs = require('fs');
var queuesInGuildsCollection = new Map();
const pathToPlaylistsLibrary = process.argv[2];
var audioPlayerInGuild = new Map();
/*class Song
{
	Song()
	{
		let tittle = "";
		let path = "";
		let durationInSec = 0;
		let author = "";
	}
}*/
bot.login(token);
bot.once("ready", () => log("Bot connected"));
bot.on("messageCreate", msg => messageCreateAndUpdateMethod(msg));
bot.on("messageUpdate", (old_msg, msg) => messageCreateAndUpdateMethod(msg));

function messageCreateAndUpdateMethod(msg)
{
	if(msg.author.isBot) return;
	if(msg.content[0] != prefix) return;
	let arguments = msg.content.split(' ');
	arguments[0] = arguments[0].slice(1);
	let command = arguments.shift();
	switch(command)
	{
		case "pl": playLocal(msg, arguments); break;
		case "pld": playLocalPlaylist(msg, arguments); break;
		case "skip": skipMusic(msg); break;
		case "pause": pauseMusic(msg); break;
		case "stop": stopMusic(msg); break;
		case "resume": resumeMusic(msg); break;
		case "leave": leaveVoiceChannel(msg); break;
		case "remove": removeSong(msg, arguments); break;
		case "np": displayNowPlayingSong(msg); break;
		case "queue": displayQueue(msg); break;
		case "search": searchForMusic(msg, arguments); break;
		case "join": DCVoice.joinVoiceChannel({channelId: msg.member.voice.channelId, guildId: msg.guildId, adapterCreator: msg.channel.guild.voiceAdapterCreator}); break;
		case "repeat": changeRepeatStatus(msg, arguments); break;
		default: msg.reply("Wrong command!"); break;
	}
}

function leaveVoiceChannel(msg)
{
	let connection = DCVoice.getVoiceConnection(msg.guildId);
	if(!connection) {msg.reply("I am not in the voice channel!"); return;}
	connection.destroy();
	if(audioPlayerInGuild.has(msg.guildId))
	{
		audioPlayerInGuild.get(msg.guildId).stop();
		audioPlayerInGuild.delete(msg.guildId);
	}
	if(queuesInGuildsCollection.has(msg.guildId)) 
	{
		queuesInGuildsCollection(msg.guildId).delete();
	}
}

function playLocalPlaylist(msg, args)
{
	let player;
	let songsList;
	let guildID = msg.guildId;
	let playlistName = args[0];
	let defPath = pathToPlaylistsLibrary;
	if (!(defPath[defPath.length - 1] === '/' || defPath[defPath.length - 1] === '\\')) defPath += '/'; //Add searching for playlist name, where u could find out if this is only name or full directory, which will return full path to this dir
	let pathToLocalPlaylist = defPath + playlistName;
	songsList = new Array();
	fs.readdir(pathToLocalPlaylist, (err, files) => 
	{
		if (err) { console.log(err); msg.reply("I found nothing. Try other tittle."); return; }
		if (queuesInGuildsCollection.has(guildID)) songsList = queuesInGuildsCollection.get(guildID);
		else
		{
			let resrc;
			for (let i = 0; i < files.length; i++)
			{
				if(files[i].indexOf(".mp3") > 0) {
					let pathToSong = pathToLocalPlaylist + '/' + files[i];
					resrc = DCVoice.createAudioResource(pathToSong);
					break;
				}
				if(i == files.length-1) { msg.reply("I found nothing. Try other tittle."); return; }
			}
			songsList.push('off');
			player = DCVoice.createAudioPlayer({
				behaviors: {
					noSubscriber: DCVoice.NoSubscriberBehavior.Pause,
				},
			});
			let connection = DCVoice.getVoiceConnection(guildID);
			if(!connection) connection = DCVoice.joinVoiceChannel({channelId: msg.member.voice.channelId, guildId: guildID, adapterCreator: msg.channel.guild.voiceAdapterCreator});
			connection.subscribe(player);
			player.play(resrc);
		}
		for (let i = 0; i < files.length; i++)
        {
            if(files[i].indexOf(".mp3") < 0) continue;
            songsList.splice(songsList.length-2, 0, pathToLocalPlaylist + '/' + files[i]);
        }
		if(songsList.length < 2) return;
		queuesInGuildsCollection.set(guildID, songsList);
		audioPlayerInGuild.set(guildID, player);
	});
}

function skipMusic(msg)
{
	if(!queuesInGuildsCollection.has(msg.guildId)) { msg.reply("I am not playing anything!"); return; }
	let queue = queuesInGuildsCollection.get(msg.guildId);
	if(queue[queue.length-1] === "all") queue.splice(queue.length-2, 0, queue[0]);
	queue = queue.slice(1);
	if(queue.length < 2) { msg.reply("That was the last song in the queue!"); audioPlayerInGuild.get(msg.guildId).stop(); queuesInGuildsCollection.delete(msg.guildId); audioPlayerInGuild.delete(msg.guildId); DCVoice.getVoiceConnection(msg.guildId).destroy(); return; }
	let rsc = DCVoice.createAudioResource(queue[0]);
	let player = audioPlayerInGuild.get(msg.guildId);
	player.play(rsc);
	queuesInGuildsCollection.set(msg.guildId, queue);
	msg.reply("Skipped song!");
}

function changeRepeatStatus(msg, args)
{
	if(!queuesInGuildsCollection.has(msg.guildId)) { msg.reply("I am not playing anything"); return; }
	if(queuesInGuildsCollection.get(msg.guildId).length < 2) { msg.reply("I am not playing anything"); queuesInGuildsCollection(msg.guildId).delete(); return; }
	let queue = queuesInGuildsCollection.get(msg.guildId);
	switch(args[0])
	{
		case "off": queue[queue.length-1] = "off"; msg.reply("Changed repeat status to ***off*** !"); break;
		case "one": queue[queue.length-1] = "one"; msg.reply("Changed repeat status to ***one*** !"); break;
		case "all": queue[queue.length-1] = "all"; msg.reply("Changed repeat status to ***all*** !"); break;
		default: msg.reply("Wrong repeat parameter!"); return;
	}
	queuesInGuildsCollection.set(msg.guildId, queue);
}

function pauseMusic(msg)
{
	if(!audioPlayerInGuild.has(msg.guildId)) {msg.reply("I am not playing anything!"); return;}
	audioPlayerInGuild.get(msg.guildId).pause();
}