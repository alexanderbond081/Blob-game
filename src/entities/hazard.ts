import { Bodies, Body } from 'matter-js';
import { Container, Graphics } from 'pixi.js';

import { LevelHazard } from '../levels/level-schema';
import { PhysicsBody } from '../physics/physics-body';

/** Matter body label for anything that kills the player on contact. */
export const HAZARD_BODY_LABEL = 'hazard';

const OUTLINE_WIDTH = 2;
const FILL_ALPHA = 0.6;
const HAZARD_FILL = 0x9b111e;
const HAZARD_OUTLINE = 0xee7777;

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

		// Inset by half the stroke so the outline sits inside the collider bounds.
		const inset = OUTLINE_WIDTH * 0.5;
		const innerWidth = Math.max(0, data.width - OUTLINE_WIDTH);
		const innerHeight = Math.max(0, data.height - OUTLINE_WIDTH);

		graphics
			.rect(inset, inset, innerWidth, innerHeight)
			.fill({ color: HAZARD_FILL, alpha: FILL_ALPHA })
			.stroke({ color: HAZARD_OUTLINE, width: OUTLINE_WIDTH, alpha: 1 });
		container.addChild(graphics);
		container.pivot.set(data.width * 0.5, data.height * 0.5);

		return container;
	}
}

export const isHazardBody = (body: Body): boolean => body.label === HAZARD_BODY_LABEL;

export const getHazardType = (body: Body): string | null => {
	return hazardTypes.get(body) ?? null;
};
