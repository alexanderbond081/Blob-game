import { Sprite, Texture, Container, Assets, Spritesheet, AnimatedSprite, Graphics, ParticleContainer } from 'pixi.js';
import { Scene } from './scene';
import { AnotherFly } from '../components/particle-fly';
import { SoundManager } from '../managers/sound-manager';

export class MainGameScene extends Scene {
	private bgSprite!: Sprite;

	private flies: AnotherFly[] = [];
	private fliesContainer!: ParticleContainer;

	constructor(
	) {
		super();
	}

	// public initializers

	public async init(): Promise<void> {
		//console.log("MainGameScene: initialization");

		await this.addBackground();
		await this.addFlies();

		SoundManager.playMusic('bg-music');
		SoundManager.playAmbience('ambience');
	}

	public update(deltaTime: number): void {
		for (let fly of this.flies) {
			fly.move(deltaTime);
		}
	}

	// private methods

	private async addBackground(): Promise<void> {
		const bgTexture = await Assets.load('background');
		this.bgSprite = new Sprite(bgTexture);
		this.adjustBackground();
		this.addChild(this.bgSprite);
	}

	private adjustBackground(): void {
		this.bgSprite.scale.set(0.5);
		this.bgSprite.x = (Scene.viewportWidth - this.bgSprite.width) * 0.5;
		this.bgSprite.y = (Scene.viewportHeight - this.bgSprite.height) * 0.5;
	}

	private async addFlies(): Promise<void> {
		const flyTexture = await Assets.load('firefly');
		this.fliesContainer = new ParticleContainer({
			dynamicProperties: {
				position: true,
				rotation: true,
				vertex: false,
				color: false,
			},
		});

		for (let i: number = 0; i < 10; i++) {
			const aFly: AnotherFly = new AnotherFly(
				flyTexture,
				Math.random() * Scene.viewportWidth,
				Math.random() * Scene.viewportHeight
			);
			this.flies.push(aFly);
			this.fliesContainer.addParticle(aFly);
		}
		this.adjustFlies();
		this.addChild(this.fliesContainer);
	}

	private adjustFlies(): void {
		this.fliesContainer.scale = this.calcScale();
		// !! test if we need to update each fly trajectory
		this.fliesContainer.update();
	}

	protected onResize(): void {
		this.adjustBackground();
		this.adjustFlies();
	}
}
