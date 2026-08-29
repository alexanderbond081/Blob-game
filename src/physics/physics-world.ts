import Matter, { Body, Engine, Events, World } from 'matter-js';

import { PhysicsCollisionInfo } from './ground-contact';

export type CollisionCallback = (collision: PhysicsCollisionInfo) => void;

/**
 * Matter reuses a fixed two-slot `supports` array per pair and reports how many
 * slots hold this step's contacts. `@types/matter-js` omits `supportCount`.
 */
type CollisionRecord = Matter.Collision & { supportCount?: number };

const TARGET_FPS = 60;
const FIXED_DELTA_MS = 1000 / TARGET_FPS;
const MAX_SUB_STEPS = 5;
const GRAVITY_SCALE = 0.0018;

export class PhysicsWorld {
	public readonly engine: Engine;

	private accumulatorMs = 0;
	private readonly collisionStartHandlers: CollisionCallback[] = [];
	private readonly collisionActiveHandlers: CollisionCallback[] = [];
	private readonly collisionEndHandlers: CollisionCallback[] = [];

	public constructor() {
		this.engine = Engine.create({
			gravity: { x: 0, y: 1, scale: GRAVITY_SCALE },
		});

		Events.on(this.engine, 'collisionStart', (event) => {
			for (const pair of event.pairs) {
				this.dispatchPair(this.collisionStartHandlers, pair);
			}
		});

		Events.on(this.engine, 'collisionActive', (event) => {
			for (const pair of event.pairs) {
				this.dispatchPair(this.collisionActiveHandlers, pair);
			}
		});

		Events.on(this.engine, 'collisionEnd', (event) => {
			for (const pair of event.pairs) {
				this.dispatchPair(this.collisionEndHandlers, pair);
			}
		});
	}

	public addBody(body: Body): void {
		World.add(this.engine.world, body);
	}

	public removeBody(body: Body): void {
		World.remove(this.engine.world, body);
	}

	public onCollisionStart(handler: CollisionCallback): void {
		this.collisionStartHandlers.push(handler);
	}

	public onCollisionActive(handler: CollisionCallback): void {
		this.collisionActiveHandlers.push(handler);
	}

	public onCollisionEnd(handler: CollisionCallback): void {
		this.collisionEndHandlers.push(handler);
	}

	/** @param deltaTime Pixi ticker deltaTime (1.0 = one frame at 60 FPS). */
	public step(deltaTime: number): void {
		const frameMs = Math.min(deltaTime, MAX_SUB_STEPS) * FIXED_DELTA_MS;
		this.accumulatorMs += frameMs;

		let steps = 0;
		while (this.accumulatorMs >= FIXED_DELTA_MS && steps < MAX_SUB_STEPS) {
			Engine.update(this.engine, FIXED_DELTA_MS);
			this.accumulatorMs -= FIXED_DELTA_MS;
			steps += 1;
		}
	}

	/**
	 * Blend factor toward the next physics step (0..1).
	 * Use for rendering: lerp(previousBodyState, currentBodyState, alpha).
	 */
	public getInterpolationAlpha(): number {
		return Math.min(1, Math.max(0, this.accumulatorMs / FIXED_DELTA_MS));
	}

	public destroy(): void {
		World.clear(this.engine.world, false);
		Engine.clear(this.engine);
		this.collisionStartHandlers.length = 0;
		this.collisionActiveHandlers.length = 0;
		this.collisionEndHandlers.length = 0;
		this.accumulatorMs = 0;
	}

	private dispatchPair(
		handlers: CollisionCallback[],
		pair: Matter.Pair,
	): void {
		const contact = pair.collision as CollisionRecord | undefined;
		const collision: PhysicsCollisionInfo = {
			bodyA: pair.bodyA,
			bodyB: pair.bodyB,
			normal: contact?.normal ?? { x: 0, y: 0 },
			contactX: averageSupportX(contact?.supports, contact?.supportCount),
		};

		for (const handler of handlers) {
			handler(collision);
		}
	}
}

/**
 * Mean X of this step's contacts only. Slots past `supportCount` still hold a
 * live vertex from an earlier step, which would drag the mean off the contact.
 */
const averageSupportX = (
	supports: Array<Matter.Vector | null> | undefined,
	supportCount: number | undefined,
): number | null => {
	if (!supports) {
		return null;
	}

	const validCount = Math.min(supportCount ?? supports.length, supports.length);

	let sumX = 0;
	let count = 0;
	for (let index = 0; index < validCount; index += 1) {
		const support = supports[index];
		if (!support) {
			continue;
		}

		sumX += support.x;
		count += 1;
	}

	if (count === 0) {
		return null;
	}

	return sumX / count;
};
