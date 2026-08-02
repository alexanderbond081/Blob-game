import { gsap } from 'gsap';
import { Assets, DestroyOptions, ParticleContainer, Sprite, Spritesheet, Texture } from 'pixi.js';

import { bindDebouncedTap } from '../components/debounced-tap';
import { HighlightDecoration } from '../components/highlight-decoration';
import { LevelCarousel } from '../components/level-carousel';
import { AnotherFly } from '../components/particle-fly';
import { UIButton } from '../components/ui-button';
import { findFirstPlayableIndex, isLevelPlayable, levelCatalog } from '../managers/level-catalog';
import { SoundManager } from '../managers/sound-manager';
import { Scene } from './scene';

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

const PORTRAIT_CAROUSEL_RATIO = 0.36;
const PORTRAIT_PLAY_GAP = 250;
const PORTRAIT_SIDE_GAP = 100;
const PORTRAIT_SIDE_SPREAD = 110;

/** Idle Play bounce while an unlocked level is selected. */
const PLAY_IDLE_INTERVAL_SEC = 8;
const PLAY_IDLE_HOP_PX = 22;

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
	private playButton!: UIButton;
	private progressButton!: UIButton;
	private customizeButton!: UIButton;
	private isPlayEnabled = false;
	private playIdleDelay: gsap.core.Tween | null = null;
	private playIdleBounce: gsap.core.Timeline | null = null;

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
		this.clearPlayIdle();
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
		const scale = Math.max(
			Scene.viewportWidth / texture.width,
			Scene.viewportHeight / texture.height,
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
		this.carousel = new LevelCarousel(levelCatalog, findFirstPlayableIndex());
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
		this.addChild(this.playButton);

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

		this.playButton.x = centerX;
		this.playButton.y = PLAY_BUTTON_Y;

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

		this.carousel.setArrowLayout('below');
		this.carousel.x = centerX;
		this.carousel.y = carouselY;

		this.playButton.x = centerX;
		this.playButton.y = carouselY + PORTRAIT_PLAY_GAP;

		this.progressButton.x = centerX - PORTRAIT_SIDE_SPREAD;
		this.progressButton.y = this.playButton.y + PORTRAIT_SIDE_GAP;
		this.customizeButton.x = centerX + PORTRAIT_SIDE_SPREAD;
		this.customizeButton.y = this.playButton.y + PORTRAIT_SIDE_GAP;
	}

	private syncPlayButton(): void {
		if (!this.playButton || !this.carousel) {
			return;
		}

		const enabled = isLevelPlayable(this.carousel.selectedEntry);

		if (enabled === this.isPlayEnabled) {
			return;
		}

		this.isPlayEnabled = enabled;
		this.playButton.setFrame(enabled ? 'play-on' : 'play-off');
		this.playButton.eventMode = 'static';
		this.playButton.cursor = 'pointer';

		if (enabled) {
			this.schedulePlayIdle();
		} else {
			this.clearPlayIdle();
			this.resetPlayButtonTransform();
		}
	}

	private requestPlay(): void {
		const entry = this.carousel.selectedEntry;

		this.clearPlayIdle();

		if (!isLevelPlayable(entry) || !entry.sceneId) {
			SoundManager.playSound('level-locked');
			this.carousel.playSelectedLockDenied();
			this.schedulePlayIdle();
			return;
		}

		SoundManager.playSound('level-start');
		this.emit('play-level', entry.sceneId);
	}

	private schedulePlayIdle(): void {
		this.playIdleDelay?.kill();
		this.playIdleDelay = null;

		if (!this.isPlayEnabled || !this.playButton) {
			return;
		}

		this.playIdleDelay = gsap.delayedCall(PLAY_IDLE_INTERVAL_SEC, () => {
			this.runPlayIdleBounce();
			this.schedulePlayIdle();
		});
	}

	private clearPlayIdle(): void {
		this.playIdleDelay?.kill();
		this.playIdleDelay = null;
		this.playIdleBounce?.kill();
		this.playIdleBounce = null;
	}

	private resetPlayButtonTransform(): void {
		if (!this.playButton) {
			return;
		}

		gsap.killTweensOf(this.playButton);
		this.playButton.scale.set(1);
		this.playButton.adjustScale(1, 1);
	}

	/** Squash → hop → land → settle, twice. */
	private runPlayIdleBounce(): void {
		if (!this.playButton || !this.isPlayEnabled) {
			return;
		}

		const button = this.playButton;
		const restY = button.y;
		const height = button.height;

		this.playIdleBounce?.kill();
		gsap.killTweensOf(button);
		button.scale.set(1);
		button.y = restY;

		const sit = (): gsap.core.Timeline => {
			return gsap.timeline()
				.to(button, {
					pixi: {
						scaleX: 1.2, scaleY: 0.8, y: restY + height * 0.1
					},
					duration: 0.22,
					ease: 'power1.out',
				});
		};

		const hop = (): gsap.core.Timeline => {
			return gsap.timeline()
				.to(button, {
					pixi: { scaleX: 0.85, scaleY: 1.15, y: restY - PLAY_IDLE_HOP_PX },
					duration: 0.15,
					ease: 'power2.out',
				})
				.to(button, {
					pixi: { scaleX: 1.05, scaleY: 0.95, y: restY - PLAY_IDLE_HOP_PX - height * 0.025 },
					duration: 0.07,
					ease: 'power1.out',
				})
				.to(button, {
					pixi: { scaleX: 1.1, scaleY: 0.9, y: restY + height * 0.05 },
					duration: 0.15,
					ease: 'power1.in',
				})
				.to(button, {
					pixi: { scaleX: 1.2, scaleY: 0.8, y: restY + height * 0.1 },
					duration: 0.07,
					ease: 'power1.out',
				});
		};

		const out = (): gsap.core.Timeline => {
			return gsap.timeline()
				.to(button, {
					pixi: { scaleX: 1, scaleY: 1, y: restY },
					duration: 0.6,
					ease: 'elastic.out(1.1, 0.4)',
				});
		};

		this.playIdleBounce = gsap.timeline()
			.add(sit())
			.add(hop())
			//.add(hop(), '+=0.02')
			.add(hop())
			.add(out());
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
