import { AnimatedSprite, Assets, Container, Spritesheet, Texture } from 'pixi.js';

export type DropletObstacleRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export type DropletLevelBounds = {
	width: number;
	height: number;
};

const POOL_SIZE = 8;
const RADIUS_MIN = 3;
const RADIUS_MAX = 7;
const SPEED_MIN = 5;
const SPEED_MAX = 10;
/**
 * Matter applies gravity as scale * deltaMs² per Engine step (~0.0018 * 16.67² ≈ 0.5).
 * Match that so arcs read against player jump feel (JUMP_VELOCITY ≈ -15).
 */
const DROPLET_GRAVITY = 0.5;
const FRAME_HZ = 60;
const MAX_LIFETIME_SEC = 2;
const BOUNDS_MARGIN = 40;
/** Logical texture size for droplet-idle (30px @ resolution 2). */
const TEXTURE_LOGICAL_SIZE = 15;

type DropletSlot = {
	sprite: AnimatedSprite;
	active: boolean;
	x: number;
	y: number;
	vx: number;
	vy: number;
	radius: number;
	lifetimeSec: number;
};

/**
 * Pooled kinematic splash droplets for blob death burst.
 * Sleep = invisible, no physics. No Matter bodies.
 */
export class BlobDropletPool extends Container {
	private readonly slots: DropletSlot[] = [];
	private obstacles: DropletObstacleRect[] = [];
	private levelBounds: DropletLevelBounds = { width: 0, height: 0 };
	private readonly dropletSheetAlias: string;

	public constructor(dropletSheetAlias = 'blob-droplet') {
		super();
		this.eventMode = 'none';
		this.dropletSheetAlias = dropletSheetAlias;
		this.buildPool();
	}

	public setObstacles(obstacles: DropletObstacleRect[]): void {
		this.obstacles = obstacles;
	}

	public setLevelBounds(bounds: DropletLevelBounds): void {
		this.levelBounds = bounds;
	}

	public burstAt(originX: number, originY: number, blobRadius: number): void {
		this.sleepAll();

		for (let i = 0; i < this.slots.length; i += 1) {
			// Even fan around the circle + small jitter so open air looks filled.
			const baseAngle = (i / POOL_SIZE) * Math.PI * 2;
			const jitter = (Math.random() - 0.5) * (Math.PI / POOL_SIZE);
			this.wakeSlot(this.slots[i], originX, originY, blobRadius, baseAngle + jitter);
		}
	}

	public sleepAll(): void {
		for (const slot of this.slots) {
			this.sleepSlot(slot);
		}
	}

	public update(deltaTime: number): void {
		const frameDt = Math.max(deltaTime, 0);
		const dtSec = frameDt / FRAME_HZ;

		for (const slot of this.slots) {
			if (!slot.active) {
				continue;
			}

			slot.lifetimeSec += dtSec;
			// Velocities use the same "px per 60fps frame" units as player Matter speeds.
			slot.vy += DROPLET_GRAVITY * frameDt;
			slot.x += slot.vx * frameDt;
			slot.y += slot.vy * frameDt;
			slot.sprite.position.set(slot.x, slot.y);

			if (
				slot.lifetimeSec >= MAX_LIFETIME_SEC
				|| this.isOutOfBounds(slot)
				|| this.hitsObstacle(slot)
			) {
				this.sleepSlot(slot);
			}
		}
	}

	public override destroy(options?: Parameters<Container['destroy']>[0]): void {
		this.sleepAll();
		super.destroy(options);
	}

	private buildPool(): void {
		const sheet = Assets.get<Spritesheet>(this.dropletSheetAlias);
		if (!sheet) {
			throw new Error(
				`Asset "${this.dropletSheetAlias}" is not loaded. Load game bundle before the level.`,
			);
		}

		const frames = sheet.animations.idle;
		const fallback = sheet.textures['droplet-idle'] ?? Texture.EMPTY;
		const textures = frames?.length ? frames : [fallback];

		for (let i = 0; i < POOL_SIZE; i += 1) {
			const sprite = new AnimatedSprite(textures);
			sprite.anchor.set(0.5);
			sprite.eventMode = 'none';
			sprite.loop = true;
			sprite.visible = false;
			this.addChild(sprite);

			this.slots.push({
				sprite,
				active: false,
				x: 0,
				y: 0,
				vx: 0,
				vy: 0,
				radius: RADIUS_MIN,
				lifetimeSec: 0,
			});
		}
	}

	private wakeSlot(
		slot: DropletSlot,
		originX: number,
		originY: number,
		blobRadius: number,
		angle: number,
	): void {
		const radius = RADIUS_MIN + Math.random() * (RADIUS_MAX - RADIUS_MIN);
		const speed = SPEED_MIN + Math.random() * (SPEED_MAX - SPEED_MIN);
		const dirX = Math.cos(angle);
		const dirY = Math.sin(angle);
		const spawnOffset = Math.max(0, blobRadius - radius);

		slot.active = true;
		slot.radius = radius;
		slot.vx = dirX * speed;
		slot.vy = dirY * speed;
		slot.x = originX + dirX * spawnOffset;
		slot.y = originY + dirY * spawnOffset;
		slot.lifetimeSec = 0;

		const scale = (radius * 2) / TEXTURE_LOGICAL_SIZE;
		slot.sprite.scale.set(scale);
		slot.sprite.position.set(slot.x, slot.y);
		slot.sprite.visible = true;
		if (slot.sprite.textures.length > 1 || slot.sprite.textures[0] !== Texture.EMPTY) {
			slot.sprite.gotoAndPlay(0);
		}
	}

	private sleepSlot(slot: DropletSlot): void {
		slot.active = false;
		slot.vx = 0;
		slot.vy = 0;
		slot.lifetimeSec = 0;
		slot.sprite.visible = false;
		slot.sprite.stop();
	}

	private isOutOfBounds(slot: DropletSlot): boolean {
		const { width, height } = this.levelBounds;
		if (width <= 0 || height <= 0) {
			return false;
		}

		return (
			slot.x + slot.radius < -BOUNDS_MARGIN
			|| slot.y + slot.radius < -BOUNDS_MARGIN
			|| slot.x - slot.radius > width + BOUNDS_MARGIN
			|| slot.y - slot.radius > height + BOUNDS_MARGIN
		);
	}

	private hitsObstacle(slot: DropletSlot): boolean {
		for (const rect of this.obstacles) {
			if (circleHitsAabb(slot.x, slot.y, slot.radius, rect)) {
				return true;
			}
		}

		return false;
	}
}

const circleHitsAabb = (
	cx: number,
	cy: number,
	radius: number,
	rect: DropletObstacleRect,
): boolean => {
	const closestX = Math.max(rect.x, Math.min(cx, rect.x + rect.width));
	const closestY = Math.max(rect.y, Math.min(cy, rect.y + rect.height));
	const dx = cx - closestX;
	const dy = cy - closestY;
	return dx * dx + dy * dy <= radius * radius;
};
