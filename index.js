import Artibot, { Global, Module } from "artibot";
import Localizer from "artibot-localizer";
import { createRequire } from 'module';
import path, { join } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const { version } = require('./package.json');

import TwitchMonitor from "./twitchMonitor.js";
import MiniDb from "./miniDb.js";
import LiveEmbed from "./liveEmbed.js";
import DiscordChannelSync from "./discordChannelSync.js";

/** 
 * TwitchMonitor Module for Artibot
 * Based on Timbot (https://github.com/roydejong/timbot), by roydejong (https://github.com/roydejong)
 * Most of the code is just adapted for this project.
 * @author GoudronViande24
 * @author roydejong
 * @license MIT
 */
export default new Module({
	id: "twitch",
	name: "TwitchMonitor",
	version,
	langs: ["fr", "en"],
	repo: "GoudronViande24/artibot-twitch",
	parts: [
		new Global({
			id: "twitch",
			mainFunction: execute
		})
	]
});

/**
 * Main function for this module
 * @param {Artibot} artibot
 */
async function execute({ client, config, config: { lang }, log }) {
	const localizer = new Localizer({
		filePath: join(__dirname, "locales.json"),
		lang
	});

	// Check if config is correct
	if (!config.twitch) return log(localizer._("Cannot load config"));

	TwitchMonitor.init(log, localizer, config);

	let targetChannels = [];

	let syncServerList = (logMembership) => {
		targetChannels = DiscordChannelSync.getChannelList(client, config.twitch.notificationChannel, logMembership, log, localizer);
	};

	// Init list of connected servers, and determine which channels we are announcing to
	syncServerList(true);

	// Activity updater
	class StreamActivity {
		/**
		 * Registers a channel that has come online, and updates the user activity.
		 */
		static setChannelOnline(stream) {
			this.onlineChannels[stream.user_name] = stream;
		}

		/**
		 * Marks a channel has having gone offline, and updates the user activity if needed.
		 */
		static setChannelOffline(stream) {
			delete this.onlineChannels[stream.user_name];
		}

		static init(discordClient) {
			this.discordClient = discordClient;
			this.onlineChannels = {};
		}
	}

	// ---------------------------------------------------------------------------------------------------------------------
	// Live events

	let liveMessageDb = new MiniDb('live-messages', log, localizer);
	let messageHistory = liveMessageDb.get("history") || {};

	TwitchMonitor.onChannelLiveUpdate((streamData) => {
		const isLive = streamData.type === "live";

		// Refresh channel list
		try {
			syncServerList(false);
		} catch (e) { };

		// Update activity
		StreamActivity.setChannelOnline(streamData);

		// Generate message
		const msgFormatted = localizer.__("**[[0]]** is live on Twitch!", { placeholders: [streamData.user_name] });
		const msgEmbed = LiveEmbed.createForStream(streamData, config, localizer, createEmbed);

		// Broadcast to all target channels
		let anySent = false;

		for (let i = 0; i < targetChannels.length; i++) {
			const discordChannel = targetChannels[i];
			const liveMsgDiscrim = `${discordChannel.guild.id}_${discordChannel.name}_${streamData.id}`;

			if (discordChannel) {
				try {
					// Either send a new message, or update an old one
					let existingMsgId = messageHistory[liveMsgDiscrim] || null;

					if (existingMsgId) {
						// Fetch existing message
						discordChannel.messages.fetch(existingMsgId)
							.then((existingMsg) => {
								existingMsg.edit({
									content: msgFormatted,
									embeds: [msgEmbed]
								}).then((message) => {
									// Clean up entry if no longer live
									if (!isLive) {
										delete messageHistory[liveMsgDiscrim];
										liveMessageDb.put('history', messageHistory);
									}
								});
							})
							.catch((e) => {
								// Unable to retrieve message object for editing
								if (e.message === "Unknown Message") {
									// Specific error: the message does not exist, most likely deleted.
									delete messageHistory[liveMsgDiscrim];
									liveMessageDb.put('history', messageHistory);
									// This will cause the message to be posted as new in the next update if needed.
								}
							});
					} else {
						// Sending a new message
						if (!isLive) {
							// We do not post "new" notifications for channels going/being offline
							continue;
						}

						// Expand the message with a @mention for "here" or "everyone"
						// We don't do this in updates because it causes some people to get spammed
						let mentionMode = (config.twitch.mentions && config.twitch.mentions[streamData.user_name.toLowerCase()]) || null;

						if (mentionMode) {
							mentionMode = mentionMode.toLowerCase();

							if (mentionMode === "everyone" || mentionMode === "here") {
								// Reserved @ keywords for discord that can be mentioned directly as text
								mentionMode = `@${mentionMode}`;
							} else {
								// Most likely a role that needs to be translated to <@&id> format
								let roleData = discordChannel.guild.roles.cache.find((role) => {
									return (role.name.toLowerCase() === mentionMode);
								});

								if (roleData) {
									mentionMode = `<@&${roleData.id}>`;
								} else {
									log("TwitchMonitor", localizer.__("Cannot tag [[0]] role (role not found on server [[1]])", { placeholders: [mentionMode, discordChannel.guild.name] }));
									mentionMode = null;
								}
							}
						}

						let msgToSend = msgFormatted;

						if (mentionMode) {
							msgToSend = msgFormatted + ` ${mentionMode}`
						}

						discordChannel.send({
							content: msgToSend,
							embeds: [msgEmbed]
						})
							.then((message) => {
								log('TwitchMonitor', localizer.__("Announcement sent in #[[0]] on [[1]]", { placeholders: [discordChannel.name, discordChannel.guild.name] }));

								messageHistory[liveMsgDiscrim] = message.id;
								liveMessageDb.put('history', messageHistory);
							})
							.catch((err) => {
								log('TwitchMonitor', localizer.__("Cannot send the announcement in #[[0]] on [[1]]: [[2]]", {
									placeholders: [
										discordChannel.name,
										discordChannel.guild.name,
										err.message
									]
								}));
							});
					}

					anySent = true;
				} catch (e) {
					log('TwitchMonitor', localizer._("An error occured while sending the message: ") + e, "warn");
				}
			}
		}

		liveMessageDb.put('history', messageHistory);
		return anySent;
	});

	TwitchMonitor.onChannelOffline((streamData) => {
		// Update activity
		StreamActivity.setChannelOffline(streamData);
	});

	// --- Common functions ------------------------------------------------------------------------------------------------
	String.prototype.replaceAll = function (search, replacement) {
		var target = this;
		return target.split(search).join(replacement);
	};

	String.prototype.spacifyCamels = function () {
		let target = this;

		try {
			return target.replace(/([a-z](?=[A-Z]))/g, '$1 ');
		} catch (e) {
			return target;
		}
	};

	Array.prototype.joinEnglishList = function () {
		let a = this;

		try {
			return [a.slice(0, -1).join(', '), a.slice(-1)[0]].join(a.length < 2 ? '' : ' and ');
		} catch (e) {
			return a.join(', ');
		}
	};

	String.prototype.lowercaseFirstChar = function () {
		let string = this;
		return string.charAt(0).toUpperCase() + string.slice(1);
	};

	Array.prototype.hasEqualValues = function (b) {
		let a = this;

		if (a.length !== b.length) {
			return false;
		}

		a.sort();
		b.sort();

		for (let i = 0; i < a.length; i++) {
			if (a[i] !== b[i]) {
				return false;
			}
		}

		return true;
	}

	// Keep our activity in the user list in sync
	StreamActivity.init(client);

	// Begin Twitch API polling
	TwitchMonitor.start();

	client.on("guildCreate", () => {
		syncServerList(true);
	});

	client.on("guildDelete", () => {
		syncServerList(true);
	});
}