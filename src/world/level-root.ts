import { Container } from 'pixi.js';

import { Collectible } from '../entities/collectible';
import { Player } from '../entities/player';
import { LevelData } from '../levels/level-schema';
import { PhysicsWorld } from '../physics/physics-world';
import { StaticBody } from '../physics/static-body';

export class LevelRoot extends Container {
	public readonly player: Player;
	public readonly collectibles: Collectible[] = [];
	public readonly staticBodies: StaticBody[] = [];

	public constructor(levelData: LevelData, physicsWorld: PhysicsWorld) {
		super();
		this.eventMode = 'none';

		for (const platform of levelData.platforms) {
			const staticBody = new StaticBody({
				x: platform.x,
				y: platform.y,
				width: platform.width,
				height: platform.height,
				label: platform.label ?? 'platform',
			});
			staticBody.addToWorld(physicsWorld, this);
			this.staticBodies.push(staticBody);
		}

		for (const collectibleData of levelData.collectibles) {
			const collectible = new Collectible(collectibleData);
			collectible.addToWorld(physicsWorld, this);
			this.collectibles.push(collectible);
		}

		this.player = new Player(levelData.spawn.x, levelData.spawn.y);
		this.player.bindPhysics(physicsWorld);
		this.player.addToWorld(physicsWorld, this);
	}

	public destroyLevel(physicsWorld: PhysicsWorld): void {
		for (const staticBody of this.staticBodies) {
			staticBody.removeFromWorld(physicsWorld);
			staticBody.destroy();
		}
		this.staticBodies.length = 0;

		for (const collectible of this.collectibles) {
			if (!collectible.collected) {
				collectible.removeFromWorld(physicsWorld);
				collectible.destroy();
			}
		}
		this.collectibles.length = 0;

		this.player.removeFromWorld(physicsWorld);
		this.player.destroy();
	}
}
