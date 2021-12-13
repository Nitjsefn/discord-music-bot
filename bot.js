const {prefix, token} = require("./bot.json");
const { Client, Intents } = require('discord.js');
const { resourceUsage, listenerCount } = require("process");
const { resourceLimits } = require("worker_threads");
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const { log } = console;
var queuesInGuildsCollection = new Map();
class Queue
{
	Queue()
	{
		let voiceChannel;
		let queue = new Array();
	}
}
bot.login(token);
bot.once("ready", () => log("Bot connected"));
bot.on("messageCreate", msg =>
{
	if(msg.author.isBot) return;
	if(msg.content[0] != prefix) return;
	let arguments = msg.content.split();
	arguments[0] = arguments[0].slice(1);
	let command = arguments.shift();
	switch(command)
	{
		case "pl": playLocal(msg, arguments); break;
		case "skip": skipMusic(msg); break;
		case "pause": pauseMusic(msg); break;
		case "stop": stopMusic(msg); break;
		case "resume": resumeMusic(msg); break;
		case "leave": leaveVoiceChannel(msg); break;
		case "remove": removeSong(msg, arguments); break;
		case "np": displayNowPlayingSong(msg); break;
		case "queue": displayQueue(msg); break;
		case "search": searchForMusic(msg, arguments); break;
		default: msg.reply("Wrong command"); break;
	}
});