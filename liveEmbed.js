import moment from 'moment';
import humanizeDuration from "humanize-duration";

class LiveEmbed {
	static createForStream(streamData, config, localizer, createEmbed) {
		const locale = config.lang;
		const isLive = streamData.type === "live";
		config = config.twitch;
		const allowBoxArt = config.showGameIcon;

		let msgEmbed = createEmbed()
			.setColor(isLive ? config.colors.live : config.colors.offline)
			.setURL(`https://twitch.tv/${streamData.user_name.toLowerCase()}`);

		// Thumbnail
		let thumbUrl = streamData.profile_image_url;

		if (allowBoxArt && streamData.game && streamData.game.box_art_url) {
			thumbUrl = streamData.game.box_art_url;
			thumbUrl = thumbUrl.replace("{width}", "288");
			thumbUrl = thumbUrl.replace("{height}", "384");
		}

		msgEmbed.setThumbnail(thumbUrl);

		// Title
		if (isLive) {
			msgEmbed.setTitle(":red_circle: " + localizer.__("**[[0]] is live on Twitch!**", { placeholders: [streamData.user_name] }));
			msgEmbed.addFields({ name: localizer._("Title"), value: streamData.title, inline: false });
		} else {
			msgEmbed.setTitle(":white_circle: " + localizer.__("[[0]] was live on Twitch.", { placeholders: [streamData.user_name] }));
			msgEmbed.setDescription(localizer._("The stream has ended."));

			msgEmbed.addFields({ name: localizer._("Title"), value: streamData.title, inline: true });
		}

		// Add game
		if (streamData.game && config.showGame) {
			msgEmbed.addFields({ name: localizer._("Game"), value: streamData.game.name, inline: false });
		}

		if (isLive) {
			// Add status
			if (config.showViews) msgEmbed.addFields({
				name: localizer._("Viewers"),
				value: isLive ? localizer.__("Currently [[0]]", { placeholders: [streamData.viewer_count] }) : localizer._("The stream has ended."),
				inline: true
			});

			// Set main image (stream preview)
			if (config.showThumbnail) {
				let imageUrl = streamData.thumbnail_url;
				imageUrl = imageUrl.replace("{width}", "1280");
				imageUrl = imageUrl.replace("{height}", "720");
				let thumbnailBuster = (Date.now() / 1000).toFixed(0);
				imageUrl += `?t=${thumbnailBuster}`;
				msgEmbed.setImage(imageUrl);
			}

			// Add uptime
			if (config.showUptime) {
				let now = moment();
				let startedAt = moment(streamData.started_at);

				msgEmbed.addFields({
					name: localizer._("Online since"),
					value: humanizeDuration(now - startedAt, {
						language: locale,
						delimiter: ", ",
						largest: 2,
						round: true,
						units: ["y", "mo", "w", "d", "h", "m"]
					}),
					inline: true
				});
			}
		}

		return msgEmbed;
	}
}

export default LiveEmbed;