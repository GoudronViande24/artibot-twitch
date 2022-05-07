import Artibot from 'artibot';
import axios from 'axios';

// Twitch Helix API helper ("New Twitch API").

class TwitchApi {
	static async init(log, localizer, config, artibot) {
		this.logToConsole = log;
		this.localizer = localizer;
		this.config = config;

		/** @type {Artibot} */
		this.artibot = artibot;

		if (!this.config.twitch.private.token) await this.generateToken();
	}

	static async requestOptions() {
		// Automatically remove "oauth:" prefix if it's present
		const oauthPrefix = "oauth:";
		let oauthBearer = this.config.twitch.private.token;

		if (!oauthBearer || typeof oauthBearer != "string") oauthBearer = await this.generateToken();

		if (oauthBearer.startsWith(oauthPrefix)) {
			oauthBearer = oauthBearer.substr(oauthPrefix.length);
		}
		// Construct default request options
		return {
			baseURL: "https://api.twitch.tv/helix/",
			headers: {
				"Client-ID": this.config.twitch.private.clientId,
				"Authorization": `Bearer ${oauthBearer}`
			}
		};
	}

	static handleApiError(err) {
		const res = err.response || {};

		if (res.data && res.data.message) {
			if (res.data.status == 401) {
				this.generateToken();
			} else {
				this.logToConsole('TwitchMonitor', this.localizer.__("API request failed with Helix error: [[0]] ([[1]]/[[2]])", { placeholders: [res.data.message, res.data.error, res.data.status] }), "error");
			}
		} else {
			this.logToConsole('TwitchMonitor', this.localizer._("API request failed with error: ") + (err.message || err), "error");
		}
	}

	static fetchStreams(channelNames) {
		return new Promise(async (resolve, reject) => {
			axios.get(`/streams?user_login=${channelNames.join('&user_login=')}`, await this.requestOptions())
				.then((res) => {
					resolve(res.data.data || []);
				})
				.catch((err) => {
					this.handleApiError(err);
					reject(err);
				});
		});
	}

	static fetchUsers(channelNames) {
		return new Promise(async (resolve, reject) => {
			axios.get(`/users?login=${channelNames.join('&login=')}`, await this.requestOptions())
				.then((res) => {
					resolve(res.data.data || []);
				})
				.catch((err) => {
					this.handleApiError(err);
					reject(err);
				});
		});
	}

	static fetchGames(gameIds) {
		return new Promise(async (resolve, reject) => {
			axios.get(`/games?id=${gameIds.join('&id=')}`, await this.requestOptions())
				.then((res) => {
					resolve(res.data.data || []);
				})
				.catch((err) => {
					this.handleApiError(err);
					reject(err);
				});
		});
	}

	/**
	 * Generate a new oAuth token to login to Twitch
	 * @returns {Promise<string>}
	 */
	static async generateToken() {
		if (this.creatingToken) return;
		this.creatingToken = true;

		const { clientId, clientSecret } = this.config.twitch.private;

		this.logToConsole("TwitchMonitor", this.localizer._("Creating new access token..."));

		try {
			const body = new URLSearchParams();
			body.append("client_id", clientId);
			body.append("client_secret", clientSecret);
			body.append("grant_type", "client_credentials");

			const res = await axios.post("https://id.twitch.tv/oauth2/token", body, {
				headers: {
					"User-Agent": `Artibot/${this.artibot.version} artibot-twitch/${this.artibot.modules.find(module => module.id = "twitch").version}`,
					"Content-Type": "application/x-www-form-urlencoded"
				}
			});

			this.config.twitch.private.token = res.data["access_token"];
		} catch (err) {
			this.logToConsole("TwitchMonitor", this.localizer._("An error occured while creating access token: ") + err, "err");
		} finally {
			this.creatingToken = false;
			return this.config.twitch.private.token;
		}
	}

	creatingToken = false;
}

export default TwitchApi;