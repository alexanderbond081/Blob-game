export type InputMode = 'touch' | 'keyboard' | 'gamepad';

type InputModeListener = (mode: InputMode) => void;

const GAMEPLAY_KEY_CODES = new Set([
	'ArrowLeft',
	'ArrowRight',
	'ArrowUp',
	'ArrowDown',
	'KeyA',
	'KeyD',
	'KeyW',
	'KeyS',
	'Space',
]);

const listeners = new Set<InputModeListener>();
let started = false;
let mode: InputMode = 'keyboard';

const readDefaultMode = (): InputMode => {
	if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
		return 'keyboard';
	}

	return window.matchMedia('(pointer: coarse)').matches ? 'touch' : 'keyboard';
};

const notify = (next: InputMode): void => {
	if (next === mode) {
		return;
	}

	mode = next;
	for (const listener of listeners) {
		listener(mode);
	}
};

const onKeyDown = (event: KeyboardEvent): void => {
	if (!GAMEPLAY_KEY_CODES.has(event.code)) {
		return;
	}

	notify('keyboard');
};

const onPointerDown = (event: PointerEvent): void => {
	if (event.pointerType === 'touch' || event.pointerType === 'pen') {
		notify('touch');
	}
};

/** Last-input tracker. Mouse clicks never switch to touch. Gamepad is reserved. */
export const startInputModeTracking = (): void => {
	if (started) {
		return;
	}

	started = true;
	mode = readDefaultMode();
	window.addEventListener('keydown', onKeyDown);
	window.addEventListener('pointerdown', onPointerDown);
};

export const getInputMode = (): InputMode => {
	return mode;
};

export const subscribeInputMode = (listener: InputModeListener): (() => void) => {
	startInputModeTracking();
	listeners.add(listener);
	return () => {
		listeners.delete(listener);
	};
};
