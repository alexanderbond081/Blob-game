import { Assets, Container, DestroyOptions, Spritesheet } from 'pixi.js';

import { bindDebouncedTap } from '../../components/debounced-tap';
import { HighlightDecoration } from '../../components/highlight-decoration';
import { IdleBounceAnimator } from '../../components/idle-bounce-animator';
import { UIButton } from '../../components/ui-button';
import { SoundManager } from '../../managers/sound-manager';
import { createModalTitle } from './modal-title';

const SIDE_BUTTON_SIZE = 75;
const RESUME_BUTTON_SIZE = 100;
const BUTTON_GAP = 36;
/** Shift button row below vertical center so the title sits in the upper band. */
const BUTTONS_Y = 28;
const TITLE_Y = -78;

/**
 * Pause modal body: "Paused" title + Home | Resume (Play art) | Restart.
 * Emits `resume`, `home`, `restart` after the shared click SFX.
 */
export class PauseModalContent extends Container {
	private title!: ReturnType<typeof createModalTitle>;
	private homeButton!: UIButton;
	private resumeButton!: UIButton;
	private restartButton!: UIButton;
	private readonly playBounce = new IdleBounceAnimator(5, 22, 0.05);

	private constructor() {
		super();
	}

	public static async create(): Promise<PauseModalContent> {
		const content = new PauseModalContent();
		await content.build();
		return content;
	}

	public startPlayIdle(): void {
		this.playBounce.syncRestPosition();
		this.playBounce.start();
	}

	public stopPlayIdle(): void {
		this.playBounce.stop();
	}

	public reflow(_contentWidth: number): void {
		this.layout();
		this.playBounce.syncRestPosition();
	}

	public override destroy(options?: DestroyOptions): void {
		this.playBounce.destroy();
		super.destroy(options);
	}

	private async build(): Promise<void> {
		const panelSheet = await Assets.load<Spritesheet>('pause-panel-buttons');
		const playSheet = await Assets.load<Spritesheet>('play-button');

		this.title = createModalTitle('Paused', 44);
		this.addChild(this.title);

		this.homeButton = UIButton.fromSpritesheet(
			panelSheet,
			'home-button',
			SIDE_BUTTON_SIZE,
			SIDE_BUTTON_SIZE,
			new HighlightDecoration(0.85),
		);
		this.resumeButton = UIButton.fromSpritesheet(
			playSheet,
			'play-on',
			RESUME_BUTTON_SIZE,
			RESUME_BUTTON_SIZE,
			new HighlightDecoration(0.85),
		);
		this.restartButton = UIButton.fromSpritesheet(
			panelSheet,
			'restart-button',
			SIDE_BUTTON_SIZE,
			SIDE_BUTTON_SIZE,
			new HighlightDecoration(0.85),
		);

		this.addChild(this.homeButton);
		this.addChild(this.resumeButton);
		this.addChild(this.restartButton);
		this.playBounce.attach(this.resumeButton);
		this.layout();

		this.bindAction(this.homeButton, 'home');
		this.bindAction(this.resumeButton, 'resume');
		this.bindAction(this.restartButton, 'restart');
	}

	private layout(): void {
		this.title.x = 0;
		this.title.y = TITLE_Y;

		this.resumeButton.x = 0;
		this.resumeButton.y = BUTTONS_Y;

		const sideOffset = RESUME_BUTTON_SIZE / 2 + BUTTON_GAP + SIDE_BUTTON_SIZE / 2;
		this.homeButton.x = -sideOffset;
		this.homeButton.y = BUTTONS_Y;
		this.restartButton.x = sideOffset;
		this.restartButton.y = BUTTONS_Y;
	}

	private bindAction(button: UIButton, eventName: 'home' | 'resume' | 'restart'): void {
		bindDebouncedTap(button, () => {
			SoundManager.playSound('hit-a-button');
			this.emit(eventName);
		});
	}
}
