import { Bodies, Body } from 'matter-js';
import { Container, Graphics } from 'pixi.js';

import { LevelHazard } from '../levels/level-schema';
import { PhysicsBody } from '../physics/physics-body';

/** Matter body label for anything that kills the player on contact. */
export const HAZARD_BODY_LABEL = 'hazard';

const hazardTypes = new WeakMap<Body, string>();

export class Hazard extends PhysicsBody {
	public readonly hazardType: string;

	public constructor(data: LevelHazard) {
		const body = Bodies.rectangle(
			data.x + data.width * 0.5,
			data.y + data.height * 0.5,
			data.width,
			data.height,
			{
				isStatic: true,
				label: HAZARD_BODY_LABEL,
				friction: 0.8,
				restitution: 0,
			},
		);
		hazardTypes.set(body, data.type);

		const display = Hazard.createDisplay(data);
		super(body, display);
		this.hazardType = data.type;
	}

	private static createDisplay(data: LevelHazard): Container {
		const container = new Container();
		const graphics = new Graphics();
		const color = data.type === 'spikes' ? 0xa63d3d : 0xc45c26;

		graphics.rect(0, 0, data.width, data.height).fill({ color, alpha: 0.95 });
		graphics.rect(0, 0, data.width, 4).fill({ color: 0xff8a80, alpha: 0.85 });
		container.addChild(graphics);
		container.pivot.set(data.width * 0.5, data.height * 0.5);

		return container;
	}
}

export const isHazardBody = (body: Body): boolean => body.label === HAZARD_BODY_LABEL;

export const getHazardType = (body: Body): string | null => {
	return hazardTypes.get(body) ?? null;
};
