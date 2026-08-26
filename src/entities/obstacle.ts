import { Bodies, Body } from 'matter-js';
import { Container, Graphics } from 'pixi.js';

import { LevelBranchObstacle, LevelStoneObstacle } from '../levels/level-schema';
import { OBSTACLE_BODY_LABEL } from '../physics/ground-contact';
import { PhysicsBody } from '../physics/physics-body';

const OUTLINE_WIDTH = 2;

/** First-pass feel; retune after play. Heavier than the blob so it can be shoved, not flicked. */
const STONE_DENSITY = 0.3; //0.012;
const STONE_FRICTION = 1;
const STONE_FRICTION_STATIC = 1;
const STONE_FRICTION_AIR = 0.002;
const STONE_RESTITUTION = 0.12;

/** Slightly heavier than the blob; more air drag so logs do not roll forever. */
const BRANCH_DENSITY = 0.05; //0.0055;
const BRANCH_FRICTION = 1.5;
const BRANCH_FRICTION_STATIC = 3;
const BRANCH_FRICTION_AIR = 0.018;
const BRANCH_RESTITUTION = 0.05;

const STONE_FILL = 0x6e6e6e;
const STONE_OUTLINE = 0xc8c8c8;
const BRANCH_FILL = 0xc4a35a;
const BRANCH_OUTLINE = 0xe8d5a3;

export type ObstacleKind = 'stone' | 'branch';

export abstract class Obstacle extends PhysicsBody {
	public readonly kind: ObstacleKind;

	protected constructor(body: Body, display: Container, kind: ObstacleKind) {
		super(body, display);
		this.kind = kind;
	}
}

export class StoneObstacle extends Obstacle {
	public constructor(data: LevelStoneObstacle) {
		// `size` is diameter. Ogmo entity `width` must be converted to `size` on export.
		const radius = data.size * 0.5;
		const body = Bodies.circle(data.x, data.y, radius, {
			label: OBSTACLE_BODY_LABEL,
			density: STONE_DENSITY,
			friction: STONE_FRICTION,
			frictionStatic: STONE_FRICTION_STATIC,
			frictionAir: STONE_FRICTION_AIR,
			restitution: STONE_RESTITUTION,
		});

		super(body, StoneObstacle.createDisplay(radius), 'stone');
	}

	private static createDisplay(radius: number): Container {
		const container = new Container();
		const graphics = new Graphics();
		const inset = OUTLINE_WIDTH * 0.5;
		const innerRadius = Math.max(1, radius - inset);

		graphics
			.circle(0, 0, innerRadius)
			.fill({ color: STONE_FILL, alpha: 1 })
			.stroke({ color: STONE_OUTLINE, width: OUTLINE_WIDTH, alpha: 1 });

		container.addChild(graphics);
		return container;
	}
}

export class BranchObstacle extends Obstacle {
	public constructor(data: LevelBranchObstacle) {
		const angleRad = (data.angle * Math.PI) / 180;
		const halfLength = data.length * 0.5;
		const centerX = data.x + Math.cos(angleRad) * halfLength;
		const centerY = data.y + Math.sin(angleRad) * halfLength;
		const chamferRadius = branchChamferRadius(data.length, data.thickness);

		const body = Bodies.rectangle(centerX, centerY, data.length, data.thickness, {
			label: OBSTACLE_BODY_LABEL,
			angle: angleRad,
			chamfer: { radius: chamferRadius },
			density: BRANCH_DENSITY,
			friction: BRANCH_FRICTION,
			frictionStatic: BRANCH_FRICTION_STATIC,
			frictionAir: BRANCH_FRICTION_AIR,
			restitution: BRANCH_RESTITUTION,
		});

		super(body, BranchObstacle.createDisplay(data.length, data.thickness, chamferRadius), 'branch');
	}

	private static createDisplay(length: number, thickness: number, cornerRadius: number): Container {
		const container = new Container();
		const graphics = new Graphics();
		const inset = OUTLINE_WIDTH * 0.5;
		const innerWidth = Math.max(0, length - OUTLINE_WIDTH);
		const innerHeight = Math.max(0, thickness - OUTLINE_WIDTH);
		const innerRadius = Math.max(0, cornerRadius - inset);

		graphics
			.roundRect(-length * 0.5 + inset, -thickness * 0.5 + inset, innerWidth, innerHeight, innerRadius)
			.fill({ color: BRANCH_FILL, alpha: 1 })
			.stroke({ color: BRANCH_OUTLINE, width: OUTLINE_WIDTH, alpha: 1 });

		container.addChild(graphics);
		return container;
	}
}

/** Almost a stadium; Matter requires radius < half the shorter side. */
const branchChamferRadius = (length: number, thickness: number): number => {
	const maxRadius = Math.min(length, thickness) * 0.5 - 0.5;
	// return Math.max(1, Math.min(maxRadius, thickness * 0.45));
	return Math.min(maxRadius, 4);
};
