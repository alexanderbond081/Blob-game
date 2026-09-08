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

/**
 * What a swipe is judged on. Amplitude runs from the anchor while speed and
 * angle come from the release window only — a separate type so the two can not
 * be quietly measured over the same span again.
 */
type SwipeMeasure = {
	angle: number;
	distance: number;
	speed: number;
};

/** Speed and heading averaged over the window, plus the sample it started at. */
type WindowVelocity = {
	angle: number;
	speed: number;
	from: StrokeSample;
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
	liveMoveY: number;
	jumpGestureActive: boolean;
	/** Where the fast phase began. Null while the finger is below the gate. */
	flickAnchor: StrokeSample | null;
	samples: StrokeSample[];
};

/** Degrees from ±X that are not a jump / crouch. Tune by feel. */
const HORIZONTAL_DEADZONE_DEG = 33;
/**
 * Swipe recognition. One rule for jump / crouch / run on every measurement:
 * far enough and fast enough. Speed decides when the gesture started, distance
 * decides how far it went from there — independent quantities, so neither knob
 * can be derived from the other.
 */
const SWIPE_DISTANCE_PX = 80; //75;
const SWIPE_SPEED_PX_PER_SEC = 500; //350;
/**
 * Speed that releases the amplitude anchor, as a share of the speed that plants
 * it. Hysteresis is what keeps the anchor still: without it, jitter around the
 * gate would re-plant the anchor every few samples and amplitude would never
 * accumulate. A ratio, so retuning the speed gate carries the release with it.
 */
const FLICK_RELEASE_SPEED_RATIO = 0.75;

/**
 * Follow the contact until it is still (fat-finger centroid jump) or this
 * timer elapses. Distance for a swipe is measured after that, not from raw down.
 */
const SETTLE_MS = 40;
const SETTLE_SPEED_PX_PER_SEC = 250; //220;
const SETTLE_MIN_MS = 16;
const MIN_SPEED_DT_MS = 16;

/**
 * Averaging window for speed and angle, and nothing else. Amplitude must never
 * be measured over it: a windowed amplitude would make SWIPE_DISTANCE_PX divided
 * by this window an implicit speed floor and leave SWIPE_SPEED_PX_PER_SEC dead.
 * Without the window, speed would be the average since the settle origin, which
 * can be seconds old and hides a finger that stopped before lifting.
 */
const GESTURE_WINDOW_MS = 60;
/**
 * The contact centroid smears while the finger leaves the glass, so the tail
 * is dropped before measuring. Short flicks must survive that cut, hence the
 * floor: never trim past RELEASE_KEEP_MIN_MS of stroke, and at minimum drop
 * only the final sample.
 */
const RELEASE_TRIM_MS = 5;
const RELEASE_KEEP_MIN_MS = 20;

/**
 * Recovery lane. Settle can eat the first SETTLE_MS of a real flick, so a
 * short stroke is re-measured from the raw contact point on lift. This is the
 * only path with the centroid jump inside the measurement — set
 * RECOVER_FROM_CONTACT to false to play without it and compare.
 */
const RECOVER_FROM_CONTACT: boolean = true;
const RECOVER_MAX_DURATION_MS = 160;
/** Post-settle travel proving the flick was real, not a centroid jump alone. */
const RECOVER_MIN_POST_SETTLE_PX = 48;

/**
 * Contact rolled on touch-down and then parked — a tap, not a swipe. The
 * window and the tail radius together act as a release-speed floor, so keep
 * them separate from SETTLE_* and TAP_* even when the numbers happen to match.
 */
const CONTACT_ROLL_WINDOW_MS = 40;
const CONTACT_ROLL_MAX_TAIL_PX = 28;
const CONTACT_ROLL_MIN_TOTAL_PX = 35;

const TAP_MAX_DISTANCE_PX = 28;
const TAP_MAX_DURATION_MS = 280;
const HOLD_CANCEL_MS = 500;
/** Stand-in for dash: keep full run after a fast horizontal flick. */
const RUN_LATCH_MS = 550;
/** Finger speed that maps to analog ±1 during a slow drag (moveX / moveY). */
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
 * Swipe up jumps (moveX from the angle lasts until a surface or a live drag).
 * Slow left/right drag is live analog moveX; slow down drag is live analog
 * moveY. Both die when the finger is still or lifts — down analog does not
 * latch. A fast horizontal flick latches run for 0.5 s until dash exists;
 * a down flick latches crouch on lift (same threshold, not a mid-drag kill).
 * The first live analog sample clears jump-run so a still finger does not snap
 * back to the swipe course. Tap, a still press
 * (≥ 0.5 s), or any gameplay key clears latches when that contact is alone.
 * Jump flicks also commit on pointer-up so a short stroke is not dropped,
 * but only if the finger still moved after settle (centroid jumps are not jumps).
 * Fat-finger contact jumps are treated as taps.
 */
export class GestureTouchLayer extends Container {
	private viewWidth: number;
	private viewHeight: number;
	private padLeft = 0;
	private padTop = 0;
	private padRight = 0;
	private padBottom = 0;
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
		this.applyHitArea();

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

	public setViewSize(
		width: number,
		height: number,
		padLeft = 0,
		padTop = 0,
		padRight = 0,
		padBottom = 0,
	): void {
		this.viewWidth = width;
		this.viewHeight = height;
		this.padLeft = padLeft;
		this.padTop = padTop;
		this.padRight = padRight;
		this.padBottom = padBottom;
		this.applyHitArea();
	}

	private applyHitArea(): void {
		this.hitArea = new Rectangle(
			-this.padLeft,
			-this.padTop,
			this.viewWidth + this.padLeft + this.padRight,
			this.viewHeight + this.padTop + this.padBottom,
		);
	}

	public getControls(): PlayerControls {
		this.refreshHoldCancel();
		this.refreshRunLatch();
		const live = this.pickLiveStroke();
		const liveMoveX = live?.liveMoveX ?? 0;
		const liveMoveY = live?.liveMoveY ?? 0;
		if (liveMoveX !== 0) {
			this.clearLatchedMoveX();
			if (this.jumpCharge <= 0) {
				this.latchedCrouch = false;
			}
		}

		this.controls.moveX = liveMoveX !== 0 ? liveMoveX : this.latchedMoveX;
		this.controls.moveY = liveMoveY;
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
			this.latchedCrouch = false;
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
			this.finishStroke(stroke, true);
			return;
		}

		this.trackMove(stroke, local.x, local.y, performance.now());
		if (this.isOutsidePlayfield(local.x, local.y)) {
			this.clearStrokeAnalog(stroke);
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
		this.finishStroke(stroke, this.isInHudReleaseBand(local.y));
	};

	private readonly onGlobalPointerEnd = (event: PointerEvent): void => {
		const stroke = this.findStroke(event.pointerId);
		if (!stroke) {
			return;
		}

		this.finishStroke(stroke, false);
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
			this.clearStrokeAnalog(stroke);
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
			this.clearStrokeAnalog(stroke);
			return;
		}

		if (!stroke.originLocked && this.absorbSettle(stroke, x, y, now, speed)) {
			this.clearStrokeAnalog(stroke);
			stroke.jumpGestureActive = false;
			return;
		}

		stroke.originLocked = true;

		// No trim here: mid-slide there is no liftoff smear to drop. The anchor is
		// moved only from this path, so the trimmed release end can never shift it.
		const latest = stroke.samples[stroke.samples.length - 1];
		const velocity = this.measureWindow(stroke, latest);
		this.updateFlickAnchor(stroke, velocity);
		const measure = this.measureSwipe(stroke, latest, velocity);
		const jumpStroke = classifySwipe(measure.angle) === 'jump';
		stroke.jumpGestureActive = jumpStroke;

		if (this.tryCommitJump(stroke, measure)) {
			this.clearStrokeAnalog(stroke);
			return;
		}

		stroke.liveMoveX = jumpStroke ? 0 : this.resolveSlowDrag(velX, velY, speed);
		stroke.liveMoveY = jumpStroke ? 0 : this.resolveSlowDragY(velX, velY, speed);
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

	private commitJump(stroke: Stroke, angle: number): void {
		stroke.consumed = true;
		this.clearStrokeAnalog(stroke);
		this.latchedCrouch = false;
		this.latchMoveX(jumpMoveXFromAngle(angle));
		this.jumpCharge = jumpAxisFromAngle(angle);
		this.jumpCommitted = true;
		this.windupCancel = false;
	}

	private finishStroke(stroke: Stroke, fromHudBand: boolean): void {
		if (!this.findStroke(stroke.pointerId)) {
			return;
		}

		if (!stroke.consumed) {
			this.recognizeStrokeEnd(stroke, fromHudBand);
		}

		this.dropStroke(stroke);
		if (!this.jumpCommitted) {
			this.jumpCharge = 0;
		}
	}

	private recognizeStrokeEnd(stroke: Stroke, fromHudBand: boolean): void {
		const soleContact = this.strokes.length === 1;
		const end = this.releaseEndSample(stroke);

		// Amplitude from the anchor, speed and angle from the release window. The
		// two plain measures below stay whole-stroke for the recovery lane and the
		// tap verdict, which ask about the contact rather than about the release.
		const swipe = this.measureSwipe(stroke, end, this.measureWindow(stroke, end));

		const fromOrigin = this.measureFrom(
			stroke.originX,
			stroke.originY,
			stroke.originTime,
			end.x,
			end.y,
			end.time,
		);

		const fromDown = this.measureFrom(
			stroke.downX,
			stroke.downY,
			stroke.downTime,
			end.x,
			end.y,
			end.time,
		);

		if (this.tryCommitJump(stroke, swipe)) {
			return;
		}

		if (this.tryCommitCrouch(stroke, swipe)) {
			return;
		}

		if (this.canRecoverFlickFromDown(stroke, fromOrigin, fromDown)) {
			if (this.tryCommitJump(stroke, fromDown)) {
				return;
			}

			if (this.tryCommitCrouch(stroke, fromDown)) {
				return;
			}

			if (this.tryCommitHorizontalRun(stroke, fromDown)) {
				return;
			}
		}

		if (this.tryCommitHorizontalRun(stroke, swipe)) {
			return;
		}

		if (this.isFatFingerTap(stroke, end)) {
			if (soleContact) {
				this.clearLatches();
			}
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

	private tryCommitJump(stroke: Stroke, measure: SwipeMeasure): boolean {
		if (classifySwipe(measure.angle) !== 'jump') {
			return false;
		}

		if (!this.meetsSwipeThreshold(measure)) {
			return false;
		}

		this.commitJump(stroke, measure.angle);
		return true;
	}

	/**
	 * Crouch latches on lift, like a horizontal run flick. Committing mid-drag
	 * would kill live moveY — the swipe threshold is not a reason to stop analog.
	 */
	private tryCommitCrouch(stroke: Stroke, measure: SwipeMeasure): boolean {
		if (classifySwipe(measure.angle) !== 'crouch') {
			return false;
		}

		if (!this.meetsSwipeThreshold(measure)) {
			return false;
		}

		stroke.consumed = true;
		this.clearStrokeAnalog(stroke);
		this.windupCancel = this.jumpCharge > 0;
		this.clearLatchedMoveX();

		if (this.wasOnGround) {
			this.latchedCrouch = true;
		}

		this.jumpCharge = 0;
		this.jumpCommitted = false;
		return true;
	}

	/**
	 * Whole-stroke flick fallback. Settle can eat the first SETTLE_MS of a real
	 * swipe; the contact-point measure puts that motion back. Require leftover
	 * travel in the same direction so a centroid jump alone is not a swipe.
	 */
	private canRecoverFlickFromDown(
		stroke: Stroke,
		fromOrigin: StrokeMeasure,
		fromDown: StrokeMeasure,
	): boolean {
		if (!RECOVER_FROM_CONTACT) {
			return false;
		}

		if (fromDown.durationMs > RECOVER_MAX_DURATION_MS) {
			return false;
		}

		if (!stroke.originLocked) {
			return true;
		}

		if (fromOrigin.distance < RECOVER_MIN_POST_SETTLE_PX) {
			return false;
		}

		return classifySwipe(fromOrigin.angle) === classifySwipe(fromDown.angle);
	}

	private tryCommitHorizontalRun(stroke: Stroke, measure: SwipeMeasure): boolean {
		if (classifySwipe(measure.angle) !== 'horizontal') {
			return false;
		}

		if (!this.meetsSwipeThreshold(measure)) {
			return false;
		}

		stroke.consumed = true;
		this.clearStrokeAnalog(stroke);
		this.latchedCrouch = false;
		this.latchMoveX(Math.cos(measure.angle) < 0 ? -1 : 1, RUN_LATCH_MS);
		return true;
	}

	/**
	 * Single gate for every gesture and every entry point. A duration-selected
	 * fast branch used to sit here, but anything it accepted cleared this rule
	 * too, so it could only ever reject — hence one continuous rule instead.
	 */
	private meetsSwipeThreshold(measure: SwipeMeasure): boolean {
		return measure.distance >= SWIPE_DISTANCE_PX && measure.speed >= SWIPE_SPEED_PX_PER_SEC;
	}

	/** Centroid jumped, then the finger sat still — that is a tap, not a swipe. */
	private isFatFingerTap(stroke: Stroke, end: StrokeSample): boolean {
		const duration = end.time - stroke.downTime;
		if (duration <= CONTACT_ROLL_WINDOW_MS) {
			return false;
		}

		const tail = this.sampleAtOrBefore(stroke, end.time - CONTACT_ROLL_WINDOW_MS);
		const tailDist = Math.hypot(end.x - tail.x, end.y - tail.y);
		const totalDist = Math.hypot(end.x - stroke.downX, end.y - stroke.downY);
		return tailDist < CONTACT_ROLL_MAX_TAIL_PX && totalDist >= CONTACT_ROLL_MIN_TOTAL_PX;
	}

	private pickLiveStroke(): Stroke | null {
		const now = performance.now();
		let best: Stroke | null = null;
		for (const stroke of this.strokes) {
			if (now - stroke.lastMoveTime >= LIVE_MOVE_STALE_MS) {
				this.clearStrokeAnalog(stroke);
			}

			if (stroke.liveMoveX === 0 && stroke.liveMoveY === 0) {
				continue;
			}

			if (!best || stroke.lastMoveTime > best.lastMoveTime) {
				best = stroke;
			}
		}

		return best;
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
			this.clearStrokeAnalog(stroke);
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

	private resolveSlowDragY(velX: number, velY: number, speed: number): number {
		if (speed < DRAG_MIN_SPEED_PX_PER_SEC || velY <= 0) {
			return 0;
		}

		if (Math.abs(velX) > Math.abs(velY) * 1.5) {
			return 0;
		}

		return clampAxis(velY / DRAG_FULL_SPEED_PX_PER_SEC);
	}

	private isInHudReleaseBand(localY: number): boolean {
		return localY + this.padTop < this.hudTopReleaseY;
	}

	private isOutsidePlayfield(localX: number, localY: number): boolean {
		return localX < -this.padLeft
			|| localX > this.viewWidth + this.padRight
			|| localY < -this.padTop
			|| localY > this.viewHeight + this.padBottom;
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

	/**
	 * Endpoint for every measurement taken on release. The last samples carry
	 * liftoff smear — direction the player never made — so they are cut. A short
	 * flick would lose its whole body to that cut, so the trim stops at
	 * RELEASE_KEEP_MIN_MS and in the worst case drops only the final sample.
	 */
	private releaseEndSample(stroke: Stroke): StrokeSample {
		const samples = stroke.samples;
		const last = samples[samples.length - 1];
		if (samples.length < 3) {
			return last;
		}

		const trimBefore = last.time - RELEASE_TRIM_MS;
		const keepUntil = samples[0].time + RELEASE_KEEP_MIN_MS;
		let trimmed: StrokeSample | null = null;
		for (const sample of samples) {
			if (sample.time > trimBefore) {
				break;
			}

			if (sample.time >= keepUntil) {
				trimmed = sample;
			}
		}

		return trimmed ?? samples[samples.length - 2];
	}

	private measureWindow(stroke: Stroke, end: StrokeSample): WindowVelocity {
		const windowStart = Math.max(stroke.originTime, end.time - GESTURE_WINDOW_MS);
		const from = this.windowStartSample(stroke, windowStart, end);
		const dx = end.x - from.x;
		const dy = end.y - from.y;
		const dtSec = Math.max(end.time - from.time, MIN_SPEED_DT_MS) / 1000;
		return {
			angle: Math.atan2(dy, dx),
			speed: Math.hypot(dx, dy) / dtSec,
			from,
		};
	}

	/**
	 * Plant the amplitude anchor where the fast phase began and leave it there.
	 * The window start is the right spot: a crossing at the current sample means
	 * the motion already happened across the window, and anchoring at the current
	 * point would throw that travel away. Release is gated lower than set, so the
	 * anchor survives jitter around the threshold instead of being re-planted.
	 */
	private updateFlickAnchor(stroke: Stroke, velocity: WindowVelocity): void {
		if (!stroke.flickAnchor) {
			if (velocity.speed >= SWIPE_SPEED_PX_PER_SEC) {
				stroke.flickAnchor = velocity.from;
			}
			return;
		}

		if (velocity.speed < SWIPE_SPEED_PX_PER_SEC * FLICK_RELEASE_SPEED_RATIO) {
			stroke.flickAnchor = null;
		}
	}

	/**
	 * Amplitude from the anchor, speed and angle from the window. Measuring
	 * amplitude from the settle origin instead would let a long slow drag satisfy
	 * SWIPE_DISTANCE_PX for the rest of the contact, leaving speed as the only
	 * live threshold. No anchor means no fast phase, hence no amplitude.
	 */
	private measureSwipe(
		stroke: Stroke,
		end: StrokeSample,
		velocity: WindowVelocity,
	): SwipeMeasure {
		const anchor = stroke.flickAnchor;
		return {
			angle: velocity.angle,
			distance: anchor ? Math.hypot(end.x - anchor.x, end.y - anchor.y) : 0,
			speed: velocity.speed,
		};
	}

	/**
	 * Oldest sample inside the window. Falls back to the newest one just outside
	 * it, so a sparse report rate still yields a span instead of a zero.
	 */
	private windowStartSample(stroke: Stroke, windowStart: number, end: StrokeSample): StrokeSample {
		let previous: StrokeSample | null = null;
		for (const sample of stroke.samples) {
			if (sample.time >= end.time) {
				break;
			}

			if (sample.time >= windowStart) {
				return sample;
			}

			previous = sample;
		}

		return previous ?? end;
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
			this.clearStrokeAnalog(stroke);
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

	private clearStrokeAnalog(stroke: Stroke): void {
		stroke.liveMoveX = 0;
		stroke.liveMoveY = 0;
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
	liveMoveY: 0,
	jumpGestureActive: false,
	flickAnchor: null,
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
	let jump = TOUCH_JUMP_BOOST;
	//return jump;

	// Not approved!
	// Visual difference between 35 and 45 degrees is not obvious, therefor lowering jump height is unexpected.
	// it is better to make short-long slide difference someday.
	if (elevation < FULL_JUMP_ELEVATION_RAD) {
		jump = (elevation / FULL_JUMP_ELEVATION_RAD + 1.5) / 2.5 * TOUCH_JUMP_BOOST;
	}
	console.log(`swipe jump strength = ${jump},  elevation = ${elevation * 180 / Math.PI}`);
	return jump;
};

/** 45° is a boosted full run; steeper swipes ease toward a vertical jump. */
const jumpMoveXFromAngle = (angle: number): number => {
	const sign = Math.cos(angle) < 0 ? -1 : 1;
	const elevation = swipeElevation(angle);
	if (elevation <= FULL_JUMP_ELEVATION_RAD) {
		//return sign * TOUCH_JUMP_BOOST;
		return sign * (FULL_JUMP_ELEVATION_RAD / elevation + 4) / 5 * TOUCH_JUMP_BOOST;
	}

	const t = (Math.PI * 0.5 - elevation) / (Math.PI * 0.5 - FULL_JUMP_ELEVATION_RAD);
	return sign * Math.max(0, t) * TOUCH_JUMP_BOOST;
};
