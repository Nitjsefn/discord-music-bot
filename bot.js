//https://www.npmjs.com/package/discord-music-player -> maybe in the future
const {prefix, token} = require("./bot.json");
const { Client, Intents, MessageEmbed, MessageAttachment, MessageActionRow, MessageButton } = require('discord.js');
const { resourceUsage, listenerCount } = require("process");
const { resourceLimits } = require("worker_threads");
const DCVoice = require('@discordjs/voice');
const bot = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const { log } = console;
const fs = require('fs');
const mp3meta = require('jsmediatags');
const { search } = require('./local-search-engine.js');
var queuesInGuildsCollection = new Map();
const pathToPlaylistsLibrary = process.argv[2];
var audioPlayerInGuild = new Map();
var queuePagesCollection = new Map(); //Last indexes are for MessageActionRow, leftButton, rightButton, stopButton, sentMessage, timeoutID <- not sure
var btnMsgIdInGuild = new Map();
var searchResultInGuild = new Map();
var searchResultInGuild_path = new Map();
var BOT_NAME;
/*class Song
{
	Song()
	{
		let title = "";
		let artist = "";
		let album = "";
	}
}*/
bot.login(token);
bot.once("ready", () => { log("Bot connected"); BOT_NAME = bot.user.username; });
bot.on("messageCreate", msg => messageCreateAndUpdateMethod(msg));
bot.on("messageUpdate", (old_msg, msg) => messageCreateAndUpdateMethod(msg));
bot.on('interactionCreate', interaction => {
	if(interaction.isButton) reactToButton(interaction);
});

function messageCreateAndUpdateMethod(msg)
{
	if(msg.author.isBot) return;
	checkForSearchInteraction(msg);
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
		case "join": DCVoice.joinVoiceChannel({channelId: msg.member.voice.channelId, guildId: msg.guildId, adapterCreator: msg.channel.guild.voiceAdapterCreator}).on(DCVoice.VoiceConnectionStatus.Disconnected, (oldState, newState) =>
					{
						if(audioPlayerInGuild.has(msg.guildId)) { audioPlayerInGuild.get(msg.guildId).stop(); audioPlayerInGuild.delete(msg.guildId); }
						if(queuesInGuildsCollection.has(msg.guildId)) queuesInGuildsCollection.delete(msg.guildId);
						let conn = DCVoice.getVoiceConnection(msg.guildId);
						if(!conn) { msg.reply("I am not in the voice channel!"); return; }
						conn.destroy();
					}); break;
		case "repeat": changeRepeatStatus(msg, arguments); break;
		case "help": sendHelpMessage(msg); break;
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
	if(!msg.member.voice.channelId) { msg.reply("You are not in voice channel"); return; }
	if(!msg.member.voice.channel.joinable) { msg.reply("I can't join to your voice channel"); return; }
	let player;
	let songsList;
	let guildID = msg.guildId;
	let playlistName = '';
	for(let i = 0; i < args.length; i++) playlistName += `${args[i]} `;
	//let defPath = pathToPlaylistsLibrary;
	//if (!(defPath[defPath.length - 1] === '/' || defPath[defPath.length - 1] === '\\')) defPath += '/'; //Add searching for playlist name, where u could find out if this is only name or full directory, which will return full path to this dir
	//let pathToLocalPlaylist = defPath + playlistName;
	let pathToLocalPlaylist = search(pathToPlaylistsLibrary, playlistName.trim(), true, '', true)[0];
	if(!pathToLocalPlaylist) { msg.reply("I found nothing. Try other title."); return; }
	songsList = new Array();
	fs.readdir(pathToLocalPlaylist, (err, files) => 
	{
		if (err) { console.log(err); msg.reply("I found nothing. Try other title."); return; }
		if(files.length == 0) { msg.reply("I found nothing inside playlist. Try other title."); return; }
		let numOfSongs = 0;
		for(let i = 0; i < files.length; i++)
		{
			if(files[i].endsWith('.mp3')) numOfSongs++;
		}
		if(numOfSongs > 0)
		{
			let c = pathToLocalPlaylist.length-1;
			while(pathToLocalPlaylist[c] !== '/') c--;
			c++;
			msg.reply(`Added ${numOfSongs} song(s) to queue from: **${pathToLocalPlaylist.slice(c)}**\nIf you want to see whole queue use \`>queue\` command.`);
		}
		if (queuesInGuildsCollection.has(guildID)) songsList = queuesInGuildsCollection.get(guildID);
		else
		{
			let firstSong;
			let resrc;
			for (let i = 0; i < files.length; i++)
			{
				if(files[i].indexOf(".mp3") > 0) {
					let pathToSong = pathToLocalPlaylist + '/' + files[i];
					resrc = DCVoice.createAudioResource(pathToSong);
					firstSong = pathToSong;
					break;
				}
				if(i == files.length-1) { msg.reply("I found nothing inside playlist. Try other title."); return; }
			}
			songsList.push('off');
			player = DCVoice.createAudioPlayer({
				behaviors: {
					noSubscriber: DCVoice.NoSubscriberBehavior.Pause,
				},
			});
			let connection = DCVoice.getVoiceConnection(guildID);
			if(!connection) 
			{
				connection = DCVoice.joinVoiceChannel({channelId: msg.member.voice.channelId, guildId: guildID, adapterCreator: msg.channel.guild.voiceAdapterCreator});
				connection.on(DCVoice.VoiceConnectionStatus.Disconnected, (oldState, newState) =>
				{
					if(audioPlayerInGuild.has(msg.guildId)) { audioPlayerInGuild.get(msg.guildId).stop(); audioPlayerInGuild.delete(msg.guildId); }
					if(queuesInGuildsCollection.has(msg.guildId)) queuesInGuildsCollection.delete(msg.guildId);
					let conn = DCVoice.getVoiceConnection(msg.guildId);
					if(!connection) { msg.reply("I am not in the voice channel!"); return; }
					conn.destroy();
				});
			}
			connection.subscribe(player);
			let d = firstSong.length-1;
			while(firstSong[d] !== '/') d--;
			d++;
			firstSong = firstSong.slice(d, -4);
			player.play(resrc);
			msg.reply(`Now playing:\t**${firstSong}**\nIf you want more information use \`>np\` command.`);
			player.addListener("stateChange", (oldOne, newOne) =>
			{
				if (newOne.status == "idle")
				{
					if(!queuesInGuildsCollection.has(msg.guildId)) { msg.reply("I am not playing anything!"); return; }
					let queue = queuesInGuildsCollection.get(msg.guildId);
					if(queue[queue.length-1] === "all") queue.splice(queue.length-1, 0, queue[0]);
					if(queue[queue.length-1] !== "one") queue = queue.slice(1);
					if(queue.length < 2) { msg.reply("That was the last song in the queue!"); audioPlayerInGuild.get(msg.guildId).stop(); queuesInGuildsCollection.delete(msg.guildId); audioPlayerInGuild.delete(msg.guildId); DCVoice.getVoiceConnection(msg.guildId).destroy(); return; }
					let rsc = DCVoice.createAudioResource(queue[0]);
					let player = audioPlayerInGuild.get(msg.guildId);
					player.play(rsc);
					queuesInGuildsCollection.set(msg.guildId, queue);
					let song = queue[0];
					let d = song.length-1;
					while(song[d] !== '/') d--;
					d++;
					song = song.slice(d, -4);
					msg.channel.send(`Now playing:\t**${song}**\nIf you want more information use \`>np\` command.`);
				}
			});
			audioPlayerInGuild.set(guildID, player);
		}
		for (let i = 0; i < files.length; i++)
        {
            if(!files[i].endsWith(".mp3")) continue;
            songsList.splice(songsList.length-1, 0, pathToLocalPlaylist + '/' + files[i]);
        }
		if(songsList.length < 2) { msg.reply('I found nothing inside playlist. Try other title.'); return; }
		queuesInGuildsCollection.set(guildID, songsList);
	});
}

function skipMusic(msg)
{
	if(!queuesInGuildsCollection.has(msg.guildId)) { msg.reply("I am not playing anything!"); return; }
	let queue = queuesInGuildsCollection.get(msg.guildId);
	if(queue[queue.length-1] === "all") queue.splice(queue.length-1, 0, queue[0]);
	queue = queue.slice(1);
	if(queue.length < 2) { msg.reply("That was the last song in the queue!"); audioPlayerInGuild.get(msg.guildId).stop(); queuesInGuildsCollection.delete(msg.guildId); audioPlayerInGuild.delete(msg.guildId); DCVoice.getVoiceConnection(msg.guildId).destroy(); return; }
	let rsc = DCVoice.createAudioResource(queue[0]);
	let player = audioPlayerInGuild.get(msg.guildId);
	player.play(rsc);
	queuesInGuildsCollection.set(msg.guildId, queue);
	let c = queue[0].length-1;
	while(queue[0][c] !== '/') c--;
	c++;
	msg.reply(`Skipped song to: **${queue[0].slice(c, -4)}**`);
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
		if(arg === "1") { msg.reply("You can't delete currently playing song from queue!"); return; } //To remove in situation as below
		let num = parseInt(arg) - 1; //-1 to delete if queuePages won't have now playing song in first index
		if(songsToRemove.indexOf(num) >= 0) return;
		songsToRemove.push(num);
	});
	songsToRemove.sort((a, b)=>
	{
		if(a < b) return 1;
		else if(a > b) return -1;
		else return 0;
	});
	log(songsToRemove);
	songsToRemove.forEach(num =>
	{
		if(num > queue.length - 2) { msg.reply(`There is no song **${num+1}** in the queue!`); return; }
		let c = queue[num].length-1;
		while(queue[num][c] !== '/') c--;
		c++;
		msg.reply(`Removed song **${queue[num].slice(c, -4)}**`);
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
			embedMsg.setColor('#1cbbb4');
			if(tag.tags.title) embedMsg.setTitle(tag.tags.title);
			if(tag.tags.artist) embedMsg.setAuthor(tag.tags.artist);
			if(tag.tags.album) embedMsg.addField('Album:', `${tag.tags.album}`);
			embedMsg.setThumbnail('attachment://song-icon.png');
			msg.channel.send({ embeds: [embedMsg], files: [file] });
		}
	});
}

function displayQueue(msg)
{
	if(!queuesInGuildsCollection.has(msg.guildId)) { msg.reply('I am not playing anything!'); return; }
	let queue = queuesInGuildsCollection.get(msg.guildId);
	let queuePages = new Array();
	let onePage = new Array();
	for(let i = 0; i < queue.length-1; i++)
	{
		let song = queue[i];
		let d = song.length-1;
		while(song[d] !== '/') d--;
		d++;
		song = song.slice(d, -4);
		song = `**${i+1}.** ${song}`;
		if(i == 0) song += '\`<- NOW PLAYING\`';
		onePage.push(song);
		if( ( (i+1)%15 == 0 ) || i == queue.length-2 )
		{
			queuePages.push(onePage);
			onePage = new Array();
		}
	}
	let leftButton = new MessageButton()
		.setCustomId('lButton')
		.setLabel('<')
		.setStyle('PRIMARY')
		.setDisabled(true);
	let rightButton = new MessageButton()
		.setCustomId('rButton')
		.setLabel('>')
		.setStyle('PRIMARY');
		if(queuePages.length < 2) rightButton.setDisabled(true);
	let stopButton = new MessageButton()
		.setCustomId('sButton')
		.setLabel('STOP')
		.setStyle('DANGER');
		if(queuePages.length < 2) stopButton.setDisabled(true);
	let row = new MessageActionRow();
	row.addComponents(leftButton, rightButton, stopButton);
	let embedMsg = new MessageEmbed();
	embedMsg.setColor('#1cbbb4');
	let firstPage = queuePages[0];
	let firstPageStr = "";
	for(let i = 0; i < firstPage.length; i++)
	{
		firstPageStr += `${firstPage[i]}\n`;
	}
	embedMsg.addField('Queue', firstPageStr);
	embedMsg.setFooter(`Page:\t1/${queuePages.length}`);
	let sentMessage = msg.channel.send({ embeds: [embedMsg], components: [row] });
	if(queuePages.length < 2) return;
	let timeoutId = setTimeout(() =>
	{
		sentMessage.then((m =>
			{
				row.setComponents(leftButton.setDisabled(true), rightButton.setDisabled(true), stopButton.setDisabled(true));
				m.edit({ components: [row] });
				queuePagesCollection.delete(msg.guildId);
				btnMsgIdInGuild.delete(msg.guildId)
			}));
	}, 60000);
	//queuePages.push(row);
	//queuePages.push(leftButton);
	//queuePages.push(rightButton);
	//queuePages.push(stopButton);
	queuePages.push(timeoutId);
	queuePagesCollection.set(msg.guildId, queuePages);
	sentMessage.then(m => btnMsgIdInGuild.set(msg.guildId, m.id));
}

function reactToButton(button)
{
	if(button.message.author.username !== BOT_NAME) return;
	if(!btnMsgIdInGuild.has(button.guildId)) { button.message.reply("This message is not up to date. Generate the new one!"); button.message.edit({ components: [button.message.components[0].setComponents(button.message.components[0].components[0].setDisabled(true), button.message.components[0].components[1].setDisabled(true), button.message.components[0].components[2].setDisabled(true))] }); button.deferUpdate(); return; }
	let correctMsgId = btnMsgIdInGuild.get(button.guildId);
	let currentMsgId = button.message.id;
	if(currentMsgId !== correctMsgId) {button.message.reply("This message is not up to date."); button.message.edit({ components: [button.message.components[0].setComponents(button.message.components[0].components[0].setDisabled(true), button.message.components[0].components[1].setDisabled(true), button.message.components[0].components[2].setDisabled(true))] }); button.deferUpdate(); return;}
	//Veryfication is complete
	let queuePages = queuePagesCollection.get(button.guildId);
	let row = button.message.components[0];
	let stopButton = row.components[2];
	let rightButton = row.components[1];
	let leftButton = row.components[0];
	let msg = button.message;
	let timeoutId = queuePages.pop();
	if(button.customId === 'sButton')
	{
		if(!msg.editable)
		{
			msg.channel.send("I can't edit this message.");
			if(msg.deletable)
			{
				msg.channel.send("I deleted this message.");
				msg.delete();
			}
			queuePagesCollection.delete(msg.guildId);
			btnMsgIdInGuild.delete(msg.guildId);
			clearTimeout(timeoutId);
			return;
		}
		row.setComponents(leftButton.setDisabled(true), rightButton.setDisabled(true), stopButton.setDisabled(true));
		msg.edit({ components: [row] });
		queuePagesCollection.delete(msg.guildId);
		btnMsgIdInGuild.delete(msg.guildId);
		clearTimeout(timeoutId);
		button.deferUpdate();
	}
	else if(button.customId === 'rButton')
	{
		leftButton.setDisabled(false);
		if(!msg.editable)
		{
			msg.channel.send("I can't edit this message.");
			if(msg.deletable)
			{
				msg.channel.send("I deleted this message.");
				msg.delete();
			}
			queuePagesCollection.delete(msg.guildId);
			btnMsgIdInGuild.delete(msg.guildId);
			clearTimeout(timeoutId);
			return;
		}
		let pageNumStr = "";
		let embedMsg = msg.embeds[0];
		let numOfPages = queuePages.length;
		for(let i = 6; i < 10; i++)
		{
			if(embedMsg.footer.text[i] === "/") break;
			pageNumStr += embedMsg.footer.text[i];
		}
		let pageNum = parseInt(pageNumStr); //Number of current page (1 -> number of pages)
		if(pageNum == numOfPages-1) //Checking if the next page will be the last one
		{
			row.setComponents(leftButton, rightButton.setDisabled(true), stopButton);
		}
		else
		{
			row.setComponents(leftButton, rightButton.setDisabled(false), stopButton);
		}
		let newPage = queuePages[pageNum]; //pageNum from 1 is the index of the next page
		let newPageStr = "";
		for(let i = 0; i < newPage.length; i++)
		{
			newPageStr += `${newPage[i]}\n`;
		}
		embedMsg.fields[0].value = newPageStr;
		embedMsg.footer.text = `Page:\t${pageNum+1}/${numOfPages}`;
		msg.edit({ embeds: [embedMsg], components: [row]});
		clearTimeout(timeoutId);
		button.deferUpdate();
		timeoutId = setTimeout(() =>
		{
			row.setComponents(leftButton.setDisabled(true), rightButton.setDisabled(true), stopButton.setDisabled(true));
			msg.edit({ components: [row] });
			queuePagesCollection.delete(msg.guildId);
			btnMsgIdInGuild.delete(msg.guildId)
		}, 60000);
		queuePages.push(timeoutId);
		queuePagesCollection.set(msg.guildId, queuePages);
	}
	else if(button.customId === 'lButton')
	{
		rightButton.setDisabled(false);
		if(!msg.editable)
		{
			msg.channel.send("I can't edit this message.");
			if(msg.deletable)
			{
				msg.channel.send("I deleted this message.");
				msg.delete();
			}
			queuePagesCollection.delete(msg.guildId);
			btnMsgIdInGuild.delete(msg.guildId);
			clearTimeout(timeoutId);
			return;
		}
		let pageNumStr = "";
		let embedMsg = msg.embeds[0];
		let numOfPages = queuePages.length;
		for(let i = 6; i < 10; i++)
		{
			if(embedMsg.footer.text[i] === "/") break;
			pageNumStr += embedMsg.footer.text[i];
		}
		let pageNum = parseInt(pageNumStr); //Number of current page (1 -> number of pages)
		if(pageNum == 2) //Checking if the prev page will be the first one
		{
			row.setComponents(leftButton.setDisabled(true), rightButton, stopButton);
		}
		else
		{
			row.setComponents(leftButton.setDisabled(false), rightButton, stopButton);
		}
		let newPage = queuePages[pageNum-2]; //pageNum from 1 is greater by 2 than index of previous page
		let newPageStr = "";
		for(let i = 0; i < newPage.length; i++)
		{
			newPageStr += `${newPage[i]}\n`;
		}
		embedMsg.fields[0].value = newPageStr;
		embedMsg.footer.text = `Page:\t${pageNum-1}/${numOfPages}`;
		msg.edit({ embeds: [embedMsg], components: [row]});
		clearTimeout(timeoutId);
		button.deferUpdate();
		timeoutId = setTimeout(() =>
		{
			row.setComponents(leftButton.setDisabled(true), rightButton.setDisabled(true), stopButton.setDisabled(true));
			msg.edit({ components: [row] });
			queuePagesCollection.delete(msg.guildId);
			btnMsgIdInGuild.delete(msg.guildId)
		}, 60000);
		queuePages.push(timeoutId);
		queuePagesCollection.set(msg.guildId, queuePages);
	}
}

function playLocal(msg, args)
{
	if(!msg.member.voice.channelId) { msg.reply("You are not in voice channel"); return; }
	if(!msg.member.voice.channel.joinable) { msg.reply("I can't join to your voice channel"); return; }
	if(args.length == 0) { msg.reply("You didn't write the title of song"); return; }
	let songName = '';
	for(let i = 0; i < args.length; i++) songName += `${args[i]} `;
	let songsList = new Array();
	let song;
	let player;
	song = search(pathToPlaylistsLibrary, songName.trim(), false, '.mp3', true)[0];
	let pathToSong = song;
	if(!song) { msg.reply("I found nothing. Try other title."); return; }
	if (queuesInGuildsCollection.has(msg.guildId)) 
	{
		songsList = queuesInGuildsCollection.get(msg.guildId);
		let c = pathToSong.length-1;
		while(pathToSong[c] !== '/') c--;
		c++;
		msg.reply(`Added song to queue: **${pathToSong.slice(c, -4)}**\nIf you want to see whole queue use \`>queue\` command.`);
	}
	else
	{
		if(!song) { msg.reply("I found nothing. Try other title."); return; }
		let resrc = DCVoice.createAudioResource(song);
		songsList.push('off');
		player = DCVoice.createAudioPlayer({
			behaviors: {
				noSubscriber: DCVoice.NoSubscriberBehavior.Pause,
			},
		});
		let connection = DCVoice.getVoiceConnection(msg.guildId);
		if(!connection) 
		{
			connection = DCVoice.joinVoiceChannel({channelId: msg.member.voice.channelId, guildId: msg.guildId, adapterCreator: msg.channel.guild.voiceAdapterCreator});
			connection.on(DCVoice.VoiceConnectionStatus.Disconnected, (oldState, newState) =>
			{
				if(audioPlayerInGuild.has(msg.guildId)) { audioPlayerInGuild.get(msg.guildId).stop(); audioPlayerInGuild.delete(msg.guildId); }
				if(queuesInGuildsCollection.has(msg.guildId)) queuesInGuildsCollection.delete(msg.guildId);
				let conn = DCVoice.getVoiceConnection(msg.guildId);
				if(!connection) { msg.reply("I am not in the voice channel!"); return; }
				conn.destroy();
			});
		}
		connection.subscribe(player);
		let d = song.length-1;
		while(song[d] !== '/') d--;
		d++;
		song = song.slice(d, -4);
		player.play(resrc);
		msg.reply(`Now playing:\t**${song}**\nIf you want more information use \`>np\` command.`);
		player.addListener("stateChange", (oldOne, newOne) =>
		{
			if (newOne.status == "idle")
			{
				if(!queuesInGuildsCollection.has(msg.guildId)) { msg.reply("I am not playing anything!"); return; }
				let queue = queuesInGuildsCollection.get(msg.guildId);
				if(queue[queue.length-1] === "all") queue.splice(queue.length-1, 0, queue[0]);
				if(queue[queue.length-1] !== "one") queue = queue.slice(1);
				if(queue.length < 2) { msg.reply("That was the last song in the queue!"); audioPlayerInGuild.get(msg.guildId).stop(); queuesInGuildsCollection.delete(msg.guildId); audioPlayerInGuild.delete(msg.guildId); DCVoice.getVoiceConnection(msg.guildId).destroy(); return; }
				let rsc = DCVoice.createAudioResource(queue[0]);
				let player = audioPlayerInGuild.get(msg.guildId);
				player.play(rsc);
				queuesInGuildsCollection.set(msg.guildId, queue);
				let song = queue[0];
				let d = song.length-1;
				while(song[d] !== '/') d--;
				d++;
				song = song.slice(d, -4);
				msg.channel.send(`Now playing:\t**${song}**\nIf you want more information use \`>np\` command.`);
			}
		});
		audioPlayerInGuild.set(msg.guildId, player);
	}
	songsList.splice(songsList.length-1, 0, pathToSong);
	if(songsList.length < 2) return;
	queuesInGuildsCollection.set(msg.guildId, songsList);
}

function searchForMusic(msg, args)
{
	if(!msg.member.voice.channelId) { msg.reply("You are not in voice channel"); return; }
	if(!msg.member.voice.channel.joinable) { msg.reply("I can't join to your voice channel"); return; }
	if(args.length == 0) { msg.reply("You didn't write the title of song"); return; }
	let songName = '';
	for(let i = 0; i < args.length; i++) songName += `${args[i]} `;
	songName = songName.trim();
	let songsList = new Array();
	songsList = search(pathToPlaylistsLibrary, songName, false, '.mp3', true);
	if(songsList.length == 0) { msg.reply("I found nothing. Try other title."); return; }
	let embedText = '';
	let embedTextPages = new Array();
	for(let i = 0; i < songsList.length; i++)
	{
		let song = songsList[i];
		let d = song.length-1;
		while(song[d] !== '/') d--;
		let c = d-1;
		while(song[c] !== '/') c--;
		let playlistName = song.slice(c+1, d)
		d++;
		song = song.slice(d, -4);
		if(embedText.length + (''+(i+1)).length + song.length + playlistName.length +18  > 1023) 
		{
			embedTextPages.push(embedText);
			embedText = '';
		}
		embedText += `**${i+1}.** ${song} \`->\` ${playlistName}\n`;
	}
	embedTextPages.push(embedText);
	let embedMsg = new MessageEmbed();
	embedMsg.setColor('#1cbbb4');
	embedMsg.addField('Found:', embedTextPages[0]);
	embedMsg.setFooter(`Page: 1/${embedTextPages.length}`);
	embedMsg.setDescription('Type number of song you want me to play, or type \`p\` before number to change page.');
	let sentMsg = msg.channel.send({ embeds: [embedMsg]});
	embedTextPages.unshift(sentMsg);
	let key = '' + msg.guildId + msg.author.id;
	searchResultInGuild.set(key, embedTextPages);
	searchResultInGuild_path.set(key, songsList);
}

function checkForSearchInteraction(msg)
{
	let key = '' + msg.guildId + msg.author.id;
	if(!searchResultInGuild.has(key)) return;
	for(let i = 0; i < msg.content.length; i++)
	{
		if(i == 0 && msg.content[i].toLowerCase() === 'p') continue;
		if(msg.content[i].charCodeAt(0) < 48 || msg.content[i].charCodeAt(0) > 57)
		{
			msg.reply('Search canceled');
			searchResultInGuild.delete(key);
			searchResultInGuild_path.delete(key)
			return;
		}
	}
	let embedTextPages = Array.from(searchResultInGuild.get(key));
	let sentMsg = embedTextPages.shift();
	if(msg.content[0] === 'p')
	{
		if(msg.content.length < 2) 
		{
			if(embedTextPages.length == 1) { msg.reply('There is only one page.'); return; }
			sentMsg.then(m =>
				{
					if(!m.editable) return;
					let currentPage_str = m.embeds[0].footer.text;
					currentPage_str = currentPage_str.slice(5)
					let d = 0;
					while(currentPage_str[d] !== '/') d++;
					currentPage_str = currentPage_str.slice(0, d)
					let currentPage = parseInt(currentPage_str);
					if(currentPage == embedTextPages.length) { msg.reply('That was the last page.'); return; }
					let embedMsg = new MessageEmbed();
					embedMsg.setColor('#1cbbb4');
					embedMsg.addField('Found:', embedTextPages[currentPage]);
					embedMsg.setFooter(`Page: ${currentPage+1}/${embedTextPages.length}`);
					embedMsg.setDescription('Type number of song you want me to play, or type \`p\` before number to change page.');
					m.edit({ embeds: [embedMsg] });
				});
			return;
		}
		let requestedPage = parseInt(msg.content.slice(1)) - 1;
		if(requestedPage + 1 > embedTextPages.length) { msg.reply(`Your requested page is too high. Try one more time.`); return; }
		if(requestedPage < 0) { msg.reply(`Your requested page is too low. Try one more time.`); return; }
		sentMsg.then((sentM) =>
		{
			if(!sentM.editable) return;
			let embedMsg = new MessageEmbed();
			embedMsg.setColor('#1cbbb4');
			embedMsg.addField('Found:', embedTextPages[requestedPage]);
			embedMsg.setFooter(`Page: ${requestedPage+1}/${embedTextPages.length}`);
			embedMsg.setDescription('Type number of song you want me to play, or type \`p\` before number to change page.');
			sentM.edit({ embeds: [embedMsg] });
		});
		return;
	}
	else
	{
		let songsPaths = searchResultInGuild_path.get(key);
		let requestedSong = parseInt(msg.content) - 1;
		if(requestedSong < 0) { msg.reply('Your chosen number is too low. Try again.'); return; }
		if(requestedSong + 1 > songsPaths.length) { msg.reply('Your chosen number is too high. Try again.'); return; }
		let pathToSong = songsPaths[requestedSong];
		let song = pathToSong;
		let songsList = new Array();
		let player;
		if(!msg.member.voice.channelId) { msg.reply("You are not in voice channel"); return; }
		if(!msg.member.voice.channel.joinable) { msg.reply("I can't join to your voice channel"); return; }
		if (queuesInGuildsCollection.has(msg.guildId))
		{
			songsList = queuesInGuildsCollection.get(msg.guildId);
			let c = pathToSong.length-1;
			while(pathToSong[c] !== '/') c--;
			c++;
			msg.reply(`Added song to queue: **${pathToSong.slice(c, -4)}**\nIf you want to see whole queue use \`>queue\` command.`);
		}
		else
		{
			if(!song) { msg.reply("I found nothing. Try other title."); return; }
			let resrc = DCVoice.createAudioResource(song);
			songsList.push('off');
			player = DCVoice.createAudioPlayer({
				behaviors: {
					noSubscriber: DCVoice.NoSubscriberBehavior.Pause,
				},
			});
			let connection = DCVoice.getVoiceConnection(msg.guildId);
			if(!connection) 
			{
				connection = DCVoice.joinVoiceChannel({channelId: msg.member.voice.channelId, guildId: msg.guildId, adapterCreator: msg.channel.guild.voiceAdapterCreator});
				connection.on(DCVoice.VoiceConnectionStatus.Disconnected, (oldState, newState) =>
				{
					if(audioPlayerInGuild.has(msg.guildId)) { audioPlayerInGuild.get(msg.guildId).stop(); audioPlayerInGuild.delete(msg.guildId); }
					if(queuesInGuildsCollection.has(msg.guildId)) queuesInGuildsCollection.delete(msg.guildId);
					let conn = DCVoice.getVoiceConnection(msg.guildId);
					if(!connection) { msg.reply("I am not in the voice channel!"); return; }
					conn.destroy();
				});
			}
			connection.subscribe(player);
			let d = song.length-1;
			while(song[d] !== '/') d--;
			d++;
			song = song.slice(d, -4);
			player.play(resrc);
			msg.reply(`Now playing:\t**${song}**\nIf you want more information use \`>np\` command.`);
			player.addListener("stateChange", (oldOne, newOne) =>
			{
				if (newOne.status == "idle")
				{
					if(!queuesInGuildsCollection.has(msg.guildId)) { msg.reply("I am not playing anything!"); return; }
					let queue = queuesInGuildsCollection.get(msg.guildId);
					if(queue[queue.length-1] === "all") queue.splice(queue.length-1, 0, queue[0]);
					if(queue[queue.length-1] !== "one") queue = queue.slice(1);
					if(queue.length < 2) { msg.reply("That was the last song in the queue!"); audioPlayerInGuild.get(msg.guildId).stop(); queuesInGuildsCollection.delete(msg.guildId); audioPlayerInGuild.delete(msg.guildId); DCVoice.getVoiceConnection(msg.guildId).destroy(); return; }
					let rsc = DCVoice.createAudioResource(queue[0]);
					let player = audioPlayerInGuild.get(msg.guildId);
					player.play(rsc);
					queuesInGuildsCollection.set(msg.guildId, queue);
					let song = queue[0];
					let d = song.length-1;
					while(song[d] !== '/') d--;
					d++;
					song = song.slice(d, -4);
					msg.channel.send(`Now playing:\t**${song}**\nIf you want more information use \`>np\` command.`);
				}
			});
			audioPlayerInGuild.set(msg.guildId, player);
		}
		songsList.splice(songsList.length-1, 0, pathToSong);
		if(songsList.length < 2) return;
		queuesInGuildsCollection.set(msg.guildId, songsList);
		searchResultInGuild_path.delete(key);
		searchResultInGuild.delete(key);
	}

}

function sendHelpMessage(msg)
{
	let embedMsg = new MessageEmbed()
		.setTitle('Guide')
		.setDescription(`To use command you have to add prefix \`${prefix}\` before it. You can use upper and lower case letters as well. Some commands requires arguments.`)
		.addField('Commands', `\`pl\` - Plays song from local files found by given name -> e.g. *\`${prefix}pl believer\`*\n\`pld\` - Plays playlist from local files found by given name -> e.g. *\`${prefix}pld Imagine Dragons\`*\n\`skip\` - Skips to the next song in the queue -> e.g. *\`${prefix}skip\`*\n\`pause\` - Pauses currently playing song -> e.g. *\`${prefix}pause\`*\n\`stop\` - Stops playing song and leaving voice channel -> e.g. *\`${prefix}stop\`*\n\`resume\` - Resumes paused song -> e.g. *\`${prefix}resume\`*\n\`leave\` - Leaves voice channel and stops playing music -> e.g. *\`${prefix}leave\`*\n\`remove\` - Removes songs given by number from queue -> e.g. *\`${prefix}remove 2 4 15\`*\n\`np\` - Displays informations about currently playing song -> e.g. *\`${prefix}np\`*\n\`queue\` - Displays songs in the queue. Can be used to see numbers of songs to remove -> e.g. *\`${prefix}queue\`*\n\`search\` - Searches for music in local files -> e.g. *\`${prefix}search beliver\`*\n\`join\` - Joins voice channel, that user is currently in -> e.g. *\`${prefix}join\`*\n\`repeat\` - Changes repeat status [all, one, off]. For default: off -> e.g. *\`${prefix}repeat all\`*\n`);
	msg.channel.send({ embeds: [embedMsg] });
}