import TwitchApi from './twitchApi.js';
import MiniDb from './miniDb.js';
import moment, { Moment } from 'moment';
import Localizer from 'artibot-localizer';
import Artibot, { log } from 'artibot';
import { Stream, hasEqualValues } from './index.js';

let debug: boolean;

export interface TwitchUser {
	login: string;
	display_name: string;
}

export interface TwitchGame {
	id: string;
	name: string;
}

export type CallbackFn = (stream: Stream, isOnline: boolean) => boolean | void;
export type OfflineCallbackFn = (stream: Stream) => boolean | void;

export default class TwitchMonitor {
	static localizer: Localizer;
	static channelNames: string[] = [];
	static checkInterval: string;
	static _userDb: MiniDb;
	static _gameDb: MiniDb;
	static _lastUserRefresh: any | null;
	static _pendingUserRefresh: boolean;
	static _userData: any;
	static _pendingGameRefresh: boolean;
	static _gameData: any;
	static _watchingGameIds: string[];
	static readonly MIN_POLL_INTERVAL_MS: number = 30000;
	static activeStreams: string[] = [];
	static streamData: { [key: string]: Stream } = {};
	static channelLiveCallbacks: CallbackFn[] = [];
	static channelOfflineCallbacks: OfflineCallbackFn[] = [];
	static _lastGameRefresh: Moment;

	static async init(localizer: Localizer, artibot: Artibot): Promise<void> {
		const { config } = artibot;
		this.localizer = localizer;

		this._userDb = new MiniDb("twitch-users", this.localizer);
		this._gameDb = new MiniDb("twitch-games", this.localizer);

		this._lastUserRefresh = this._userDb.get("last-update") || null;
		this._pendingUserRefresh = false;
		this._userData = this._userDb.get("user-list") || {};

		this._pendingGameRefresh = false;
		this._gameData = this._gameDb.get("game-list") || {};
		this._watchingGameIds = [];

		this.channelNames = config.twitch.twitchChannels;
		this.checkInterval = config.twitch.checkInterval;

		debug = config.debug;

		await TwitchApi.init(localizer, artibot);
	}

	static start(): void {
		// Load channel names from config
		if (!this.channelNames.length) {
			log('TwitchMonitor', this.localizer._("No channels to listen to. Maybe you should disable this module in the config to free up some system resources."), "warn");
			return;
		}

		// Configure polling interval
		let checkIntervalMs: number = parseInt(this.checkInterval);
		if (isNaN(checkIntervalMs) || checkIntervalMs < TwitchMonitor.MIN_POLL_INTERVAL_MS) {
			// Enforce minimum poll interval to help avoid rate limits
			checkIntervalMs = TwitchMonitor.MIN_POLL_INTERVAL_MS;
		}
		setInterval((): void => {
			this.refresh(this.localizer._("Periodic check"));
		}, checkIntervalMs + 1000);

		// Immediate refresh after startup
		setTimeout((): void => {
			this.refresh(this.localizer._("Initial check"));
		}, 1000);

		// Ready!
		log('TwitchMonitor', this.localizer.__("Listens to: [[0]] (Checks every [[1]]ms)", {
			placeholders: [
				this.channelNames.join(', '),
				checkIntervalMs.toString()
			]
		}));
	}

	static refresh(reason: string): void {
		const now: Moment = moment();
		if (debug) log('TwitchMonitor', `${this.localizer._("Refreshing")} (${reason ? reason : this.localizer._("No reason")})`);

		// Refresh all users periodically
		if (this._lastUserRefresh === null || now.diff(moment(this._lastUserRefresh), 'minutes') >= 10) {
			TwitchApi.fetchUsers(this.channelNames)
				.then((users) => {
					this.handleUserList(users);
				})
				.catch((err) => {
					log('TwitchMonitor', this.localizer._("An error occured while updating the user: ") + err, "warn");
				})
				.then(() => {
					if (this._pendingUserRefresh) {
						this._pendingUserRefresh = false;
					}
				});
		}

		// Refresh all games if needed
		if (this._pendingGameRefresh) {
			TwitchApi.fetchGames(this._watchingGameIds)
				.then((games) => {
					this.handleGameList(games);
				})
				.catch((err) => {
					log('TwitchMonitor', this.localizer._("An error occured while updating the game: ") + err, "warn");
				})
				.then(() => {
					if (this._pendingGameRefresh) {
						this._pendingGameRefresh = false;
					}
				});
		}

		// Refresh all streams
		if (!this._pendingUserRefresh && !this._pendingGameRefresh) {
			TwitchApi.fetchStreams(this.channelNames)
				.then((channels) => {
					this.handleStreamList(channels);
				})
				.catch((err) => {
					log('TwitchMonitor', this.localizer._("An error occured while updating streams: ") + err, "warn");
				});
		}
	}

	static handleUserList(users: any[]): void {
		let gotChannelNames: string[] = [];

		users.forEach((user: TwitchUser) => {
			const channelName = user.login.toLowerCase();

			let prevUserData = this._userData[channelName] || {};
			this._userData[channelName] = Object.assign({}, prevUserData, user);

			gotChannelNames.push(user.display_name);
		});

		if (gotChannelNames.length && debug) log('TwitchMonitor', this.localizer._("Updating users data: ") + gotChannelNames.join(', '), "debug");

		this._lastUserRefresh = moment();

		this._userDb.put("last-update", this._lastUserRefresh);
		this._userDb.put("user-list", this._userData);
	}

	static handleGameList(games: TwitchGame[]): void {
		const gotGameNames: string[] = [];

		for (const game of games) {
			const gameId = game.id;

			const prevGameData = this._gameData[gameId] || {};
			this._gameData[gameId] = Object.assign({}, prevGameData, game);

			gotGameNames.push(`${game.id} → ${game.name}`);
		}

		if (gotGameNames.length) {
			if (debug) log('TwitchMonitor', this.localizer._("Updating games data: ") + gotGameNames.join(', '), "debug");
		}

		this._lastGameRefresh = moment();

		this._gameDb.put("last-update", this._lastGameRefresh);
		this._gameDb.put("game-list", this._gameData);
	}

	static handleStreamList(streams: Stream[]): void {
		// Index channel data & build list of stream IDs now online
		const nextOnlineList: string[] = [];
		const nextGameIdList: string[] = [];

		for (const stream of streams) {
			const channelName = stream.user_name.toLowerCase();

			if (stream.type === "live") {
				nextOnlineList.push(channelName);
			}

			const userDataBase = this._userData[channelName] || {};
			const prevStreamData = this.streamData[channelName] || {};

			this.streamData[channelName] = Object.assign({}, userDataBase, prevStreamData, stream);
			this.streamData[channelName].game = (stream.game_id && this._gameData[stream.game_id]) || null;

			if (stream.game_id) {
				nextGameIdList.push(stream.game_id);
			}
		}

		// Find channels that are now online, but were not before
		let notifyFailed = false;

		for (let i = 0; i < nextOnlineList.length; i++) {
			let _chanName = nextOnlineList[i];

			if (this.activeStreams.indexOf(_chanName) === -1) {
				// Stream was not in the list before
				log('TwitchMonitor', this.localizer._("The stream is now online: ") + _chanName);
			}

			if (!this.handleChannelLiveUpdate(this.streamData[_chanName], true)) {
				notifyFailed = true;
			}
		}

		// Find channels that are now offline, but were online before
		for (let i = 0; i < this.activeStreams.length; i++) {
			const _chanName: string = this.activeStreams[i];

			if (nextOnlineList.indexOf(_chanName) === -1) {
				// Stream was in the list before, but no longer
				log('TwitchMonitor', this.localizer._("The stream is now offline: ") + _chanName);
				this.streamData[_chanName].type = "detected_offline";
				this.handleChannelOffline(this.streamData[_chanName]);
			}
		}

		if (!notifyFailed) {
			// Notify OK, update list
			this.activeStreams = nextOnlineList;
		} else {
			log('TwitchMonitor', this.localizer._("Cannot send the announcement, another try will be done on next update."));
		}

		if (!hasEqualValues(this._watchingGameIds, nextGameIdList)) {
			// We need to refresh game info
			this._watchingGameIds = nextGameIdList;
			this._pendingGameRefresh = true;
			this.refresh(this.localizer._("Updating games data: "));
		}
	}

	static handleChannelLiveUpdate(streamData: Stream, isOnline: boolean): boolean {
		for (let i = 0; i < this.channelLiveCallbacks.length; i++) {
			const callback: CallbackFn = this.channelLiveCallbacks[i];

			if (callback && callback(streamData, isOnline) === false) return false;
		}
		return true;
	}

	static handleChannelOffline(streamData: Stream): boolean {
		this.handleChannelLiveUpdate(streamData, false);

		for (let i = 0; i < this.channelOfflineCallbacks.length; i++) {
			const callback: OfflineCallbackFn = this.channelOfflineCallbacks[i];
			if (callback && callback(streamData) === false) return false;
		}

		return true;
	}

	static onChannelLiveUpdate(callback: CallbackFn): void {
		this.channelLiveCallbacks.push(callback);
	}

	static onChannelOffline(callback: OfflineCallbackFn): void {
		this.channelOfflineCallbacks.push(callback);
	}
}