import { Container } from 'pixi.js';

import { isCollectibleBody, isPlayerBody } from '../entities/collectible';
import { isHazardBody } from '../entities/hazard';
import { NineSliceTouchPad } from '../input/nine-slice-touch-pad';
import { loadLevelData } from '../levels/level-loader';
import { SoundManager } from '../managers/sound-manager';
import { PhysicsCollisionInfo } from '../physics/ground-contact';
import { PhysicsWorld } from '../physics/physics-world';
import { GameCamera } from '../world/game-camera';
import { LevelRoot } from '../world/level-root';
import { ParallaxLayer } from '../world/parallax-layer';
import { Scene } from './scene';

const COLLECT_SOUNDS = [
	'firefly-collect1',
	'firefly-collect2',
	'firefly-collect3'
] as const;

const TONE_FACTORS = [
	Math.pow(2, 2 / 12) / 2,
	Math.pow(2, 4 / 12) / 2,
	Math.pow(2, 5 / 12) / 2,
	Math.pow(2, 7 / 12) / 2,
	Math.pow(2, 9 / 12) / 2,
	Math.pow(2, 10 / 12) / 2,
	Math.pow(2, 12 / 12) / 2,
] as const;

export class PlatformLevelScene extends Scene {
	private readonly levelId: string;
	private readonly physicsWorld = new PhysicsWorld();
	private readonly worldRoot = new Container();
	private touchPad!: NineSliceTouchPad;
	private parallaxFar!: ParallaxLayer;
	private parallaxMid!: ParallaxLayer;
	private camera!: GameCamera;
	private levelRoot!: LevelRoot;
	private spawnX = 0;
	private spawnY = 0;
	private fallLimitY = 0;
	private collected = 0;

	public constructor(levelId: string) {
		super();
		this.levelId = levelId;
	}

	public async init(): Promise<void> {
		const levelData = loadLevelData(this.levelId);
		this.spawnX = levelData.spawn.x;
		this.spawnY = levelData.spawn.y;
		// Kill plane slightly below the level bottom so edge platforms still work.
		this.fallLimitY = levelData.size.height + 80;

		this.camera = new GameCamera(
			this.designWidth,
			this.designHeight,
			levelData.size.width,
			levelData.size.height,
		);

		this.parallaxFar = new ParallaxLayer({
			textureAlias: levelData.backgrounds.far.texture,
			parallaxFactor: levelData.backgrounds.far.parallax,
			viewportWidth: this.designWidth,
			viewportHeight: this.designHeight,
		});
		this.parallaxMid = new ParallaxLayer({
			textureAlias: levelData.backgrounds.mid.texture,
			parallaxFactor: levelData.backgrounds.mid.parallax,
			viewportWidth: this.designWidth,
			viewportHeight: this.designHeight,
		});

		this.addChild(this.parallaxFar);
		this.addChild(this.parallaxMid);
		this.addChild(this.worldRoot);

		this.levelRoot = new LevelRoot(levelData, this.physicsWorld);
		this.worldRoot.addChild(this.levelRoot);

		this.touchPad = new NineSliceTouchPad({
			width: this.designWidth,
			height: this.designHeight,
			edgeInset: 10,
			columnWeights: [1, 1.35, 1],
			rowWeights: [0.2, 2, 1],
		});
		this.addChild(this.touchPad);

		this.physicsWorld.onCollisionStart((collision) => {
			this.handleCollectibleCollision(collision);
			this.handleHazardCollision(collision);
		});

		SoundManager.playMusic('bg-music');
		//SoundManager.playAmbience('ambience');
	}

	public update(deltaTime: number): void {
		this.levelRoot.player.setTouchControls(this.touchPad.getControls());
		this.physicsWorld.step(deltaTime);
		this.levelRoot.player.update(deltaTime);
		this.levelRoot.droplets.update(deltaTime);
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
		this.parallaxFar.update(cameraX, cameraY);
		this.parallaxMid.update(cameraX, cameraY);
	}

	public override destroy(options?: Parameters<Container['destroy']>[0]): void {
		if (this.levelRoot) {
			this.levelRoot.destroyLevel(this.physicsWorld);
		}
		this.physicsWorld.destroy();
		this.touchPad?.destroy({ children: true });
		super.destroy(options);
	}

	protected onResize(): void {
		// World uses fixed design coordinates; letterbox handled in index.ts.
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
			player.beginDeath();
			console.info('[player] fell below level — bursting');
		}
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

		player.beginDeath();
		console.info('[player] hit hazard — bursting');
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
		const snd_indx = Math.floor((this.collected % 21) / 7);
		const tone_indx = this.collected % 7;
		SoundManager.playSound(COLLECT_SOUNDS[snd_indx], 2, { speed: TONE_FACTORS[tone_indx] }); //Math.floor(Math.random() * 10)
		this.collected++;
		console.info(`collected ${this.collected} fireflies`);
	}
}
