import { Assets, Container, DestroyOptions, FederatedPointerEvent, Graphics, NineSliceSprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { bindDebouncedTap } from '../components/debounced-tap';
import { SoundManager } from '../managers/sound-manager';
import { createModalOkLabel } from './modals/modal-title';

/** Matches the 150×150 logical paper panels (resolution 2). */
const PANEL_SLICE = 30;
/** 75×75 logical graydirt button (resolution 2). */
const OK_BUTTON_SLICE = 15;
const DEFAULT_BACKDROP_ALPHA = 0.45;
const CONTENT_PADDING = 28;
const OK_BUTTON_WIDTH = 120;
const OK_BUTTON_HEIGHT = 48;
const OK_BUTTON_BOTTOM_OFFSET = 40;
const CONTENT_BOTTOM_RESERVE = 56;
const DEFAULT_PANEL_ALIAS = '9slice-panel-old';
const OK_BUTTON_ALIAS = '9slice-button-graydirt';

export type HudModalOptions = {
	width: number;
	height: number;
	backdropAlpha?: number;
	showOkButton?: boolean;
	/** Dismiss when tapping the dimmed area. Default true. */
	closeOnBackdropTap?: boolean;
	/** Assets alias for the nine-slice panel texture. */
	panelAlias?: string;
};

type ReflowableContent = Container & {
	reflow(
		contentWidth: number,
		panelHeight?: number,
		viewportWidth?: number,
		viewportHeight?: number,
	): void;
};

export class HudModal extends Container {
	private readonly backdrop: Graphics;
	private readonly windowRoot: Container;
	private readonly panel: NineSliceSprite;
	private readonly content: Container;
	private readonly okButtonRoot: Container | null;
	private readonly modalWidth: number;
	private readonly modalHeight: number;
	private readonly backdropAlpha: number;
	private readonly showOkButton: boolean;
	private readonly closeOnBackdropTap: boolean;
	private isBackdropTapEnabled = false;
	private _isOpen = false;

	private constructor(
		panelTexture: Texture,
		okButtonTexture: Texture | null,
		options: HudModalOptions,
	) {
		super();

		this.modalWidth = options.width;
		this.modalHeight = options.height;
		this.backdropAlpha = options.backdropAlpha ?? DEFAULT_BACKDROP_ALPHA;
		this.showOkButton = options.showOkButton ?? true;
		this.closeOnBackdropTap = options.closeOnBackdropTap ?? true;

		this.backdrop = new Graphics();
		this.backdrop.eventMode = 'static';
		this.backdrop.cursor = 'default';

		this.windowRoot = new Container();
		this.panel = new NineSliceSprite({
			texture: panelTexture,
			leftWidth: PANEL_SLICE,
			rightWidth: PANEL_SLICE,
			topHeight: PANEL_SLICE,
			bottomHeight: PANEL_SLICE,
			width: this.modalWidth,
			height: this.modalHeight,
		});
		this.panel.eventMode = 'static';
		this.panel.anchor.set(0.5);

		this.content = new Container();

		if (this.showOkButton && okButtonTexture) {
			const okBg = new NineSliceSprite({
				texture: okButtonTexture,
				leftWidth: OK_BUTTON_SLICE,
				rightWidth: OK_BUTTON_SLICE,
				topHeight: OK_BUTTON_SLICE,
				bottomHeight: OK_BUTTON_SLICE,
				width: OK_BUTTON_WIDTH,
				height: OK_BUTTON_HEIGHT,
			});
			okBg.anchor.set(0.5);

			const okLabel = createModalOkLabel();

			this.okButtonRoot = new Container();
			this.okButtonRoot.eventMode = 'static';
			this.okButtonRoot.cursor = 'pointer';
			this.okButtonRoot.addChild(okBg);
			this.okButtonRoot.addChild(okLabel);
		} else {
			this.okButtonRoot = null;
		}

		this.windowRoot.addChild(this.panel);
		this.windowRoot.addChild(this.content);
		if (this.okButtonRoot) {
			this.windowRoot.addChild(this.okButtonRoot);
		}
		this.addChild(this.backdrop);
		this.addChild(this.windowRoot);

		this.visible = false;
		this.bindInteractions();
	}

	public static async create(options: HudModalOptions): Promise<HudModal> {
		const panelAlias = options.panelAlias ?? DEFAULT_PANEL_ALIAS;
		const showOk = options.showOkButton ?? true;
		const panelTexture = await Assets.load<Texture>(panelAlias);

		let okButtonTexture: Texture | null = null;
		if (showOk) {
			okButtonTexture = await Assets.load<Texture>(OK_BUTTON_ALIAS);
		}

		return new HudModal(panelTexture, okButtonTexture, options);
	}

	public get isOpen(): boolean {
		return this._isOpen;
	}

	public setContent(content: Container): void {
		this.content.removeChildren();
		this.content.addChild(content);
	}

	public open(): void {
		if (this._isOpen) {
			return;
		}

		this._isOpen = true;
		this.visible = true;
		this.isBackdropTapEnabled = false;
		this.emit('opened');
		gsap.delayedCall(0, () => {
			if (this._isOpen) {
				this.isBackdropTapEnabled = true;
			}
		});
	}

	public close(): void {
		if (!this._isOpen) {
			return;
		}

		this._isOpen = false;
		this.isBackdropTapEnabled = false;
		this.visible = false;
		this.emit('closed');
	}

	public toggle(): void {
		if (this._isOpen) {
			this.close();
			return;
		}

		this.open();
	}

	public adjustLayout(
		viewportWidth: number,
		viewportHeight: number,
		centerY: number,
		panelWidth?: number,
		panelHeight?: number,
	): void {
		const width = panelWidth ?? this.modalWidth;
		const height = panelHeight ?? this.modalHeight;
		const contentWidth = width - CONTENT_PADDING * 2;

		this.backdrop.clear()
			.rect(0, 0, viewportWidth, viewportHeight)
			.fill({ color: 0x000000, alpha: this.backdropAlpha });

		this.windowRoot.x = viewportWidth / 2;
		this.windowRoot.y = centerY;
		this.panel.width = width;
		this.panel.height = height;

		const contentView = this.content.children[0] as ReflowableContent | undefined;
		contentView?.reflow?.(contentWidth, height, viewportWidth, viewportHeight);

		this.content.x = 0;
		this.content.y = this.showOkButton
			? -CONTENT_BOTTOM_RESERVE / 2
			: 0;

		if (this.okButtonRoot) {
			this.okButtonRoot.x = 0;
			this.okButtonRoot.y = height / 2 - OK_BUTTON_BOTTOM_OFFSET;
		}
	}

	public override destroy(options?: DestroyOptions): void {
		gsap.killTweensOf(this);
		super.destroy(options);
	}

	private bindInteractions(): void {
		this.backdrop.on('pointertap', (event: FederatedPointerEvent) => {
			if (!this.closeOnBackdropTap || !this.isBackdropTapEnabled) {
				return;
			}

			this.closeWithSound();
			event.stopPropagation();
		});

		this.panel.on('pointertap', (event: FederatedPointerEvent) => {
			event.stopPropagation();
		});

		if (this.okButtonRoot) {
			bindDebouncedTap(this.okButtonRoot, () => {
				this.closeWithSound();
			});
		}
	}

	private closeWithSound(): void {
		SoundManager.playSound('hit-a-button');
		this.close();
	}
}
