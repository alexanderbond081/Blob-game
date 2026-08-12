import { Assets, Container, DestroyOptions, Spritesheet, Text, TextStyle } from 'pixi.js';

import { bindDebouncedTap } from '../../components/debounced-tap';
import { HighlightDecoration } from '../../components/highlight-decoration';
import { IdleBounceAnimator } from '../../components/idle-bounce-animator';
import { UIButton } from '../../components/ui-button';
import { SoundManager } from '../../managers/sound-manager';
import { createModalTitle, formatRunTime } from './modal-title';

const SIDE_BUTTON_SIZE = 75;
const CONTINUE_BUTTON_SIZE = 100;
const BUTTON_GAP = 36;
const BUTTONS_Y = 72;
const TITLE_Y = -118;
const STATS_Y = -28;
const STAT_LINE_GAP = 28;
const STAT_FILL = 0x4a2c14;

export type LevelResultStats = {
	collected: number;
	totalFireflies: number;
	timeSec: number;
	deaths: number;
};

const createStatStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Arial',
		fontSize: 22,
		fontWeight: 'bold',
		fill: STAT_FILL,
		align: 'center',
		stroke: { color: 0xf5e6c8, width: 3, join: 'round' },
	});
};

/**
 * Level-clear modal: title + run stats + Home | Continue (Play) | Restart.
 * Same button art as pause. Emits `continue`, `home`, `restart`.
 */
export class ResultModalContent extends Container {
	private title!: Text;
	private firefliesText!: Text;
	private timeText!: Text;
	private deathsText!: Text;
	private homeButton!: UIButton;
	private continueButton!: UIButton;
	private restartButton!: UIButton;
	private readonly playBounce = new IdleBounceAnimator(5, 22, 0.05);

	private constructor() {
		super();
	}

	public static async create(): Promise<ResultModalContent> {
		const content = new ResultModalContent();
		await content.build();
		return content;
	}

	public setStats(stats: LevelResultStats): void {
		this.firefliesText.text = `Fireflies  ${stats.collected} / ${stats.totalFireflies}`;
		this.timeText.text = `Time  ${formatRunTime(stats.timeSec)}`;
		this.deathsText.text = `Deaths  ${stats.deaths}`;
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
		const statStyle = createStatStyle();

		this.title = createModalTitle('Clear!', 44);
		this.addChild(this.title);

		this.firefliesText = new Text({ text: 'Fireflies  0 / 0', style: statStyle, resolution: 2, roundPixels: true });
		this.timeText = new Text({ text: 'Time  0:00', style: statStyle, resolution: 2, roundPixels: true });
		this.deathsText = new Text({ text: 'Deaths  0', style: statStyle, resolution: 2, roundPixels: true });
		this.firefliesText.anchor.set(0.5);
		this.timeText.anchor.set(0.5);
		this.deathsText.anchor.set(0.5);
		this.firefliesText.eventMode = 'none';
		this.timeText.eventMode = 'none';
		this.deathsText.eventMode = 'none';
		this.addChild(this.firefliesText);
		this.addChild(this.timeText);
		this.addChild(this.deathsText);

		this.homeButton = UIButton.fromSpritesheet(
			panelSheet,
			'home-button',
			SIDE_BUTTON_SIZE,
			SIDE_BUTTON_SIZE,
			new HighlightDecoration(0.85),
		);
		this.continueButton = UIButton.fromSpritesheet(
			playSheet,
			'play-on',
			CONTINUE_BUTTON_SIZE,
			CONTINUE_BUTTON_SIZE,
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
		this.addChild(this.continueButton);
		this.addChild(this.restartButton);
		this.playBounce.attach(this.continueButton);
		this.layout();

		this.bindAction(this.homeButton, 'home');
		this.bindAction(this.continueButton, 'continue');
		this.bindAction(this.restartButton, 'restart');
	}

	private layout(): void {
		this.title.x = 0;
		this.title.y = TITLE_Y;

		this.firefliesText.x = 0;
		this.firefliesText.y = STATS_Y - STAT_LINE_GAP;
		this.timeText.x = 0;
		this.timeText.y = STATS_Y;
		this.deathsText.x = 0;
		this.deathsText.y = STATS_Y + STAT_LINE_GAP;

		this.continueButton.x = 0;
		this.continueButton.y = BUTTONS_Y;

		const sideOffset = CONTINUE_BUTTON_SIZE / 2 + BUTTON_GAP + SIDE_BUTTON_SIZE / 2;
		this.homeButton.x = -sideOffset;
		this.homeButton.y = BUTTONS_Y;
		this.restartButton.x = sideOffset;
		this.restartButton.y = BUTTONS_Y;
	}

	private bindAction(button: UIButton, eventName: 'home' | 'continue' | 'restart'): void {
		bindDebouncedTap(button, () => {
			SoundManager.playSound('hit-a-button');
			this.emit(eventName);
		});
	}
}
