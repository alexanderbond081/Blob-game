import { Bodies } from 'matter-js';
import { Container, Graphics } from 'pixi.js';

import { PlatformType } from '../levels/level-schema';
import { PLATFORM_BODY_LABEL, setPlatformType } from './ground-contact';
import { PhysicsBody } from './physics-body';

const CORNER_RADIUS = 8;
const OUTLINE_WIDTH = 2;
//const FILL_ALPHA = 0.8;

const PLATFORM_STYLE: Record<PlatformType, { fill: number; outline: number; alpha: number }> = {
	ground: { fill: 0x3b2412, outline: 0x8b5a2b, alpha: 0.8 },
	wall: { fill: 0xa67c52, outline: 0xe2c49a, alpha: 0.8 },
	leaf: { fill: 0x005020, outline: 0x30bf52, alpha: 0.8 },
	sticky: { fill: 0x0073a0, outline: 0x5fd2ff, alpha: 0.6 },
};

export type StaticBodyOptions = {
	x: number;
	y: number;
	width: number;
	height: number;
	type: PlatformType;
};

export class StaticBody extends PhysicsBody {
	public constructor(options: StaticBodyOptions) {
		const body = Bodies.rectangle(
			options.x + options.width * 0.5,
			options.y + options.height * 0.5,
			options.width,
			options.height,
			{
				isStatic: true,
				label: PLATFORM_BODY_LABEL,
				friction: 2,
				restitution: 0,
			},
		);
		setPlatformType(body, options.type);

		const display = StaticBody.createDisplay(options);
		super(body, display);
	}

	private static createDisplay(options: StaticBodyOptions): Container {
		const container = new Container();
		const graphics = new Graphics();
		const style = PLATFORM_STYLE[options.type];

		// Inset by half the stroke so the outline sits inside the collider bounds.
		const inset = OUTLINE_WIDTH * 0.5;
		const innerWidth = Math.max(0, options.width - OUTLINE_WIDTH);
		const innerHeight = Math.max(0, options.height - OUTLINE_WIDTH);

		graphics
			.roundRect(inset, inset, innerWidth, innerHeight, CORNER_RADIUS)
			.fill({ color: style.fill, alpha: style.alpha })
			.stroke({ color: style.outline, width: OUTLINE_WIDTH, alpha: 1 });

		container.addChild(graphics);
		container.pivot.set(options.width * 0.5, options.height * 0.5);

		return container;
	}
}
