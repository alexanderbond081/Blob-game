import { Bodies, Body } from 'matter-js';
import { Container, Graphics } from 'pixi.js';

import { PLATFORM_BODY_LABEL } from './ground-contact';
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

		const display = StaticBody.createDisplay(options);
		super(body, display);
	}

	private static createDisplay(options: StaticBodyOptions): Container {
		const container = new Container();
		const graphics = new Graphics();
		const color = options.color ?? 0x3d6b4f;

		graphics.rect(0, 0, options.width, options.height).fill({ color, alpha: 0.95 });
		graphics.rect(0, 0, options.width, 4).fill({ color: 0x6fcf97, alpha: 0.8 });
		container.addChild(graphics);
		container.pivot.set(options.width * 0.5, options.height * 0.5);

		return container;
	}
}
