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
		default: msg.reply("Wrong command"); break;
	}
}

function leaveVoiceChannel(msg)
{
	let connection = DCVoice.getVoiceConnection(msg.guildId);
	if(!connection) {msg.reply("I am not in the voice channel"); return;}
	connection.destroy();
}

function playLocalPlaylist(msg, args)
{
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
			let player = DCVoice.createAudioPlayer({
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
            if(files[i].indexOf(".mp3") < 0) return;
            songsList.splice(songsList.length-2, 0, pathToLocalPlaylist + '/' + files[i]);
        }
		if(songsList.length < 2) return;
		queuesInGuildsCollection.set(guildID, songsList);
	});
}
