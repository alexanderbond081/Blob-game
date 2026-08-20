import { gsap } from 'gsap';

import {
	getSwipeRange,
	HINT_CONTACT_FADE_SEC,
	HINT_CYCLE_PAUSE_SEC,
	HINT_HAND_FADE_IN_SEC,
	HINT_HAND_FADE_OUT_SEC,
	HINT_MOVE_SPEED,
	HINT_PRESS_PX,
	JUMP_HINT_SIZE,
} from './hint-layout';
import { LevelHint } from './level-hint';

/** Hide / crouch poster: swipe down, or ↓ / S held like a move hint. */
export class CrouchHint extends LevelHint {
	public constructor(x: number, y: number) {
		super(x, y, JUMP_HINT_SIZE);
		this.beginPlayback();
	}

	protected buildTouchTimeline(): gsap.core.Timeline {
		const range = getSwipeRange(JUMP_HINT_SIZE);
		const midX = (range.minX + range.maxX) * 0.5;
		const topY = range.minY;
		const bottomY = range.maxY;
		const pressedTopY = topY + HINT_PRESS_PX;
		const pressedBottomY = bottomY + HINT_PRESS_PX;
		const slideSec = Math.abs(pressedBottomY - pressedTopY) / HINT_MOVE_SPEED;

		this.tip.x = midX;
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
		timeline.set(this.tip, { x: midX, y: topY });
		timeline.to(this.pointer.hand, { alpha: 1, duration: HINT_HAND_FADE_IN_SEC });
		timeline.to(this.tip, { y: pressedTopY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 1, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.call(() => {
			this.setSamplingTrail(true);
			this.pointer.sampleTrail(this.tip.x, this.tip.y);
		});
		timeline.to(this.tip, { y: pressedBottomY, duration: slideSec, ease: 'none' });
		timeline.call(() => {
			this.setSamplingTrail(false);
		});
		timeline.to(this.tip, { y: bottomY, duration: HINT_CONTACT_FADE_SEC });
		timeline.to(this.pointer.contact, { alpha: 0, duration: HINT_CONTACT_FADE_SEC }, '<');
		timeline.to(this.pointer.hand, { alpha: 0, duration: HINT_HAND_FADE_OUT_SEC });
		this.hold(timeline, HINT_CYCLE_PAUSE_SEC);
		return timeline;
	}

	protected buildKeyboardTimeline(): gsap.core.Timeline {
		return this.playKeyboardCycle(['down']);
	}
}
