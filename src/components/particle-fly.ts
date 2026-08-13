import { Particle, Texture } from 'pixi.js';

/**
 * Firefly particle: a damped random walk around a movable origin point.
 * `chaos` is the random impulse, `speed` the velocity damping time and `distance`
 * the pull back to the origin, so the drift settles near
 * `chaos * sqrt(speed * distance / 6)` pixels. That spread is unbounded, so pass
 * `maxRadius` when the fly has to stay inside a known circle.
 */
export class AnotherFly extends Particle {
	private shiftX: number = 0;
	private shiftY: number = 0;
	private originX: number;
	private originY: number;

	public constructor(
		texture: Texture,
		originX: number,
		originY: number,
		private chaos: number = 1,
		private speed: number = 20,
		private distance: number = 400,
		scale: number = 1,
		private orientToVelocity: boolean = true,
	) {
		super(texture);
		if (chaos <= 0) throw new Error('AnotherFly chaos <= 0');
		if (speed <= 0) throw new Error('AnotherFly speed <= 0');
		if (distance <= 0) throw new Error('AnotherFly distance <= 0');
		if (scale <= 0) throw new Error('AnotherFly scale <= 0');

		this.originX = originX;
		this.originY = originY;
		this.scaleX = scale;
		this.scaleY = scale;
		this.anchorX = 0.5;
		this.anchorY = 0.5;
		this.x = originX;
		this.y = originY;
	}

	/**
	 * Moves the point the fly circles around. The pull term is a spring, so the fly
	 * follows a moving origin (a portal slot, later on) with a natural lag.
	 */
	public setOrigin(x: number, y: number): void {
		this.originX = x;
		this.originY = y;
	}

	public setChaos(chaos: number): void {
		this.chaos = chaos;
	}

	public setSpeed(speed: number): void {
		this.speed = speed;
	}

	public setDistance(distance: number): void {
		this.distance = distance;
	}

	public resetDrift(): void {
		this.shiftX = 0;
		this.shiftY = 0;
	}

	public distanceToOrigin(): number {
		const offsetX = this.x - this.originX;
		const offsetY = this.y - this.originY;
		return Math.hypot(offsetX, offsetY);
	}

	public move(delta: number): void {
		this.shiftX += (Math.random() * 2 - 1) * this.chaos - this.shiftX / this.speed - (this.x - this.originX) / this.distance;
		this.shiftY += (Math.random() * 2 - 1) * this.chaos - this.shiftY / this.speed - (this.y - this.originY) / this.distance;

		const currentSpeed = Math.sqrt(this.shiftX * this.shiftX + this.shiftY * this.shiftY);
		if (currentSpeed > this.speed) {
			const f = this.speed / currentSpeed;
			this.shiftX *= f;
			this.shiftY *= f;
		}

		this.x += this.shiftX * delta;
		this.y += this.shiftY * delta;

		if (this.orientToVelocity) {
			this.rotation = Math.atan2(this.shiftX, -this.shiftY);
		}
	}

}
