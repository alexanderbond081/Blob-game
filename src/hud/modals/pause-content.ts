import { Assets, Container, DestroyOptions, Spritesheet } from 'pixi.js';

import { bindDebouncedTap } from '../../components/debounced-tap';
import { HighlightDecoration } from '../../components/highlight-decoration';
import { IdleBounceAnimator } from '../../components/idle-bounce-animator';
import { UIButton } from '../../components/ui-button';
import { SoundManager } from '../../managers/sound-manager';
import { loadModalDecorTextures, ModalDecorLayer } from './modal-decor';
import { createModalTitle } from './modal-title';

const SIDE_BUTTON_SIZE = 75;
const RESUME_BUTTON_SIZE = 100;
const BUTTON_GAP = 36;
/** Shift button row below vertical center so the title sits in the upper band. */
const BUTTONS_Y = 28;
const TITLE_Y = -74;
/** Matches `CONTENT_PADDING` in `hud-modal.ts` — content origin is the panel centre. */
const PANEL_EDGE_PAD = 28;

/** Static panel decor. `offsetX` / `offsetY` are from the named panel corner. `height` is logical. */
const PAUSE_DECOR_LAYOUT = [
	{ texture: 'spider-web-decor', anchor: 'topRight', offsetX: -43.5, offsetY: 41.5, height: 60, scaleX: 1, scaleY: 1, alpha: 0.45 },
	{ texture: 'burdock-decor', anchor: 'bottomLeft', offsetX: 40, offsetY: -44, height: 62, scaleX: 1, scaleY: 1, alpha: 0.55 },
] as const;

/**
 * Pause modal body: "Paused" title + Home | Resume (Play art) | Restart.
 * Emits `resume`, `home`, `restart` after the shared click SFX.
 */
export class PauseModalContent extends Container {
	private title!: ReturnType<typeof createModalTitle>;
	private decor!: ModalDecorLayer;
	private homeButton!: UIButton;
	private resumeButtonRoot!: Container;
	private resumeButton!: UIButton;
	private restartButton!: UIButton;
	private readonly playBounce = new IdleBounceAnimator(5, 22, 0.05);
	private panelWidth = 400;
	private panelHeight = 240;

	private constructor() {
		super();
	}

	public static async create(): Promise<PauseModalContent> {
		const content = new PauseModalContent();
		await content.build();
		return content;
	}

	public startPlayIdle(): void {
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
		const decorTextures = await loadModalDecorTextures([PAUSE_DECOR_LAYOUT]);
		this.decor = ModalDecorLayer.create(this, PAUSE_DECOR_LAYOUT, decorTextures);

		this.title = createModalTitle('Paused', 38);
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
		this.resumeButtonRoot = new Container();
		this.resumeButtonRoot.addChild(this.resumeButton);
		this.addChild(this.resumeButtonRoot);
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
		this.decor.layout(this.panelWidth, this.panelHeight);

		this.resumeButtonRoot.x = 0;
		this.resumeButtonRoot.y = BUTTONS_Y;

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
