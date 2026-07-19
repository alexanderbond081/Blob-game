import { Particle, Texture } from 'pixi.js';

export class AnotherFly extends Particle {
	private shiftX: number = 0;
	private shiftY: number = 0;
	private width: number = 1;
	private height: number = 1;

	constructor(
		texture: Texture,
		private initialX: number,
		private initialY: number,
		private chaos: number = 1,
		private speed: number = 20,
		private distance: number = 400,
	) {
		super(texture);
		if (chaos <= 0) throw new Error('AnotherFly chaos < 0');
		if (speed <= 0) throw new Error('AnotherFly speed < 0');
		if (distance <= 0) throw new Error('AnotherFly distance < 0');
		this.width = texture.width;
		this.height = texture.height;
		let rndScale = Math.random() * 0.8 + 0.2;
		this.scaleX = rndScale;
		this.scaleY = rndScale;
		speed *= rndScale;
		distance *= rndScale;
		this.initialY *= rndScale;
		this.anchorX = 0.5;
		this.anchorY = 0.5;
		this.x = this.initialX;
		this.y = this.initialY;
	}

	public move(delta: number): void {
		this.shiftX += (Math.random() * 2 - 1) * this.chaos - this.shiftX / this.speed - (this.x - this.width / 2 - this.initialX) / this.distance;
		this.shiftY += (Math.random() * 2 - 1) * this.chaos - this.shiftY / this.speed - (this.y - this.height / 2 - this.initialY) / this.distance;
		this.x += this.shiftX * delta;
		this.y += this.shiftY * delta;

		this.rotation = Math.atan2(this.shiftX, -this.shiftY);
	}
}
