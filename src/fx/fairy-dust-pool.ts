import { Assets, Container, Particle, ParticleContainer, Texture } from 'pixi.js';

const DEFAULT_TEXTURE_ALIAS = 'fairy-dust-particle';
const DEFAULT_POOL_SIZE = 50;
/** Grow from 0 → full size / alpha. Tune by feel. */
const APPEAR_SEC = 0.5;
/** Shrink back to 0 size / alpha. Tune by feel. */
const FADE_SEC = 0.5;
const FRAME_HZ = 60;

export type FairyDustPoolOptions = {
	/** Sleeping particles kept for reuse. Default 50. */
	poolSize?: number;
	/**
	 * Asset aliases this pool can draw. Each alias is its own batch:
	 * a ParticleContainer shares one base texture.
	 * Default is the level pollen texture.
	 */
	textureAliases?: readonly string[];
};

type DustTexture = {
	alias: string;
	texture: Texture;
	textureSize: number;
	view: ParticleContainer;
};

type DustSlot = {
	particle: Particle;
	texture: DustTexture;
	active: boolean;
	x: number;
	y: number;
	vx: number;
	vy: number;
	targetScale: number;
	holdSec: number;
	ageSec: number;
};

const createBatch = (texture: Texture): ParticleContainer => {
	const batch = new ParticleContainer({
		texture,
		dynamicProperties: {
			position: true,
			rotation: false,
			vertex: true,
			color: true,
			uvs: false,
		},
	});
	batch.eventMode = 'none';
	return batch;
};

/**
 * Pooled motes. Callers spawn; the pool owns motion, fade and reuse.
 * Sleep = alpha 0, scale 0, still in a batch. No Matter bodies.
 */
export class FairyDustPool extends Container {
	private readonly textures = new Map<string, DustTexture>();
	private readonly slots: DustSlot[] = [];
	private readonly defaultAlias: string;

	public constructor(options?: FairyDustPoolOptions) {
		super();
		this.eventMode = 'none';

		const aliases = options?.textureAliases ?? [DEFAULT_TEXTURE_ALIAS];
		if (aliases.length === 0) {
			throw new Error('FairyDustPool needs at least one texture.');
		}

		const poolSize = options?.poolSize ?? DEFAULT_POOL_SIZE;
		if (poolSize < 1) {
			throw new Error('FairyDustPool poolSize must be at least 1.');
		}

		for (const alias of aliases) {
			if (this.textures.has(alias)) {
				throw new Error(`FairyDustPool texture "${alias}" is listed twice.`);
			}

			const texture = Assets.get<Texture>(alias);
			if (!texture) {
				throw new Error(`Asset "${alias}" is not loaded. Load it before creating the pool.`);
			}

			const view = createBatch(texture);
			this.addChild(view);
			this.textures.set(alias, {
				alias,
				texture,
				textureSize: Math.max(texture.width, texture.height) || 1,
				view,
			});
		}

		this.defaultAlias = aliases[0];
		const home = this.textures.get(this.defaultAlias);
		if (!home) {
			throw new Error(`Asset "${this.defaultAlias}" is not loaded. Load it before creating the pool.`);
		}

		this.buildPool(home, poolSize);
	}

	/**
	 * `size` is the full logical diameter in world pixels.
	 * `holdSec` is time at full size between appear and fade (px/frame velocities match droplets).
	 * `textureAlias` picks a texture from this pool's list; omitted uses the first one.
	 */
	public spawn(
		x: number,
		y: number,
		size: number,
		holdSec = 0,
		vx = 0,
		vy = 0,
		textureAlias?: string,
	): void {
		const texture = this.resolveTexture(textureAlias);
		const slot = this.takeSlot();
		this.bindSlotTexture(slot, texture);
		this.wakeSlot(slot, x, y, size, holdSec, vx, vy);
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

			slot.ageSec += dtSec;
			slot.x += slot.vx * frameDt;
			slot.y += slot.vy * frameDt;

			const fadeStartSec = APPEAR_SEC + slot.holdSec;
			const lifeEndSec = fadeStartSec + FADE_SEC;
			if (slot.ageSec >= lifeEndSec) {
				this.sleepSlot(slot);
				continue;
			}

			this.applyPose(slot, this.lifeWeight(slot.ageSec, fadeStartSec));
		}
	}

	public override destroy(options?: Parameters<Container['destroy']>[0]): void {
		this.sleepAll();
		super.destroy(options);
	}

	private resolveTexture(textureAlias?: string): DustTexture {
		const alias = textureAlias ?? this.defaultAlias;
		const texture = this.textures.get(alias);
		if (!texture) {
			throw new Error(`FairyDustPool has no texture "${alias}".`);
		}

		return texture;
	}

	private buildPool(home: DustTexture, poolSize: number): void {
		for (let i = 0; i < poolSize; i += 1) {
			const particle = new Particle(home.texture);
			particle.anchorX = 0.5;
			particle.anchorY = 0.5;

			const slot: DustSlot = {
				particle,
				texture: home,
				active: false,
				x: 0,
				y: 0,
				vx: 0,
				vy: 0,
				targetScale: 1,
				holdSec: 0,
				ageSec: 0,
			};
			this.sleepSlot(slot);
			home.view.addParticle(particle);
			this.slots.push(slot);
		}
	}

	private takeSlot(): DustSlot {
		for (const slot of this.slots) {
			if (!slot.active) {
				return slot;
			}
		}

		let oldest = this.slots[0];
		for (const slot of this.slots) {
			if (slot.ageSec > oldest.ageSec) {
				oldest = slot;
			}
		}

		return oldest;
	}

	/** Move the particle onto the batch that owns this texture. Batches cannot share a source image. */
	private bindSlotTexture(slot: DustSlot, texture: DustTexture): void {
		if (slot.texture === texture) {
			return;
		}

		slot.texture.view.removeParticle(slot.particle);
		slot.particle.texture = texture.texture;
		texture.view.addParticle(slot.particle);
		slot.texture = texture;
	}

	private wakeSlot(
		slot: DustSlot,
		x: number,
		y: number,
		size: number,
		holdSec: number,
		vx: number,
		vy: number,
	): void {
		slot.active = true;
		slot.x = x;
		slot.y = y;
		slot.vx = vx;
		slot.vy = vy;
		slot.targetScale = Math.max(size, 0) / slot.texture.textureSize;
		slot.holdSec = Math.max(holdSec, 0);
		slot.ageSec = 0;
		this.applyPose(slot, 0);
	}

	private sleepSlot(slot: DustSlot): void {
		slot.active = false;
		slot.vx = 0;
		slot.vy = 0;
		slot.ageSec = 0;
		slot.holdSec = 0;
		slot.targetScale = 0;
		slot.particle.alpha = 0;
		slot.particle.scaleX = 0;
		slot.particle.scaleY = 0;
	}

	private lifeWeight(ageSec: number, fadeStartSec: number): number {
		if (ageSec < APPEAR_SEC) {
			return ageSec / APPEAR_SEC;
		}

		if (ageSec < fadeStartSec) {
			return 1;
		}

		return 1 - (ageSec - fadeStartSec) / FADE_SEC;
	}

	private applyPose(slot: DustSlot, weight: number): void {
		const clamped = weight < 0 ? 0 : weight > 1 ? 1 : weight;
		const scale = slot.targetScale * clamped;
		slot.particle.x = slot.x;
		slot.particle.y = slot.y;
		slot.particle.alpha = clamped;
		slot.particle.scaleX = scale;
		slot.particle.scaleY = scale;
	}
}
