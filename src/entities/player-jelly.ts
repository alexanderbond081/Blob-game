import { PlayerState } from './player-state';

export type JellyMotionInput = {
	state: PlayerState;
	velocityX: number;
	velocityY: number;
	onGround: boolean;
	crouching: boolean;
	moveSpeedX: number;
	halfHeight: number;
	deltaTime: number;
};

export type JellyPose = {
	scaleX: number;
	scaleY: number;
	skewX: number;
	offsetY: number;
};

/** Horizontal butt-drag while moving. */
const MAX_SKEW = 0.2;
const SKEW_LERP = 0.2;

/** Soft resting squash on ground (1 = circle). */
const IDLE_SQUASH = 0.06;
const RUN_SQUASH = 0.15;
const CROUCH_SQUASH = 0.4; //0.22

/** Idle breath: slow squash/stretch, period = 1 / BREATH_HZ seconds. */
const BREATH_HZ = 0.85;
const BREATH_AMOUNT = 0.0545;

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

const FRAME_HZ = 60;

/**
 * Procedural jelly squash / stretch for the blob player.
 * Visual only — does not affect the physics body.
 */
export class PlayerJelly {
	private time = 0;
	private skewX = 0;
	private jelly = 0;
	private jellyVelocity = 0;
	private wasOnGround = true;

	/** Wind-up squash right before the jump launches. */
	public anticipateJump(): void {
		this.jellyVelocity -= ANTICIPATION_IMPULSE;
	}

	public update(input: JellyMotionInput): JellyPose {
		const dt = Math.max(input.deltaTime, 0);
		const dtSec = dt / FRAME_HZ;
		this.time += dt;

		if (!input.onGround && this.wasOnGround) {
			// Leave ground: kick into a tall stretch so the spring can ring in air.
			this.jellyVelocity += JUMP_IMPULSE;
		}

		if (input.onGround && !this.wasOnGround) {
			// Land: squash kick — with current damping this yields ~2–3 visible bounces.
			this.jellyVelocity -= LAND_IMPULSE;
		}

		this.wasOnGround = input.onGround;

		const restJelly = input.onGround
			? -(input.crouching ? CROUCH_SQUASH : input.state === 'run' ? RUN_SQUASH : IDLE_SQUASH)
			: 0;
		const velocityDrive = -input.velocityY * VELOCITY_DRIVE;
		const targetJelly = restJelly + velocityDrive;

		const springForce = (targetJelly - this.jelly) * SPRING_STIFFNESS - this.jellyVelocity * SPRING_DAMPING;
		this.jellyVelocity += springForce * dtSec;
		this.jelly += this.jellyVelocity * dtSec;
		this.jelly = Math.max(-MAX_JELLY, Math.min(MAX_JELLY, this.jelly));

		const breath = input.onGround && input.state === 'idle' && !input.crouching
			? Math.sin(this.time * (BREATH_HZ / FRAME_HZ) * Math.PI * 2) * BREATH_AMOUNT
			: 0;
		const jellyPose = this.jelly + breath;
		const scaleY = 1 + jellyPose;
		const scaleX = 1 - jellyPose * 0.85;

		const speedRatio = input.onGround && input.moveSpeedX !== 0
			? Math.max(-1, Math.min(1, input.velocityX / input.moveSpeedX))
			: 0;
		const dragSkew = -speedRatio * MAX_SKEW;
		const skewAlpha = 1 - Math.pow(1 - SKEW_LERP, dt);
		this.skewX += (dragSkew - this.skewX) * skewAlpha;

		const bob = input.onGround && input.state === 'run' && !input.crouching
			? Math.sin(this.time * (BOB_HZ / FRAME_HZ) * Math.PI * 2) * BOB_RUN
			: 0;
		const plantOffset = input.halfHeight * (1 - scaleY);

		return {
			scaleX,
			scaleY,
			skewX: this.skewX,
			offsetY: plantOffset + bob,
		};
	}
}
