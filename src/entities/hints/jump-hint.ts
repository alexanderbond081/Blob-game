import { gsap } from 'gsap';

import {
	getSwipeRange,
	HINT_CONTACT_FADE_SEC,
	HINT_CYCLE_PAUSE_SEC,
	HINT_HAND_FADE_IN_SEC,
	HINT_HAND_FADE_OUT_SEC,
	HINT_JUMP_SPEED,
	HINT_PRESS_PX,
	HintAxis,
	JUMP_HINT_SIZE,
} from './hint-layout';
import { KeySlot } from './keyboard-cluster';
import { LevelHint } from './level-hint';

/** Diagonal jump poster. Axis +1 is jump-right, −1 is jump-left. */
export class JumpHint extends LevelHint {
	private readonly axis: HintAxis;

	public constructor(x: number, y: number, axis: HintAxis) {
		super(x, y, JUMP_HINT_SIZE);
		this.axis = axis;
		this.beginPlayback();
	}

	protected buildTouchTimeline(): gsap.core.Timeline {
		const range = getSwipeRange(JUMP_HINT_SIZE);
		const startX = this.axis > 0 ? range.minX : range.maxX;
		const endX = this.axis > 0 ? range.maxX : range.minX;
		const startY = range.maxY;
		const endY = range.minY;
		const pressedStartY = startY + HINT_PRESS_PX;
		const pressedEndY = endY + HINT_PRESS_PX;
		const distance = Math.hypot(endX - startX, pressedEndY - pressedStartY);
		const slideSec = distance / HINT_JUMP_SPEED;

		this.tip.x = startX;
		this.tip.y = startY;
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
		timeline.set(this.tip, { x: startX, y: startY });
		timeline.to(this.pointer.hand, { alpha: 1, duration: HINT_HAND_FADE_IN_SEC });
		timeline.to(this.tip, { y: pressedStartY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 1, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.call(() => {
			this.setSamplingTrail(true);
			this.pointer.sampleTrail(this.tip.x, this.tip.y);
		});
		timeline.to(this.tip, {
			x: endX,
			y: pressedEndY,
			duration: slideSec,
			ease: 'power2.in',
		});
		timeline.call(() => {
			this.setSamplingTrail(false);
		});
		timeline.to(this.tip, { y: endY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 0, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.to(this.pointer.hand, { alpha: 0, duration: HINT_HAND_FADE_OUT_SEC });
		this.hold(timeline, HINT_CYCLE_PAUSE_SEC);
		return timeline;
	}

	protected buildKeyboardTimeline(): gsap.core.Timeline {
		const held: KeySlot[] = this.axis > 0 ? ['up', 'right'] : ['up', 'left'];
		return this.playKeyboardCycle(held);
	}
}
