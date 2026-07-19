import { Container, Text, TextStyle } from 'pixi.js';

const TITLE_FONT_SIZE = 20;
const BODY_FONT_SIZE = 16;
const BODY_LINE_HEIGHT = 22;
const TITLE_COLOR = '#FFB000';
const BODY_COLOR = '#E8D5A8';
const TITLE_BODY_GAP = 12;

export class ErrorModalContent extends Container {
	private readonly titleLabel: Text;
	private readonly bodyLabel: Text;

	public constructor() {
		super();

		this.titleLabel = new Text({
			text: 'Something went wrong',
			style: new TextStyle({
				fontFamily: 'Arial, sans-serif',
				fontSize: TITLE_FONT_SIZE,
				fill: TITLE_COLOR,
				align: 'center',
				fontWeight: 'bold',
			}),
		});
		this.titleLabel.anchor.set(0.5, 0);

		this.bodyLabel = new Text({
			text: '',
			style: new TextStyle({
				fontFamily: 'Arial, sans-serif',
				fontSize: BODY_FONT_SIZE,
				fill: BODY_COLOR,
				align: 'center',
				wordWrap: true,
				lineHeight: BODY_LINE_HEIGHT,
			}),
		});
		this.bodyLabel.anchor.set(0.5, 0);

		this.addChild(this.titleLabel);
		this.addChild(this.bodyLabel);
	}

	public setMessage(message: string): void {
		this.bodyLabel.text = message;
	}

	public reflow(contentWidth: number): void {
		this.bodyLabel.style.wordWrapWidth = contentWidth;
		this.titleLabel.x = 0;
		this.titleLabel.y = 0;
		this.bodyLabel.x = 0;
		this.bodyLabel.y = this.titleLabel.height + TITLE_BODY_GAP;

		const totalHeight = this.bodyLabel.y + this.bodyLabel.height;
		this.pivot.y = totalHeight / 2;
	}
}
