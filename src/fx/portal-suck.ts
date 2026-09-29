/**
 * Clockwise suck into a portal centre. The caller starts it when an object
 * crosses the portal trigger and applies the pose to whatever it draws.
 * The centre is passed every frame because the portal art bobs.
 *
 * Radius falls with constant inward acceleration. Angle grows at a constant
 * rate, so the turn count is a result of these three knobs, not its own input.
 * From the 30px trigger, speed 6 / accel 20 / spin 6.5 is about one and a half turns.
 */

/** Inward speed at the start of the spiral, world pixels per second. */
const SUCK_SPEED = 80; //6;

/** How fast the inward speed grows, pixels per second squared. */
const SUCK_ACCEL = 80;//100; //20;

/** Clockwise angular speed at the start of the spiral, radians per second. Positive is clockwise in Pixi's Y-down space. */
const SUCK_SPIN = 0;//4; //16;//6.5;

/** How fast the angular speed grows, radians per second squared. */
const SPIN_ACCEL = 80; //50; //20;

/** Scale at the centre, as a fraction of the scale captured when the suck starts. */
const SUCK_END_SCALE = 0.2;

/** Alpha at the centre, as a fraction of the alpha captured when the suck starts. */
const SUCK_END_ALPHA = 0.2;

export type PortalSuckPose = {
	x: number;
	y: number;
	scale: number;
	alpha: number;
	done: boolean;
};

export class PortalSuck {
	private radialSpeed = SUCK_SPEED;
	private angularSpeed = SUCK_SPIN;
	private complete = false;
	private readonly startRadius: number;

	private constructor(
		private radius: number,
		private angle: number,
		private readonly startScale: number,
		private readonly startAlpha: number,
	) {
		this.startRadius = Math.max(radius, 0);
		this.radius = this.startRadius;
		this.complete = this.startRadius <= 0;
	}

	/** Captures the polar pose around `center` from the object's world position. */
	public static fromWorldPosition(
		x: number,
		y: number,
		centerX: number,
		centerY: number,
		startScale: number,
		startAlpha: number,
	): PortalSuck {
		const dx = x - centerX;
		const dy = y - centerY;
		return new PortalSuck(Math.hypot(dx, dy), Math.atan2(dy, dx), startScale, startAlpha);
	}

	public step(dtSec: number, centerX: number, centerY: number): PortalSuckPose {
		if (!this.complete) {
			const dt = Math.max(dtSec, 0);
			this.radialSpeed += SUCK_ACCEL * dt;
			this.radius = Math.max(0, this.radius - this.radialSpeed * dt);
			this.angularSpeed += SPIN_ACCEL * dt;
			this.angle += this.angularSpeed * dt;
			if (this.radius <= 0) {
				this.radius = 0;
				this.complete = true;
			}
		}

		return this.poseAt(centerX, centerY);
	}

	private poseAt(centerX: number, centerY: number): PortalSuckPose {
		const raw = this.startRadius > 0 ? 1 - this.radius / this.startRadius : 1;
		const progress = Math.min(1, Math.max(0, raw));
		return {
			x: centerX + Math.cos(this.angle) * this.radius,
			y: centerY + Math.sin(this.angle) * this.radius,
			scale: this.startScale * (1 + (SUCK_END_SCALE - 1) * progress),
			alpha: this.startAlpha * (1 + (SUCK_END_ALPHA - 1) * progress),
			done: this.complete,
		};
	}
}
