import { Bodies } from 'matter-js';
import { Container, Graphics } from 'pixi.js';

import { PLATFORM_BODY_LABEL, STICKY_WALL_SURFACE_LABEL, setPlatformSurfaceLabel } from './ground-contact';
import { PhysicsBody } from './physics-body';

const CORNER_RADIUS = 8;
const OUTLINE_WIDTH = 2;
const FILL_ALPHA = 0.8;

const PLATFORM_FILL = 0x005020;
const PLATFORM_OUTLINE = 0x30bf52;
const STICKY_FILL = 0x0073a0;//328caf;//2e90b6;//2a9ecb;
const STICKY_OUTLINE = 0x5fd2ff;//9fe4ff;

const PLATFORM_FACE = 0x00280f;
const STICKY_FACE = 0x003a52;

export type StaticBodyOptions = {
	x: number;
	y: number;
	width: number;
	height: number;
	label?: string;
	color?: number;
};

export class StaticBody extends PhysicsBody {
	public constructor(options: StaticBodyOptions) {
		const surfaceLabel = options.label ?? PLATFORM_BODY_LABEL;
		const body = Bodies.rectangle(
			options.x + options.width * 0.5,
			options.y + options.height * 0.5,
			options.width,
			options.height,
			{
				isStatic: true,
				label: PLATFORM_BODY_LABEL,
				friction: 0.8,
				restitution: 0,
			},
		);
		setPlatformSurfaceLabel(body, surfaceLabel);

		const display = StaticBody.createDisplay(options, surfaceLabel);
		super(body, display);
	}

	private static createDisplay(options: StaticBodyOptions, surfaceLabel: string): Container {
		const container = new Container();
		const graphics = new Graphics();
		const isSticky = surfaceLabel === STICKY_WALL_SURFACE_LABEL;
		const fillColor = options.color ?? (isSticky ? STICKY_FILL : PLATFORM_FILL);
		const outlineColor = isSticky ? STICKY_OUTLINE : PLATFORM_OUTLINE;
		const faceColor = isSticky ? STICKY_FACE : PLATFORM_FACE;

		// Inset by half the stroke so the outline sits inside the collider bounds.
		const inset = OUTLINE_WIDTH * 0.5;
		const innerWidth = Math.max(0, options.width - OUTLINE_WIDTH);
		const innerHeight = Math.max(0, options.height - OUTLINE_WIDTH);

		graphics
			.roundRect(inset, inset, innerWidth, innerHeight, CORNER_RADIUS)
			.fill({ color: fillColor, alpha: FILL_ALPHA })
			.stroke({ color: outlineColor, width: OUTLINE_WIDTH, alpha: 1 });

		container.addChild(graphics);
		container.pivot.set(options.width * 0.5, options.height * 0.5);

		return container;
	}
}
