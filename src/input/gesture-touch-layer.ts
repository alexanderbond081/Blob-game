import { Container, FederatedPointerEvent, Rectangle } from 'pixi.js';

import { clampAxis, createEmptyPlayerControls, PlayerControls } from './player-controls';

export type GestureTouchLayerOptions = {
	width: number;
	height: number;
	/** Pointers that enter this band (design px from the top) end the stroke. */
	hudTopReleaseY?: number;
};

export type GesturePlayerFeedback = {
	clinging: boolean;
	dying: boolean;
	onGround: boolean;
};

type StrokeSample = {
	x: number;
	y: number;
	time: number;
};

type SwipeKind = 'horizontal' | 'jump' | 'crouch';

type StrokeMeasure = {
	angle: number;
	distance: number;
	speed: number;
	durationMs: number;
};

/** Degrees from ±X that are not a jump / crouch. Tune by feel. */
const HORIZONTAL_DEADZONE_DEG = 33;
/**
 * Horizontal swipe / dash is disabled until dash exists.
 * When it returns: commit on pointer-up (not mid-stroke), require a speed
 * threshold as well as distance, and do not latch run.
 */
const SWIPE_DISTANCE_PX = 90;
/** Slow post-settle swipes need this; short flicks use distance only. */
const SWIPE_SPEED_PX_PER_SEC = 380;
/**
 * Follow the contact until it is still (fat-finger centroid jump) or this
 * timer elapses. Distance for a swipe is measured after that, not from raw down.
 */
const SETTLE_MS = 40;
const SETTLE_RADIUS_PX = 72;
const SETTLE_SPEED_PX_PER_SEC = 220;
const SETTLE_MIN_MS = 16;
const MIN_SPEED_DT_MS = 16;
/** Fast lift: commit from the whole stroke even if settle chased the finger. */
const FLICK_MAX_DURATION_MS = 160;
const FLICK_DISTANCE_PX = 90;
const TAP_MAX_DISTANCE_PX = 28;
const TAP_MAX_DURATION_MS = 280;
const HOLD_CANCEL_MS = 500;
/** Finger speed that maps to moveX = ±1 during a slow drag. */
const DRAG_FULL_SPEED_PX_PER_SEC = 360;
const DRAG_MIN_SPEED_PX_PER_SEC = 40;
/** Drop live analog if no real movement arrived — off-screen drag keeps the pointer down. */
const LIVE_MOVE_STALE_MS = 100;
const MAX_SAMPLES = 48;
const DEFAULT_HUD_TOP_RELEASE_Y = 72;
/** Elevation from ±X at which jump height matches a full keyboard jump. */
const FULL_JUMP_ELEVATION_DEG = 45;
/**
 * Mobile assist: swipe jumps scale past keyboard 1 so a near-45° flick still
 * reaches the same platforms. Keyboard stays at 1. Tune before adding a 40–50° plateau.
 */
const TOUCH_JUMP_BOOST = 1.05;

const HORIZONTAL_DEADZONE_RAD = (HORIZONTAL_DEADZONE_DEG * Math.PI) / 180;
const FULL_JUMP_ELEVATION_RAD = (FULL_JUMP_ELEVATION_DEG * Math.PI) / 180;

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

/**
 * Full-screen gesture layer. Direction only — no on-screen buttons.
 *
 * Swipe up jumps (moveX from the angle lasts until a surface); swipe down
 * latches crouch. Horizontal swipe is off until dash. Slow left/right drag
 * is live analog and dies when the finger is still or lifts. Tap, a still press (≥ 0.5 s), or any
 * gameplay key clears latches. Jump flicks also commit on pointer-up so a
 * short stroke is not dropped; fat-finger contact jumps are treated as taps.
 */
export class GestureTouchLayer extends Container {
	private readonly viewWidth: number;
	private readonly viewHeight: number;
	private readonly hudTopReleaseY: number;
	private readonly samples: StrokeSample[] = [];
	private readonly controls: PlayerControls = createEmptyPlayerControls();

	private activePointerId: number | null = null;
	private downX = 0;
	private downY = 0;
	private downTime = 0;
	private originX = 0;
	private originY = 0;
	private originTime = 0;
	private originLocked = false;
	private lastX = 0;
	private lastY = 0;
	private lastTime = 0;
	private lastMoveTime = 0;
	private strokeConsumed = false;
	private latchedMoveX = 0;
	private latchedCrouch = false;
	private liveMoveX = 0;
	private jumpCharge = 0;
	private jumpCommitted = false;
	private windupCancel = false;
	private jumpGestureActive = false;
	private wasClinging = false;
	private wasOnGround = false;

	public constructor(options: GestureTouchLayerOptions) {
		super();
		this.viewWidth = options.width;
		this.viewHeight = options.height;
		this.hudTopReleaseY = options.hudTopReleaseY ?? DEFAULT_HUD_TOP_RELEASE_Y;

		this.eventMode = 'static';
		this.cursor = 'default';
		this.hitArea = new Rectangle(0, 0, this.viewWidth, this.viewHeight);

		this.on('pointerdown', this.onPointerDown);
		this.on('pointermove', this.onPointerMove);
		this.on('pointerup', this.onPointerUp);
		this.on('pointerupoutside', this.onPointerUp);
		this.on('pointercancel', this.onPointerUp);

		// Bubble only: capture would finish the stroke before Pixi can store the
		// release point, so a down→up flick with no move would measure as 0 px.
		window.addEventListener('pointerup', this.onGlobalPointerEnd);
		window.addEventListener('pointercancel', this.onGlobalPointerEnd);
		window.addEventListener('touchcancel', this.onGlobalTouchInterrupt, true);
		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('blur', this.onWindowBlur);
		document.addEventListener('visibilitychange', this.onVisibilityChange);
	}

	public getControls(): PlayerControls {
		this.refreshHoldCancel();
		this.refreshLiveMove();
		if (this.liveMoveX !== 0 && !this.jumpGestureActive && this.jumpCharge <= 0) {
			this.latchedCrouch = false;
		}

		this.controls.moveX = this.liveMoveX !== 0 ? this.liveMoveX : this.latchedMoveX;
		this.controls.jump = this.jumpCharge;
		this.controls.crouch = this.latchedCrouch;
		this.controls.jumpCommitted = this.jumpCommitted;
		this.controls.cancelJumpOnRelease = this.windupCancel;
		if (this.activePointerId === null && this.jumpCharge <= 0) {
			this.windupCancel = false;
		}
		return { ...this.controls };
	}

	/**
	 * Clears latched jump-run on cling / landing, and everything on death.
	 * Call after the physics step so cling can start from contact this frame.
	 */
	public notePlayerState(feedback: GesturePlayerFeedback): void {
		if (feedback.dying) {
			this.clearLatches();
			this.endStroke();
			this.wasClinging = feedback.clinging;
			this.wasOnGround = feedback.onGround;
			return;
		}

		if (feedback.clinging && !this.wasClinging) {
			this.latchedMoveX = 0;
			this.windupCancel = this.jumpCharge > 0;
			this.jumpCharge = 0;
			this.jumpCommitted = false;
		}

		if (feedback.onGround && !this.wasOnGround) {
			this.latchedMoveX = 0;
			this.jumpCharge = 0;
			this.jumpCommitted = false;
		} else if (!feedback.onGround && this.wasOnGround) {
			this.jumpCharge = 0;
			this.jumpCommitted = false;
		}

		// Jump-run may only persist in air. A committed swipe that never left
		// the ground (cancelled wind-up, lost capture) must not keep walking.
		if (
			feedback.onGround
			&& this.activePointerId === null
			&& !this.jumpCommitted
			&& this.jumpCharge <= 0
		) {
			this.latchedMoveX = 0;
		}

		this.wasClinging = feedback.clinging;
		this.wasOnGround = feedback.onGround;
	}

	public override destroy(options?: Parameters<Container['destroy']>[0]): void {
		this.off('pointerdown', this.onPointerDown);
		this.off('pointermove', this.onPointerMove);
		this.off('pointerup', this.onPointerUp);
		this.off('pointerupoutside', this.onPointerUp);
		this.off('pointercancel', this.onPointerUp);

		window.removeEventListener('pointerup', this.onGlobalPointerEnd);
		window.removeEventListener('pointercancel', this.onGlobalPointerEnd);
		window.removeEventListener('touchcancel', this.onGlobalTouchInterrupt, true);
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('blur', this.onWindowBlur);
		document.removeEventListener('visibilitychange', this.onVisibilityChange);

		this.endStroke();
		super.destroy(options);
	}

	private readonly onPointerDown = (event: FederatedPointerEvent): void => {
		event.preventDefault();

		if (this.activePointerId !== null && this.activePointerId !== event.pointerId) {
			return;
		}

		if (
			event.isPrimary
			&& this.activePointerId !== null
			&& this.activePointerId !== event.pointerId
		) {
			this.endStroke();
		}

		const local = event.getLocalPosition(this);
		if (this.isInHudReleaseBand(local.y)) {
			return;
		}

		this.tryCapturePointer(event);
		this.activePointerId = event.pointerId;
		this.downX = local.x;
		this.downY = local.y;
		this.downTime = performance.now();
		this.originX = local.x;
		this.originY = local.y;
		this.originTime = this.downTime;
		this.originLocked = false;
		this.lastX = local.x;
		this.lastY = local.y;
		this.lastTime = this.downTime;
		this.lastMoveTime = this.downTime;
		this.strokeConsumed = false;
		this.jumpCharge = 0;
		this.jumpCommitted = false;
		this.windupCancel = false;
		this.jumpGestureActive = false;
		this.liveMoveX = 0;
		if (this.wasOnGround) {
			this.latchedMoveX = 0;
		}
		this.samples.length = 0;
		this.pushSample(local.x, local.y, this.downTime);
	};

	private readonly onPointerMove = (event: FederatedPointerEvent): void => {
		if (event.pointerId !== this.activePointerId) {
			return;
		}

		const local = event.getLocalPosition(this);
		if (this.isInHudReleaseBand(local.y)) {
			this.finishStroke(performance.now(), true);
			return;
		}

		this.trackMove(local.x, local.y, performance.now());
		if (this.isOutsidePlayfield(local.x, local.y)) {
			this.liveMoveX = 0;
		}
	};

	private readonly onPointerUp = (event: FederatedPointerEvent): void => {
		if (event.pointerId !== this.activePointerId) {
			return;
		}

		const local = event.getLocalPosition(this);
		const now = performance.now();
		this.lastX = local.x;
		this.lastY = local.y;
		this.lastTime = now;
		this.pushSample(local.x, local.y, now);
		this.finishStroke(now, this.isInHudReleaseBand(local.y));
	};

	private readonly onGlobalPointerEnd = (event: PointerEvent): void => {
		if (event.pointerId !== this.activePointerId) {
			return;
		}

		this.finishStroke(performance.now(), false);
	};

	private readonly onGlobalTouchInterrupt = (): void => {
		this.endStroke();
	};

	private readonly onWindowBlur = (): void => {
		this.endStroke();
	};

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		if (event.repeat || !GAMEPLAY_KEY_CODES.has(event.code)) {
			return;
		}

		this.latchedMoveX = 0;
		this.latchedCrouch = false;
		this.liveMoveX = 0;
		this.jumpCharge = 0;
		this.jumpCommitted = false;
	};

	private readonly onVisibilityChange = (): void => {
		if (document.visibilityState === 'hidden') {
			this.endStroke();
		}
	};

	private trackMove(x: number, y: number, now: number): void {
		const dtSec = Math.max(now - this.lastTime, MIN_SPEED_DT_MS) / 1000;
		const velX = (x - this.lastX) / dtSec;
		const velY = (y - this.lastY) / dtSec;
		const speed = Math.hypot(velX, velY);

		this.lastX = x;
		this.lastY = y;
		this.lastTime = now;
		if (speed >= DRAG_MIN_SPEED_PX_PER_SEC) {
			this.lastMoveTime = now;
		}

		this.pushSample(x, y, now);

		if (this.strokeConsumed) {
			this.liveMoveX = 0;
			return;
		}

		if (!this.originLocked && this.absorbSettle(x, y, now, speed)) {
			this.liveMoveX = 0;
			this.jumpGestureActive = false;
			return;
		}

		this.originLocked = true;

		const stroke = this.measureFrom(this.originX, this.originY, this.originTime, x, y, now);
		const kind = classifySwipe(stroke.angle);
		const jumpStroke = kind === 'jump';
		this.jumpGestureActive = jumpStroke;

		if (this.tryCommitStroke(stroke)) {
			this.liveMoveX = 0;
			return;
		}

		this.liveMoveX = jumpStroke ? 0 : this.resolveSlowDrag(velX, velY, speed);
	}

	/**
	 * Chase the contact while it is still (absorbs the fat-finger centroid jump).
	 * Lock once it quiets, or after SETTLE_MS so a long drag can start.
	 */
	private absorbSettle(x: number, y: number, now: number, speed: number): boolean {
		this.originX = x;
		this.originY = y;
		this.originTime = now;

		const elapsed = now - this.downTime;
		const isStill = speed < SETTLE_SPEED_PX_PER_SEC;
		if (elapsed >= SETTLE_MS || (elapsed >= SETTLE_MIN_MS && isStill)) {
			return false;
		}

		return true;
	}

	private commitSwipe(angle: number): void {
		const kind = classifySwipe(angle);
		this.strokeConsumed = true;
		this.liveMoveX = 0;

		if (kind === 'crouch') {
			this.windupCancel = this.jumpCharge > 0;
			this.latchedCrouch = true;
			this.latchedMoveX = 0;
			this.jumpCharge = 0;
			this.jumpCommitted = false;
			return;
		}

		this.latchedCrouch = false;
		this.latchedMoveX = jumpMoveXFromAngle(angle);
		this.jumpCharge = jumpAxisFromAngle(angle);
		this.jumpCommitted = true;
		this.windupCancel = false;
	}

	private finishStroke(now: number, fromHudBand: boolean): void {
		if (this.activePointerId === null) {
			return;
		}

		if (!this.strokeConsumed) {
			this.recognizeStrokeEnd(now, fromHudBand);
		}

		this.endStroke();
	}

	private recognizeStrokeEnd(now: number, fromHudBand: boolean): void {
		if (this.isFatFingerTap(now)) {
			this.clearLatches();
			return;
		}

		const fromOrigin = this.measureFrom(
			this.originX,
			this.originY,
			this.originTime,
			this.lastX,
			this.lastY,
			now,
		);
		const fromDown = this.measureFrom(
			this.downX,
			this.downY,
			this.downTime,
			this.lastX,
			this.lastY,
			now,
		);

		if (this.tryCommitStroke(fromOrigin)) {
			return;
		}

		if (fromDown.durationMs <= FLICK_MAX_DURATION_MS && this.tryCommitStroke(fromDown)) {
			return;
		}

		const distance = this.originLocked ? fromOrigin.distance : fromDown.distance;
		const duration = this.originLocked ? fromOrigin.durationMs : fromDown.durationMs;
		if (distance < TAP_MAX_DISTANCE_PX && !fromHudBand && duration <= TAP_MAX_DURATION_MS) {
			this.clearLatches();
			return;
		}

		this.latchedMoveX = 0;
		if (!this.jumpCommitted) {
			this.windupCancel = true;
			this.latchedCrouch = false;
		}
	}

	private tryCommitStroke(stroke: StrokeMeasure): boolean {
		if (classifySwipe(stroke.angle) === 'horizontal') {
			return false;
		}

		const flick = stroke.durationMs <= FLICK_MAX_DURATION_MS;
		if (flick) {
			if (stroke.distance < FLICK_DISTANCE_PX) {
				return false;
			}
		} else if (stroke.distance < SWIPE_DISTANCE_PX || stroke.speed < SWIPE_SPEED_PX_PER_SEC) {
			return false;
		}

		this.commitSwipe(stroke.angle);
		return true;
	}

	/** Centroid jumped, then the finger sat still — that is a tap, not a swipe. */
	private isFatFingerTap(now: number): boolean {
		const duration = now - this.downTime;
		if (duration <= SETTLE_MS) {
			return false;
		}

		const tail = this.sampleAtOrBefore(now - SETTLE_MS);
		const tailDist = Math.hypot(this.lastX - tail.x, this.lastY - tail.y);
		const totalDist = Math.hypot(this.lastX - this.downX, this.lastY - this.downY);
		return tailDist < TAP_MAX_DISTANCE_PX && totalDist >= SETTLE_RADIUS_PX * 0.5;
	}

	private refreshLiveMove(): void {
		if (this.activePointerId === null || this.liveMoveX === 0) {
			return;
		}

		if (performance.now() - this.lastMoveTime >= LIVE_MOVE_STALE_MS) {
			this.liveMoveX = 0;
		}
	}

	private refreshHoldCancel(): void {
		if (this.activePointerId === null || this.strokeConsumed) {
			return;
		}

		const now = performance.now();
		const distance = Math.hypot(this.lastX - this.originX, this.lastY - this.originY);
		if (distance >= TAP_MAX_DISTANCE_PX) {
			return;
		}

		if (now - this.originTime >= HOLD_CANCEL_MS && now - this.lastMoveTime >= HOLD_CANCEL_MS) {
			this.clearLatches();
			this.strokeConsumed = true;
		}
	}

	private resolveSlowDrag(velX: number, velY: number, speed: number): number {
		if (speed < DRAG_MIN_SPEED_PX_PER_SEC) {
			return 0;
		}

		if (Math.abs(velY) > Math.abs(velX) * 1.5) {
			return 0;
		}

		return clampAxis(velX / DRAG_FULL_SPEED_PX_PER_SEC);
	}

	private isInHudReleaseBand(localY: number): boolean {
		return localY < this.hudTopReleaseY;
	}

	private isOutsidePlayfield(localX: number, localY: number): boolean {
		return localX < 0 || localX > this.viewWidth || localY > this.viewHeight;
	}

	private pushSample(x: number, y: number, time: number): void {
		this.samples.push({ x, y, time });
		while (this.samples.length > MAX_SAMPLES) {
			this.samples.shift();
		}
	}

	private measureFrom(
		originX: number,
		originY: number,
		originTime: number,
		x: number,
		y: number,
		now: number,
	): StrokeMeasure {
		const dx = x - originX;
		const dy = y - originY;
		const distance = Math.hypot(dx, dy);
		const durationMs = Math.max(now - originTime, 0);
		const dtSec = Math.max(durationMs, MIN_SPEED_DT_MS) / 1000;
		return {
			angle: Math.atan2(dy, dx),
			distance,
			speed: distance / dtSec,
			durationMs,
		};
	}

	private sampleAtOrBefore(time: number): StrokeSample {
		let best: StrokeSample = this.samples[0] ?? {
			x: this.downX,
			y: this.downY,
			time: this.downTime,
		};
		for (const sample of this.samples) {
			if (sample.time > time) {
				break;
			}
			best = sample;
		}
		return best;
	}

	private tryCapturePointer(event: FederatedPointerEvent): void {
		const native = event.nativeEvent;
		if (!(native instanceof PointerEvent)) {
			return;
		}

		const target = native.target;
		if (!(target instanceof Element) || typeof target.setPointerCapture !== 'function') {
			return;
		}

		try {
			target.setPointerCapture(native.pointerId);
		} catch {
			// Capture can fail if the pointer was already released by the OS.
		}
	}

	private clearLatches(): void {
		this.latchedMoveX = 0;
		this.latchedCrouch = false;
		this.jumpCharge = 0;
		this.jumpCommitted = false;
		this.windupCancel = true;
		this.liveMoveX = 0;
	}

	private endStroke(): void {
		this.activePointerId = null;
		this.samples.length = 0;
		this.liveMoveX = 0;
		this.strokeConsumed = false;
		this.jumpGestureActive = false;
		this.originLocked = false;
		// Keep a committed jump until takeoff so a fast lift still launches.
		// latchedMoveX stays until a surface; an unfinished swipe must not.
		if (!this.jumpCommitted) {
			this.jumpCharge = 0;
		}
	}
}

const classifySwipe = (angle: number): SwipeKind => {
	const absAngle = Math.abs(angle);
	const distToHorizontal = Math.min(absAngle, Math.PI - absAngle);
	if (distToHorizontal <= HORIZONTAL_DEADZONE_RAD) {
		return 'horizontal';
	}

	return angle > 0 ? 'crouch' : 'jump';
};

const swipeElevation = (angle: number): number => {
	return Math.min(Math.abs(angle), Math.PI - Math.abs(angle));
};

const jumpAxisFromAngle = (angle: number): number => {

	const elevation = swipeElevation(angle);
	if (elevation >= FULL_JUMP_ELEVATION_RAD) {
		return TOUCH_JUMP_BOOST;
	}

	return ((elevation / FULL_JUMP_ELEVATION_RAD) * TOUCH_JUMP_BOOST + TOUCH_JUMP_BOOST) / 2;
};

/** 45° is a boosted full run; steeper swipes ease toward a vertical jump. */
const jumpMoveXFromAngle = (angle: number): number => {
	const sign = Math.cos(angle) < 0 ? -1 : 1;
	const elevation = swipeElevation(angle);
	if (elevation <= FULL_JUMP_ELEVATION_RAD) {
		return sign * TOUCH_JUMP_BOOST;
	}

	const t = (Math.PI * 0.5 - elevation) / (Math.PI * 0.5 - FULL_JUMP_ELEVATION_RAD);
	return sign * Math.max(0, t) * TOUCH_JUMP_BOOST;
};
