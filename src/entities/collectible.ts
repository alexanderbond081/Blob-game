import { Bodies, Body } from 'matter-js';
import { Assets, Sprite, Texture } from 'pixi.js';

import { PhysicsBody } from '../physics/physics-body';
import { PhysicsWorld } from '../physics/physics-world';
import { LevelCollectible } from '../levels/level-schema';

const COLLECTIBLE_RADIUS = 16;

export type CollectibleCollectedHandler = (collectible: Collectible) => void;

export class Collectible extends PhysicsBody {
	public readonly collectibleId: string;
	public readonly collectibleType: string;
	public collected = false;

	public constructor(data: LevelCollectible) {
		const body = Bodies.circle(data.x, data.y, COLLECTIBLE_RADIUS, {
			isStatic: true,
			isSensor: true,
			label: 'collectible',
		});

		const display = new Sprite(Texture.EMPTY);
		display.anchor.set(0.5);
		display.eventMode = 'none';
		super(body, display);

		this.collectibleId = data.id;
		this.collectibleType = data.type;
		void this.loadTexture(data.type);
	}

	public collect(world: PhysicsWorld): void {
		if (this.collected) {
			return;
		}

		this.collected = true;
		this.removeFromWorld(world);
		this.destroy();
	}

	private async loadTexture(type: string): Promise<void> {
		const alias = type === 'firefly' ? 'firefly' : 'firefly';
		const texture = await Assets.load(alias);
		this.display.scale.set(1);
		(this.display as Sprite).texture = texture;
		const sprite = this.display as Sprite;
		const scale = (COLLECTIBLE_RADIUS * 2) / Math.max(sprite.texture.width, sprite.texture.height);
		sprite.scale.set(scale);
	}
}

export const isCollectibleBody = (body: Body): boolean => body.label === 'collectible';

export const isPlayerBody = (body: Body): boolean => body.label === 'player';
