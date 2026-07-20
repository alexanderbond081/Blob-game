import Matter, { Body, Engine, Events, World } from 'matter-js';

import { PhysicsCollisionInfo } from './ground-contact';

export type CollisionCallback = (collision: PhysicsCollisionInfo) => void;

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
				this.dispatchPair(this.collisionStartHandlers, pair.bodyA, pair.bodyB, pair.collision.normal);
			}
		});

		Events.on(this.engine, 'collisionActive', (event) => {
			for (const pair of event.pairs) {
				this.dispatchPair(this.collisionActiveHandlers, pair.bodyA, pair.bodyB, pair.collision.normal);
			}
		});

		Events.on(this.engine, 'collisionEnd', (event) => {
			for (const pair of event.pairs) {
				this.dispatchPair(this.collisionEndHandlers, pair.bodyA, pair.bodyB, pair.collision.normal);
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
		bodyA: Body,
		bodyB: Body,
		normal: Matter.Vector,
	): void {
		const collision: PhysicsCollisionInfo = { bodyA, bodyB, normal };

		for (const handler of handlers) {
			handler(collision);
		}
	}
}
