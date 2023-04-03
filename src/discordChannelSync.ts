import { log } from "artibot";
import Localizer from "artibot-localizer";
import { PermissionsBitField, Client, GuildBasedChannel, GuildTextBasedChannel } from "discord.js";

/** Helper class for syncing discord target channels. */
export default class DiscordChannelSync {
	/**
	 * @param client Discord.js client.
	 * @param channelName Name of the Discord channel we are looking for on each server (e.g. `config.discord_announce_channel`).
	 * @param verbose If true, log guild membership info to stdout (debug / info purposes).
	 * @return List of Discord.js channels
	 */
	static getChannelList(client: Client<true>, channelName: string, verbose: boolean, localizer: Localizer): GuildTextBasedChannel[] {
		let nextTargetChannels: GuildTextBasedChannel[] = [];

		for (const guild of client.guilds.cache.values()) {
			let targetChannel = guild.channels.cache.find(g => g.name === channelName);

			if (!targetChannel || !targetChannel.isTextBased()) {
				if (verbose) log('TwitchMonitor', localizer.__("Configuration error: The server [[0]] does not have a #[[1]] channel!", { placeholders: [guild.name, channelName] }));
				continue;
			}

			const permissions: PermissionsBitField = targetChannel.permissionsFor(guild.members.me!);

			if (verbose) log('TwitchMonitor', localizer.__(" --> for the [[0]] server, the announcements channel is #[[1]]", { placeholders: [guild.name, targetChannel.name] }));

			if (!permissions.has(PermissionsBitField.Flags.SendMessages)) {
				if (verbose) {
					log('TwitchMonitor', localizer.__("Configuration error: The bot does not have SEND_MESSAGES permission in #[[0]] channel on [[1]] server. The announcements will not be sent.", { placeholders: [targetChannel.name, guild.name] }));
				}
			}

			nextTargetChannels.push(targetChannel);
		}

		if (verbose) {
			log('TwitchMonitor', localizer.__("Total of [[0]] #[[1]] channels.", { placeholders: [nextTargetChannels.length.toString(), channelName] }));
		}

		return nextTargetChannels;
	}
}