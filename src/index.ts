import { Application, Container, Graphics, Assets, Filter } from 'pixi.js';
import * as PIXI from 'pixi.js';

import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';

import { Scene } from './scenes/scene';
import { LoadingScene } from './scenes/loading-scene';
import { MainMenuScene } from './scenes/main-menu-scene';
import { findGameScene } from './managers/scenes-catalog';
import { GameProgress } from './managers/game-progress';
import { LevelExitEvent, PlatformLevelScene } from './scenes/platform-level-scene';
import { logBuildInfo } from './version';
import { initPlatform, platformCommercialBreak, platformGameplayStart, platformGameplayStop, platformLoadingFinished, setPlatformHooks, syncPageVisibility } from './platform/platform';

import './global-delay';
import { GameHUD } from './hud/game-hud';
import { SoundManager } from './managers/sound-manager';
import { bindGameDelayTicker, setGameDelayPaused } from './global-delay';
import { startInputModeTracking } from './input/input-mode';
import { computeGameView, getGameView, setGameView } from './world/game-view';

Filter.defaultOptions.resolution = 'inherit';
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

const app = new Application();
const gameHUD = new GameHUD();

const viewRoot = new Container();
const gameLayer = new Container();
const hudLayer = new Container();
const uiOverlay = new Container();
const fadeRect = new Graphics();
uiOverlay.addChild(fadeRect);

let currentScene: Scene | null = null;
let gameSceneAssets: string = '';
let isSwitchingScene = false;
/** Scene catalog id of the level currently in play (for Restart). */
let currentPlaySceneId: string | null = null;
/** After level-clear modal: next scene to load on Continue (null → menu). */
let pendingResultNextSceneId: string | null = null;
/** Level that was just cleared (Restart from result modal). */
let pendingResultLevelId: string | null = null;

/** Global scene pause (ticker + input) during bootstrap/load / future UI pause. */
let isPaused = true;
/** Ad break or hidden page; both are arbitrated by the platform layer. */
let isPlatformPaused = false;

const isGamePaused = (): boolean => isPaused || isPlatformPaused;

const getClientSize = (): { width: number; height: number } => {
	const visualViewport = window.visualViewport;
	return {
		width: visualViewport?.width ?? document.documentElement.clientWidth,
		height: visualViewport?.height ?? document.documentElement.clientHeight,
	};
};

const applyStageScale = (): void => {
	const dpr = window.devicePixelRatio || 1;
	const { width: clientWidth, height: clientHeight } = getClientSize();
	const layout = computeGameView(clientWidth, clientHeight);
	setGameView(layout);
	Scene.setPlayfield(layout.viewWidth, layout.viewHeight);

	app.renderer.resolution = dpr;
	app.renderer.resize(clientWidth, clientHeight);

	viewRoot.scale.set(layout.scale);
	viewRoot.x = layout.offsetX;
	viewRoot.y = layout.offsetY;

	hudLayer.scale.set(layout.scale);
	hudLayer.x = 0;
	hudLayer.y = 0;

	uiOverlay.scale.set(layout.scale);
	uiOverlay.x = 0;
	uiOverlay.y = 0;

	fadeRect.clear().rect(0, 0, layout.screenWidth, layout.screenHeight).fill(0xffffff);

	currentScene?.resize(layout.viewWidth, layout.viewHeight);
	gameHUD.layoutToScreen(layout.screenWidth, layout.screenHeight);
};

const isFullscreen = (): boolean => {
	return document.fullscreenElement !== null;
};

const toggleFullscreen = async (): Promise<void> => {
	try {
		if (!isFullscreen()) {
			await document.documentElement.requestFullscreen();
		} else {
			await document.exitFullscreen();
		}
	} catch (error) {
		console.warn('toggleFullscreen: not available', error);
	} finally {
		gameHUD.syncFullscreenButton(isFullscreen());
		applyStageScale();
	}
};

const bindViewportListeners = (): void => {
	const onViewportChange = (): void => {
		applyStageScale();
	};

	window.addEventListener('resize', onViewportChange);
	window.addEventListener('orientationchange', () => {
		requestAnimationFrame(onViewportChange);
		setTimeout(onViewportChange, 100);
		setTimeout(onViewportChange, 300);
	});
	window.visualViewport?.addEventListener('resize', onViewportChange);
	window.visualViewport?.addEventListener('scroll', onViewportChange);
	document.addEventListener('fullscreenchange', () => {
		gameHUD.syncFullscreenButton(isFullscreen());
		onViewportChange();
	});
};

/** Freeze the game whenever the platform says so (ad on screen / page hidden). */
const bindPlatformPause = (): void => {
	setPlatformHooks({
		onPause: () => {
			isPlatformPaused = true;
			gsap.globalTimeline.pause();
		},
		onResume: () => {
			isPlatformPaused = false;
			gsap.globalTimeline.resume();
			gsap.ticker.wake();
		},
	});
};

/** Block long-press text selection / callout / vibration on mobile browsers. */
const suppressBrowserTouchChrome = (canvas: HTMLCanvasElement): void => {
	const prevent = (event: Event): void => {
		event.preventDefault();
	};

	document.addEventListener('contextmenu', prevent);
	canvas.addEventListener('contextmenu', prevent);
	canvas.addEventListener('selectstart', prevent);
	// passive: false is required for preventDefault to cancel iOS long-press.
	canvas.addEventListener('touchstart', prevent, { passive: false });
	canvas.addEventListener('touchmove', prevent, { passive: false });
};

/**
 * If Chrome/Safari dropped `visibilitychange` after a long freeze, the first
 * tap still reaches HUD. Re-sync `hidden` only — HUD Pause stays if it was open.
 */
const bindPlatformWakeOnInput = (canvas: HTMLCanvasElement): void => {
	const wakeIfVisible = (): void => {
		if (document.visibilityState === 'visible') {
			syncPageVisibility();
		}
	};

	canvas.addEventListener('pointerdown', wakeIfVisible, { capture: true, passive: true });
	canvas.addEventListener('touchstart', wakeIfVisible, { capture: true, passive: true });
};



// ---- methods implementation ---- (do not touch my comments!!!)

async function initGame(): Promise<void> {
	logBuildInfo();
	// Audio settings and pause hooks must exist before the platform starts
	// reporting visibility, otherwise the very first state change is lost.
	SoundManager.init();
	const progress = GameProgress.load();
	applyProgressAudioSettings(progress);
	bindPlatformPause();
	await initPlatform();
	bindViewportListeners();

	await app.init({
		background: '0x222222',
		width: getGameView().viewWidth,
		height: getGameView().viewHeight,
		antialias: false,
		autoDensity: true,
		resolution: window.devicePixelRatio || 1,
	});
	bindGameDelayTicker(app.ticker);
	setGameDelayPaused(isGamePaused);
	const gameContainer = document.getElementById('game-container');
	if (!gameContainer) {
		throw new Error('Missing #game-container');
	}

	gameContainer.appendChild(app.canvas);
	suppressBrowserTouchChrome(app.canvas);
	bindPlatformWakeOnInput(app.canvas);
	startInputModeTracking();

	viewRoot.addChild(gameLayer);
	app.stage.addChild(viewRoot);
	app.stage.addChild(hudLayer);
	app.stage.addChild(uiOverlay);
	initFadeEffect();
	applyStageScale();

	await Assets.init({ manifest: 'assets/manifest.json' });

	app.ticker.add((ticker) => {
		if (isGamePaused()) {
			return;
		}

		if (currentScene) {
			currentScene.update(ticker.deltaTime);
		}
	});

	isPaused = true;

	// show logo and loading screen
	await preload();
	await initHUD();
	applyStageScale();

	// setup keys and window focus - the app works fine without it
	//app.canvas.setAttribute('tabindex', '0');
	//app.canvas.focus();

	window.addEventListener('keydown', onKeyDown);

	await showMainMenu();

	// Poki counts the game as loaded once the menu is interactive; gameplayStart
	// belongs to the level transition, not to boot.
	platformLoadingFinished();

	isPaused = false;
}

async function changeScene(newScene: Scene, bundleName: string = '', doThings?: () => void): Promise<void> {
	if (currentScene) {
		// fade out and load new assets bundle
		const promiseFadeIsOn = fadeEffect(500, true);

		if (gameSceneAssets === bundleName) {
			bundleName = '';
		}

		let oldSceneAssets = '';
		if (bundleName) {
			await Assets.loadBundle(bundleName);
			oldSceneAssets = gameSceneAssets;
			gameSceneAssets = bundleName;
		}

		const promiseSceneInit = newScene.init();
		await Promise.all([promiseFadeIsOn, promiseSceneInit]);

		// change scenes and do things while it is dark
		//hudLayer.visible = showHud;
		gameLayer.removeChild(currentScene);
		doThings?.();
		gameLayer.addChild(newScene);

		// fade out and unload old assets bundle
		const fadeIsOff = fadeEffect(500, false);
		currentScene.destroy({ children: true });
		currentScene = newScene;
		const view = getGameView();
		newScene.resize(view.viewWidth, view.viewHeight);

		// !!! assets unload temporary turned off!
		oldSceneAssets = ''; // !!! assets unload temporary turned off!

		const oldBundleUnloaded = oldSceneAssets
			? Assets.unloadBundle(oldSceneAssets)
			: Promise.resolve();

		const promiseFadeIsOff = fadeIsOff;
		await Promise.all([promiseFadeIsOff, oldBundleUnloaded]);

	} else {
		// the very first screen load
		if (bundleName) {
			await Assets.loadBundle(bundleName);
			gameSceneAssets = bundleName;
		}

		await newScene.init();
		doThings?.();
		gameLayer.addChild(newScene);
		currentScene = newScene;
		const view = getGameView();
		newScene.resize(view.viewWidth, view.viewHeight);
		await fadeEffect(100, false, 0x00);
	}
}

async function preload(): Promise<void> {
	hudLayer.visible = false;

	await Assets.loadBundle('preload');
	const loadingScene = new LoadingScene();
	await changeScene(loadingScene);
	await Assets.loadBundle(['sounds', 'ui-elements', 'game'], p => loadingScene.onProgress(p * 0.9 + 0.1));
}

async function showMainMenu(): Promise<void> {

	currentPlaySceneId = null;
	pendingResultNextSceneId = null;
	pendingResultLevelId = null;
	platformGameplayStop();
	gameHUD.closeResultModal();
	gameHUD.closeProgressModal();
	gameHUD.closeCustomizeModal();

	const menuScene = new MainMenuScene;
	menuScene.on('play-level', (sceneId: string) => {
		void startLevel(sceneId);
	});
	menuScene.on('open-progress', () => {
		void gameHUD.openProgressModal();
	});
	menuScene.on('open-customize', () => {
		void gameHUD.openCustomizeModal();
	});

	await changeScene(menuScene, 'main-menu-scene', () => {
		gameHUD.setProfile('menu');
		hudLayer.visible = true;
	});
}

async function startLevel(sceneId: string): Promise<void> {
	if (isSwitchingScene) {
		return;
	}

	const entry = findGameScene(sceneId);

	if (!entry) {
		console.error(`startLevel: unknown scene id "${sceneId}"`);
		return;
	}

	isSwitchingScene = true;
	isPaused = true;
	gameHUD.closePauseModal();
	gameHUD.closeResultModal();
	platformGameplayStop();

	try {
		await platformCommercialBreak();
		currentPlaySceneId = sceneId;
		GameProgress.shared.setLastPlayed(sceneId);
		GameProgress.shared.save();
		const levelScene = entry.createScene() as PlatformLevelScene;
		levelScene.on('level-exit', (payload: LevelExitEvent) => {
			isPaused = true;
			platformGameplayStop();
			void handleLevelExit(payload);
		});
		await changeScene(levelScene, entry.assetBundle, () => {
			gameHUD.setProfile('gameplay');
			hudLayer.visible = true;
		});

		platformGameplayStart();
	} finally {
		isPaused = false;
		isSwitchingScene = false;
	}
}

async function handleLevelExit(payload: LevelExitEvent): Promise<void> {
	if (isSwitchingScene) {
		return;
	}

	const nextSceneId = GameProgress.shared.applyLevelExit(
		payload.levelId,
		payload.collected,
		payload.timeSec,
	);
	pendingResultNextSceneId = nextSceneId;
	pendingResultLevelId = payload.levelId;

	isPaused = true;
	gameHUD.closePauseModal();
	await gameHUD.openResultModal({
		collected: payload.collected,
		totalFireflies: payload.totalFireflies,
		timeSec: payload.timeSec,
		deaths: payload.deaths,
	}, {
		demoComplete: nextSceneId === null,
	});
}

async function continueFromResult(): Promise<void> {
	if (isSwitchingScene || !gameHUD.isModalOpen()) {
		return;
	}

	const nextSceneId = pendingResultNextSceneId;
	pendingResultNextSceneId = null;
	pendingResultLevelId = null;
	gameHUD.closeResultModal();

	if (nextSceneId) {
		await startLevel(nextSceneId);
		return;
	}

	isSwitchingScene = true;
	isPaused = true;

	try {
		await showMainMenu();
	} finally {
		isPaused = false;
		isSwitchingScene = false;
	}
}

async function homeFromResult(): Promise<void> {
	if (isSwitchingScene) {
		return;
	}

	pendingResultNextSceneId = null;
	pendingResultLevelId = null;
	gameHUD.closeResultModal();

	isSwitchingScene = true;
	isPaused = true;

	try {
		await showMainMenu();
	} finally {
		isPaused = false;
		isSwitchingScene = false;
	}
}

async function restartFromResult(): Promise<void> {
	const levelId = pendingResultLevelId ?? currentPlaySceneId;
	pendingResultNextSceneId = null;
	pendingResultLevelId = null;
	gameHUD.closeResultModal();

	if (!levelId) {
		return;
	}

	await startLevel(levelId);
}

const applyProgressAudioSettings = (progress: GameProgress): void => {
	const { musicMuted, sfxMuted } = progress.settings;
	SoundManager.setMusicMuted(musicMuted);
	SoundManager.setSfxMuted(sfxMuted);
	gameHUD.syncAudioButtonFrames();
};

async function resetProgressDebug(): Promise<void> {
	if (isSwitchingScene) {
		return;
	}

	GameProgress.shared.resetToDefaults();
	applyProgressAudioSettings(GameProgress.shared);

	pendingResultNextSceneId = null;
	pendingResultLevelId = null;
	isSwitchingScene = true;
	isPaused = true;
	gameHUD.closePauseModal();
	gameHUD.closeResultModal();

	try {
		await showMainMenu();
	} finally {
		isPaused = false;
		isSwitchingScene = false;
	}
}

async function openPause(): Promise<void> {
	if (isSwitchingScene || gameHUD.activeProfile !== 'gameplay' || gameHUD.isModalOpen()) {
		return;
	}

	isPaused = true;
	platformGameplayStop();
	await gameHUD.openPauseModal();
}

async function resumeFromPause(): Promise<void> {
	if (!gameHUD.isModalOpen()) {
		return;
	}

	gameHUD.closePauseModal();
	isPaused = true;
	await platformCommercialBreak();
	platformGameplayStart();
	isPaused = false;
}

async function leaveToMenuFromPause(): Promise<void> {
	if (isSwitchingScene) {
		return;
	}

	isSwitchingScene = true;
	isPaused = true;
	gameHUD.closePauseModal();

	try {
		await showMainMenu();
	} finally {
		isPaused = false;
		isSwitchingScene = false;
	}
}

async function restartFromPause(): Promise<void> {
	if (!currentPlaySceneId) {
		return;
	}

	await startLevel(currentPlaySceneId);
}

async function initHUD(): Promise<void> {
	await gameHUD.init();

	if (!hudLayer.children.includes(gameHUD)) {
		hudLayer.addChild(gameHUD);
	}

	connectFullscreenControl();
	connectPauseControls();
}

function connectFullscreenControl(): void {
	gameHUD.off('toggle-fullscreen');
	gameHUD.on('toggle-fullscreen', () => {
		void toggleFullscreen();
	});
}

function connectPauseControls(): void {
	gameHUD.off('request-pause');
	gameHUD.off('pause-resume');
	gameHUD.off('pause-home');
	gameHUD.off('pause-restart');
	gameHUD.off('result-continue');
	gameHUD.off('result-home');
	gameHUD.off('result-restart');

	gameHUD.on('request-pause', () => {
		void openPause();
	});
	gameHUD.on('pause-resume', () => {
		void resumeFromPause();
	});
	gameHUD.on('pause-home', () => {
		void leaveToMenuFromPause();
	});
	gameHUD.on('pause-restart', () => {
		void restartFromPause();
	});
	gameHUD.on('result-continue', () => {
		void continueFromResult();
	});
	gameHUD.on('result-home', () => {
		void homeFromResult();
	});
	gameHUD.on('result-restart', () => {
		void restartFromResult();
	});
}

function initFadeEffect(): void {
	const view = getGameView();
	fadeRect.clear().rect(0, 0, view.screenWidth, view.screenHeight).fill(0xffffff);
	fadeRect.tint = 0x000000;
	fadeRect.alpha = 1;
	fadeRect.interactive = true;
}

async function fadeEffect(durationMs: number, fadeOut: boolean, color: number = 0x222222): Promise<void> {
	gsap.killTweensOf(fadeRect);
	fadeRect.tint = color;
	fadeRect.visible = true;

	await gsap.to(fadeRect, {
		pixi: { alpha: fadeOut ? 1 : 0 },
		duration: durationMs / 1000,
	});

	if (!fadeOut) {
		fadeRect.visible = false;
	}
}

const SCROLL_KEYS = ['Space', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'];

function onKeyDown(event: KeyboardEvent): void {
	// Keep the host page from scrolling while the game owns these keys.
	if (SCROLL_KEYS.includes(event.code)) {
		event.preventDefault();
	}

	if (event.code === 'Escape') {
		event.preventDefault();
		if (event.repeat) {
			return;
		}

		if (gameHUD.closeTopModal()) {
			return;
		}

		if (gameHUD.activeProfile === 'gameplay' && !isSwitchingScene) {
			void openPause();
		}
		return;
	}

	if (event.code === 'Enter' || event.code === 'NumpadEnter') {
		event.preventDefault();
		if (event.repeat) {
			return;
		}

		if (gameHUD.acceptPrimaryAction()) {
			return;
		}
	}

	if (event.code === 'KeyF') {
		event.preventDefault();
		if (event.repeat) return;
		void toggleFullscreen();
		return;
	}

	if (event.code === 'KeyR' && event.altKey && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
		event.preventDefault();
		if (event.repeat) {
			return;
		}

		void resetProgressDebug();
		return;
	}

	if (isGamePaused() || gameHUD.isModalOpen()) {
		return;
	}

	// Gameplay input is handled by active scene entities (e.g. Player).
}

initGame().catch((err) => console.error("Game crash:", err));
