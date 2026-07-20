import { Bodies, Body } from 'matter-js';
import { Assets, Sprite, Texture } from 'pixi.js';

import { PhysicsBody } from '../physics/physics-body';
import { PhysicsWorld } from '../physics/physics-world';
import { LevelCollectible } from '../levels/level-schema';

const COLLECTIBLE_RADIUS = 40;
const BOB_PERIOD_SEC = 2;
const BOB_AMPLITUDE = 8;
const FRAME_HZ = 60;

export type CollectibleCollectedHandler = (collectible: Collectible) => void;

export class Collectible extends PhysicsBody {
	public readonly collectibleId: string;
	public readonly collectibleType: string;
	public collected = false;

	private readonly baseX: number;
	private readonly baseY: number;
	private readonly bobPhase: number;
	private bobTime = 0;

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
		this.baseX = data.x;
		this.baseY = data.y;
		this.bobPhase = Collectible.hashPhase(data.id);
		void this.loadTexture(data.type);
	}

	public update(deltaTime: number): void {
		if (this.collected) {
			return;
		}

		this.bobTime += Math.max(deltaTime, 0) / FRAME_HZ;
		const offsetY = Math.sin((this.bobTime * Math.PI * 2) / BOB_PERIOD_SEC + this.bobPhase) * BOB_AMPLITUDE;
		this.display.position.set(this.baseX, this.baseY + offsetY);
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

	private static hashPhase(id: string): number {
		let hash = 0;
		for (let i = 0; i < id.length; i += 1) {
			hash = (hash * 31 + id.charCodeAt(i)) | 0;
		}
		return (Math.abs(hash) % 1000) / 1000 * Math.PI * 2;
	}
}

export const isCollectibleBody = (body: Body): boolean => body.label === 'collectible';

export const isPlayerBody = (body: Body): boolean => body.label === 'player';
