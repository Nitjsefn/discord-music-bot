const {prefix, token} = require("./bot.json");
const { Client, Intents } = require('discord.js');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const { log } = console;
bot.login(token);
bot.once("ready", () => log("Bot connected"));
bot.on("messageCreate", msg => {
	log("Got message")
	if(msg.author.isBot) return;
	if(msg.content[0] != prefix) return;
	log("Got command!");
});
