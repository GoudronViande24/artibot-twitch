import { get } from 'axios';

// Twitch Helix API helper ("New Twitch API").

class TwitchApi {
	static init(log, localizer, config) {
		this.logToConsole = log;
		this.localizer = localizer;
		this.config = config;
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
			this.logToConsole('TwitchMonitor', this.localizer.__("API request failed with Helix error: [[0]] ([[1]]/[[2]])", { placeholders: [res.data.message, res.data.error, res.data.status] }), "error");
		} else {
			this.logToConsole('TwitchMonitor', this.localizer._("API request failed with error: ") + (err.message || err), "error");
		}
	}

	static fetchStreams(channelNames) {
		return new Promise((resolve, reject) => {
			get(`/streams?user_login=${channelNames.join('&user_login=')}`, this.requestOptions)
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
			get(`/users?login=${channelNames.join('&login=')}`, this.requestOptions)
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
			get(`/games?id=${gameIds.join('&id=')}`, this.requestOptions)
				.then((res) => {
					resolve(res.data.data || []);
				})
				.catch((err) => {
					this.handleApiError(err);
					reject(err);
				});
		});
	}
}

export default TwitchApi;