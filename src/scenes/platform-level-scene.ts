import { Container } from 'pixi.js';

import { isCollectibleBody, isPlayerBody } from '../entities/collectible';
import { FireflyCollectible } from '../entities/firefly-collectible';
import { isHazardBody } from '../entities/hazard';
import { isLevelExitBody } from '../entities/level-portal';
import { GestureTouchLayer } from '../input/gesture-touch-layer';
import { loadLevelData } from '../levels/level-loader';
import { GameProgress } from '../managers/game-progress';
import { SoundManager } from '../managers/sound-manager';
import { PhysicsCollisionInfo } from '../physics/ground-contact';
import { PhysicsWorld } from '../physics/physics-world';
import { GameCamera } from '../world/game-camera';
import { LevelRoot } from '../world/level-root';
import { ParallaxLayer } from '../world/parallax-layer';
import { Scene } from './scene';

export type LevelExitEvent = {
	levelId: string;
	collected: number;
	totalFireflies: number;
	timeSec: number;
	deaths: number;
};

export class PlatformLevelScene extends Scene {
	private readonly levelId: string;
	private readonly physicsWorld = new PhysicsWorld();
	private readonly worldRoot = new Container();
	private touchLayer!: GestureTouchLayer;
	private parallaxLayers: ParallaxLayer[] = [];
	private camera!: GameCamera;
	private levelRoot!: LevelRoot;
	private spawnX = 0;
	private spawnY = 0;
	private fallLimitY = 0;
	private collected = 0;
	private totalFireflies = 0;
	private runTimeSec = 0;
	private runDeaths = 0;
	private hasExited = false;

	public constructor(levelId: string) {
		super();
		this.levelId = levelId;
	}

	public async init(): Promise<void> {
		const levelData = loadLevelData(this.levelId);
		this.spawnX = levelData.spawn.x;
		this.spawnY = levelData.spawn.y;
		this.totalFireflies = levelData.collectibles.filter((item) => item.type === 'firefly').length;
		this.runTimeSec = 0;
		this.runDeaths = 0;
		this.collected = 0;
		this.hasExited = false;
		// Kill plane slightly below the level bottom so edge platforms still work.
		this.fallLimitY = levelData.size.height + 80;

		this.camera = new GameCamera(
			this.designWidth,
			this.designHeight,
			levelData.size.width,
			levelData.size.height,
		);

		this.parallaxLayers = [];
		for (const layer of levelData.backgrounds) {
			const parallax = new ParallaxLayer({
				textureAlias: layer.texture,
				parallaxFactor: layer.parallax,
				viewportWidth: this.designWidth,
				viewportHeight: this.designHeight,
				levelHeight: levelData.size.height,
			});
			this.parallaxLayers.push(parallax);
			this.addChild(parallax);
		}
		this.addChild(this.worldRoot);

		this.levelRoot = new LevelRoot(levelData, this.physicsWorld);
		this.worldRoot.addChild(this.levelRoot);
		this.centerCameraOnPlayer();

		this.touchLayer = new GestureTouchLayer({
			width: this.designWidth,
			height: this.designHeight,
		});
		this.addChild(this.touchLayer);

		this.physicsWorld.onCollisionStart((collision) => {
			this.handleCollectibleCollision(collision);
			this.handleHazardCollision(collision);
			this.handleLevelExitCollision(collision);
		});

		SoundManager.playMusic('bg-music');
		//SoundManager.playAmbience('ambience');
	}

	public update(deltaTime: number): void {
		if (!this.hasExited) {
			this.runTimeSec += Math.max(deltaTime, 0) / 60;
		}

		this.levelRoot.player.setTouchControls(this.touchLayer.getControls());
		this.physicsWorld.step(deltaTime);
		this.touchLayer.notePlayerState({
			clinging: this.levelRoot.player.isClinging,
			dying: this.levelRoot.player.isDying,
			onGround: this.levelRoot.player.isOnGround(),
		});
		this.levelRoot.player.update(deltaTime);
		this.levelRoot.droplets.update(deltaTime);
		this.levelRoot.portal.update(deltaTime);
		for (const collectible of this.levelRoot.collectibles) {
			collectible.update(deltaTime);
		}
		this.checkPlayerDeath();

		const renderPos = this.levelRoot.player.getRenderPosition();
		this.camera.update(renderPos.x, renderPos.y, deltaTime);

		const renderScale = this.worldTransform.a || 1;
		const cameraX = this.camera.getRenderX(renderScale);
		const cameraY = this.camera.getRenderY(renderScale);
		this.camera.applyToContainer(this.worldRoot, renderScale);
		this.levelRoot.player.alignDisplayToCameraPixels(cameraX, cameraY, renderScale);
		for (const layer of this.parallaxLayers) {
			layer.update(cameraX, cameraY);
		}
	}

	public override destroy(options?: Parameters<Container['destroy']>[0]): void {
		if (this.levelRoot) {
			this.levelRoot.destroyLevel(this.physicsWorld);
		}
		this.physicsWorld.destroy();
		this.touchLayer?.destroy({ children: true });
		super.destroy(options);
	}

	protected onResize(): void {
		// World uses fixed design coordinates; letterbox handled in index.ts.
	}

	/**
	 * Places the camera on the player before the first frame so the level opens
	 * at the spawn point instead of scrolling in from the level origin.
	 * Runs before the scene is on stage, so the stage scale is not known yet —
	 * the first update() re-applies scroll with the real render scale.
	 */
	private centerCameraOnPlayer(): void {
		const renderPos = this.levelRoot.player.getRenderPosition();
		this.camera.snapTo(renderPos.x, renderPos.y);

		const cameraX = this.camera.getRenderX();
		const cameraY = this.camera.getRenderY();
		this.camera.applyToContainer(this.worldRoot);
		for (const layer of this.parallaxLayers) {
			layer.update(cameraX, cameraY);
		}
	}

	private checkPlayerDeath(): void {
		const player = this.levelRoot.player;

		if (player.finishDeathIfReady(this.spawnX, this.spawnY)) {
			console.info('[player] burst complete — respawned at spawn');
			return;
		}

		if (player.isDying) {
			return;
		}

		if (player.position.y > this.fallLimitY) {
			this.registerDeath();
			player.beginDeath();
			console.info('[player] fell below level — bursting');
		}
	}

	private handleLevelExitCollision(collision: PhysicsCollisionInfo): void {
		if (this.hasExited || this.levelRoot.player.isDying) {
			return;
		}

		const portal = this.levelRoot.portal;
		if (!portal.canTrigger) {
			return;
		}

		const { bodyA, bodyB } = collision;
		const playerInvolved = isPlayerBody(bodyA) || isPlayerBody(bodyB);
		const exitInvolved = isLevelExitBody(bodyA) || isLevelExitBody(bodyB);

		if (!playerInvolved || !exitInvolved) {
			return;
		}

		this.hasExited = true;
		portal.setState('entered');
		SoundManager.playSound('portal-enter');
		const payload: LevelExitEvent = {
			levelId: this.levelId,
			collected: this.collected,
			totalFireflies: this.totalFireflies,
			timeSec: this.runTimeSec,
			deaths: this.runDeaths,
		};
		console.info(
			`[level] exit ${payload.levelId} collected=${payload.collected}/${payload.totalFireflies} `
			+ `time=${payload.timeSec.toFixed(1)}s deaths=${payload.deaths}`,
		);
		this.emit('level-exit', payload);
	}

	private handleHazardCollision(collision: PhysicsCollisionInfo): void {
		const player = this.levelRoot.player;
		if (player.isDying) {
			return;
		}

		const { bodyA, bodyB } = collision;
		const playerInvolved = isPlayerBody(bodyA) || isPlayerBody(bodyB);
		const hazardInvolved = isHazardBody(bodyA) || isHazardBody(bodyB);

		if (!playerInvolved || !hazardInvolved) {
			return;
		}

		this.registerDeath();
		player.beginDeath();
		console.info('[player] hit hazard — bursting');
	}

	private registerDeath(): void {
		this.runDeaths += 1;
		GameProgress.shared.recordDeath(this.levelId);
		GameProgress.shared.save();
	}

	private handleCollectibleCollision(collision: PhysicsCollisionInfo): void {
		if (this.levelRoot.player.isDying) {
			return;
		}

		const { bodyA, bodyB } = collision;
		const playerInvolved = isPlayerBody(bodyA) || isPlayerBody(bodyB);
		const collectibleBody = isCollectibleBody(bodyA) ? bodyA : isCollectibleBody(bodyB) ? bodyB : null;

		if (!playerInvolved || !collectibleBody) {
			return;
		}

		const collectible = this.levelRoot.collectibles.find((item) => item.body === collectibleBody);

		if (!collectible || collectible.collected) {
			return;
		}

		collectible.collect(this.physicsWorld);

		if (!(collectible instanceof FireflyCollectible)) {
			return;
		}

		SoundManager.playSound('firefly-wind', 3);
		this.collected++;
		collectible.deliverToPortal(this.levelRoot.portal, this.collected === this.totalFireflies);
		console.info(`collected ${this.collected} fireflies`);
	}
}
