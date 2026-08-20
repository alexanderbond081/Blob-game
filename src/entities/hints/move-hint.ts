import { gsap } from 'gsap';

import {
	getSwipeRange,
	HINT_CONTACT_FADE_SEC,
	HINT_CYCLE_PAUSE_SEC,
	HINT_HAND_FADE_IN_SEC,
	HINT_HAND_FADE_OUT_SEC,
	HINT_MOVE_SPEED,
	HINT_PRESS_PX,
	HintAxis,
	MOVE_HINT_SIZE,
} from './hint-layout';
import { KeySlot } from './keyboard-cluster';
import { LevelHint } from './level-hint';

/** Horizontal walk poster. Axis +1 is right, −1 is left. */
export class MoveHint extends LevelHint {
	private readonly axis: HintAxis;

	public constructor(x: number, y: number, axis: HintAxis) {
		super(x, y, MOVE_HINT_SIZE);
		this.axis = axis;
		this.beginPlayback();
	}

	protected buildTouchTimeline(): gsap.core.Timeline {
		const range = getSwipeRange(MOVE_HINT_SIZE);
		const restY = (range.minY + range.maxY) * 0.5;
		const startX = this.axis > 0 ? range.minX : range.maxX;
		const endX = this.axis > 0 ? range.maxX : range.minX;
		const pressedY = restY + HINT_PRESS_PX;
		const slideSec = Math.abs(endX - startX) / HINT_MOVE_SPEED;

		this.tip.x = startX;
		this.tip.y = restY;
		this.setSamplingTrail(false);
		this.pointer.hand.alpha = 0;
		this.pointer.contact.alpha = 0;
		this.pointer.resetTrail();
		this.applyTip();

		const timeline = gsap.timeline({
			repeat: -1,
			onUpdate: () => {
				this.applyTip();
			},
			onRepeat: () => {
				this.setSamplingTrail(false);
				this.pointer.resetTrail();
			},
		});

		timeline.set(this.pointer.hand, { alpha: 0 });
		timeline.set(this.pointer.contact, { alpha: 0 });
		timeline.set(this.tip, { x: startX, y: restY });
		timeline.to(this.pointer.hand, { alpha: 1, duration: HINT_HAND_FADE_IN_SEC });
		timeline.to(this.tip, { y: pressedY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 1, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.call(() => {
			this.setSamplingTrail(true);
			this.pointer.sampleTrail(this.tip.x, this.tip.y);
		});
		timeline.to(this.tip, { x: endX, duration: slideSec, ease: 'none' });
		timeline.call(() => {
			this.setSamplingTrail(false);
		});
		timeline.to(this.tip, { y: restY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 0, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.to(this.pointer.hand, { alpha: 0, duration: HINT_HAND_FADE_OUT_SEC });
		this.hold(timeline, HINT_CYCLE_PAUSE_SEC);
		return timeline;
	}

	protected buildKeyboardTimeline(): gsap.core.Timeline {
		const held: KeySlot[] = this.axis > 0 ? ['right'] : ['left'];
		return this.playKeyboardCycle(held);
	}
}
