import { Bodies, Body } from 'matter-js';
import { Assets, Container, ParticleContainer, Sprite, Texture } from 'pixi.js';

import { LevelCollectible } from '../levels/level-schema';
import { PhysicsWorld } from '../physics/physics-world';

/** Sensor radius and rendered size shared by every collectible type. */
export const COLLECTIBLE_RADIUS = 40;
const BOB_PERIOD_SEC = 2;
const BOB_AMPLITUDE = 8;
const FRAME_HZ = 60;

/**
 * Level layers a collectible can attach its visual to: the regular sprite tree
 * or the shared firefly particle batch. Each type uses one of them.
 */
export type CollectibleLayers = {
	sprites: Container;
	flies: ParticleContainer;
};

/**
 * Pickup base: owns the static sensor body and the collected flag.
 * Visuals and collect feedback belong to the subclass, because fireflies
 * (portal fuel) and other pickups follow different rules.
 */
export abstract class Collectible {
	public readonly body: Body;
	public readonly collectibleId: string;
	public readonly collectibleType: string;
	public collected = false;

	protected readonly baseX: number;
	protected readonly baseY: number;

	protected constructor(data: LevelCollectible, sensorRadius: number = COLLECTIBLE_RADIUS) {
		this.body = Bodies.circle(data.x, data.y, sensorRadius, {
			isStatic: true,
			isSensor: true,
			label: 'collectible',
		});

		this.collectibleId = data.id;
		this.collectibleType = data.type;
		this.baseX = data.x;
		this.baseY = data.y;
	}

	public abstract addToLevel(world: PhysicsWorld, layers: CollectibleLayers): void;

	public abstract removeFromLevel(world: PhysicsWorld): void;

	public abstract update(deltaTime: number): void;

	/** Drops the sensor so the pickup cannot fire twice; visuals are up to the subclass. */
	public collect(world: PhysicsWorld): void {
		if (this.collected) {
			return;
		}

		this.collected = true;
		world.removeBody(this.body);
	}

	/** Shared textures are owned by Assets, so only subclasses with own nodes override this. */
	public destroy(): void {
		return;
	}

	protected static toSeconds(deltaTime: number): number {
		return Math.max(deltaTime, 0) / FRAME_HZ;
	}

	protected static hashPhase(id: string): number {
		let hash = 0;
		for (let i = 0; i < id.length; i += 1) {
			hash = (hash * 31 + id.charCodeAt(i)) | 0;
		}
		return (Math.abs(hash) % 1000) / 1000 * Math.PI * 2;
	}
}

/**
 * Default pickup: a bobbing sprite that disappears when taken.
 * Used by every type except fireflies (see `FireflyCollectible`).
 */
export class SpriteCollectible extends Collectible {
	private readonly sprite: Sprite;
	private readonly bobPhase: number;
	private bobTime = 0;

	public constructor(data: LevelCollectible) {
		super(data);

		this.sprite = new Sprite(Texture.EMPTY);
		this.sprite.anchor.set(0.5);
		this.sprite.eventMode = 'none';
		this.sprite.position.set(this.baseX, this.baseY);
		this.bobPhase = Collectible.hashPhase(data.id);
		void this.loadTexture(data.type);
	}

	public override addToLevel(world: PhysicsWorld, layers: CollectibleLayers): void {
		world.addBody(this.body);
		layers.sprites.addChild(this.sprite);
	}

	public override removeFromLevel(world: PhysicsWorld): void {
		if (!this.collected) {
			world.removeBody(this.body);
		}

		this.sprite.removeFromParent();
	}

	public override update(deltaTime: number): void {
		if (this.collected) {
			return;
		}

		this.bobTime += Collectible.toSeconds(deltaTime);
		const offsetY = Math.sin((this.bobTime * Math.PI * 2) / BOB_PERIOD_SEC + this.bobPhase) * BOB_AMPLITUDE;
		this.sprite.position.set(this.baseX, this.baseY + offsetY);
	}

	public override collect(world: PhysicsWorld): void {
		if (this.collected) {
			return;
		}

		super.collect(world);
		this.sprite.visible = false;
	}

	public override destroy(): void {
		this.sprite.destroy();
	}

	private async loadTexture(alias: string): Promise<void> {
		try {
			const texture = await Assets.load<Texture>(alias);
			this.sprite.texture = texture;
			this.sprite.scale.set((COLLECTIBLE_RADIUS * 2) / Math.max(texture.width, texture.height));
		} catch {
			console.warn(`[collectible] no texture for type "${alias}"`);
		}
	}
}

export const isCollectibleBody = (body: Body): boolean => body.label === 'collectible';

export const isPlayerBody = (body: Body): boolean => body.label === 'player';
