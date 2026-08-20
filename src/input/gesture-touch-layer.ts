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

type Stroke = {
	pointerId: number;
	downX: number;
	downY: number;
	downTime: number;
	originX: number;
	originY: number;
	originTime: number;
	originLocked: boolean;
	lastX: number;
	lastY: number;
	lastTime: number;
	lastMoveTime: number;
	consumed: boolean;
	liveMoveX: number;
	jumpGestureActive: boolean;
	samples: StrokeSample[];
};

/** Degrees from ±X that are not a jump / crouch. Tune by feel. */
const HORIZONTAL_DEADZONE_DEG = 33;
/**
 * Horizontal swipe / dash is off. Until dash exists, a fast horizontal
 * flick latches run for RUN_LATCH_MS on pointer-up (not mid-stroke).
 */
const SWIPE_DISTANCE_PX = 75;
/** Slow post-settle swipes need this; short flicks use distance only. */
const SWIPE_SPEED_PX_PER_SEC = 350;
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
/** Stand-in for dash: keep full run after a fast horizontal flick. */
const RUN_LATCH_MS = 550;
/** Finger speed that maps to moveX = ±1 during a slow drag. */
const DRAG_FULL_SPEED_PX_PER_SEC = 360;
const DRAG_MIN_SPEED_PX_PER_SEC = 40;
/** Drop live analog if no real movement arrived — off-screen drag keeps the pointer down. */
const LIVE_MOVE_STALE_MS = 100;
const MAX_SAMPLES = 48;
const MAX_STROKES = 2;
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
 * Two concurrent strokes. A third contact evicts the stillest (else oldest)
 * slot without treating it as a tap — a resting thumb on the bezel must not
 * block jump / run. Live analog uses the most recently moving drag; jump and
 * crouch commit from either finger. Latches are player state, not per-finger.
 *
 * Swipe up jumps (moveX from the angle lasts until a surface or a live drag);
 * swipe down latches crouch. A fast horizontal flick latches run for 0.5 s
 * until dash exists. Slow left/right drag is live analog and dies when the
 * finger is still or lifts.
 * The first live analog sample clears jump-run so a still finger does not snap
 * back to the swipe course. Tap, a still press
 * (≥ 0.5 s), or any gameplay key clears latches when that contact is alone.
 * Jump flicks also commit on pointer-up so a short stroke is not dropped;
 * fat-finger contact jumps are treated as taps.
 */
export class GestureTouchLayer extends Container {
	private readonly viewWidth: number;
	private readonly viewHeight: number;
	private readonly hudTopReleaseY: number;
	private readonly strokes: Stroke[] = [];
	private readonly controls: PlayerControls = createEmptyPlayerControls();

	private latchedMoveX = 0;
	/** 0 = until a surface (jump-run). Else expire time for a timed run flick. */
	private runLatchUntil = 0;
	private latchedCrouch = false;
	private jumpCharge = 0;
	private jumpCommitted = false;
	private windupCancel = false;
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
		this.refreshRunLatch();
		const liveMoveX = this.resolveLiveMoveX();
		if (liveMoveX !== 0) {
			this.clearLatchedMoveX();
			if (this.jumpCharge <= 0) {
				this.latchedCrouch = false;
			}
		}

		this.controls.moveX = liveMoveX !== 0 ? liveMoveX : this.latchedMoveX;
		this.controls.jump = this.jumpCharge;
		this.controls.crouch = this.latchedCrouch;
		this.controls.jumpCommitted = this.jumpCommitted;
		this.controls.cancelJumpOnRelease = this.windupCancel;
		if (this.strokes.length === 0 && this.jumpCharge <= 0) {
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
			this.dropAllStrokes();
			this.wasClinging = feedback.clinging;
			this.wasOnGround = feedback.onGround;
			return;
		}

		if (feedback.clinging && !this.wasClinging) {
			this.clearLatchedMoveX();
			this.windupCancel = this.jumpCharge > 0;
			this.jumpCharge = 0;
			this.jumpCommitted = false;
		}

		if (feedback.onGround && !this.wasOnGround) {
			this.clearLatchedMoveX();
			this.jumpCharge = 0;
			this.jumpCommitted = false;
		} else if (!feedback.onGround && this.wasOnGround) {
			this.jumpCharge = 0;
			this.jumpCommitted = false;
		}

		// Jump-run may only persist in air. A committed swipe that never left
		// the ground (cancelled wind-up, lost capture) must not keep walking.
		// A timed horizontal flick is allowed to coast on the ground.
		if (
			feedback.onGround
			&& this.strokes.length === 0
			&& !this.jumpCommitted
			&& this.jumpCharge <= 0
			&& this.runLatchUntil <= 0
		) {
			this.clearLatchedMoveX();
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

		this.dropAllStrokes();
		super.destroy(options);
	}

	private readonly onPointerDown = (event: FederatedPointerEvent): void => {
		event.preventDefault();

		if (this.findStroke(event.pointerId)) {
			return;
		}

		const local = event.getLocalPosition(this);
		if (this.isInHudReleaseBand(local.y)) {
			return;
		}

		const hadMovingStroke = this.strokes.some((stroke) => !this.isStrokeStill(stroke));
		if (this.strokes.length >= MAX_STROKES) {
			this.dropStroke(this.pickEvictionStroke());
		}

		this.tryCapturePointer(event);
		const now = performance.now();
		this.strokes.push(createStroke(event.pointerId, local.x, local.y, now));
		if (this.wasOnGround && !hadMovingStroke) {
			this.clearLatchedMoveX();
		}
	};

	private readonly onPointerMove = (event: FederatedPointerEvent): void => {
		const stroke = this.findStroke(event.pointerId);
		if (!stroke) {
			return;
		}

		const local = event.getLocalPosition(this);
		if (this.isInHudReleaseBand(local.y)) {
			this.finishStroke(stroke, performance.now(), true);
			return;
		}

		this.trackMove(stroke, local.x, local.y, performance.now());
		if (this.isOutsidePlayfield(local.x, local.y)) {
			stroke.liveMoveX = 0;
		}
	};

	private readonly onPointerUp = (event: FederatedPointerEvent): void => {
		const stroke = this.findStroke(event.pointerId);
		if (!stroke) {
			return;
		}

		const local = event.getLocalPosition(this);
		const now = performance.now();
		stroke.lastX = local.x;
		stroke.lastY = local.y;
		stroke.lastTime = now;
		this.pushSample(stroke, local.x, local.y, now);
		this.finishStroke(stroke, now, this.isInHudReleaseBand(local.y));
	};

	private readonly onGlobalPointerEnd = (event: PointerEvent): void => {
		const stroke = this.findStroke(event.pointerId);
		if (!stroke) {
			return;
		}

		this.finishStroke(stroke, performance.now(), false);
	};

	private readonly onGlobalTouchInterrupt = (): void => {
		this.dropAllStrokes();
	};

	private readonly onWindowBlur = (): void => {
		this.dropAllStrokes();
	};

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		if (event.repeat || !GAMEPLAY_KEY_CODES.has(event.code)) {
			return;
		}

		this.clearLatchedMoveX();
		this.latchedCrouch = false;
		this.jumpCharge = 0;
		this.jumpCommitted = false;
		for (const stroke of this.strokes) {
			stroke.liveMoveX = 0;
		}
	};

	private readonly onVisibilityChange = (): void => {
		if (document.visibilityState === 'hidden') {
			this.dropAllStrokes();
		}
	};

	private trackMove(stroke: Stroke, x: number, y: number, now: number): void {
		const dtSec = Math.max(now - stroke.lastTime, MIN_SPEED_DT_MS) / 1000;
		const velX = (x - stroke.lastX) / dtSec;
		const velY = (y - stroke.lastY) / dtSec;
		const speed = Math.hypot(velX, velY);

		stroke.lastX = x;
		stroke.lastY = y;
		stroke.lastTime = now;
		if (speed >= DRAG_MIN_SPEED_PX_PER_SEC) {
			stroke.lastMoveTime = now;
		}

		this.pushSample(stroke, x, y, now);

		if (stroke.consumed) {
			stroke.liveMoveX = 0;
			return;
		}

		if (!stroke.originLocked && this.absorbSettle(stroke, x, y, now, speed)) {
			stroke.liveMoveX = 0;
			stroke.jumpGestureActive = false;
			return;
		}

		stroke.originLocked = true;

		const measure = this.measureFrom(
			stroke.originX,
			stroke.originY,
			stroke.originTime,
			x,
			y,
			now,
		);
		const jumpStroke = classifySwipe(measure.angle) === 'jump';
		stroke.jumpGestureActive = jumpStroke;

		if (this.tryCommitStroke(stroke, measure)) {
			stroke.liveMoveX = 0;
			return;
		}

		stroke.liveMoveX = jumpStroke ? 0 : this.resolveSlowDrag(velX, velY, speed);
	}

	/**
	 * Chase the contact while it is still (absorbs the fat-finger centroid jump).
	 * Lock once it quiets, or after SETTLE_MS so a long drag can start.
	 */
	private absorbSettle(stroke: Stroke, x: number, y: number, now: number, speed: number): boolean {
		stroke.originX = x;
		stroke.originY = y;
		stroke.originTime = now;

		const elapsed = now - stroke.downTime;
		const isStill = speed < SETTLE_SPEED_PX_PER_SEC;
		if (elapsed >= SETTLE_MS || (elapsed >= SETTLE_MIN_MS && isStill)) {
			return false;
		}

		return true;
	}

	private commitSwipe(stroke: Stroke, angle: number): void {
		stroke.consumed = true;
		stroke.liveMoveX = 0;

		const kind = classifySwipe(angle);
		if (kind === 'crouch') {
			this.windupCancel = this.jumpCharge > 0;
			this.latchedCrouch = true;
			this.clearLatchedMoveX();
			this.jumpCharge = 0;
			this.jumpCommitted = false;
			return;
		}

		this.latchedCrouch = false;
		this.latchMoveX(jumpMoveXFromAngle(angle));
		this.jumpCharge = jumpAxisFromAngle(angle);
		this.jumpCommitted = true;
		this.windupCancel = false;
	}

	private finishStroke(stroke: Stroke, now: number, fromHudBand: boolean): void {
		if (!this.findStroke(stroke.pointerId)) {
			return;
		}

		if (!stroke.consumed) {
			this.recognizeStrokeEnd(stroke, now, fromHudBand);
		}

		this.dropStroke(stroke);
		if (!this.jumpCommitted) {
			this.jumpCharge = 0;
		}
	}

	private recognizeStrokeEnd(stroke: Stroke, now: number, fromHudBand: boolean): void {
		const soleContact = this.strokes.length === 1;

		if (this.isFatFingerTap(stroke, now)) {
			if (soleContact) {
				this.clearLatches();
			}
			return;
		}

		const fromOrigin = this.measureFrom(
			stroke.originX,
			stroke.originY,
			stroke.originTime,
			stroke.lastX,
			stroke.lastY,
			now,
		);
		const fromDown = this.measureFrom(
			stroke.downX,
			stroke.downY,
			stroke.downTime,
			stroke.lastX,
			stroke.lastY,
			now,
		);

		if (this.tryCommitStroke(stroke, fromOrigin)) {
			return;
		}

		if (fromDown.durationMs <= FLICK_MAX_DURATION_MS && this.tryCommitStroke(stroke, fromDown)) {
			return;
		}

		if (this.tryCommitHorizontalRun(stroke, fromOrigin)) {
			return;
		}

		if (fromDown.durationMs <= FLICK_MAX_DURATION_MS && this.tryCommitHorizontalRun(stroke, fromDown)) {
			return;
		}

		if (!soleContact) {
			return;
		}

		const distance = stroke.originLocked ? fromOrigin.distance : fromDown.distance;
		const duration = stroke.originLocked ? fromOrigin.durationMs : fromDown.durationMs;
		if (distance < TAP_MAX_DISTANCE_PX && !fromHudBand && duration <= TAP_MAX_DURATION_MS) {
			this.clearLatches();
			return;
		}

		this.clearLatchedMoveX();
		if (!this.jumpCommitted) {
			this.windupCancel = true;
			this.latchedCrouch = false;
		}
	}

	private tryCommitStroke(stroke: Stroke, measure: StrokeMeasure): boolean {
		if (classifySwipe(measure.angle) === 'horizontal') {
			return false;
		}

		if (!this.meetsSwipeThreshold(measure)) {
			return false;
		}

		this.commitSwipe(stroke, measure.angle);
		return true;
	}

	private tryCommitHorizontalRun(stroke: Stroke, measure: StrokeMeasure): boolean {
		if (classifySwipe(measure.angle) !== 'horizontal') {
			return false;
		}

		if (!this.meetsSwipeThreshold(measure)) {
			return false;
		}

		stroke.consumed = true;
		stroke.liveMoveX = 0;
		this.latchedCrouch = false;
		this.latchMoveX(Math.cos(measure.angle) < 0 ? -1 : 1, RUN_LATCH_MS);
		return true;
	}

	private meetsSwipeThreshold(measure: StrokeMeasure): boolean {
		const flick = measure.durationMs <= FLICK_MAX_DURATION_MS;
		if (flick) {
			return measure.distance >= FLICK_DISTANCE_PX;
		}

		return measure.distance >= SWIPE_DISTANCE_PX && measure.speed >= SWIPE_SPEED_PX_PER_SEC;
	}

	/** Centroid jumped, then the finger sat still — that is a tap, not a swipe. */
	private isFatFingerTap(stroke: Stroke, now: number): boolean {
		const duration = now - stroke.downTime;
		if (duration <= SETTLE_MS) {
			return false;
		}

		const tail = this.sampleAtOrBefore(stroke, now - SETTLE_MS);
		const tailDist = Math.hypot(stroke.lastX - tail.x, stroke.lastY - tail.y);
		const totalDist = Math.hypot(stroke.lastX - stroke.downX, stroke.lastY - stroke.downY);
		return tailDist < TAP_MAX_DISTANCE_PX && totalDist >= SETTLE_RADIUS_PX * 0.5;
	}

	private resolveLiveMoveX(): number {
		const now = performance.now();
		let best: Stroke | null = null;
		for (const stroke of this.strokes) {
			if (stroke.liveMoveX !== 0 && now - stroke.lastMoveTime >= LIVE_MOVE_STALE_MS) {
				stroke.liveMoveX = 0;
			}

			if (stroke.liveMoveX === 0) {
				continue;
			}

			if (!best || stroke.lastMoveTime > best.lastMoveTime) {
				best = stroke;
			}
		}

		return best?.liveMoveX ?? 0;
	}

	private refreshRunLatch(): void {
		if (this.runLatchUntil <= 0) {
			return;
		}

		if (performance.now() >= this.runLatchUntil) {
			this.clearLatchedMoveX();
		}
	}

	private refreshHoldCancel(): void {
		const now = performance.now();
		const soleContact = this.strokes.length === 1;
		for (const stroke of this.strokes) {
			if (stroke.consumed) {
				continue;
			}

			const distance = Math.hypot(stroke.lastX - stroke.originX, stroke.lastY - stroke.originY);
			if (distance >= TAP_MAX_DISTANCE_PX) {
				continue;
			}

			if (now - stroke.originTime < HOLD_CANCEL_MS || now - stroke.lastMoveTime < HOLD_CANCEL_MS) {
				continue;
			}

			stroke.consumed = true;
			stroke.liveMoveX = 0;
			if (soleContact) {
				this.clearLatches();
			}
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

	private isStrokeStill(stroke: Stroke): boolean {
		if (stroke.consumed) {
			return true;
		}

		const distance = Math.hypot(stroke.lastX - stroke.originX, stroke.lastY - stroke.originY);
		return distance < TAP_MAX_DISTANCE_PX;
	}

	private pickEvictionStroke(): Stroke {
		let stillest: Stroke | null = null;
		for (const stroke of this.strokes) {
			if (!this.isStrokeStill(stroke)) {
				continue;
			}

			if (!stillest || stroke.downTime < stillest.downTime) {
				stillest = stroke;
			}
		}

		if (stillest) {
			return stillest;
		}

		let oldest = this.strokes[0];
		for (const stroke of this.strokes) {
			if (stroke.downTime < oldest.downTime) {
				oldest = stroke;
			}
		}

		return oldest;
	}

	private findStroke(pointerId: number): Stroke | undefined {
		return this.strokes.find((stroke) => stroke.pointerId === pointerId);
	}

	private pushSample(stroke: Stroke, x: number, y: number, time: number): void {
		stroke.samples.push({ x, y, time });
		while (stroke.samples.length > MAX_SAMPLES) {
			stroke.samples.shift();
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

	private sampleAtOrBefore(stroke: Stroke, time: number): StrokeSample {
		let best: StrokeSample = stroke.samples[0] ?? {
			x: stroke.downX,
			y: stroke.downY,
			time: stroke.downTime,
		};
		for (const sample of stroke.samples) {
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
		this.clearLatchedMoveX();
		this.latchedCrouch = false;
		this.jumpCharge = 0;
		this.jumpCommitted = false;
		this.windupCancel = true;
		for (const stroke of this.strokes) {
			stroke.liveMoveX = 0;
		}
	}

	private latchMoveX(moveX: number, durationMs = 0): void {
		this.latchedMoveX = moveX;
		this.runLatchUntil = durationMs > 0 ? performance.now() + durationMs : 0;
	}

	private clearLatchedMoveX(): void {
		this.latchedMoveX = 0;
		this.runLatchUntil = 0;
	}

	/** Remove a slot without recognizing it — eviction must not count as a tap. */
	private dropStroke(stroke: Stroke): void {
		const index = this.strokes.indexOf(stroke);
		if (index >= 0) {
			this.strokes.splice(index, 1);
		}
	}

	private dropAllStrokes(): void {
		this.strokes.length = 0;
		if (!this.jumpCommitted) {
			this.jumpCharge = 0;
		}
	}
}

const createStroke = (pointerId: number, x: number, y: number, now: number): Stroke => ({
	pointerId,
	downX: x,
	downY: y,
	downTime: now,
	originX: x,
	originY: y,
	originTime: now,
	originLocked: false,
	lastX: x,
	lastY: y,
	lastTime: now,
	lastMoveTime: now,
	consumed: false,
	liveMoveX: 0,
	jumpGestureActive: false,
	samples: [{ x, y, time: now }],
});

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
