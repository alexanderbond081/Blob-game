import { Ticker } from 'pixi.js';

declare global {
	function delay(ms: number): Promise<void>;
	function gameDelay(ms: number): Promise<void>;
}

let gameDelayTicker: Ticker | null = null;
let gameDelayIsPaused: () => boolean = () => false;

const delay = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

const gameDelay = (ms: number): Promise<void> => {
	if (ms <= 0) {
		return Promise.resolve();
	}

	const ticker = gameDelayTicker ?? Ticker.shared;

	return new Promise((resolve) => {
		let elapsed = 0;

		const tick = (currentTicker: Ticker): void => {
			if (gameDelayIsPaused()) {
				return;
			}

			elapsed += currentTicker.deltaMS;

			if (elapsed >= ms) {
				ticker.remove(tick);
				resolve();
			}
		};

		ticker.add(tick);
	});
};

/** Wire gameDelay to the app ticker; call once after Application.init(). */
export const bindGameDelayTicker = (ticker: Ticker): void => {
	gameDelayTicker = ticker;
};

/** Optional hook for explicit game pause; defaults to never paused. */
export const setGameDelayPaused = (isPaused: () => boolean): void => {
	gameDelayIsPaused = isPaused;
};

if (typeof globalThis.delay !== 'function') {
	globalThis.delay = delay;
}

globalThis.gameDelay = gameDelay;

export { };
