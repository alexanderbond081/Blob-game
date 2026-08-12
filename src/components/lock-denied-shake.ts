import { gsap } from 'gsap';
import { Container } from 'pixi.js';

const SHAKE_ANGLE = 0.18;

/**
 * Classic "won't budge" padlock shake: rotation only around the lock's anchor.
 * Caller owns layout/anchor (prefer shackle pivot ~0.5, 0.4) and any SFX.
 */
export const playLockDeniedShake = (lock: Container): void => {
	gsap.killTweensOf(lock);
	lock.rotation = 0;

	gsap.timeline()
		.to(lock, { rotation: -SHAKE_ANGLE, duration: 0.05, ease: 'power2.out' })
		.to(lock, { rotation: SHAKE_ANGLE, duration: 0.08, ease: 'power2.inOut' })
		.to(lock, { rotation: -SHAKE_ANGLE * 0.85, duration: 0.07, ease: 'power2.inOut' })
		.to(lock, { rotation: SHAKE_ANGLE * 0.7, duration: 0.07, ease: 'power2.inOut' })
		.to(lock, { rotation: -SHAKE_ANGLE * 0.4, duration: 0.06, ease: 'power2.inOut' })
		.to(lock, { rotation: 0, duration: 0.12, ease: 'power2.out' });
};
