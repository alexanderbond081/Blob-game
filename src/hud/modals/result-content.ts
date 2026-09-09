import { Assets, Container, DestroyOptions, Graphics, Sprite, Spritesheet, Text, Texture, TextStyle } from 'pixi.js';

import { bindDebouncedTap } from '../../components/debounced-tap';
import { HighlightDecoration } from '../../components/highlight-decoration';
import { IdleBounceAnimator } from '../../components/idle-bounce-animator';
import { UIButton } from '../../components/ui-button';
import { SoundManager } from '../../managers/sound-manager';
import { loadModalDecorTextures, ModalDecorLayer } from './modal-decor';
import { createModalTitle, formatRunTime } from './modal-title';

const SIDE_BUTTON_SIZE = 75;
const CONTINUE_BUTTON_SIZE = 100;
const BUTTON_GAP = 36;
const DEMO_SIDE_GAP = 48;
const BUTTONS_Y = 72;
const TITLE_Y = -102;
/** Taller demo panel: two-line header sits in the same band as Clear, stats keep the same gap to the buttons. */
const DEMO_TITLE_Y = -116;
const DEMO_SUBTITLE_Y = -60;
const STATS_Y = -26;
const DEMO_STATS_Y = 8;
const DEMO_BUTTONS_Y = 100;
const STAT_FILL = 0x4a2c14;
const STAT_ICON_SIZE = 40;
const STAT_ICON_TEXT_GAP = 8;
const STAT_CLUSTER_GAP = 16;
const STAT_DIVIDER_HEIGHT = 34;
/** Matches `CONTENT_PADDING` in `hud-modal.ts` — content origin is the panel centre. */
const PANEL_EDGE_PAD = 28;
/** Static panel decor. `offsetX` / `offsetY` are from the named panel corner. `height` is logical. */
const RESULT_DECOR_LAYOUT = [
	{ texture: 'star1-decor', anchor: 'topLeft', offsetX: 70, offsetY: 52, height: 50, scaleX: 1, scaleY: 1, alpha: 0.8 },
	{ texture: 'star1-decor', anchor: 'topRight', offsetX: -48, offsetY: 36, height: 36, scaleX: 1, scaleY: 1, alpha: 0.9 },
	{ texture: 'star1-decor', anchor: 'topRight', offsetX: -80, offsetY: 86, height: 25, scaleX: 1, scaleY: 1, alpha: 0.7 },
	{ texture: 'grass-decor', anchor: 'bottomLeft', offsetX: 39, offsetY: -52, height: 80, scaleX: 1, scaleY: 1, alpha: 1.0 },
	{ texture: 'grass-decor', anchor: 'bottomRight', offsetX: -39, offsetY: -52, height: 80, scaleX: -1, scaleY: 1, alpha: 1.0 },
] as const;

const COMPLETE_DECOR_LAYOUT = [
	{ texture: 'star2-decor', anchor: 'topLeft', offsetX: 42, offsetY: 42, height: 52, scaleX: 1, scaleY: 1, alpha: 0.9 },
	{ texture: 'star1-decor', anchor: 'topLeft', offsetX: 65, offsetY: 125, height: 48, scaleX: 1, scaleY: 1, alpha: 0.6 },
	{ texture: 'star1-decor', anchor: 'topRight', offsetX: -42, offsetY: 37, height: 36, scaleX: 1, scaleY: 1, alpha: 0.9 },
	{ texture: 'star1-decor', anchor: 'topRight', offsetX: -108, offsetY: 102, height: 25, scaleX: 1, scaleY: 1, alpha: 0.7 },
	{ texture: 'star2-decor', anchor: 'topRight', offsetX: -75, offsetY: 127, height: 35, scaleX: 1, scaleY: 1, alpha: 0.8 },
	{ texture: 'grass-decor', anchor: 'bottomLeft', offsetX: 39, offsetY: -52, height: 80, scaleX: 1, scaleY: 1, alpha: 1.0 },
	{ texture: 'grass-decor', anchor: 'bottomRight', offsetX: -39, offsetY: -52, height: 80, scaleX: -1, scaleY: 1, alpha: 1.0 },
] as const;

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

type StatCell = {
	root: Container;
	icon: Sprite;
	value: Text;
};

const createStatStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Arial',
		fontSize: 24,
		fontWeight: 'bold',
		fill: STAT_FILL,
		align: 'left',
		stroke: { color: 0xf5e6c8, width: 1, join: 'round' },
	});
};

const createSubtitleStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Nunito, Helvetica, sans-serif',
		fontSize: 22,
		//fontStyle: 'italic',
		fontWeight: '600',
		fill: STAT_FILL,
		align: 'center',
		stroke: { color: 0xf5e6c8, width: 1, join: 'round' },
	});
};

const createStatCell = (iconTexture: Texture, style: TextStyle): StatCell => {
	const root = new Container();
	root.eventMode = 'none';

	const icon = new Sprite(iconTexture);
	icon.anchor.set(0, 0.5);
	icon.width = STAT_ICON_SIZE;
	icon.height = STAT_ICON_SIZE;
	icon.eventMode = 'none';

	const value = new Text({
		text: '0',
		style,
		resolution: 2,
		roundPixels: true,
	});
	value.anchor.set(0, 0.5);
	value.eventMode = 'none';

	root.addChild(icon);
	root.addChild(value);
	return { root, icon, value };
};

const measureStatCell = (cell: StatCell): number => {
	cell.value.x = STAT_ICON_SIZE + STAT_ICON_TEXT_GAP;
	cell.value.y = 0;
	cell.icon.x = 0;
	cell.icon.y = 0;
	return STAT_ICON_SIZE + STAT_ICON_TEXT_GAP + cell.value.width;
};

const createStatDivider = (): Graphics => {
	const divider = new Graphics();
	divider.rect(-0.5, -STAT_DIVIDER_HEIGHT * 0.5, 1, STAT_DIVIDER_HEIGHT);
	divider.fill({ color: STAT_FILL, alpha: 0.28 });
	divider.eventMode = 'none';
	return divider;
};

/**
 * Level-clear modal: title + run stats + Home | Continue (Play) | Restart.
 * Demo-complete: larger title + thanks line, Home | Restart only.
 * Emits `continue`, `home`, `restart`.
 */
export class ResultModalContent extends Container {
	private title!: Text;
	private subtitle!: Text;
	private firefliesCell!: StatCell;
	private timeCell!: StatCell;
	private deathsCell!: StatCell;
	private dividerLeft!: Graphics;
	private dividerRight!: Graphics;
	private resultDecor!: ModalDecorLayer;
	private completeDecor!: ModalDecorLayer;
	private homeButton!: UIButton;
	private continueButtonRoot!: Container;
	private continueButton!: UIButton;
	private restartButton!: UIButton;
	private readonly playBounce = new IdleBounceAnimator(5, 22, 0.05);
	private demoComplete = false;
	private panelWidth = 420;
	private panelHeight = 320;

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
		this.firefliesCell.value.text = `${stats.collected}/${stats.totalFireflies}`;
		this.timeCell.value.text = formatRunTime(stats.timeSec);
		this.deathsCell.value.text = `${stats.deaths}`;
		this.layout();
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

		this.resultDecor.setVisible(!this.demoComplete);
		this.completeDecor.setVisible(this.demoComplete);
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

	public reflow(contentWidth: number, panelHeight?: number): void {
		this.panelWidth = contentWidth + PANEL_EDGE_PAD * 2;
		if (panelHeight !== undefined) {
			this.panelHeight = panelHeight;
		}

		this.layout();
	}

	public override destroy(options?: DestroyOptions): void {
		this.playBounce.destroy();
		super.destroy(options);
	}

	private async build(): Promise<void> {
		const panelSheet = await Assets.load<Spritesheet>('pause-panel-buttons');
		const playSheet = await Assets.load<Spritesheet>('play-button');
		const fireflyIcon = await Assets.load<Texture>('firefly-icon');
		const watchIcon = await Assets.load<Texture>('watch-icon');
		const scullIcon = await Assets.load<Texture>('scull-icon');
		const statStyle = createStatStyle();
		const decorTextures = await loadModalDecorTextures([RESULT_DECOR_LAYOUT, COMPLETE_DECOR_LAYOUT]);
		this.resultDecor = ModalDecorLayer.create(this, RESULT_DECOR_LAYOUT, decorTextures);
		this.completeDecor = ModalDecorLayer.create(this, COMPLETE_DECOR_LAYOUT, decorTextures);
		this.resultDecor.setVisible(true);
		this.completeDecor.setVisible(false);

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

		this.firefliesCell = createStatCell(fireflyIcon, statStyle);
		this.timeCell = createStatCell(watchIcon, statStyle);
		this.deathsCell = createStatCell(scullIcon, statStyle);
		this.dividerLeft = createStatDivider();
		this.dividerRight = createStatDivider();
		this.addChild(this.firefliesCell.root);
		this.addChild(this.dividerLeft);
		this.addChild(this.timeCell.root);
		this.addChild(this.dividerRight);
		this.addChild(this.deathsCell.root);

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
		this.title.x = 0;
		this.title.y = this.demoComplete ? DEMO_TITLE_Y : TITLE_Y;

		this.subtitle.x = 0;
		this.subtitle.y = DEMO_SUBTITLE_Y;

		this.layoutStatsRow();
		this.resultDecor.layout(this.panelWidth, this.panelHeight);
		this.completeDecor.layout(this.panelWidth, this.panelHeight);

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

	private layoutStatsRow(): void {
		const statsY = this.demoComplete ? DEMO_STATS_Y : STATS_Y;
		const firefliesWidth = measureStatCell(this.firefliesCell);
		const timeWidth = measureStatCell(this.timeCell);
		const deathsWidth = measureStatCell(this.deathsCell);
		const totalWidth = firefliesWidth + timeWidth + deathsWidth + STAT_CLUSTER_GAP * 4;

		let x = -totalWidth * 0.5;
		this.firefliesCell.root.x = x;
		this.firefliesCell.root.y = statsY;
		x += firefliesWidth + STAT_CLUSTER_GAP;

		this.dividerLeft.x = x;
		this.dividerLeft.y = statsY;
		x += STAT_CLUSTER_GAP;

		this.timeCell.root.x = x;
		this.timeCell.root.y = statsY;
		x += timeWidth + STAT_CLUSTER_GAP;

		this.dividerRight.x = x;
		this.dividerRight.y = statsY;
		x += STAT_CLUSTER_GAP;

		this.deathsCell.root.x = x;
		this.deathsCell.root.y = statsY;
	}

	private bindAction(button: UIButton, eventName: 'home' | 'continue' | 'restart'): void {
		bindDebouncedTap(button, () => {
			SoundManager.playSound('hit-a-button');
			this.emit(eventName);
		});
	}
}
