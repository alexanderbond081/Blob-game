import { Assets, ParticleContainer, Texture } from 'pixi.js';

import { AnotherFly } from '../components/particle-fly';
import { LevelCollectible } from '../levels/level-schema';
import { SoundManager } from '../managers/sound-manager';
import { PhysicsWorld } from '../physics/physics-world';
import { Collectible, CollectibleLayers } from './collectible';
import { LevelPortal } from './level-portal';

/** Visual half-size in world pixels (sprite is scaled to this diameter). */
const FLY_DISPLAY_RADIUS = 25;
/** Matter sensor radius — smaller than the glow so pickup feels tight. */
const FLY_COLLECT_RADIUS = 20;

/** Wander tuning: random impulse, damping time and pull back to the level point. */
const FLY_CHAOS = 0.35;
const FLY_SPEED = 10;
const FLY_DISTANCE = 50;
const SLOT_CHAOS = 0.3;
const SLOT_SPEED = 5;
const SLOT_DISTANCE = 5;

const SLOT_CHIMES = [
	'firefly-collect1',
	'firefly-collect2',
	'firefly-collect3',
] as const;

const SLOT_TONE_FACTORS = [
	Math.pow(2, 2 / 12) / 2,
	Math.pow(2, 4 / 12) / 2,
	Math.pow(2, 5 / 12) / 2,
	Math.pow(2, 7 / 12) / 2,
	Math.pow(2, 9 / 12) / 2,
	Math.pow(2, 10 / 12) / 2,
	Math.pow(2, 12 / 12) / 2,
] as const;

/** Ease-out homing rate; ~95% of the trip in 0.67s even if the slot is bobbing. */
const SEEK_ARRIVE_PX = 12;
/** Extra flies fade out at the vortex; the real suck-in comes later. */
const CENTER_FADE_SEC = 0.2;

type FlyDuty = 'idle' | 'toSlot' | 'docked' | 'toCenter' | 'fading' | 'gone';

/**
 * Firefly: portal fuel. Renders as a particle in the level-wide batch instead of
 * a sprite, and flies around its level point rather than bobbing in place.
 * After pickup it homes to a rim slot (and stays there) or to the vortex centre.
 */
export class FireflyCollectible extends Collectible {
	private readonly fly: AnotherFly;
	private layer: ParticleContainer | null = null;
	private duty: FlyDuty = 'idle';
	private portal: LevelPortal | null = null;
	private slotIndex: number | null = null;
	private isLastOnMap = false;

	public constructor(data: LevelCollectible) {
		super(data, FLY_COLLECT_RADIUS);

		const texture = Assets.get<Texture>('firefly');
		if (!texture) {
			throw new Error('Asset "firefly" is not loaded. Load game bundle before the level.');
		}

		const scale = (FLY_DISPLAY_RADIUS * 2) / Math.max(texture.width, texture.height);
		this.fly = new AnotherFly(
			texture,
			this.baseX,
			this.baseY,
			FLY_CHAOS,
			FLY_SPEED,
			FLY_DISTANCE,
			scale,
			false,
		);
	}

	public override addToLevel(world: PhysicsWorld, layers: CollectibleLayers): void {
		this.layer = layers.flies;
		world.addBody(this.body);
		layers.flies.addParticle(this.fly);
	}

	public override removeFromLevel(world: PhysicsWorld): void {
		if (!this.collected) {
			world.removeBody(this.body);
		}

		this.detachFly();
	}

	public override update(deltaTime: number): void {
		if (this.duty === 'gone') {
			return;
		}

		const target = this.readTarget();
		if (target) {
			this.fly.setOrigin(target.x, target.y);
		}

		this.fly.move(deltaTime);

		const dtSec = Collectible.toSeconds(deltaTime);

		if (this.fly.distanceToOrigin() > SEEK_ARRIVE_PX) {
			return;
		}

		if (this.duty === 'toSlot') {
			this.duty = 'docked';
			this.fly.setChaos(SLOT_CHAOS);
			this.fly.setSpeed(SLOT_SPEED);
			this.playSlotChime();
			this.portal?.notifySlotArrived();
			return;
		}

		if (this.duty === 'toCenter') {
			SoundManager.playSound(this.isLastOnMap ? 'firefly-all-done' : 'firefly-suck', 3);
			this.duty = 'fading';
		}

		if (this.duty === 'fading') {
			this.fly.alpha -= dtSec / CENTER_FADE_SEC;
			if (this.fly.alpha <= 0) {
				this.fly.alpha = 0;
				this.detachFly();
			}
		}
	}

	/**
	 * Sensor is already gone (`collect`). Homes to the next rim slot, or to the
	 * vortex centre when the portal is already full.
	 */
	public deliverToPortal(portal: LevelPortal, isLastOnMap = false): void {
		if (this.duty !== 'idle') {
			return;
		}

		this.portal = portal;
		this.isLastOnMap = isLastOnMap;
		this.fly.setDistance(SLOT_DISTANCE);

		const slot = portal.reserveNextSlot();
		if (slot === null) {
			this.duty = 'toCenter';
			this.slotIndex = null;
			return;
		}

		this.duty = 'toSlot';
		this.slotIndex = slot;
	}

	private playSlotChime(): void {
		const n = this.slotIndex ?? 0;
		const soundIndex = Math.floor((n % 21) / 7);
		const toneIndex = n % 7;
		SoundManager.playSound(SLOT_CHIMES[soundIndex], 2, { speed: SLOT_TONE_FACTORS[toneIndex] });
	}
	/*
		private dockAtSlot(): void {
			this.duty = 'docked';
			this.fly.resetDrift();
			this.fly.setNewDistance(SLOT_DISTANCE);
		}*/

	private readTarget(): { x: number; y: number } | null {
		if (!this.portal) {
			return null;
		}

		if (this.slotIndex === null) {
			return this.portal.getCenterWorldPosition();
		}

		return this.portal.getSlotWorldPosition(this.slotIndex);
	}

	private detachFly(): void {
		this.duty = 'gone';
		this.layer?.removeParticle(this.fly);
		this.layer = null;
		this.portal = null;
	}
}
