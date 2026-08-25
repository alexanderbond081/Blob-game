import { Container, ParticleContainer } from 'pixi.js';

import { Collectible, SpriteCollectible } from '../entities/collectible';
import { FireflyCollectible } from '../entities/firefly-collectible';
import { createHazard } from '../entities/create-hazard';
import { Hazard } from '../entities/hazard';
import { createLevelHint } from '../entities/hints/create-level-hint';
import { LevelHint } from '../entities/hints/level-hint';
import { LevelPortal } from '../entities/level-portal';
import { Player } from '../entities/player';
import { BlobDropletPool, DropletObstacleRect } from '../fx/blob-droplet-pool';
import { LevelData } from '../levels/level-schema';
import { GameProgress } from '../managers/game-progress';
import { resolveSkin } from '../managers/skins-catalog';
import { PhysicsWorld } from '../physics/physics-world';
import { StaticBody } from '../physics/static-body';

export class LevelRoot extends Container {
	public readonly player: Player;
	public readonly portal: LevelPortal;
	public readonly collectibles: Collectible[] = [];
	public readonly staticBodies: StaticBody[] = [];
	public readonly hazards: Hazard[] = [];
	public readonly hints: LevelHint[] = [];
	public readonly droplets: BlobDropletPool;
	/** Every firefly in one batch; added above the portal so collected ones read on top. */
	public readonly flies: ParticleContainer;

	public constructor(levelData: LevelData, physicsWorld: PhysicsWorld) {
		super();
		this.eventMode = 'none';

		// Position every frame; color is for the mild slot-shade tint (and later fades).
		this.flies = new ParticleContainer({
			dynamicProperties: { position: true, rotation: false, vertex: false, color: true, uvs: false },
		});

		const hintsLayer = new Container();
		hintsLayer.eventMode = 'none';
		this.addChild(hintsLayer);
		for (const hintData of levelData.hints) {
			const hint = createLevelHint(hintData);
			if (!hint) {
				continue;
			}

			hintsLayer.addChild(hint);
			this.hints.push(hint);
		}

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
			const hazard = createHazard(hazardData);
			hazard.addToWorld(physicsWorld, this);
			this.hazards.push(hazard);
		}

		for (const collectibleData of levelData.collectibles) {
			const collectible = collectibleData.type === 'firefly'
				? new FireflyCollectible(collectibleData)
				: new SpriteCollectible(collectibleData);
			collectible.addToLevel(physicsWorld, { sprites: this, flies: this.flies });
			this.collectibles.push(collectible);
		}

		// Portal under the player so the blob draws on top.
		this.portal = new LevelPortal(levelData.exit);
		this.portal.addToWorld(physicsWorld, this);
		this.addChild(this.flies);

		const skin = resolveSkin(GameProgress.shared.selectedSkinId);
		this.player = new Player(levelData.spawn.x, levelData.spawn.y, skin.blobSheetAlias);
		this.player.bindPhysics(physicsWorld);
		this.player.addToWorld(physicsWorld, this);

		this.droplets = new BlobDropletPool(skin.dropletAlias);
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

		for (const hint of this.hints) {
			hint.destroy({ children: true });
		}
		this.hints.length = 0;

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
			collectible.removeFromLevel(physicsWorld);
			collectible.destroy();
		}
		this.collectibles.length = 0;
		this.flies.destroy();

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
			if (!hazard.blocksDroplets) {
				continue;
			}

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
