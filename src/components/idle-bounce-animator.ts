import { gsap } from 'gsap';
import { Container } from 'pixi.js';

import { UIButton } from './ui-button';

const DEFAULT_INTERVAL_SEC = 8;
const DEFAULT_INTRO_DELAY_SEC = 0.5;
const DEFAULT_HOP_PX = 22;

/**
 * Idle Play / Continue bounce:
 * - after a short intro delay → sit + elastic restore (keeps the CTA alive early);
 * - every `intervalSec` → full sit → hop → hop → restore.
 *
 * Not a MouseActionDecoration: timing is independent of pointer; call start/stop
 * when the host becomes the focused CTA (menu unlocked, modal open, …).
 */
export class IdleBounceAnimator {
	private readonly intervalSec: number;
	private readonly introDelaySec: number;
	private readonly hopPx: number;
	private host: Container | null = null;
	private introDelay: gsap.core.Tween | null = null;
	private loopDelay: gsap.core.Tween | null = null;
	private bounce: gsap.core.Timeline | null = null;
	private running = false;
	private restY = 0;

	public constructor(
		intervalSec = DEFAULT_INTERVAL_SEC,
		hopPx = DEFAULT_HOP_PX,
		introDelaySec = DEFAULT_INTRO_DELAY_SEC,
	) {
		this.intervalSec = intervalSec;
		this.hopPx = hopPx;
		this.introDelaySec = introDelaySec;
	}

	public attach(host: Container): void {
		if (this.host === host) {
			return;
		}

		this.stop();
		this.host = host;
	}

	public start(): void {
		if (!this.host || this.running) {
			return;
		}

		this.restY = this.host.y;
		this.running = true;
		this.scheduleIntro();
		this.scheduleLoop();
	}

	public stop(): void {
		this.running = false;
		this.introDelay?.kill();
		this.introDelay = null;
		this.loopDelay?.kill();
		this.loopDelay = null;
		this.bounce?.kill();
		this.bounce = null;
		this.resetHostTransform();
	}

	/**
	 * Call after layout moves the button so the next bounce / stop uses the new rest Y.
	 */
	public syncRestPosition(): void {
		if (!this.host || this.bounce?.isActive()) {
			return;
		}

		this.restY = this.host.y;
	}

	public destroy(): void {
		this.stop();
		this.host = null;
	}

	private scheduleIntro(): void {
		this.introDelay?.kill();
		this.introDelay = null;

		if (!this.running || !this.host) {
			return;
		}

		this.introDelay = gsap.delayedCall(this.introDelaySec, () => {
			if (this.running) {
				this.playNudge();
			}
		});
	}

	private scheduleLoop(): void {
		this.loopDelay?.kill();
		this.loopDelay = null;

		if (!this.running || !this.host) {
			return;
		}

		this.loopDelay = gsap.delayedCall(this.intervalSec, () => {
			this.playFullBounce();
			this.scheduleLoop();
		});
	}

	/** Sit + elastic restore — early “alive” cue without a hop. */
	private playNudge(): void {
		const prepared = this.beginClip();
		if (!prepared) {
			return;
		}

		const { button, restY, height } = prepared;
		this.bounce = gsap.timeline()
			.add(this.buildSit(button, restY, height))
			.add(this.buildRestore(button, restY));
	}

	/** Sit → hop → hop → restore. */
	private playFullBounce(): void {
		const prepared = this.beginClip();
		if (!prepared) {
			return;
		}

		const { button, restY, height } = prepared;
		this.bounce = gsap.timeline()
			.add(this.buildSit(button, restY, height))
			.add(this.buildHop(button, restY, height))
			.add(this.buildHop(button, restY, height))
			.add(this.buildRestore(button, restY));
	}

	private beginClip(): { button: Container; restY: number; height: number } | null {
		const button = this.host;
		if (!button || !this.running) {
			return null;
		}

		const restY = button.y;
		this.restY = restY;
		const height = button.height;

		this.bounce?.kill();
		gsap.killTweensOf(button);
		button.scale.set(1);
		button.y = restY;
		if (button instanceof UIButton) {
			button.adjustScale(1, 1);
		}

		return { button, restY, height };
	}

	private buildSit(button: Container, restY: number, height: number): gsap.core.Timeline {
		return gsap.timeline()
			.to(button, {
				pixi: {
					scaleX: 1.2, scaleY: 0.8, y: restY + height * 0.1,
				},
				duration: 0.22,
				ease: 'power1.out',
			});
	}

	private buildHop(button: Container, restY: number, height: number): gsap.core.Timeline {
		return gsap.timeline()
			.to(button, {
				pixi: { scaleX: 0.85, scaleY: 1.15, y: restY - this.hopPx },
				duration: 0.15,
				ease: 'power2.out',
			})
			.to(button, {
				pixi: { scaleX: 1.05, scaleY: 0.95, y: restY - this.hopPx - height * 0.025 },
				duration: 0.07,
				ease: 'power1.out',
			})
			.to(button, {
				pixi: { scaleX: 1.1, scaleY: 0.9, y: restY + height * 0.05 },
				duration: 0.15,
				ease: 'power1.in',
			})
			.to(button, {
				pixi: { scaleX: 1.2, scaleY: 0.8, y: restY + height * 0.1 },
				duration: 0.07,
				ease: 'power1.out',
			});
	}

	private buildRestore(button: Container, restY: number): gsap.core.Timeline {
		return gsap.timeline()
			.to(button, {
				pixi: { scaleX: 1, scaleY: 1, y: restY },
				duration: 0.6,
				ease: 'elastic.out(1.1, 0.4)',
			});
	}

	private resetHostTransform(): void {
		const button = this.host;
		if (!button) {
			return;
		}

		gsap.killTweensOf(button);
		button.scale.set(1);
		button.y = this.restY;
		if (button instanceof UIButton) {
			button.adjustScale(1, 1);
		}
	}
}
