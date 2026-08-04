import { Assets, Container, Spritesheet } from 'pixi.js';

import { bindDebouncedTap } from '../../components/debounced-tap';
import { HighlightDecoration } from '../../components/highlight-decoration';
import { UIButton } from '../../components/ui-button';
import { SoundManager } from '../../managers/sound-manager';

const SIDE_BUTTON_SIZE = 68;
const RESUME_BUTTON_SIZE = 100;
const BUTTON_GAP = 36;

/**
 * Pause modal body: Home | Resume (Play art) | Restart.
 * Emits `resume`, `home`, `restart` after the shared click SFX.
 */
export class PauseModalContent extends Container {
	private homeButton!: UIButton;
	private resumeButton!: UIButton;
	private restartButton!: UIButton;

	private constructor() {
		super();
	}

	public static async create(): Promise<PauseModalContent> {
		const content = new PauseModalContent();
		await content.build();
		return content;
	}

	public reflow(_contentWidth: number): void {
		this.layoutButtons();
	}

	private async build(): Promise<void> {
		const panelSheet = await Assets.load<Spritesheet>('pause-panel-buttons');
		const playSheet = await Assets.load<Spritesheet>('play-button');

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
		this.layoutButtons();

		this.bindAction(this.homeButton, 'home');
		this.bindAction(this.resumeButton, 'resume');
		this.bindAction(this.restartButton, 'restart');
	}

	private layoutButtons(): void {
		this.resumeButton.x = 0;
		this.resumeButton.y = 0;

		const sideOffset = RESUME_BUTTON_SIZE / 2 + BUTTON_GAP + SIDE_BUTTON_SIZE / 2;
		this.homeButton.x = -sideOffset;
		this.homeButton.y = 0;
		this.restartButton.x = sideOffset;
		this.restartButton.y = 0;
	}

	private bindAction(button: UIButton, eventName: 'home' | 'resume' | 'restart'): void {
		bindDebouncedTap(button, () => {
			SoundManager.playSound('hit-a-button');
			this.emit(eventName);
		});
	}
}
