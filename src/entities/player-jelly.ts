import { WallSide } from '../physics/ground-contact';
import { PlayerState } from './player-state';

export type JellyMotionInput = {
	state: PlayerState;
	velocityX: number;
	velocityY: number;
	onGround: boolean;
	/** Jump wind-up squash (anticipation), not hide crouch. */
	jumpCrouching: boolean;
	/** Hide crouch blend 0…1 (half-height squash + quiet breath). */
	crouchBlend: number;
	clinging: boolean;
	wallSide: WallSide | null;
	wallCrouching: boolean;
	wallPeeling: boolean;
	moveSpeedX: number;
	halfHeight: number;
	/**
	 * Current Matter collider scaleY (1 = full circle). Visual plantOffset must
	 * subtract the body plant shift so the sprite does not sink twice.
	 */
	colliderScaleY: number;
	deltaTime: number;
};

export type JellyPose = {
	scaleX: number;
	scaleY: number;
	skewX: number;
	skewY: number;
	offsetX: number;
	offsetY: number;
};

/** Horizontal butt-drag while moving on the ground. */
const MAX_SKEW = 0.2;
const SKEW_LERP = 0.2;

/** Soft resting squash on ground (1 = circle). */
const IDLE_SQUASH = 0.06;
const RUN_SQUASH = 0.15;
const JUMP_CROUCH_SQUASH = 0.4;

/**
 * Sticky-wall hang: stuck side plants like ground butt-drag; free mass sags down.
 * skew.y shifts Y by X so the free side hangs while the wall edge stays put (via offset).
 */
const WALL_HANG_SKEW = 0.05;
const WALL_IDLE_SQUASH = 0.04;
const WALL_CROUCH_SQUASH = 0.4;
const WALL_CROUCH_HANG = 0.06;
/** Stretch away from the wall while peeling off (positive wallJelly). */
const WALL_PEEL_STRETCH = 0.32;
const WALL_PEEL_HANG = 0.04;
const WALL_PEEL_IMPULSE = 1.1;

/** Idle / cling breath: slow squash/stretch, period = 1 / BREATH_HZ seconds. */
const BREATH_HZ = 0.85;
const BREATH_AMOUNT = 0.0545;
/** Hide crouch uses quieter breathing. */
const CROUCH_BREATH_SCALE = 0.25;
/** Full hide crouch flattens the blob to half height. */
const CROUCH_HIDE_SCALE_Y = 0.5;

/** Run bob (Hz + amplitude in px). Idle has no bob. */
const BOB_HZ = 2.2;
const BOB_RUN = 2.4;

/**
 * Vertical jelly spring (positive = tall/thin, negative = flat/wide).
 *
 * Tune feel here:
 * - SPRING_STIFFNESS — how fast it oscillates (higher = more wiggles per jump)
 * - SPRING_DAMPING — how quickly wiggles die (lower = more bounces)
 * - JUMP_IMPULSE — stretch kick when leaving the ground
 * - LAND_IMPULSE — squash kick on landing
 * - ANTICIPATION_IMPULSE — pre-jump crouch kick
 * - VELOCITY_DRIVE — how much vertical speed continuously feeds the spring
 * - MAX_JELLY — clamp so it never looks broken
 */
const SPRING_STIFFNESS = 350;
const SPRING_DAMPING = 7.5;
const JUMP_IMPULSE = 6.4;
const LAND_IMPULSE = 0.8;
const ANTICIPATION_IMPULSE = 1;
const VELOCITY_DRIVE = 0.035;
const MAX_JELLY = 0.38;

/** Horizontal wall spring (negative = squashed into the wall). */
const WALL_SPRING_STIFFNESS = 300;
const WALL_SPRING_DAMPING = 6.5;
const WALL_CLING_IMPULSE = 4.0;
const WALL_ANTICIPATION_IMPULSE = 1;
const MAX_WALL_JELLY = 0.38;

const FRAME_HZ = 60;

/**
 * Procedural jelly squash / stretch for the blob player.
 * Visual only — does not affect the physics body.
 */
export class PlayerJelly {
	private time = 0;
	private skewX = 0;
	private hangSkew = 0;
	private hangSkewVelocity = 0;
	private jelly = 0;
	private jellyVelocity = 0;
	private wallJelly = 0;
	private wallJellyVelocity = 0;
	private wasOnGround = true;
	private wasClinging = false;

	/** Wind-up squash right before the jump launches. */
	public anticipateJump(): void {
		this.jellyVelocity -= ANTICIPATION_IMPULSE;
	}

	/** Wind-up squash into the wall before a wall jump. */
	public anticipateWallJump(): void {
		this.wallJellyVelocity -= WALL_ANTICIPATION_IMPULSE;
	}

	/** Stretch kick when starting to peel off the wall. */
	public beginClingPeel(): void {
		this.wallJellyVelocity += WALL_PEEL_IMPULSE;
	}

	/** Decaying wobble when first sticking to a wall (squash + hang). */
	public onClingStart(): void {
		this.wallJellyVelocity -= WALL_CLING_IMPULSE;
		this.hangSkewVelocity += WALL_CLING_IMPULSE * 0.55;
	}

	public update(input: JellyMotionInput): JellyPose {
		const dt = Math.max(input.deltaTime, 0);
		const dtSec = dt / FRAME_HZ;
		this.time += dt;

		if (!input.onGround && this.wasOnGround && !input.clinging) {
			// Leave ground: kick into a tall stretch so the spring can ring in air.
			this.jellyVelocity += JUMP_IMPULSE;
		}

		if (input.onGround && !this.wasOnGround) {
			// Land: squash kick — with current damping this yields ~2–3 visible bounces.
			this.jellyVelocity -= LAND_IMPULSE;
		}

		this.wasOnGround = input.onGround;

		if (input.clinging && !this.wasClinging) {
			this.onClingStart();
		}

		if (!input.clinging && this.wasClinging) {
			this.wallJellyVelocity = 0;
			this.wallJelly = 0;
			this.hangSkewVelocity = 0;
			this.hangSkew = 0;
		}

		this.wasClinging = input.clinging;

		if (input.clinging) {
			return this.updateClingPose(input, dt, dtSec);
		}

		return this.updateFreePose(input, dt, dtSec);
	}

	private updateClingPose(input: JellyMotionInput, dt: number, dtSec: number): JellyPose {
		const restWallJelly = input.wallPeeling
			? WALL_PEEL_STRETCH
			: -(input.wallCrouching ? WALL_CROUCH_SQUASH : WALL_IDLE_SQUASH);
		const wallSpringForce =
			(restWallJelly - this.wallJelly) * WALL_SPRING_STIFFNESS
			- this.wallJellyVelocity * WALL_SPRING_DAMPING;
		this.wallJellyVelocity += wallSpringForce * dtSec;
		this.wallJelly += this.wallJellyVelocity * dtSec;
		this.wallJelly = Math.max(-MAX_WALL_JELLY, Math.min(MAX_WALL_JELLY, this.wallJelly));

		// Hang direction: free side (away from wall) sags down — mirror of ground butt-drag.
		const wallSign = input.wallSide === 'right' ? 1 : -1;
		const hangAmount = input.wallPeeling
			? WALL_PEEL_HANG
			: (input.wallCrouching ? WALL_CROUCH_HANG : WALL_HANG_SKEW);
		const restHang = -wallSign * hangAmount;
		const hangSpringForce =
			(restHang - this.hangSkew) * WALL_SPRING_STIFFNESS
			- this.hangSkewVelocity * WALL_SPRING_DAMPING;
		this.hangSkewVelocity += hangSpringForce * dtSec;
		this.hangSkew += this.hangSkewVelocity * dtSec;
		this.hangSkew = Math.max(-MAX_WALL_JELLY, Math.min(MAX_WALL_JELLY, this.hangSkew));

		// Free mass breathes like idle (coupled X/Y jelly), once cling wobble settles.
		const breath = !input.wallCrouching && !input.wallPeeling
			? Math.sin(this.time * (BREATH_HZ / FRAME_HZ) * Math.PI * 2) * BREATH_AMOUNT
			: 0;

		const clingPose = this.wallJelly + breath;
		const scaleX = 1 + clingPose;
		const scaleY = 1 - clingPose * 0.85;
		// Plant stuck side on the wall (same idea as feet plant on ground via offsetY).
		const plantOffsetX = wallSign * input.halfHeight * (1 - scaleX);
		// Cancel vertical drift of the wall edge caused by skew.y so that edge stays stuck.
		const plantOffsetY = -wallSign * input.halfHeight * this.hangSkew;

		this.skewX += (0 - this.skewX) * (1 - Math.pow(1 - SKEW_LERP, dt));

		return {
			scaleX,
			scaleY,
			skewX: this.skewX,
			skewY: this.hangSkew,
			offsetX: plantOffsetX,
			offsetY: plantOffsetY,
		};
	}

	private updateFreePose(input: JellyMotionInput, dt: number, dtSec: number): JellyPose {
		const hideBlend = Math.max(0, Math.min(1, input.crouchBlend));
		const restJelly = input.onGround
			? -(input.jumpCrouching
				? JUMP_CROUCH_SQUASH
				: input.state === 'run'
					? RUN_SQUASH
					: IDLE_SQUASH)
			: 0;
		const velocityDrive = -input.velocityY * VELOCITY_DRIVE;
		const targetJelly = restJelly + velocityDrive;

		const springForce = (targetJelly - this.jelly) * SPRING_STIFFNESS - this.jellyVelocity * SPRING_DAMPING;
		this.jellyVelocity += springForce * dtSec;
		this.jelly += this.jellyVelocity * dtSec;
		this.jelly = Math.max(-MAX_JELLY, Math.min(MAX_JELLY, this.jelly));

		const breathScale = 1 - (1 - CROUCH_BREATH_SCALE) * hideBlend;
		const canBreathe = input.onGround
			&& !input.jumpCrouching
			&& (input.state === 'idle' || input.state === 'crouch' || hideBlend > 0);
		const breath = canBreathe
			? Math.sin(this.time * (BREATH_HZ / FRAME_HZ) * Math.PI * 2) * BREATH_AMOUNT * breathScale
			: 0;
		// Hide crouch flattens like jelly squash (taller→wider) so X expands with Y compress.
		const hideJelly = -(1 - CROUCH_HIDE_SCALE_Y) * hideBlend;
		const jellyPose = this.jelly + breath + hideJelly;
		const scaleY = 1 + jellyPose;
		const scaleX = 1 - jellyPose * 0.85;

		const speedRatio = input.onGround && input.moveSpeedX !== 0
			? Math.max(-1, Math.min(1, input.velocityX / input.moveSpeedX))
			: 0;
		const dragSkew = -speedRatio * MAX_SKEW;
		const skewAlpha = 1 - Math.pow(1 - SKEW_LERP, dt);
		this.skewX += (dragSkew - this.skewX) * skewAlpha;

		const bob = input.onGround && input.state === 'run' && !input.jumpCrouching && hideBlend <= 0
			? Math.sin(this.time * (BOB_HZ / FRAME_HZ) * Math.PI * 2) * BOB_RUN
			: 0;
		// Body already shifted for collider plant; only offset the visual vs collider half-height.
		const colliderScaleY = Math.max(input.colliderScaleY, 1e-6);
		const plantOffset = input.halfHeight * (colliderScaleY - scaleY);

		this.hangSkew += (0 - this.hangSkew) * (1 - Math.pow(1 - SKEW_LERP, dt));

		return {
			scaleX,
			scaleY,
			skewX: this.skewX,
			skewY: this.hangSkew,
			offsetX: 0,
			offsetY: plantOffset + bob,
		};
	}
}
