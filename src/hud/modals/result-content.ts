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
const DEMO_SIDE_GAP = 48;
const BUTTONS_Y = 72;
const TITLE_Y = -118;
/** Demo panel is 40px taller; spend that on title/subtitle gaps, not empty space under the buttons. */
const DEMO_TITLE_Y = -118;
const DEMO_SUBTITLE_Y = -70;
const STATS_Y = -38;
const DEMO_STATS_Y = 6;
const DEMO_BUTTONS_Y = 100;
const STAT_LINE_GAP = 28;
const STAT_FILL = 0x4a2c14;

export type LevelResultStats = {
	collected: number;
	totalFireflies: number;
	timeSec: number;
	deaths: number;
};

export type ResultModalPresentation = {
	/** Last catalog level cleared — celebratory copy, no Continue. */
	demoComplete?: boolean;
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

const createSubtitleStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Arial, Helvetica, sans-serif',
		fontSize: 22,
		fontStyle: 'italic',
		fontWeight: 'bold',
		fill: STAT_FILL,
		align: 'center',
		stroke: { color: 0xf5e6c8, width: 3, join: 'round' },
	});
};

/**
 * Level-clear modal: title + run stats + Home | Continue (Play) | Restart.
 * Demo-complete: larger title + thanks line, Home | Restart only.
 * Emits `continue`, `home`, `restart`.
 */
export class ResultModalContent extends Container {
	private title!: Text;
	private subtitle!: Text;
	private firefliesText!: Text;
	private timeText!: Text;
	private deathsText!: Text;
	private homeButton!: UIButton;
	private continueButtonRoot!: Container;
	private continueButton!: UIButton;
	private restartButton!: UIButton;
	private readonly playBounce = new IdleBounceAnimator(5, 22, 0.05);
	private demoComplete = false;

	private constructor() {
		super();
	}

	public static async create(): Promise<ResultModalContent> {
		const content = new ResultModalContent();
		await content.build();
		return content;
	}

	public get isDemoComplete(): boolean {
		return this.demoComplete;
	}

	public setStats(stats: LevelResultStats): void {
		this.firefliesText.text = `Fireflies  ${stats.collected} / ${stats.totalFireflies}`;
		this.timeText.text = `Time  ${formatRunTime(stats.timeSec)}`;
		this.deathsText.text = `Deaths  ${stats.deaths}`;
	}

	public setPresentation(presentation: ResultModalPresentation = {}): void {
		this.demoComplete = presentation.demoComplete === true;

		if (this.demoComplete) {
			this.title.text = 'Demo complete!';
			this.title.style.fontSize = 40;
			this.subtitle.visible = true;
			this.continueButton.visible = false;
			this.continueButton.eventMode = 'none';
			this.continueButtonRoot.visible = false;
		} else {
			this.title.text = 'Clear!';
			this.title.style.fontSize = 44;
			this.subtitle.visible = false;
			this.continueButton.visible = true;
			this.continueButton.eventMode = 'static';
			this.continueButtonRoot.visible = true;
		}

		this.layout();
	}

	public startPlayIdle(): void {
		if (this.demoComplete) {
			this.playBounce.stop();
			return;
		}

		this.playBounce.start();
	}

	public stopPlayIdle(): void {
		this.playBounce.stop();
	}

	public reflow(_contentWidth: number): void {
		this.layout();
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

		this.subtitle = new Text({
			text: 'Thanks for playing!',
			style: createSubtitleStyle(),
			resolution: 2,
			roundPixels: true,
		});
		this.subtitle.anchor.set(0.5);
		this.subtitle.eventMode = 'none';
		this.subtitle.visible = false;
		this.addChild(this.subtitle);

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
		this.continueButtonRoot = new Container();
		this.continueButtonRoot.addChild(this.continueButton);
		this.addChild(this.continueButtonRoot);
		this.addChild(this.restartButton);
		this.playBounce.attach(this.continueButton);
		this.layout();

		this.bindAction(this.homeButton, 'home');
		this.bindAction(this.continueButton, 'continue');
		this.bindAction(this.restartButton, 'restart');
	}

	private layout(): void {
		const statsY = this.demoComplete ? DEMO_STATS_Y : STATS_Y;

		this.title.x = 0;
		this.title.y = this.demoComplete ? DEMO_TITLE_Y : TITLE_Y;

		this.subtitle.x = 0;
		this.subtitle.y = DEMO_SUBTITLE_Y;

		this.firefliesText.x = 0;
		this.firefliesText.y = statsY - STAT_LINE_GAP;
		this.timeText.x = 0;
		this.timeText.y = statsY;
		this.deathsText.x = 0;
		this.deathsText.y = statsY + STAT_LINE_GAP;

		this.homeButton.y = this.demoComplete ? DEMO_BUTTONS_Y : BUTTONS_Y;
		this.restartButton.y = this.demoComplete ? DEMO_BUTTONS_Y : BUTTONS_Y;
		this.continueButtonRoot.y = BUTTONS_Y;

		if (this.demoComplete) {
			const halfGap = DEMO_SIDE_GAP / 2 + SIDE_BUTTON_SIZE / 2;
			this.homeButton.x = -halfGap;
			this.restartButton.x = halfGap;
			this.continueButtonRoot.x = 0;
			return;
		}

		this.continueButtonRoot.x = 0;
		const sideOffset = CONTINUE_BUTTON_SIZE / 2 + BUTTON_GAP + SIDE_BUTTON_SIZE / 2;
		this.homeButton.x = -sideOffset;
		this.restartButton.x = sideOffset;
	}

	private bindAction(button: UIButton, eventName: 'home' | 'continue' | 'restart'): void {
		bindDebouncedTap(button, () => {
			SoundManager.playSound('hit-a-button');
			this.emit(eventName);
		});
	}
}
