import Artibot from 'artibot';
import axios from 'axios';

// Twitch Helix API helper ("New Twitch API").

class TwitchApi {
	static init(log, localizer, config, artibot) {
		this.logToConsole = log;
		this.localizer = localizer;
		this.config = config;

		/** @type {Artibot} */
		this.artibot = artibot;

		if (!this.config.twitch.private.token) this.generateToken();
	}

	static get requestOptions() {
		// Automatically remove "oauth:" prefix if it's present
		const oauthPrefix = "oauth:";
		let oauthBearer = this.config.twitch.private.token;
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
		return new Promise((resolve, reject) => {
			axios.get(`/streams?user_login=${channelNames.join('&user_login=')}`, this.requestOptions)
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
		return new Promise((resolve, reject) => {
			axios.get(`/users?login=${channelNames.join('&login=')}`, this.requestOptions)
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
		return new Promise((resolve, reject) => {
			axios.get(`/games?id=${gameIds.join('&id=')}`, this.requestOptions)
				.then((res) => {
					resolve(res.data.data || []);
				})
				.catch((err) => {
					this.handleApiError(err);
					reject(err);
				});
		});
	}

	static generateToken() {
		const { clientId, clientSecret } = this.config.twitch.private;

		this.logToConsole("TwitchMonitor", this.localizer._("Creating new access token..."));

		axios.post("https://id.twitch.tv/oauth2/token", {
			"client_id": clientId,
			"client_secrect": clientSecret,
			"grant_type": "client_credentials"
		}, {
			headers: {
				"User-Agent": `Artibot/${this.artibot.version} artibot-twitch/${this.artibot.modules.find(module => module.id = "twitch").version}`
			}
		}).then(res => {
			this.config.twitch.private.token = res.data["access_token"];
		}).catch(err => {
			this.logToConsole("TwitchMonitor", this.localizer._("An error occured while creating access token: ") + err, "err");
		});
	}
}

export default TwitchApi;