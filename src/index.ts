import { Application, Container, Graphics, Assets, Filter } from 'pixi.js';
import * as PIXI from 'pixi.js';

import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';

import { Scene } from './scenes/scene';
import { LoadingScene } from './scenes/loading-scene';
import { MainMenuScene } from './scenes/main-menu-scene';
import { findGameScene, MAIN_MENU_SCENE_ID } from './managers/scenes-catalog';
import { logBuildInfo } from './version';
import { initPlatform, platformCommercialBreak, platformGameplayStart, platformGameplayStop, platformLoadingFinished, setPlatformHooks } from './platform/platform';

import './global-delay';
import { GameHUD } from './hud/game-hud';
import { SoundManager } from './managers/sound-manager';
import { bindGameDelayTicker, setGameDelayPaused } from './global-delay';

Filter.defaultOptions.resolution = 'inherit';
gsap.registerPlugin(PixiPlugin);
PixiPlugin.registerPIXI(PIXI);

const app = new Application();
const gameHUD = new GameHUD();

const viewRoot = new Container();
const viewMask = new Graphics();
const gameLayer = new Container();
const hudLayer = new Container();
const uiOverlay = new Container();
const fadeRect = new Graphics();
uiOverlay.addChild(fadeRect);

/** Design resolution (16:9). Scaled with contain to fill the host iframe/window. */
let gameWidth = 960;
let gameHeight = 540;

let currentScene: Scene | null = null;
let gameSceneAssets: string = '';
let isSwitchingScene = false;
/** Scene catalog id of the level currently in play (for Restart). */
let currentPlaySceneId: string | null = null;

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

	app.renderer.resolution = dpr;
	app.renderer.resize(clientWidth, clientHeight);

	const scale = Math.min(
		clientWidth / gameWidth,
		clientHeight / gameHeight,
	);

	app.stage.scale.set(scale);
	app.stage.x = (clientWidth - gameWidth * scale) * 0.5;
	app.stage.y = (clientHeight - gameHeight * scale) * 0.5;

	viewMask.clear().rect(0, 0, gameWidth, gameHeight).fill(0xffffff);
};

const applyResponsiveLayout = (): void => {
	// !! to be implemented
	//app.renderer.resize(gameWidth, gameHeight);
	//currentScene?.resize(gameWidth, gameHeight);
	//gameHUD.resize(gameWidth, gameHeight);
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

async function initGame(): Promise<void> {
	logBuildInfo();
	// Audio settings and pause hooks must exist before the platform starts
	// reporting visibility, otherwise the very first state change is lost.
	SoundManager.init();
	bindPlatformPause();
	await initPlatform();
	bindViewportListeners();

	await app.init({
		background: '0x222222',
		width: gameWidth,
		height: gameHeight,
		antialias: false,
		autoDensity: true,
		resolution: window.devicePixelRatio || 1,
	});
	bindGameDelayTicker(app.ticker);
	setGameDelayPaused(isGamePaused);
	document.body.appendChild(app.canvas);
	suppressBrowserTouchChrome(app.canvas);
	applyStageScale();

	viewMask.rect(0, 0, gameWidth, gameHeight).fill(0xffffff);
	viewRoot.addChild(viewMask);
	viewRoot.mask = viewMask;
	viewRoot.addChild(gameLayer);
	viewRoot.addChild(hudLayer);
	viewRoot.addChild(uiOverlay);
	app.stage.addChild(viewRoot);
	initFadeEffect();

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
	hudLayer.visible = false;
	// show logo
	await Assets.loadBundle('preload');
	const loadCommonPromise = Assets.loadBundle('common');
	await Promise.all([loadCommonPromise, delay(1000)]);
	// no progress bar durin loading 'common', because there is no main menu and login screen yet

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

/** Swap the active asset bundle. The previous scene must already be destroyed. */
async function swapAssetBundle(bundleName: string): Promise<void> {
	if (gameSceneAssets === bundleName) {
		return;
	}

	if (gameSceneAssets) {
		await Assets.unloadBundle(gameSceneAssets);
		gameSceneAssets = '';
	}

	await Assets.loadBundle(bundleName);
	gameSceneAssets = bundleName;
}

async function showLoadingScene(): Promise<void> {
	await changeScene(new LoadingScene(), false);
}

async function showMainMenu(): Promise<void> {
	const entry = findGameScene(MAIN_MENU_SCENE_ID);

	if (!entry) {
		console.error('showMainMenu: main menu is missing from the scene catalog');
		return;
	}

	currentPlaySceneId = null;
	platformGameplayStop();

	await showLoadingScene();
	await swapAssetBundle(entry.assetBundle);
	await initHUD();
	gameHUD.setProfile('menu');

	const menuScene = entry.createScene() as MainMenuScene;
	menuScene.on('play-level', (sceneId: string) => {
		void startLevel(sceneId);
	});

	await changeScene(menuScene, true);
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
	platformGameplayStop();

	try {
		// Break on the loading screen — before the level is mounted / unfrozen.
		await showLoadingScene();
		await platformCommercialBreak();
		await swapAssetBundle(entry.assetBundle);
		await initHUD();
		gameHUD.setProfile('gameplay');
		currentPlaySceneId = sceneId;
		await changeScene(entry.createScene(), true);
		platformGameplayStart();
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

async function changeScene(newScene: Scene, showHud: boolean = false): Promise<void> {
	if (currentScene) {
		const promiseFadeIsOn = fadeEffect(500, true);
		const promiseSceneInit = newScene.init();
		await Promise.all([promiseFadeIsOn, promiseSceneInit]);
		hudLayer.visible = showHud;

		gameLayer.removeChild(currentScene);
		gameLayer.addChild(newScene);

		const fadeIsOff = fadeEffect(500, false);
		currentScene.destroy({ children: true });
		currentScene = newScene;
		await fadeIsOff;

	} else {
		await newScene.init();
		gameLayer.addChild(newScene);
		currentScene = newScene;
		await fadeEffect(100, false, 0x00);
	}
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
}

function initFadeEffect(): void {
	fadeRect.rect(0, 0, gameWidth, gameHeight).fill(0xffffff);
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

	if (event.code === 'KeyF') {
		event.preventDefault();
		if (event.repeat) return;
		void toggleFullscreen();
		return;
	}

	if (isGamePaused() || gameHUD.isModalOpen()) {
		return;
	}

	// Gameplay input is handled by active scene entities (e.g. Player).
}

initGame().catch((err) => console.error("Game crash:", err));
