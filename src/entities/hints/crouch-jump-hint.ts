import { gsap } from 'gsap';

import {
	getSwipeRange,
	HINT_CONTACT_FADE_SEC,
	HINT_CYCLE_PAUSE_SEC,
	HINT_HAND_FADE_IN_SEC,
	HINT_HAND_FADE_OUT_SEC,
	HINT_JUMP_SPEED,
	HINT_KEY_SHORT_SEC,
	HINT_MOVE_SPEED,
	HINT_PRESS_PX,
	HINT_SLIDE_GAP_SEC,
	HintAxis,
	JUMP_HINT_SIZE,
} from './hint-layout';
import { KeySlot } from './keyboard-cluster';
import { LevelHint } from './level-hint';

/**
 * Crouch then diagonal jump. Axis +1 is crouchJump-right, −1 is crouchJump-left.
 * Touch: swipe down, then the same up-diagonal as JumpHint.
 */
export class CrouchJumpHint extends LevelHint {
	private readonly axis: HintAxis;

	public constructor(x: number, y: number, axis: HintAxis) {
		super(x, y, JUMP_HINT_SIZE);
		this.axis = axis;
		this.beginPlayback();
	}

	protected buildTouchTimeline(): gsap.core.Timeline {
		const range = getSwipeRange(JUMP_HINT_SIZE);
		const topX = this.axis > 0 ? range.minX : range.maxX;
		const jumpEndX = this.axis > 0 ? range.maxX : range.minX;
		const topY = range.minY;
		const bottomY = range.maxY;
		const pressedTopY = topY + HINT_PRESS_PX;
		const pressedBottomY = bottomY + HINT_PRESS_PX;
		const crouchSec = Math.abs(pressedBottomY - pressedTopY) / HINT_MOVE_SPEED;
		const jumpSec = Math.hypot(jumpEndX - topX, pressedTopY - pressedBottomY) / HINT_JUMP_SPEED;

		this.tip.x = topX;
		this.tip.y = topY;
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
		timeline.set(this.tip, { x: topX, y: topY });
		timeline.to(this.pointer.hand, { alpha: 1, duration: HINT_HAND_FADE_IN_SEC });
		timeline.to(this.tip, { y: pressedTopY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 1, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.call(() => {
			this.setSamplingTrail(true);
			this.pointer.sampleTrail(this.tip.x, this.tip.y);
		});
		timeline.to(this.tip, { y: pressedBottomY, duration: crouchSec, ease: 'none' });
		timeline.call(() => {
			this.setSamplingTrail(false);
		});
		timeline.to(this.tip, { y: bottomY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 0, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.to(this.pointer.hand, { alpha: 0, duration: HINT_HAND_FADE_OUT_SEC });
		timeline.call(() => {
			this.pointer.resetTrail();
		});
		this.hold(timeline, HINT_SLIDE_GAP_SEC);
		timeline.to(this.pointer.hand, { alpha: 1, duration: HINT_HAND_FADE_IN_SEC });
		timeline.to(this.tip, { y: pressedBottomY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 1, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.call(() => {
			this.setSamplingTrail(true);
			this.pointer.sampleTrail(this.tip.x, this.tip.y);
		});
		timeline.to(this.tip, {
			x: jumpEndX,
			y: pressedTopY,
			duration: jumpSec,
			ease: 'power2.in',
		});
		timeline.call(() => {
			this.setSamplingTrail(false);
		});
		timeline.to(this.tip, { y: topY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 0, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.to(this.pointer.hand, { alpha: 0, duration: HINT_HAND_FADE_OUT_SEC });
		this.hold(timeline, HINT_CYCLE_PAUSE_SEC);
		return timeline;
	}

	protected buildKeyboardTimeline(): gsap.core.Timeline {
		const held: KeySlot[] = this.axis > 0 ? ['up', 'right'] : ['up', 'left'];
		return this.playKeyboardCycle(held, { slots: ['down'], durationSec: HINT_KEY_SHORT_SEC });
	}
}
