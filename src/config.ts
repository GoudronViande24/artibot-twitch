import { Snowflake, ColorResolvable } from "discord.js";

export type ArtibotTwitchMention = "everyone" | "here" | Snowflake;

export class ArtibotTwitchConfigBuilder {
	checkInterval: number = 60000;
	notificationChannel: string = "notifs";
	twitchChannels: string[] = [
		"goudronviande24",
		"zariaa2020"
	];
	mentions: {
		[key: string]: ArtibotTwitchMention;
	} = {};
	showGameIcon: boolean = true;
	showGame: boolean = true;
	showViews: boolean = true;
	showUptime: boolean = true;
	showThumbnail: boolean = true;
	colors: {
		live: ColorResolvable;
		offline: ColorResolvable;
	} = {
		live: "#9146FF",
		offline: "Grey"
	};
	private: {
		clientId?: string;
		clientSecret?: string;
	} = {};

	/** Set how much time (in milliseconds) between refreshes of the embeds */
	public setCheckInterval(checkInterval: number): this {
		this.checkInterval = checkInterval;
		return this;
	}

	/** Set the channel where the notifications will be sent */
	public setNotificationChannel(notificationChannel: string): this {
		this.notificationChannel = notificationChannel;
		return this;
	}

	/** Set the channels to check for live streams */
	public setTwitchChannels(twitchChannels: string[]): this {
		this.twitchChannels = twitchChannels;
		return this;
	}

	/** Add a channel to check for live streams */
	public addTwitchChannel(twitchChannel: string, mention?: ArtibotTwitchMention): this {
		this.twitchChannels.push(twitchChannel);
		if (mention) this.mentions[twitchChannel] = mention;
		return this;
	}

	/** Add channels to check for live streams */
	public addTwitchChannels(...twitchChannels: string[]): this {
		this.twitchChannels.push(...twitchChannels);
		return this;
	}

	/** Set the mention to use when a channel goes live */
	public setMention(twitchChannel: string, mention: ArtibotTwitchMention): this {
		this.mentions[twitchChannel] = mention;
		return this;
	}

	/** Enable or disable the game icon */
	public setShowGameIcon(showGameIcon: boolean): this {
		this.showGameIcon = showGameIcon;
		return this;
	}

	/** Enable the game icon */
	public enableGameIcon(): this {
		this.showGameIcon = true;
		return this;
	}

	/** Disable the game icon */
	public disableGameIcon(): this {
		this.showGameIcon = false;
		return this;
	}

	/** Enable or disable the game */
	public setShowGame(showGame: boolean): this {
		this.showGame = showGame;
		return this;
	}

	/** Enable the game */
	public enableGame(): this {
		this.showGame = true;
		return this;
	}

	/** Disable the game */
	public disableGame(): this {
		this.showGame = false;
		return this;
	}

	/** Enable or disable the views */
	public setShowViews(showViews: boolean): this {
		this.showViews = showViews;
		return this;
	}

	/** Enable the views */
	public enableViews(): this {
		this.showViews = true;
		return this;
	}

	/** Disable the views */
	public disableViews(): this {
		this.showViews = false;
		return this;
	}

	/** Enable or disable the uptime */
	public setShowUptime(showUptime: boolean): this {
		this.showUptime = showUptime;
		return this;
	}

	/** Enable the uptime */
	public enableUptime(): this {
		this.showUptime = true;
		return this;
	}

	/** Disable the uptime */
	public disableUptime(): this {
		this.showUptime = false;
		return this;
	}

	/** Enable or disable the thumbnail */
	public setShowThumbnail(showThumbnail: boolean): this {
		this.showThumbnail = showThumbnail;
		return this;
	}

	/** Enable the thumbnail */
	public enableThumbnail(): this {
		this.showThumbnail = true;
		return this;
	}

	/** Disable the thumbnail */
	public disableThumbnail(): this {
		this.showThumbnail = false;
		return this;
	}

	/** Set the color to use when a channel goes live */
	public setLiveColor(liveColor: ColorResolvable): this {
		this.colors.live = liveColor;
		return this;
	}

	/** Set the color to use when a channel goes offline */
	public setOfflineColor(offlineColor: ColorResolvable): this {
		this.colors.offline = offlineColor;
		return this;
	}

	/** Set the Twitch client ID */
	public setClientId(clientId: string): this {
		this.private.clientId = clientId;
		return this;
	}

	/** Set the Twitch client secret */
	public setClientSecret(clientSecret: string): this {
		this.private.clientSecret = clientSecret;
		return this;
	}
}