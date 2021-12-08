//var json_file = require("./bot.json");
//const token = json_file.token;
//const prefix = json_file.prefix;
const {prefix, token} = require("./bot.json");
const { Client, Intents } = require('discord.js');
console.log(prefix, token);