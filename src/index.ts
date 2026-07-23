import { Application, Container, Graphics, Assets, Filter } from 'pixi.js';
import * as PIXI from 'pixi.js';

import { gsap } from 'gsap';
import { PixiPlugin } from 'gsap/PixiPlugin';

import { Scene } from './scenes/scene';
import { LoadingScene } from './scenes/loading-scene';
import { GameSceneCatalogEntry, gameSceneCatalog } from './managers/scenes-catalog';
import { logBuildInfo } from './version';
import { initPlatform, platformGameplayStart, platformLoadingFinished } from './platform/platform';

import './global-delay';
import { GameHUD } from './hud/game-hud';
import { SoundManager } from './managers/sound-manager';
import { bindGameDelayTicker } from './global-delay';

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

/** Global scene pause (ticker + input) during bootstrap/load. */
let isPaused = true;

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
	await initPlatform();
	SoundManager.init();
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
		if (isPaused) return;

		if (currentScene) {
			currentScene.update(ticker.deltaTime);
		}
	});

	isPaused = true;

	// show logo
	await Assets.loadBundle('preload');
	const loadCommonPromise = Assets.loadBundle('common');
	await Promise.all([loadCommonPromise, delay(1000)]);
	// no progress bar durin loading 'common', because there is no main menu and login screen yet

	// load main game scene
	await loadGameScene('main-scene');
	platformLoadingFinished();
	platformGameplayStart();

	// setup keys and window focus - the app works fine without it
	//app.canvas.setAttribute('tabindex', '0');
	//app.canvas.focus();

	window.addEventListener('keydown', onKeyDown);

	isPaused = false;
}

async function loadGameScene(sceneId: string): Promise<void> {
	const entry = gameSceneCatalog.find((catalogEntry) => catalogEntry.id === sceneId);

	if (!entry) {
		console.error(`loadGameScene: unknown scene id "${sceneId}"`);
		return;
	}

	const loadingScene = new LoadingScene();
	await changeScene(loadingScene);
	if (gameSceneAssets) {
		await Assets.unloadBundle(gameSceneAssets);
		gameSceneAssets = '';
	}

	gameSceneAssets = entry.assetBundle;
	await Assets.loadBundle(entry.assetBundle);

	await initHUD();

	const gameScene = createGameScene(entry);

	await changeScene(gameScene, true);
}

function createGameScene(entry: GameSceneCatalogEntry): Scene {
	const gameScene = entry.createScene();
	return gameScene;
}

async function changeScene(newScene: Scene, showHud: boolean = false): Promise<void> {
	if (currentScene) {
		const promiseFadeIsOn = fadeEffect(500, true);
		const promiseSceneInit = newScene.init();
		await Promise.all([promiseFadeIsOn, promiseSceneInit]);
		//hudLayer.visible = showHud; // !! disables yet

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
}

function connectFullscreenControl(): void {
	gameHUD.off('toggle-fullscreen');
	gameHUD.on('toggle-fullscreen', () => {
		void toggleFullscreen();
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

function onKeyDown(event: KeyboardEvent): void {
	if (event.code === 'Escape') {
		if (gameHUD.closeTopModal()) {
			event.preventDefault();
			return;
		}
	}

	if (event.code === 'KeyF') {
		event.preventDefault();
		if (event.repeat) return;
		void toggleFullscreen();
		return;
	}

	if (isPaused || gameHUD.isModalOpen()) return;

	// Gameplay input is handled by active scene entities (e.g. Player).
}

initGame().catch((err) => console.error("Game crash:", err));
