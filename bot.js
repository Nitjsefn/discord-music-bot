//https://www.npmjs.com/package/discord-music-player -> maybe in the future
const {prefix, token} = require("./bot.json");
const { Client, Intents, MessageEmbed, MessageAttachment } = require('discord.js');
const { resourceUsage, listenerCount } = require("process");
const { resourceLimits } = require("worker_threads");
const DCVoice = require('@discordjs/voice');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const { log } = console;
const fs = require('fs');
const mp3meta = require('jsmediatags');
var queuesInGuildsCollection = new Map();
const pathToPlaylistsLibrary = process.argv[2];
var audioPlayerInGuild = new Map();
/*class Song
{
	Song()
	{
		let title = "";
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
		queuesInGuildsCollection.delete(msg.guildId);
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
		if (err) { console.log(err); msg.reply("I found nothing. Try other title."); return; }
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
				if(i == files.length-1) { msg.reply("I found nothing. Try other title."); return; }
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
			audioPlayerInGuild.set(guildID, player);
		}
		for (let i = 0; i < files.length; i++)
        {
            if(files[i].indexOf(".mp3") < 0) continue;
            songsList.splice(songsList.length-1, 0, pathToLocalPlaylist + '/' + files[i]);
        }
		if(songsList.length < 2) return;
		queuesInGuildsCollection.set(guildID, songsList);
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

function resumeMusic(msg)
{
	if(!audioPlayerInGuild.has(msg.guildId)) {msg.reply("I am not playing anything!"); return;}
	audioPlayerInGuild.get(msg.guildId).unpause();
}

function stopMusic(msg)
{
	if(!audioPlayerInGuild.has(msg.guildId)) msg.reply("I am not playing anything!");
	else
	{
		audioPlayerInGuild.get(msg.guildId).stop();
		audioPlayerInGuild.delete(msg.guildId);
	}
	if(queuesInGuildsCollection.has(msg.guildId)) queuesInGuildsCollection.delete(msg.guildId);
	let connection = DCVoice.getVoiceConnection(msg.guildId);
	if(connection) connection.destroy();
}

function removeSong(msg, arguments)
{
	let queue = queuesInGuildsCollection.get(msg.guildId);
	if(!queue) { msg.reply("I am not playing anything!"); return; }
	if(queue.length < 2) 
	{
		if(audioPlayerInGuild.has(msg.guildId)) { audioPlayerInGuild.get(msg.guildId).stop(); audioPlayerInGuild.delete(msg.guildId); }
		queuesInGuildsCollection.delete(msg.guildId);
		let connection = DCVoice.getVoiceConnection(msg.guildId);
		if(connection) connection.destroy();
	}
	if(queue.length < 3) { msg.reply("There is no song to play in the future!"); return; }
	let songsToRemove = new Array();
	arguments.forEach(arg =>
	{
		if(arg === "0") { msg.reply("There is no song **0** in the queue!"); return; }
		songsToRemove.push(parseInt(arg));
	});
	songsToRemove.forEach(num =>
	{
		if(num > queue.length - 2) { msg.reply(`There is no song **${num}** in the queue!`); return; }
		queue.splice(num, 1);
	});
}

function displayNowPlayingSong(msg)
{
	if(!audioPlayerInGuild.has(msg.guildId)) { msg.reply("I am not playing anything"); return; }
	if(!queuesInGuildsCollection.has(msg.guildId)) { msg.reply("I am not playing anything"); return; }
	let queue = queuesInGuildsCollection.get(msg.guildId);
	let song = queue[0];
	mp3meta.read(song, { onSuccess: (tag) =>
		{
			//msg.reply(`Title: **${tag.tags.title}**\nArtist: *${tag.tags.artist}*`);
			let file = new MessageAttachment('./src/img/song-icon.png');
			let embedMsg = new MessageEmbed();
			embedMsg.setColor('#1cbbb4')
			embedMsg.setTitle(tag.tags.title)
			embedMsg.setAuthor(tag.tags.artist)
			if(tag.tags.album) embedMsg.addField('Album:', `${tag.tags.album}`)
			embedMsg.setThumbnail('attachment://song-icon.png')
			msg.channel.send({ embeds: [embedMsg], files: [file] });
		}
	});
}