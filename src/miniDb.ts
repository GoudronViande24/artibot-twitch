import { log } from 'artibot';
import Localizer from 'artibot-localizer';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';

export default class MiniDb {
	basePath: string;
	localizer: Localizer;

	constructor(name: string, localizer: Localizer) {
		this.localizer = localizer;
		this.basePath = "./data/twitch/";

		if (!existsSync(this.basePath)) {
			log('TwitchMonitor', this.localizer.__("Creating directory for minidb: [[0]]", { placeholders: [this.basePath] }));
			mkdirSync(this.basePath, { recursive: true });
		}

		this.basePath = `./data/twitch/${name}`;

		if (!existsSync(this.basePath)) {
			log('TwitchMonitor', this.localizer.__("Creating directory for minidb: [[0]]", { placeholders: [this.basePath] }));
			mkdirSync(this.basePath, { recursive: true });
		}
	}

	get(id: string): any | null {
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
			log('TwitchMonitor', this.localizer.__("Writing error: [[0]], [[1]]", { placeholders: [filePath, (e as Error).message] }), "err");
		}
		return null;
	}

	put(id: string, value: any): boolean {
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
			log('TwitchMonitor', this.localizer.__("Writing error: [[0]], [[1]]", { placeholders: [filePath, (e as Error).message] }), "err");
			return false;
		}
	}
}