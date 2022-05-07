import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

class MiniDb {
	constructor(name, log, localizer) {
		this.logToConsole = log;
		this.localizer = localizer;
		this.basePath = "./data/twitch/";

		if (!existsSync(this.basePath)) {
			this.logToConsole('TwitchMonitor', this.localizer.__("Creating directory for minidb: [[0]]", { placeholders: [this.basePath] }));
			mkdirSync(this.basePath, { recursive: true });
		}

		this.basePath = `./data/twitch/${name}`;

		if (!existsSync(this.basePath)) {
			this.logToConsole('TwitchMonitor', this.localizer.__("Creating directory for minidb: [[0]]", { placeholders: [this.basePath] }));
			mkdirSync(this.basePath, { recursive: true });
		}
	}

	get(id) {
		const filePath = `${this.basePath}/${id}.json`;

		try {
			if (existsSync(filePath)) {
				const raw = readFileSync(filePath, {
					encoding: 'utf8',
					flag: 'r'
				});
				return JSON.parse(raw) || null;
			}
		} catch (e) {
			this.logToConsole('TwitchMonitor', this.localizer.__("Writing error: [[0]], [[1]]", { placeholders: [filePath, e] }), "error");
		}
		return null;
	}

	put(id, value) {
		const filePath = `${this.basePath}/${id}.json`;

		try {
			const raw = JSON.stringify(value);
			writeFileSync(filePath, raw, {
				encoding: 'utf8',
				mode: '666',
				flag: 'w'
			});
			return true;
		} catch (e) {
			this.logToConsole('TwitchMonitor', this.localizer.__("Writing error: [[0]], [[1]]", { placeholders: [filePath, e] }), "error");
			return false;
		}
	}
}

export default MiniDb;