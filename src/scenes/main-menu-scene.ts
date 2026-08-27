import { Assets, Container, DestroyOptions, ParticleContainer, Sprite, Spritesheet, Texture } from 'pixi.js';

import { bindDebouncedTap } from '../components/debounced-tap';
import { HighlightDecoration } from '../components/highlight-decoration';
import { IdleBounceAnimator } from '../components/idle-bounce-animator';
import { LevelCarousel, CAROUSEL_BELOW_ARROW_OFFSET_Y } from '../components/level-carousel';
import { AnotherFly } from '../components/particle-fly';
import { UIButton } from '../components/ui-button';
import { GameProgress, isCarouselLevelPlayable } from '../managers/game-progress';
import { SoundManager } from '../managers/sound-manager';
import { Scene } from './scene';
import { getGameView } from '../world/game-view';

const PLAY_BUTTON_SIZE = 100;
const SIDE_BUTTON_SIZE = 68;
const MENU_FLY_COUNT = 10;

const LOGO_SCALE = 0.25;
const LOGO_X = 80;
const LOGO_Y = 8;

const CAROUSEL_CENTER_Y = 240;
const PLAY_BUTTON_Y = 462;
const SIDE_BUTTON_Y = 470;
const SIDE_BUTTON_MARGIN = 72;

const PORTRAIT_CAROUSEL_RATIO = 0.45;
const PORTRAIT_SIDE_BOTTOM_MARGIN = 72;
/** Match carousel 'below' arrow spacing (`TILE_STEP` = 165). */
const PORTRAIT_SIDE_SPREAD = 165;

/**
 * Menu hub: level carousel plus Play and the two meta-screen entries.
 * Emits `play-level` (scene id), `open-progress` and `open-customize`.
 */
export class MainMenuScene extends Scene {
	private background!: Sprite;
	private logo!: Sprite;
	private flies: AnotherFly[] = [];
	private fliesContainer!: ParticleContainer;
	private carousel!: LevelCarousel;
	private playButtonRoot!: Container;
	private playButton!: UIButton;
	private playBounce = new IdleBounceAnimator();
	private progressButton!: UIButton;
	private customizeButton!: UIButton;
	private isPlayEnabled = false;

	public async init(): Promise<void> {
		await this.addBackground();
		await this.addFlies();
		await this.addLogo();
		await this.addCarousel();
		await this.addPlayButton();
		await this.addSideButtons();

		window.addEventListener('keydown', this.onKeyDown);

		this.syncPlayButton();
		this.onResize();

		SoundManager.playMusic('bg-music');
	}

	public update(deltaTime: number): void {
		this.carousel?.update();

		for (const fly of this.flies) {
			fly.move(deltaTime);
		}
	}

	public override destroy(options?: DestroyOptions): void {
		window.removeEventListener('keydown', this.onKeyDown);
		this.playBounce.destroy();
		super.destroy(options);
	}

	protected onResize(): void {
		this.adjustBackground();
		this.adjustFlies();
		this.adjustLogo();

		if (this.isPortrait) {
			this.applyPortraitLayout();
			return;
		}

		this.applyLandscapeLayout();
	}

	private async addBackground(): Promise<void> {
		const texture = await Assets.load<Texture>('menu-background');
		this.background = new Sprite(texture);
		this.background.anchor.set(0.5);
		this.addChild(this.background);
		this.adjustBackground();
	}

	private adjustBackground(): void {
		if (!this.background) {
			return;
		}

		const { texture } = this.background;
		const view = getGameView();
		const coverWidth = view.screenWidth;
		const coverHeight = view.screenHeight;
		const scale = Math.max(
			coverWidth / texture.width,
			coverHeight / texture.height,
		);

		this.background.scale.set(scale);
		this.background.x = Scene.viewportWidth * 0.5;
		this.background.y = Scene.viewportHeight * 0.5;
	}

	private async addFlies(): Promise<void> {
		const flyTexture = await Assets.load<Texture>('firefly');
		this.fliesContainer = new ParticleContainer({
			dynamicProperties: {
				position: true,
				rotation: true,
				vertex: false,
				color: false,
			},
		});

		for (let i = 0; i < MENU_FLY_COUNT; i++) {
			let x = Math.random() * Scene.viewportWidth;
			let y = (Math.random() * 0.5 + 0.3) * Scene.viewportHeight;
			let scale = (y - Scene.viewportHeight * 0.2) / (Scene.viewportHeight * 0.6);
			const fly = new AnotherFly(flyTexture, x, y, 0.8, 15, 300, scale);
			this.flies.push(fly);
			this.fliesContainer.addParticle(fly);
		}

		this.adjustFlies();
		// Above the background, below carousel / buttons.
		this.addChild(this.fliesContainer);
	}

	private adjustFlies(): void {
		if (!this.fliesContainer) {
			return;
		}

		this.fliesContainer.scale.set(this.calcScale());
		this.fliesContainer.update();
	}

	private async addLogo(): Promise<void> {
		const texture = await Assets.load<Texture>('logo');
		this.logo = new Sprite(texture);
		this.adjustLogo();
		this.addChild(this.logo);
	}

	private adjustLogo(): void {
		if (!this.logo) {
			return;
		}

		this.logo.scale.set(LOGO_SCALE);
		this.logo.x = LOGO_X;
		this.logo.y = LOGO_Y;
	}

	private async addCarousel(): Promise<void> {
		const progress = GameProgress.shared;
		this.carousel = new LevelCarousel(progress.getCarouselEntries(), progress.getCarouselStartIndex());
		await this.carousel.init();
		this.carousel.on('selectionChanged', () => {
			this.syncPlayButton();
		});
		this.addChild(this.carousel);
	}

	private async addPlayButton(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>('play-button');
		this.playButton = UIButton.fromSpritesheet(
			sheet,
			'play-on',
			PLAY_BUTTON_SIZE,
			PLAY_BUTTON_SIZE,
			new HighlightDecoration(0.85),
		);
		this.playButtonRoot = new Container();
		this.playButtonRoot.addChild(this.playButton);
		this.addChild(this.playButtonRoot);
		this.playBounce.attach(this.playButton);

		// Stay clickable for locked levels too — feedback is sound + lock shake.
		bindDebouncedTap(this.playButton, () => {
			this.requestPlay();
		});
	}

	private async addSideButtons(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>('custom-buttons');

		this.progressButton = UIButton.fromSpritesheet(
			sheet,
			'progress-button',
			SIDE_BUTTON_SIZE,
			SIDE_BUTTON_SIZE,
			new HighlightDecoration(0.85),
		);
		this.customizeButton = UIButton.fromSpritesheet(
			sheet,
			'custom-button',
			SIDE_BUTTON_SIZE,
			SIDE_BUTTON_SIZE,
			new HighlightDecoration(0.85),
		);
		this.addChild(this.progressButton);
		this.addChild(this.customizeButton);

		// Target scenes land on the progress stage; feedback only for now.
		bindDebouncedTap(this.progressButton, () => {
			SoundManager.playSound('hit-a-button');
			this.emit('open-progress');
		});
		bindDebouncedTap(this.customizeButton, () => {
			SoundManager.playSound('hit-a-button');
			this.emit('open-customize');
		});
	}

	private applyLandscapeLayout(): void {
		if (!this.carousel) {
			return;
		}

		const centerX = Scene.viewportWidth * 0.5;

		this.carousel.setArrowLayout('sides');
		this.carousel.x = centerX;
		this.carousel.y = CAROUSEL_CENTER_Y;

		this.playButtonRoot.x = centerX;
		this.playButtonRoot.y = PLAY_BUTTON_Y;

		this.progressButton.x = SIDE_BUTTON_MARGIN;
		this.progressButton.y = SIDE_BUTTON_Y;
		this.customizeButton.x = Scene.viewportWidth - SIDE_BUTTON_MARGIN;
		this.customizeButton.y = SIDE_BUTTON_Y;
	}

	private applyPortraitLayout(): void {
		if (!this.carousel) {
			return;
		}

		const centerX = Scene.viewportWidth * 0.5;
		const carouselY = Scene.viewportHeight * PORTRAIT_CAROUSEL_RATIO;
		const sideY = Scene.viewportHeight
			- PORTRAIT_SIDE_BOTTOM_MARGIN
			- SIDE_BUTTON_SIZE / 2;
		const arrowY = carouselY + CAROUSEL_BELOW_ARROW_OFFSET_Y;

		this.carousel.setArrowLayout('below');
		this.carousel.x = centerX;
		this.carousel.y = carouselY;

		this.playButtonRoot.x = centerX;
		this.playButtonRoot.y = (arrowY + sideY) * 0.5;

		this.progressButton.x = centerX - PORTRAIT_SIDE_SPREAD;
		this.progressButton.y = sideY;
		this.customizeButton.x = centerX + PORTRAIT_SIDE_SPREAD;
		this.customizeButton.y = sideY;
	}

	private syncPlayButton(): void {
		if (!this.playButton || !this.carousel) {
			return;
		}

		const enabled = isCarouselLevelPlayable(this.carousel.selectedEntry);

		if (enabled === this.isPlayEnabled) {
			return;
		}

		this.isPlayEnabled = enabled;
		this.playButton.setFrame(enabled ? 'play-on' : 'play-off');
		this.playButton.eventMode = 'static';
		this.playButton.cursor = 'pointer';

		if (enabled) {
			this.playBounce.start();
		} else {
			this.playBounce.stop();
		}
	}

	private requestPlay(): void {
		const entry = this.carousel.selectedEntry;

		this.playBounce.stop();

		if (!isCarouselLevelPlayable(entry)) {
			SoundManager.playSound('level-locked');
			this.carousel.playSelectedLockDenied();
			if (this.isPlayEnabled) {
				this.playBounce.start();
			}
			return;
		}

		SoundManager.playSound('level-start');
		this.emit('play-level', entry.id);
	}

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		if (event.repeat) {
			return;
		}

		if (event.code === 'ArrowLeft') {
			this.carousel?.stepBy(-1);
			return;
		}

		if (event.code === 'ArrowRight') {
			this.carousel?.stepBy(1);
			return;
		}

		if (event.code === 'Enter' || event.code === 'NumpadEnter') {
			this.requestPlay();
		}
	};
}
