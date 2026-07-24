import { Bodies } from 'matter-js';
import { Container, Graphics } from 'pixi.js';

import { PLATFORM_BODY_LABEL, STICKY_WALL_SURFACE_LABEL, setPlatformSurfaceLabel } from './ground-contact';
import { PhysicsBody } from './physics-body';

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
		const color = options.color ?? (isSticky ? 0x5b4a8a : 0x3d6b4f);
		const topColor = isSticky ? 0xb39ddb : 0x6fcf97;

		graphics.rect(0, 0, options.width, options.height).fill({ color, alpha: 0.95 });
		graphics.rect(0, 0, options.width, 4).fill({ color: topColor, alpha: 0.8 });
		container.addChild(graphics);
		container.pivot.set(options.width * 0.5, options.height * 0.5);

		return container;
	}
}
