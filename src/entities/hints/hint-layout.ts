import { Assets, Texture } from 'pixi.js';

/** Matches platform `CORNER_RADIUS` in `static-body.ts`. */
export const HINT_CORNER_RADIUS = 8;
export const HINT_PLATE_COLOR = 0x222222;//0x000000;
export const HINT_PLATE_ALPHA = 0.5;
export const HINT_PAD = 16;
export const HINT_KEY_GAP = 0;
export const HINT_LABEL_COLOR = 0x333333;
export const HINT_TRAIL_COLOR = 0xbfbfbf;
export const HINT_TRAIL_WIDTH = 8;
export const HINT_TRAIL_LIFETIME_SEC = 0.45;

/** Matches player `MOVE_SPEED_X` at 60 Hz. */
export const HINT_MOVE_SPEED = 250;
export const HINT_JUMP_SPEED = HINT_MOVE_SPEED * 1.7;
export const HINT_CYCLE_PAUSE_SEC = 1.5;
/** Gap between the two crouch-jump touch slides, after the hand has faded out. */
export const HINT_SLIDE_GAP_SEC = 0.0;
export const HINT_PRESS_PX = 5;
export const HINT_HAND_FADE_IN_SEC = 0.15;
export const HINT_HAND_FADE_OUT_SEC = 0.45;
export const HINT_CONTACT_FADE_SEC = 0.08;
export const HINT_KEY_IDLE_SEC = 0.5;
export const HINT_KEY_HOLD_SEC = 0.8;
export const HINT_KEY_RELEASE_SEC = 0.5;
export const HINT_KEY_SHORT_SEC = 0.5;
export const HINT_SCHEME_FADE_SEC = 0.0;
export const HINT_SCHEME_GAP_SEC = 0.0;

export const HINT_TOUCH_HAND_ALIAS = 'hint-touch-hand';
export const HINT_TOUCH_POINT_ALIAS = 'hint-touch-point';
export const HINT_KEY_PRESSED_ALIAS = 'hint-key-pressed';
export const HINT_KEY_UNPRESSED_ALIAS = 'hint-key-unpressed';

/** Fingertip in source pixels of `touch-hand.webp` (110×110), as a texture anchor. */
export const HAND_FINGERTIP_ANCHOR = { x: 14 / 110, y: 6 / 110 };

export const KEY_LOGICAL = 50;
export const HAND_LOGICAL = 55;
export const CONTACT_LOGICAL = 20;

export const KEYBOARD_CLUSTER_WIDTH = KEY_LOGICAL * 3 + HINT_KEY_GAP * 2;
export const KEYBOARD_CLUSTER_HEIGHT = KEY_LOGICAL * 2 + HINT_KEY_GAP;

const HAND_LEFT = HAND_LOGICAL * HAND_FINGERTIP_ANCHOR.x;
const HAND_RIGHT = HAND_LOGICAL * (1 - HAND_FINGERTIP_ANCHOR.x);
const HAND_UP = HAND_LOGICAL * HAND_FINGERTIP_ANCHOR.y;
const HAND_DOWN = HAND_LOGICAL * (1 - HAND_FINGERTIP_ANCHOR.y);
const CONTACT_RADIUS = CONTACT_LOGICAL * 0.5;

/** Horizontal sign for move / jump posters: +1 right, −1 left. */
export type HintAxis = -1 | 1;

export type HintSize = {
	width: number;
	height: number;
};

export type SwipeRange = {
	minX: number;
	maxX: number;
	minY: number;
	maxY: number;
};

export const MOVE_HINT_SIZE: HintSize = {
	width: Math.max(KEYBOARD_CLUSTER_WIDTH + HINT_PAD * 2, 220),
	height: Math.max(KEYBOARD_CLUSTER_HEIGHT + HINT_PAD * 2, 156),
};

export const JUMP_HINT_SIZE: HintSize = {
	width: MOVE_HINT_SIZE.width,
	height: Math.max(MOVE_HINT_SIZE.height, 196),
};

export const getSwipeRange = (size: HintSize): SwipeRange => {
	return {
		minX: HINT_PAD + Math.max(HAND_LEFT, CONTACT_RADIUS),
		maxX: size.width - HINT_PAD - HAND_RIGHT,
		minY: HINT_PAD + Math.max(HAND_UP, CONTACT_RADIUS),
		maxY: size.height - HINT_PAD - HAND_DOWN - HINT_PRESS_PX,
	};
};

export const requireHintTexture = (alias: string): Texture => {
	const texture = Assets.get<Texture>(alias);
	if (!texture || texture === Texture.EMPTY) {
		throw new Error(`Asset "${alias}" is not loaded. Load game bundle before the level.`);
	}

	return texture;
};
