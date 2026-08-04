import { BUILD_INFO } from '../build-info.generated';
import { SoundManager } from '../managers/sound-manager';

type PokiSDK = {
	init: () => Promise<void>;
	gameLoadingFinished: () => void;
	gameplayStart: () => void;
	gameplayStop: () => void;
	/** pauseHandler runs only when an ad actually starts (not on empty breaks). */
	commercialBreak: (pauseHandler?: () => void) => Promise<void>;
	rewardedBreak: (
		optionsOrPause?: (() => void) | { size?: string; onStart?: () => void },
	) => Promise<boolean>;
	movePill: (topPercent: number, topPx?: number) => void;
};

type CrazyGamesAdCallbacks = {
	adStarted?: () => void;
	adFinished?: () => void;
	adError?: (error: unknown) => void;
};

type CrazyGamesSDK = {
	init: () => Promise<void>;
	environment: string;
	game: {
		loadingStart: () => void;
		loadingStop: () => void;
		gameplayStart: () => void;
		gameplayStop: () => void;
	};
	ad: {
		requestAd: (type: 'midgame' | 'rewarded', callbacks?: CrazyGamesAdCallbacks) => void;
	};
};

declare global {
	interface Window {
		PokiSDK?: PokiSDK;
		CrazyGames?: {
			SDK: CrazyGamesSDK;
		};
	}
}

/** Host hooks so the coordinator can freeze/unfreeze the game with the platform. */
export type PlatformHooks = {
	onPause?: () => void;
	onResume?: () => void;
};

/**
 * Everything that forces the game to stand still is platform-driven: a portal ad
 * covering the frame, or the page being hidden. Both suspend the same resources,
 * so they are arbitrated here as a reason set instead of by each consumer.
 */
type PlatformPauseReason = 'ad' | 'hidden';

let isInitialized = false;
/** Mirrors the portal gameplay session; guards against double start/stop. */
let isInGameplay = false;
let isAdRunning = false;
let hooks: PlatformHooks = {};
const pauseReasons = new Set<PlatformPauseReason>();

export const getPlatformChannel = (): string => BUILD_INFO.channel;

/** True when this build embeds a portal SDK script (poki / crazygames). */
export const hasPortalSdk = (): boolean => {
	return BUILD_INFO.channel === 'poki' || BUILD_INFO.channel === 'crazygames';
};

/** Poki renders its own fullscreen control in the portal frame; ours would duplicate it. */
export const isFullscreenControlAllowed = (): boolean => BUILD_INFO.channel !== 'poki';

export const isGameplaySessionActive = (): boolean => isInGameplay;

export const isPlatformPaused = (): boolean => pauseReasons.size > 0;

export const setPlatformHooks = (nextHooks: PlatformHooks): void => {
	hooks = nextHooks;

	// A host registering after boot must not miss an already active pause.
	if (isPlatformPaused()) {
		hooks.onPause?.();
	}
};

/**
 * Initialize portal SDK for the current build channel.
 * itch / local / release: no-op (no portal scripts in HTML).
 */
export const initPlatform = async (): Promise<void> => {
	if (isInitialized) {
		return;
	}

	isInitialized = true;
	bindVisibilityPause();

	if (BUILD_INFO.channel === 'poki') {
		try {
			if (window.PokiSDK) {
				await window.PokiSDK.init();
			} else {
				console.warn('[platform] PokiSDK script missing');
			}
		} catch (error) {
			console.warn('[platform] PokiSDK.init failed, continuing', error);
		}
		return;
	}

	if (BUILD_INFO.channel === 'crazygames') {
		try {
			if (window.CrazyGames?.SDK) {
				await window.CrazyGames.SDK.init();
				window.CrazyGames.SDK.game.loadingStart();
			} else {
				console.warn('[platform] CrazyGames.SDK script missing');
			}
		} catch (error) {
			console.warn('[platform] CrazyGames.SDK.init failed, continuing', error);
		}
	}
};

/** Call once when the menu is interactive and the loading screen is gone. */
export const platformLoadingFinished = (): void => {
	if (BUILD_INFO.channel === 'poki') {
		window.PokiSDK?.gameLoadingFinished();
		return;
	}

	if (BUILD_INFO.channel === 'crazygames') {
		window.CrazyGames?.SDK.game.loadingStop();
	}
};

export const platformGameplayStart = (): void => {
	if (isInGameplay) {
		return;
	}

	isInGameplay = true;

	if (BUILD_INFO.channel === 'poki') {
		window.PokiSDK?.gameplayStart();
		return;
	}

	if (BUILD_INFO.channel === 'crazygames') {
		window.CrazyGames?.SDK.game.gameplayStart();
	}
};

export const platformGameplayStop = (): void => {
	if (!isInGameplay) {
		return;
	}

	isInGameplay = false;

	if (BUILD_INFO.channel === 'poki') {
		window.PokiSDK?.gameplayStop();
		return;
	}

	if (BUILD_INFO.channel === 'crazygames') {
		window.CrazyGames?.SDK.game.gameplayStop();
	}
};

/**
 * Interstitial before entering gameplay (play / resume / continue / restart).
 * Call while the game is already stopped / on a loading screen — not after the
 * level is live. Audio suspends only if an ad actually starts (Poki pauseHandler /
 * CrazyGames adStarted); empty breaks are silent no-ops on local/itch.
 * Always resolves: a missing or failing SDK must not block the transition.
 */
export const platformCommercialBreak = async (): Promise<void> => {
	if (isAdRunning) {
		return;
	}

	isAdRunning = true;

	try {
		if (BUILD_INFO.channel === 'poki' && window.PokiSDK) {
			await window.PokiSDK.commercialBreak(() => {
				beginAdBreak();
			});
		} else if (BUILD_INFO.channel === 'crazygames' && window.CrazyGames?.SDK) {
			await requestCrazyGamesAd('midgame');
		}
	} catch (error) {
		console.warn('[platform] commercialBreak failed', error);
	} finally {
		endAdBreak();
		isAdRunning = false;
	}
};

/** Opt-in reward ad. Resolves true only when the reward was actually earned. */
export const platformRewardedBreak = async (): Promise<boolean> => {
	if (isAdRunning) {
		return false;
	}

	isAdRunning = true;
	let rewarded = false;

	try {
		if (BUILD_INFO.channel === 'poki' && window.PokiSDK) {
			rewarded = await window.PokiSDK.rewardedBreak(() => {
				beginAdBreak();
			});
		} else if (BUILD_INFO.channel === 'crazygames' && window.CrazyGames?.SDK) {
			await requestCrazyGamesAd('rewarded');
			rewarded = true;
		}
	} catch (error) {
		console.warn('[platform] rewardedBreak failed', error);
		rewarded = false;
	} finally {
		endAdBreak();
		isAdRunning = false;
	}

	return rewarded;
};

/** Shift the Poki pill so it does not overlap our HUD on mobile. No-op elsewhere. */
export const platformMovePill = (topPercent: number, topPx: number = 0): void => {
	if (BUILD_INFO.channel !== 'poki') {
		return;
	}

	try {
		window.PokiSDK?.movePill(topPercent, topPx);
	} catch (error) {
		console.warn('[platform] movePill failed', error);
	}
};

/** Only when an ad is actually on screen — empty commercialBreak must not call this. */
const beginAdBreak = (): void => {
	platformGameplayStop();
	setPauseReason('ad', true);
};

/** Safe if beginAdBreak never ran (no-op when 'ad' is not in the reason set). */
const endAdBreak = (): void => {
	setPauseReason('ad', false);
};

/**
 * Window blur alone is deliberately ignored: the game keeps running while its
 * window stays visible but unfocused (multi-monitor / Poki iframe focus).
 */
const bindVisibilityPause = (): void => {
	const syncVisibility = (): void => {
		setPauseReason('hidden', document.visibilityState === 'hidden');
	};

	document.addEventListener('visibilitychange', syncVisibility);
	syncVisibility();
};

const setPauseReason = (reason: PlatformPauseReason, active: boolean): void => {
	const wasPaused = isPlatformPaused();

	if (active) {
		pauseReasons.add(reason);
	} else {
		pauseReasons.delete(reason);
	}

	const paused = isPlatformPaused();

	if (paused === wasPaused) {
		return;
	}

	SoundManager.setSuspended(paused);

	if (paused) {
		hooks.onPause?.();
	} else {
		hooks.onResume?.();
	}
};

const requestCrazyGamesAd = (type: 'midgame' | 'rewarded'): Promise<void> => {
	return new Promise((resolve, reject) => {
		window.CrazyGames?.SDK.ad.requestAd(type, {
			adStarted: () => {
				beginAdBreak();
			},
			adFinished: () => resolve(),
			adError: (error: unknown) => reject(error),
		});
	});
};
