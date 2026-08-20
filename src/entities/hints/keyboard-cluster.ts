import { Container, Sprite, Text, TextStyle } from 'pixi.js';

import {
	HINT_KEY_GAP,
	HINT_KEY_PRESSED_ALIAS,
	HINT_KEY_UNPRESSED_ALIAS,
	HINT_LABEL_COLOR,
	KEY_LOGICAL,
	KEYBOARD_CLUSTER_HEIGHT,
	KEYBOARD_CLUSTER_WIDTH,
	requireHintTexture,
} from './hint-layout';

export type KeySlot = 'up' | 'down' | 'left' | 'right';
export type KeyScheme = 'arrows' | 'wasd';

const ARROW_LABELS: Record<KeySlot, string> = {
	up: '↑',
	left: '←',
	down: '↓',
	right: '→',
};

const WASD_LABELS: Record<KeySlot, string> = {
	up: 'W',
	left: 'A',
	down: 'S',
	right: 'D',
};

const PRESSED_LABEL_OFFSET_Y = 8;

const createLabelStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Arial, sans-serif',
		fontSize: 18,
		fontWeight: '700',
		fill: HINT_LABEL_COLOR,
		align: 'center',
	});
};

class KeyCap extends Container {
	private readonly unpressed: Sprite;
	private readonly pressed: Sprite;
	private readonly caption: Text;

	public constructor() {
		super();
		this.eventMode = 'none';

		this.unpressed = new Sprite(requireHintTexture(HINT_KEY_UNPRESSED_ALIAS));
		this.unpressed.anchor.set(0.5);
		this.unpressed.eventMode = 'none';
		this.addChild(this.unpressed);

		this.pressed = new Sprite(requireHintTexture(HINT_KEY_PRESSED_ALIAS));
		this.pressed.anchor.set(0.5);
		this.pressed.eventMode = 'none';
		this.pressed.visible = false;
		this.addChild(this.pressed);

		this.caption = new Text({
			text: '',
			style: createLabelStyle(),
			resolution: 2,
		});
		this.caption.anchor.set(0.5, 0.8);
		this.caption.eventMode = 'none';
		this.addChild(this.caption);
	}

	public setLabel(text: string): void {
		this.caption.text = text;
	}

	public setPressed(pressed: boolean): void {
		this.unpressed.visible = !pressed;
		this.pressed.visible = pressed;
		this.caption.y = pressed ? PRESSED_LABEL_OFFSET_Y : 0;
	}
}

/** Inverted-T navigation cluster; labels swap between arrows and WASD. */
export class KeyboardCluster extends Container {
	public readonly clusterWidth = KEYBOARD_CLUSTER_WIDTH;
	public readonly clusterHeight = KEYBOARD_CLUSTER_HEIGHT;

	private readonly keys: Record<KeySlot, KeyCap>;
	private scheme: KeyScheme = 'arrows';

	public constructor() {
		super();
		this.eventMode = 'none';

		this.keys = {
			up: new KeyCap(),
			left: new KeyCap(),
			down: new KeyCap(),
			right: new KeyCap(),
		};

		const midX = KEYBOARD_CLUSTER_WIDTH * 0.5;
		const topY = KEY_LOGICAL * 0.5;
		const bottomY = KEY_LOGICAL + HINT_KEY_GAP + KEY_LOGICAL * 0.5;

		this.keys.up.position.set(midX, topY);
		this.keys.left.position.set(KEY_LOGICAL * 0.5, bottomY);
		this.keys.down.position.set(midX, bottomY);
		this.keys.right.position.set(KEYBOARD_CLUSTER_WIDTH - KEY_LOGICAL * 0.5, bottomY);

		this.addChild(this.keys.up);
		this.addChild(this.keys.left);
		this.addChild(this.keys.down);
		this.addChild(this.keys.right);
		this.applyLabels();
	}

	public setScheme(scheme: KeyScheme): void {
		this.scheme = scheme;
		this.applyLabels();
	}

	public setPressed(slots: readonly KeySlot[]): void {
		const pressed = new Set(slots);
		this.keys.up.setPressed(pressed.has('up'));
		this.keys.left.setPressed(pressed.has('left'));
		this.keys.down.setPressed(pressed.has('down'));
		this.keys.right.setPressed(pressed.has('right'));
	}

	private applyLabels(): void {
		const labels = this.scheme === 'arrows' ? ARROW_LABELS : WASD_LABELS;
		this.keys.up.setLabel(labels.up);
		this.keys.left.setLabel(labels.left);
		this.keys.down.setLabel(labels.down);
		this.keys.right.setLabel(labels.right);
	}
}
