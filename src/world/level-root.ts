import { Container } from 'pixi.js';

import { Collectible } from '../entities/collectible';
import { Hazard } from '../entities/hazard';
import { LevelPortal } from '../entities/level-portal';
import { Player } from '../entities/player';
import { BlobDropletPool, DropletObstacleRect } from '../fx/blob-droplet-pool';
import { LevelData } from '../levels/level-schema';
import { PhysicsWorld } from '../physics/physics-world';
import { StaticBody } from '../physics/static-body';

export class LevelRoot extends Container {
	public readonly player: Player;
	public readonly portal: LevelPortal;
	public readonly collectibles: Collectible[] = [];
	public readonly staticBodies: StaticBody[] = [];
	public readonly hazards: Hazard[] = [];
	public readonly droplets: BlobDropletPool;

	public constructor(levelData: LevelData, physicsWorld: PhysicsWorld) {
		super();
		this.eventMode = 'none';

		for (const platform of levelData.platforms) {
			const staticBody = new StaticBody({
				x: platform.x,
				y: platform.y,
				width: platform.width,
				height: platform.height,
				type: platform.type,
			});
			staticBody.addToWorld(physicsWorld, this);
			this.staticBodies.push(staticBody);
		}

		for (const hazardData of levelData.hazards) {
			const hazard = new Hazard(hazardData);
			hazard.addToWorld(physicsWorld, this);
			this.hazards.push(hazard);
		}

		for (const collectibleData of levelData.collectibles) {
			const collectible = new Collectible(collectibleData);
			collectible.addToWorld(physicsWorld, this);
			this.collectibles.push(collectible);
		}

		// Portal under the player so the blob draws on top.
		this.portal = new LevelPortal(levelData.exit);
		this.portal.addToWorld(physicsWorld, this);

		this.player = new Player(levelData.spawn.x, levelData.spawn.y);
		this.player.bindPhysics(physicsWorld);
		this.player.addToWorld(physicsWorld, this);

		this.droplets = new BlobDropletPool();
		this.droplets.setLevelBounds(levelData.size);
		this.droplets.setObstacles(this.collectObstacleRects());
		this.addChild(this.droplets);
		this.player.setBurstFxHandler((x, y, radius) => {
			this.droplets.burstAt(x, y, radius);
		});
	}

	public destroyLevel(physicsWorld: PhysicsWorld): void {
		this.player.setBurstFxHandler(null);
		this.droplets.sleepAll();
		this.droplets.destroy({ children: true });

		for (const staticBody of this.staticBodies) {
			staticBody.removeFromWorld(physicsWorld);
			staticBody.destroy();
		}
		this.staticBodies.length = 0;

		for (const hazard of this.hazards) {
			hazard.removeFromWorld(physicsWorld);
			hazard.destroy();
		}
		this.hazards.length = 0;

		for (const collectible of this.collectibles) {
			if (!collectible.collected) {
				collectible.removeFromWorld(physicsWorld);
			}
			collectible.destroy();
		}
		this.collectibles.length = 0;

		this.portal.removeFromWorld(physicsWorld);
		this.portal.destroy();

		this.player.removeFromWorld(physicsWorld);
		this.player.destroy();
	}

	private collectObstacleRects(): DropletObstacleRect[] {
		const rects: DropletObstacleRect[] = [];

		for (const platform of this.staticBodies) {
			rects.push(boundsToRect(platform.body.bounds));
		}

		for (const hazard of this.hazards) {
			rects.push(boundsToRect(hazard.body.bounds));
		}

		return rects;
	}
}

const boundsToRect = (bounds: { min: { x: number; y: number }; max: { x: number; y: number } }): DropletObstacleRect => ({
	x: bounds.min.x,
	y: bounds.min.y,
	width: bounds.max.x - bounds.min.x,
	height: bounds.max.y - bounds.min.y,
});
