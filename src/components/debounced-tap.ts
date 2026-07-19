import { gsap } from 'gsap';
import { Container } from 'pixi.js';

type DebouncedTapOptions = {
	debounceMs?: number;
};

export const bindDebouncedTap = (
	target: Container,
	onTap: () => void,
	options: DebouncedTapOptions = {},
): void => {
	const debounceMs = options.debounceMs ?? 0.15;
	let isClickBlocked = false;

	target.on('pointertap', () => {
		if (isClickBlocked) {
			return;
		}

		onTap();
		isClickBlocked = true;
		gsap.delayedCall(debounceMs, () => {
			isClickBlocked = false;
		});
	});
};
