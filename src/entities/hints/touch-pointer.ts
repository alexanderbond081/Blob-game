import { gsap } from 'gsap';
import { Container, Graphics, Sprite } from 'pixi.js';

import {
	HAND_FINGERTIP_ANCHOR,
	HINT_TOUCH_HAND_ALIAS,
	HINT_TOUCH_POINT_ALIAS,
	HINT_TRAIL_COLOR,
	HINT_TRAIL_LIFETIME_SEC,
	HINT_TRAIL_WIDTH,
	requireHintTexture,
} from './hint-layout';

type TrailPoint = {
	x: number;
	y: number;
	born: number;
};

class SwipeTrail extends Graphics {
	private points: TrailPoint[] = [];

	public clearPoints(): void {
		this.points = [];
		this.clear();
	}

	public sample(x: number, y: number): void {
		const last = this.points[this.points.length - 1];
		if (last && Math.hypot(x - last.x, y - last.y) < 1) {
			return;
		}

		this.points.push({ x, y, born: gsap.globalTimeline.time() });
	}

	public redraw(): void {
		const now = gsap.globalTimeline.time();
		this.points = this.points.filter((point) => now - point.born < HINT_TRAIL_LIFETIME_SEC);
		this.clear();

		if (this.points.length === 0) {
			return;
		}

		const radius = HINT_TRAIL_WIDTH * 0.5;
		for (let i = 0; i < this.points.length; i += 1) {
			const point = this.points[i];
			const alpha = Math.max(0, 1 - (now - point.born) / HINT_TRAIL_LIFETIME_SEC);
			if (i > 0) {
				const prev = this.points[i - 1];
				this.moveTo(prev.x, prev.y);
				this.lineTo(point.x, point.y);
				this.stroke({
					width: HINT_TRAIL_WIDTH,
					color: HINT_TRAIL_COLOR,
					alpha,
					cap: 'round',
					join: 'round',
				});
			}

			this.circle(point.x, point.y, radius);
			this.fill({ color: HINT_TRAIL_COLOR, alpha });
		}
	}
}

/** Hand cursor + contact ring + fading swipe ribbon. Position is the fingertip. */
export class TouchPointer extends Container {
	public readonly hand: Sprite;
	public readonly contact: Sprite;
	public readonly trail: SwipeTrail;

	public constructor() {
		super();
		this.eventMode = 'none';

		this.trail = new SwipeTrail();
		this.trail.eventMode = 'none';
		this.addChild(this.trail);

		this.contact = new Sprite(requireHintTexture(HINT_TOUCH_POINT_ALIAS));
		this.contact.anchor.set(0.5);
		this.contact.eventMode = 'none';
		this.contact.alpha = 0;
		this.addChild(this.contact);

		this.hand = new Sprite(requireHintTexture(HINT_TOUCH_HAND_ALIAS));
		this.hand.anchor.set(HAND_FINGERTIP_ANCHOR.x, HAND_FINGERTIP_ANCHOR.y);
		this.hand.eventMode = 'none';
		this.hand.alpha = 0;
		this.addChild(this.hand);
	}

	public setFingertip(x: number, y: number): void {
		this.hand.position.set(x, y);
		this.contact.position.set(x, y);
	}

	public resetTrail(): void {
		this.trail.clearPoints();
	}

	public sampleTrail(x: number, y: number): void {
		this.trail.sample(x, y);
	}

	public redrawTrail(): void {
		this.trail.redraw();
	}
}
