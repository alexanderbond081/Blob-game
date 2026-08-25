import { Bodies, Body } from 'matter-js';
import { Assets, Container, DestroyOptions, Spritesheet, Texture } from 'pixi.js';

import { LevelPatrolHazard } from '../levels/level-schema';
import { HAZARD_BODY_LABEL, Hazard } from './hazard';

export const PATROL_FRAME_HZ = 60;

type Point = {
	x: number;
	y: number;
};

export abstract class PatrolHazard extends Hazard {
	protected readonly from: Point;
	protected readonly to: Point;
	protected readonly speed: number;
	protected readonly pathLength: number;
	protected readonly restWidth: number;
	protected readonly restHeight: number;
	protected traveled = 0;

	protected constructor(
		data: LevelPatrolHazard,
		display: Container,
		restWidth: number,
		restHeight: number,
	) {
		const body = Bodies.rectangle(data.from.x, data.from.y, restWidth, restHeight, {
			isStatic: true,
			isSensor: true,
			label: HAZARD_BODY_LABEL,
			friction: 0,
			restitution: 0,
		});
		super(body, display, data.type);

		this.from = { x: data.from.x, y: data.from.y };
		this.to = { x: data.to.x, y: data.to.y };
		this.speed = data.speed;
		this.restWidth = restWidth;
		this.restHeight = restHeight;
		this.pathLength = Math.hypot(this.to.x - this.from.x, this.to.y - this.from.y);
	}

	public override get blocksDroplets(): boolean {
		return false;
	}

	public override syncFromBody(): void {
		this.display.position.set(this.body.position.x, this.body.position.y);
	}

	public override destroy(_options?: DestroyOptions): void {
		super.destroy({ children: true });
	}

	protected toSeconds(deltaTime: number): number {
		return Math.max(deltaTime, 0) / PATROL_FRAME_HZ;
	}

	protected samplePingPong(): { x: number; y: number; forward: boolean; distOnLeg: number } {
		if (this.pathLength <= 1e-6) {
			return { x: this.from.x, y: this.from.y, forward: true, distOnLeg: 0 };
		}

		const cycle = this.traveled / this.pathLength;
		const trip = Math.floor(cycle);
		const frac = cycle - trip;
		const forward = trip % 2 === 0;
		const t = forward ? frac : 1 - frac;

		return {
			x: this.from.x + (this.to.x - this.from.x) * t,
			y: this.from.y + (this.to.y - this.from.y) * t,
			forward,
			distOnLeg: (forward ? t : 1 - t) * this.pathLength,
		};
	}

	protected headingRight(forward: boolean, fallback: boolean): boolean {
		const dx = (this.to.x - this.from.x) * (forward ? 1 : -1);
		if (Math.abs(dx) < 1e-3) {
			return fallback;
		}

		return dx > 0;
	}

	protected lerpPath(t: number): Point {
		const u = Math.max(0, Math.min(1, t));
		return {
			x: this.from.x + (this.to.x - this.from.x) * u,
			y: this.from.y + (this.to.y - this.from.y) * u,
		};
	}

	protected setSensorSize(width: number, height: number): void {
		const currentWidth = this.body.bounds.max.x - this.body.bounds.min.x;
		const currentHeight = this.body.bounds.max.y - this.body.bounds.min.y;
		if (currentWidth <= 1e-6 || currentHeight <= 1e-6) {
			return;
		}

		Body.scale(this.body, width / currentWidth, height / currentHeight);
	}

	protected placeSensor(x: number, y: number, width: number, height: number): void {
		this.setSensorSize(width, height);
		Body.setPosition(this.body, { x, y });
		this.display.position.set(x, y);
	}
}

export const requireHazardSheet = (alias: string): Spritesheet => {
	const candidates = [Assets.get(alias), Assets.get(`assets/images/${alias}.json`)];
	for (const asset of candidates) {
		if (asset instanceof Spritesheet) {
			return asset;
		}
	}

	const got = candidates[0];
	const kind = got === undefined ? 'undefined' : got.constructor?.name ?? typeof got;
	throw new Error(
		`Asset "${alias}" is not a spritesheet (got ${kind}). `
		+ 'The atlas image filename must not match this alias (e.g. spider.webp vs alias "spider").',
	);
};

export const requireSheetTexture = (sheet: Spritesheet, frame: string): Texture => {
	const texture = sheet.textures[frame];
	if (!texture) {
		throw new Error(`Spritesheet is missing frame "${frame}".`);
	}

	return texture;
};
