const {prefix, token} = require("./bot.json");
const { Client, Intents } = require('discord.js');
const { resourceUsage, listenerCount } = require("process");
const { resourceLimits } = require("worker_threads");
const DCVoice = require('@discordjs/voice');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const { log } = console;
const fs = require('fs');
var queuesInGuildsCollection = new Map();
var pathToPlaylistsLibrary = new Map();
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
bot.on("messageUpdate", msg => messageCreateAndUpdateMethod(msg));

function messageCreateAndUpdateMethod(msg)
{
	if(msg.author.isBot) return;
	if(msg.content[0] != prefix) return;
	let arguments = msg.content.split();
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
		case "setPath": pathToPlaylistsLibrary.set(msg.guildId, arguments[0]); break;
		default: msg.reply("Wrong command"); break;
	}
}

function leaveVoiceChannel(msg)
{
	let connection = DCVoice.getVoiceConnection(msg.guildId);
	connection.destroy();
}

function playLocalPlaylist(msg, args)
{
	let songsList;
	let guildID = msg.guildId;
	let playlistName = arguments[0];
	if(pathToPlaylistsLibrary.hasValue(guildID))
	{
		let defPath = pathToPlaylistsLibrary.get(guildID);
		if (!(defPath[defPath.length - 1] === '/')) defPath += '/';
		let pathToLocalPlaylist = defPath + playlistName;
		let songsList = new Array();
		fs.readdir(pathToLocalPlaylist, (err, files) => 
		{
			if (err) { console.log(err); return; }
			if (queuesInGuildsCollection.hasValue(guildID)) songsList = queuesInGuildsCollection.get(guildID);
			foreach (file in files)
			{
				if(file.indexOf("mp3") < 0) continue;
				songsList.add(file);
			}
			queuesInGuildsCollection.set(guildID, songsList);
		});
	}
	else
	{
		fs.readdir(playlistName, (err, files) => 
		{
			if (err) { console.log(err); return; }
			if (queuesInGuildsCollection.hasValue(guildID)) songsList = queuesInGuildsCollection.get(guildID);
			foreach (file in files)
			{
				if(file.indexOf("mp3") < 0) continue;
				songsList.add(file);
			}
			queuesInGuildsCollection.set(guildID, songsList);
		});
	}
}