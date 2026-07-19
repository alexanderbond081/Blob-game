import { Container, DestroyOptions, Graphics, Text, TextStyle } from 'pixi.js';
import { debug } from '../managers/debug';

const DEBUG_PANEL_LEFT = 165;
const DEBUG_PANEL_TOP = 310;
const DEBUG_PANEL_WIDTH = 390;
const DEBUG_PANEL_HEIGHT = 190;
const DEBUG_FONT_SIZE = 12;
const DEBUG_TEXT_PADDING = 6;

export class DebugHudPanel extends Container {
	private readonly background: Graphics;
	private readonly messageText: Text;

	constructor() {
		super();

		this.background = new Graphics();
		this.messageText = new Text({
			text: '',
			style: new TextStyle({
				fontFamily: 'monospace',
				fontSize: DEBUG_FONT_SIZE,
				fill: '#ffffff',
				wordWrap: true,
			}),
		});
		this.addChild(this.background);
		this.addChild(this.messageText);
		this.visible = false;
		this.refresh();
		debug.on('logUpdated', this.refresh, this);
		this.adjustLayout();
	}

	public override destroy(options?: DestroyOptions): void {
		debug.off('logUpdated', this.refresh, this);
		super.destroy(options);
	}

	public toggle(): void {
		this.visible = !this.visible;
	}

	public adjustLayout(): void {
		const width = DEBUG_PANEL_WIDTH;
		const height = DEBUG_PANEL_HEIGHT;
		this.background.clear()
			.rect(0, 0, width, height)
			.fill({ color: 0x555555, alpha: 0.72 });
		this.x = DEBUG_PANEL_LEFT;
		this.y = DEBUG_PANEL_TOP;
		this.messageText.x = DEBUG_TEXT_PADDING;
		this.messageText.y = DEBUG_TEXT_PADDING;
		this.messageText.style.wordWrapWidth = width - DEBUG_TEXT_PADDING * 2;
	}

	private refresh(): void {
		this.messageText.text = debug.read().join('\n');
	}
}
