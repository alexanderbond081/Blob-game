import { Body } from 'matter-js';
import { Container, DestroyOptions } from 'pixi.js';

import { PhysicsWorld } from './physics-world';

export abstract class PhysicsBody {
	public readonly display: Container;
	public readonly body: Body;

	protected constructor(body: Body, display: Container) {
		this.body = body;
		this.display = display;
		this.display.eventMode = 'none';
	}

	public syncFromBody(): void {
		this.display.position.set(this.body.position.x, this.body.position.y);
		this.display.rotation = this.body.angle;
	}

	public addToWorld(world: PhysicsWorld, parent: Container): void {
		world.addBody(this.body);
		parent.addChild(this.display);
		this.syncFromBody();
	}

	public removeFromWorld(world: PhysicsWorld): void {
		world.removeBody(this.body);
		this.display.removeFromParent();
	}

	public destroy(options?: DestroyOptions): void {
		this.display.destroy(options);
	}
}
