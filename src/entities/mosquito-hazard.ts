import { AnimatedSprite, Container, Texture } from 'pixi.js';

import { LevelPatrolHazard } from '../levels/level-schema';
import { PatrolHazard, requireHazardSheet } from './patrol-hazard';

const SHEET_ALIAS = 'mosquito';
const HITBOX_INSET = 0.48;
const BOB_HZ = 2.4;
const BOB_AMP = 5;
const FLAP_SPEED = 0.32;

/**
 * Flying rail patrol. Two-frame wing buzz per facing, plus a small vertical bob.
 */
export class MosquitoHazard extends PatrolHazard {
	private readonly sprite: AnimatedSprite;
	private readonly flyRight: Texture[];
	private readonly flyLeft: Texture[];
	private bobTime = 0;
	private facingRight = true;

	public constructor(data: LevelPatrolHazard) {
		const sheet = requireHazardSheet(SHEET_ALIAS);
		const flyRight = sheet.animations?.['fly-right'] ?? [Texture.EMPTY];
		const flyLeft = sheet.animations?.['fly-left'] ?? flyRight;
		const first = flyRight[0] ?? Texture.EMPTY;
		const display = new Container();
		const sprite = new AnimatedSprite(flyRight);
		sprite.anchor.set(0.5);
		sprite.eventMode = 'none';
		sprite.animationSpeed = FLAP_SPEED;
		sprite.play();
		display.addChild(sprite);

		super(data, display, Math.max(first.width, 1), Math.max(first.height, 1));

		this.sprite = sprite;
		this.flyRight = flyRight;
		this.flyLeft = flyLeft;
	}

	public override update(deltaTime: number): void {
		const dtSec = this.toSeconds(deltaTime);
		this.traveled += this.speed * dtSec;
		this.bobTime += dtSec;

		const sample = this.samplePingPong();
		this.setFacing(this.headingRight(sample.forward, this.facingRight));

		const bob = Math.sin(this.bobTime * Math.PI * 2 * BOB_HZ) * BOB_AMP;
		this.placeSensor(
			sample.x,
			sample.y + bob,
			this.restWidth * HITBOX_INSET,
			this.restHeight * HITBOX_INSET,
		);
	}

	private setFacing(facingRight: boolean): void {
		if (this.facingRight === facingRight) {
			return;
		}

		this.facingRight = facingRight;
		const frames = facingRight ? this.flyRight : this.flyLeft;
		if (frames.length === 0) {
			return;
		}

		this.sprite.textures = frames;
		this.sprite.play();
	}
}
