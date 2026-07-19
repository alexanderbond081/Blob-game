import { EventEmitter } from 'pixi.js';

const MAX_DEBUG_LINES = 10;

class DebugManager extends EventEmitter {
	private lines: string[] = [];

	public log(msg: string): void {
		this.lines.push(msg);
		if (this.lines.length > MAX_DEBUG_LINES) {
			this.lines.shift();
		}
		this.emit('logUpdated');
	}

	public read(): string[] {
		return [...this.lines];
	}
}

export const debug = new DebugManager();
