import { Bodies, Body } from 'matter-js';
import { Container, Graphics } from 'pixi.js';

import { LevelSpikeHazard } from '../levels/level-schema';
import { PhysicsBody } from '../physics/physics-body';
import { buildSpikePolygon } from './spike-outline';

/** Matter body label for anything that kills the player on contact. */
export const HAZARD_BODY_LABEL = 'hazard';

const OUTLINE_WIDTH = 2;
const FILL_ALPHA = 0.6;
const HAZARD_FILL = 0x9b111e;
const HAZARD_OUTLINE = 0xee7777;

const hazardTypes = new WeakMap<Body, string>();

export const registerHazardType = (body: Body, hazardType: string): void => {
	hazardTypes.set(body, hazardType);
};

export abstract class Hazard extends PhysicsBody {
	public readonly hazardType: string;

	protected constructor(body: Body, display: Container, hazardType: string) {
		super(body, display);
		this.hazardType = hazardType;
		registerHazardType(body, hazardType);
	}

	public update(_deltaTime: number): void {
		return;
	}

	/** Static spikes block death droplets; moving insects do not. */
	public get blocksDroplets(): boolean {
		return true;
	}
}

export class SpikeHazard extends Hazard {
	public constructor(data: LevelSpikeHazard) {
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

		super(body, SpikeHazard.createDisplay(data), data.type);
	}

	private static createDisplay(data: LevelSpikeHazard): Container {
		const container = new Container();
		const graphics = new Graphics();

		// Inset by half the stroke so the outline sits inside the collider bounds.
		const inset = OUTLINE_WIDTH * 0.5;
		const spikePolygon = buildSpikePolygon({
			width: data.width,
			height: data.height,
			inset,
			facing: data.facing,
			length: data.length,
		});

		if (spikePolygon && spikePolygon.length >= 3) {
			graphics.poly(spikePolygon, true);
		} else {
			const innerWidth = Math.max(0, data.width - OUTLINE_WIDTH);
			const innerHeight = Math.max(0, data.height - OUTLINE_WIDTH);
			graphics.rect(inset, inset, innerWidth, innerHeight);
		}

		graphics
			.fill({ color: HAZARD_FILL, alpha: FILL_ALPHA })
			.stroke({ color: HAZARD_OUTLINE, width: OUTLINE_WIDTH, alpha: 1, join: 'round' });
		container.addChild(graphics);
		container.pivot.set(data.width * 0.5, data.height * 0.5);

		return container;
	}
}

export const isHazardBody = (body: Body): boolean => body.label === HAZARD_BODY_LABEL;

export const getHazardType = (body: Body): string | null => {
	return hazardTypes.get(body) ?? null;
};
