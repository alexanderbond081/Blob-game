import { AnimatedSprite, Container, Graphics, Spritesheet, Texture } from 'pixi.js';

import { LevelPatrolHazard } from '../levels/level-schema';
import { PatrolHazard, requireHazardSheet } from './patrol-hazard';

const SHEET_ALIAS = 'spider-sheet';
const HITBOX_INSET = 0.65;
/** Pause at the top of the web before dropping. */
const WAIT_TOP_SEC = 0.9;
const DROP_SPEED_MUL = 3.4;
const BOUNCE_AMP = 28;
const BOUNCE_OMEGA = 14 / 1.5;
const BOUNCE_DECAY = 4.2;
const BOUNCE_END_SEC = 0.85;
/** Hold each look-out frame this long (left, then right). */
const LOOK_OUT_FRAME_SEC = 1;
const WEB_WIDTH = 2;
const WEB_COLOR = 0xffffff;
const WEB_ALPHA = 0.88;
const ABDOMEN_INSET = 8;

type SpiderPhase = 'waitTop' | 'drop' | 'bounce' | 'lookOut' | 'climb';
type SpiderAnim = 'idle' | 'look-out' | 'climb' | 'drop';

/**
 * Vertical web crawler: wait at top → drop → bounce (idle pose) → look-out → climb.
 * `speed` is climb speed; drop is faster.
 */
export class SpiderHazard extends PatrolHazard {
	private readonly sprite: AnimatedSprite;
	private readonly web: Graphics;
	private readonly sheet: Spritesheet;
	private readonly topT: number;
	private readonly bottomT: number;
	private readonly webAnchor: { x: number; y: number };
	private readonly abdomenLocalY: number;
	private phase: SpiderPhase = 'waitTop';
	private currentAnim: SpiderAnim | null = null;
	private waitTimer = 0;
	private bounceTime = 0;
	private lookOutTime = 0;
	/** 0 = top endpoint, 1 = bottom endpoint. */
	private along = 0;

	public constructor(data: LevelPatrolHazard) {
		const sheet = requireHazardSheet(SHEET_ALIAS);
		const idleFrames = framesOf(sheet, 'idle');
		const startFrames = idleFrames.length > 0 ? idleFrames : [Texture.EMPTY];
		const first = startFrames[0];
		const display = new Container();
		const web = new Graphics();
		web.eventMode = 'none';
		const sprite = new AnimatedSprite(startFrames);
		sprite.anchor.set(0.5);
		sprite.eventMode = 'none';
		sprite.animationSpeed = 0.1;
		display.addChild(web);
		display.addChild(sprite);

		super(data, display, Math.max(first.width, 1), Math.max(first.height, 1));

		this.sheet = sheet;
		this.sprite = sprite;
		this.web = web;
		this.topT = data.from.y <= data.to.y ? 0 : 1;
		this.bottomT = 1 - this.topT;
		this.abdomenLocalY = -this.restHeight * 0.5 + ABDOMEN_INSET;
		const top = this.lerpPath(this.topT);
		this.webAnchor = { x: top.x, y: top.y + this.abdomenLocalY };
		this.playAnim('idle');
		this.placeAlong(0);
	}

	public override update(deltaTime: number): void {
		const dtSec = this.toSeconds(deltaTime);
		if (this.pathLength <= 1e-6) {
			this.placeAlong(0);
			return;
		}

		if (this.phase === 'waitTop') {
			this.waitTimer += dtSec;
			if (this.waitTimer >= WAIT_TOP_SEC) {
				this.waitTimer = 0;
				this.phase = 'drop';
				this.playAnim('drop');
			}
		} else if (this.phase === 'drop') {
			this.along += (this.speed * DROP_SPEED_MUL * dtSec) / this.pathLength;
			if (this.along >= 1) {
				this.along = 1;
				this.bounceTime = 0;
				this.phase = 'bounce';
				this.playAnim('idle');
			}
		} else if (this.phase === 'bounce') {
			this.bounceTime += dtSec;
			const envelope = Math.exp(-BOUNCE_DECAY * this.bounceTime);
			const hop = Math.abs(Math.sin(this.bounceTime * BOUNCE_OMEGA));
			const amp = Math.min(BOUNCE_AMP, this.pathLength * 0.4);
			this.along = 1 - (amp / this.pathLength) * envelope * hop;
			if (this.bounceTime >= BOUNCE_END_SEC || envelope < 0.06) {
				this.along = 1;
				this.lookOutTime = 0;
				this.phase = 'lookOut';
				this.playAnim('look-out');
			}
		} else if (this.phase === 'lookOut') {
			this.lookOutTime += dtSec;
			const lookFrames = framesOf(this.sheet, 'look-out');
			const frameCount = Math.max(1, lookFrames.length);
			const frameIndex = Math.min(
				Math.floor(this.lookOutTime / LOOK_OUT_FRAME_SEC),
				frameCount - 1,
			);
			if (this.sprite.currentFrame !== frameIndex) {
				this.sprite.gotoAndStop(frameIndex);
			}
			if (this.lookOutTime >= frameCount * LOOK_OUT_FRAME_SEC) {
				this.phase = 'climb';
				this.playAnim('climb');
			}
		} else {
			this.along -= (this.speed * dtSec) / this.pathLength;
			if (this.along <= 0) {
				this.along = 0;
				this.phase = 'waitTop';
				this.waitTimer = 0;
				this.playAnim('idle');
			}
		}

		this.placeAlong(this.along);
	}

	private placeAlong(along: number): void {
		const t = this.topT + (this.bottomT - this.topT) * Math.max(0, Math.min(1, along));
		const point = this.lerpPath(t);
		this.placeSensor(
			point.x,
			point.y,
			this.restWidth * HITBOX_INSET,
			this.restHeight * HITBOX_INSET,
		);
		this.redrawWeb();
	}

	private redrawWeb(): void {
		const startX = this.webAnchor.x - this.display.position.x;
		const startY = this.webAnchor.y - this.display.position.y;
		this.web.clear();
		this.web
			.moveTo(startX, startY)
			.lineTo(0, this.abdomenLocalY)
			.stroke({ width: WEB_WIDTH, color: WEB_COLOR, alpha: WEB_ALPHA, cap: 'round' });
	}

	private playAnim(name: SpiderAnim): void {
		if (this.currentAnim === name) {
			return;
		}

		const next = framesOf(this.sheet, name);
		if (next.length === 0) {
			return;
		}

		this.sprite.textures = next;
		this.currentAnim = name;
		if (name === 'look-out' || next.length === 1) {
			this.sprite.gotoAndStop(0);
			return;
		}

		this.sprite.loop = true;
		this.sprite.animationSpeed = name === 'climb' ? 0.14 : 0.1;
		this.sprite.play();
	}
}

const framesOf = (sheet: Spritesheet, name: SpiderAnim): Texture[] => {
	const fromAnim = sheet.animations?.[name];
	if (fromAnim && fromAnim.length > 0) {
		return fromAnim;
	}

	const available = Object.keys(sheet.animations ?? {});
	console.warn(
		`[spider] animation "${name}" not found `
		+ `(have: ${available.length > 0 ? available.join(', ') : 'none'}). Using first sheet frame.`,
	);

	const first = Object.values(sheet.textures)[0] ?? Texture.EMPTY;
	return [first];
};
