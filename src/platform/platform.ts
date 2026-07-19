import { BUILD_INFO } from '../build-info.generated';

type PokiSDK = {
	init: () => Promise<void>;
	gameLoadingFinished: () => void;
	gameplayStart: () => void;
	gameplayStop: () => void;
	commercialBreak: (pauseHandler?: () => void) => Promise<void>;
	rewardedBreak: (options?: { size?: string }) => Promise<boolean>;
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
		requestAd: (type: 'midgame' | 'rewarded') => Promise<void>;
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

let isInitialized = false;

export const getPlatformChannel = (): string => BUILD_INFO.channel;

/** True when this build embeds a portal SDK script (poki / crazygames). */
export const hasPortalSdk = (): boolean => {
	return BUILD_INFO.channel === 'poki' || BUILD_INFO.channel === 'crazygames';
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

/** Call once when the first playable scene is ready. */
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
	if (BUILD_INFO.channel === 'poki') {
		window.PokiSDK?.gameplayStart();
		return;
	}

	if (BUILD_INFO.channel === 'crazygames') {
		window.CrazyGames?.SDK.game.gameplayStart();
	}
};

export const platformGameplayStop = (): void => {
	if (BUILD_INFO.channel === 'poki') {
		window.PokiSDK?.gameplayStop();
		return;
	}

	if (BUILD_INFO.channel === 'crazygames') {
		window.CrazyGames?.SDK.game.gameplayStop();
	}
};
