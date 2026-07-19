import { Assets, Container, DestroyOptions, FederatedPointerEvent, Graphics, NineSliceSprite, Texture } from 'pixi.js';
import { gsap } from 'gsap';
import { bindDebouncedTap } from '../components/debounced-tap';
import { HighlightDecoration } from '../components/highlight-decoration';
import { UIButton } from '../components/ui-button';
import { SoundManager } from '../managers/sound-manager';

const PANEL_SLICE = 32;
const DEFAULT_BACKDROP_ALPHA = 0.45;
const CONTENT_PADDING = 28;
const OK_BUTTON_WIDTH = 96;
const OK_BUTTON_HEIGHT = 32;
const OK_BUTTON_BOTTOM_OFFSET = 36;
const CONTENT_BOTTOM_RESERVE = 56;

type HudModalOptions = {
	width: number;
	height: number;
	backdropAlpha?: number;
	showOkButton?: boolean;
};

type ReflowableContent = Container & {
	reflow(contentWidth: number): void;
};

export class HudModal extends Container {
	private readonly backdrop: Graphics;
	private readonly windowRoot: Container;
	private readonly panel: NineSliceSprite;
	private readonly content: Container;
	private readonly okButton: UIButton;
	private readonly modalWidth: number;
	private readonly modalHeight: number;
	private readonly backdropAlpha: number;
	private readonly showOkButton: boolean;
	private isBackdropTapEnabled = false;
	private _isOpen = false;

	private constructor(panelTexture: Texture, okButtonTexture: Texture, options: HudModalOptions) {
		super();

		this.modalWidth = options.width;
		this.modalHeight = options.height;
		this.backdropAlpha = options.backdropAlpha ?? DEFAULT_BACKDROP_ALPHA;
		this.showOkButton = options.showOkButton ?? true;

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

		const decorator = new HighlightDecoration(0.85);
		this.okButton = UIButton.fromTexture(
			okButtonTexture,
			OK_BUTTON_WIDTH,
			OK_BUTTON_HEIGHT,
			decorator,
		);

		this.windowRoot.addChild(this.panel);
		this.windowRoot.addChild(this.content);
		this.windowRoot.addChild(this.okButton);
		this.addChild(this.backdrop);
		this.addChild(this.windowRoot);

		this.okButton.visible = this.showOkButton;
		this.visible = false;

		this.bindInteractions();
	}

	public static async create(options: HudModalOptions): Promise<HudModal> {
		const [panelTexture, okButtonTexture] = await Promise.all([
			Assets.load<Texture>('panel-window'),
			Assets.load<Texture>('button-ok'),
		]);
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

	public adjustLayout(viewportWidth: number, viewportHeight: number, centerY: number, panelWidth?: number): void {
		const width = panelWidth ?? this.modalWidth;
		const contentWidth = width - CONTENT_PADDING * 2;

		this.backdrop.clear()
			.rect(0, 0, viewportWidth, viewportHeight)
			.fill({ color: 0x000000, alpha: this.backdropAlpha });

		this.windowRoot.x = viewportWidth / 2;
		this.windowRoot.y = centerY;
		this.panel.width = width;
		this.panel.height = this.modalHeight;

		const contentView = this.content.children[0] as ReflowableContent | undefined;
		contentView?.reflow(contentWidth);

		this.content.x = 0;
		this.content.y = this.showOkButton
			? -CONTENT_BOTTOM_RESERVE / 2
			: 0;

		this.okButton.x = 0;
		this.okButton.y = this.modalHeight / 2 - OK_BUTTON_BOTTOM_OFFSET;
	}

	public override destroy(options?: DestroyOptions): void {
		gsap.killTweensOf(this);
		super.destroy(options);
	}

	private bindInteractions(): void {
		this.backdrop.on('pointertap', (event: FederatedPointerEvent) => {
			if (!this.isBackdropTapEnabled) {
				return;
			}

			this.closeWithSound();
			event.stopPropagation();
		});

		this.panel.on('pointertap', (event: FederatedPointerEvent) => {
			event.stopPropagation();
		});

		if (this.showOkButton) {
			bindDebouncedTap(this.okButton, () => {
				this.closeWithSound();
			});
		}
	}

	private closeWithSound(): void {
		SoundManager.playSound('button-pressed');
		this.close();
	}
}
