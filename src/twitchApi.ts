import Artibot, { ArtibotConfig, log } from 'artibot';
import axios from 'axios';
import Localizer from "artibot-localizer";

export interface TwitchApiOptions {
	baseURL: string;
	headers: {
		"Client-ID": string;
		"Authorization": string;
	};
}

/* Twitch Helix API helper ("New Twitch API") */
export default class TwitchApi {
	static localizer: Localizer;
	static config: ArtibotConfig;
	static artibot: Artibot;
	static creatingToken: boolean = false;

	static async init(localizer: Localizer, artibot: Artibot): Promise<void> {
		const { config } = artibot;
		this.localizer = localizer;
		this.config = config;
		this.artibot = artibot;

		if (!this.config.twitch.private.token) await this.generateToken();
	}

	static async requestOptions(): Promise<TwitchApiOptions> {
		// Automatically remove "oauth:" prefix if it's present
		const oauthPrefix: string = "oauth:";
		let oauthBearer: string = this.config.twitch.private.token;

		if (!oauthBearer || typeof oauthBearer != "string") oauthBearer = await this.generateToken();

		if (oauthBearer.startsWith(oauthPrefix)) oauthBearer = oauthBearer.substring(oauthPrefix.length);

		// Construct default request options
		return {
			baseURL: "https://api.twitch.tv/helix/",
			headers: {
				"Client-ID": this.config.twitch.private.clientId,
				"Authorization": `Bearer ${oauthBearer}`
			}
		};
	}

	static handleApiError(err: any): void {
		const res = err.response || {};

		if (res.data && res.data.message) {
			if (res.data.status == 401) {
				this.generateToken();
			} else {
				log('TwitchMonitor', this.localizer.__("API request failed with Helix error: [[0]] ([[1]]/[[2]])", { placeholders: [res.data.message, res.data.error, res.data.status] }), "err");
			}
		} else {
			log('TwitchMonitor', this.localizer._("API request failed with error: ") + (err.message || err), "err");
		}
	}

	static async fetchStreams(channelNames: string[]): Promise<any[]> {
		try {
			const res = await axios.get(`/streams?user_login=${channelNames.join('&user_login=')}`, await this.requestOptions())
			return res.data.data || [];
		} catch (err) {
			this.handleApiError(err);
			throw err;
		}
	}

	static async fetchUsers(channelNames: string[]): Promise<any[]> {
		try {
			const res = await axios.get(`/users?login=${channelNames.join('&login=')}`, await this.requestOptions())
			return res.data.data || [];
		} catch (err) {
			this.handleApiError(err);
			throw err;
		}
	}

	static async fetchGames(gameIds: string[]): Promise<any[]> {
		try {
			const res = await axios.get(`/games?id=${gameIds.join('&id=')}`, await this.requestOptions())
			return res.data.data || [];
		} catch (err) {
			this.handleApiError(err);
			throw err;
		}
	}

	/** Generate a new oAuth token to login to Twitch */
	static async generateToken(): Promise<string> {
		if (this.creatingToken) return this.config.twitch.private.token;
		this.creatingToken = true;

		const { clientId, clientSecret }: { [key: string]: string } = this.config.twitch.private;

		log("TwitchMonitor", this.localizer._("Creating new access token..."));

		try {
			const body: URLSearchParams = new URLSearchParams();
			body.append("client_id", clientId);
			body.append("client_secret", clientSecret);
			body.append("grant_type", "client_credentials");

			const res = await axios.post("https://id.twitch.tv/oauth2/token", body, {
				headers: {
					"User-Agent": `Artibot/${this.artibot.version} artibot-twitch/${this.artibot.modules.get("twitch")!.version}`,
					"Content-Type": "application/x-www-form-urlencoded"
				}
			});

			this.config.twitch.private.token = res.data["access_token"];
		} catch (err) {
			log("TwitchMonitor", this.localizer._("An error occured while creating access token: ") + err, "err");
		} finally {
			this.creatingToken = false;
			return this.config.twitch.private.token;
		}
	}
}