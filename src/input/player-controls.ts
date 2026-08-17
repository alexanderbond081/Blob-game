/** Shared analog axes for keyboard (always ±1), touch swipes, and future gamepads. */
export type PlayerControls = {
	/** Horizontal axis, −1 = full left, +1 = full right. */
	moveX: number;
	/** Jump axis this frame, 0 = idle, 1 = full jump. Impulse, not a hold-to-cut. */
	jump: number;
	crouch: boolean;
	/** True after a swipe actually commits; the jump axis must not launch without this. */
	jumpCommitted: boolean;
	/**
	 * Touch-only: releasing jump during ground wind-up cancels the squat.
	 * Keyboard taps must not set this — a short Space still has to jump.
	 */
	cancelJumpOnRelease: boolean;
};

/** Ignore tiny analog values when testing digital intents (cling / peel / facing). */
export const PLAYER_AXIS_DEADZONE = 0.2;

export const createEmptyPlayerControls = (): PlayerControls => ({
	moveX: 0,
	jump: 0,
	crouch: false,
	jumpCommitted: false,
	cancelJumpOnRelease: false,
});

export const clampAxis = (value: number): number => {
	return Math.max(-1, Math.min(1, value));
};

export const axisDirection = (moveX: number, deadzone = PLAYER_AXIS_DEADZONE): number => {
	if (moveX > deadzone) {
		return 1;
	}

	if (moveX < -deadzone) {
		return -1;
	}

	return 0;
};
