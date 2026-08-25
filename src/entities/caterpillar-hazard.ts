import { Container, Sprite, Texture } from 'pixi.js';

import { LevelPatrolHazard } from '../levels/level-schema';
import { PatrolHazard, requireHazardSheet, requireSheetTexture } from './patrol-hazard';

const SHEET_ALIAS = 'caterpillar';
const STRETCH_AMP = 0.18;
const VOLUME_COUPLE = 0.85;
const HITBOX_INSET_X = 0.9;
const HITBOX_INSET_Y = 0.82;

/**
 * Horizontal crawler: ping-pong along from→to with an inchworm squash/stretch.
 * Rear plants while stretching, front plants while bunching. Feet stay on the rest baseline.
 */
export class CaterpillarHazard extends PatrolHazard {
	private readonly sprite: Sprite;
	private readonly rightTexture: Texture;
	private readonly leftTexture: Texture;
	private readonly compactScale: number;
	private readonly stretchScale: number;
	private readonly stride: number;

	public constructor(data: LevelPatrolHazard) {
		const sheet = requireHazardSheet(SHEET_ALIAS);
		const rightTexture = requireSheetTexture(sheet, 'caterpillar-right');
		const display = new Container();
		const sprite = new Sprite(rightTexture);
		sprite.anchor.set(0.5);
		sprite.eventMode = 'none';
		display.addChild(sprite);

		super(data, display, rightTexture.width, rightTexture.height);

		this.sprite = sprite;
		this.rightTexture = rightTexture;
		this.leftTexture = requireSheetTexture(sheet, 'caterpillar-left');
		this.compactScale = 1 - STRETCH_AMP;
		this.stretchScale = 1 + STRETCH_AMP;
		this.stride = this.restWidth * (this.stretchScale - this.compactScale);
	}

	public override update(deltaTime: number): void {
		this.traveled += this.speed * this.toSeconds(deltaTime);
		const sample = this.samplePingPong();
		const pose = this.poseFromDistance(sample.distOnLeg);

		this.sprite.texture = this.headingRight(sample.forward, true)
			? this.rightTexture
			: this.leftTexture;
		this.sprite.scale.set(pose.scaleX, pose.scaleY);

		const visualWidth = this.restWidth * pose.scaleX;
		const visualHeight = this.restHeight * pose.scaleY;
		const feetY = sample.y + this.restHeight * 0.5;
		const centerY = feetY - visualHeight * 0.5;

		this.placeSensor(
			sample.x,
			centerY,
			visualWidth * HITBOX_INSET_X,
			visualHeight * HITBOX_INSET_Y,
		);
	}

	private poseFromDistance(distOnLeg: number): { scaleX: number; scaleY: number } {
		const phase = this.stride > 1e-6 ? ((distOnLeg / this.stride) % 1 + 1) % 1 : 0;
		const stretchU = phase < 0.5 ? phase / 0.5 : 1 - (phase - 0.5) / 0.5;
		const scaleX = this.compactScale + (this.stretchScale - this.compactScale) * stretchU;
		const scaleY = 1 - (scaleX - 1) * VOLUME_COUPLE;
		return { scaleX, scaleY };
	}
}
