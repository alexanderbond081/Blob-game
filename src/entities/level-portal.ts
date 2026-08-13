import { gsap } from 'gsap';
import { Bodies, Body } from 'matter-js';
import { Assets, Container, Sprite, Texture } from 'pixi.js';

import { LevelExit } from '../levels/level-schema';
import { SoundManager } from '../managers/sound-manager';
import { PhysicsBody } from '../physics/physics-body';

/** Matter sensor label for the level-exit portal trigger. */
export const LEVEL_EXIT_BODY_LABEL = 'level-exit';

/** Circular exit sensor radius in world pixels (independent of portal art size). */
const PORTAL_TRIGGER_RADIUS = 30;

/** Fixed oval grid capacity — fewer slots omit positions from the bottom of this set. */
export const PORTAL_SLOT_CAPACITY = 12;

const FRAME_HZ = 60;

/** Idle float of the portal art. The sensor stays put, so the exit trigger never jitters. */
const BOB_PERIOD_SEC = 3;
const BOB_AMPLITUDE = 10;

/** Vortex spin in radians per second; positive is clockwise in Pixi's Y-down space. */
const VORTEX_SPIN = 0.9;

/** Inner opening of the brass ring, as a fraction of the ring texture. */
const HOLE_WIDTH_RATIO = 0.62;
const HOLE_HEIGHT_RATIO = 0.75;

/** Pull slots inward so they sit in the brass rim instead of hugging the outer edge. */
const SLOT_INSET_PX = 38;

const DOOR_OPEN_SEC = 0.45;

/**
 * Portal lifecycle: starts `locked` behind its door, fills rim slots while
 * `charging` and swaps the door for the vortex on `open`.
 */
export type PortalState = 'locked' | 'charging' | 'open' | 'entered';

export type PortalSlotWorldPos = { x: number; y: number };

/**
 * Level exit portal: brass ring sprite, rim slots on a 12-point oval grid,
 * a door / vortex fill and a circular sensor (`PORTAL_TRIGGER_RADIUS`).
 * Opens once enough fireflies have arrived in their rim slots.
 */
export class LevelPortal extends PhysicsBody {
	/** Fireflies required to open this portal (level JSON `exit.slots`). */
	public readonly slotCount: number;

	private readonly artRoot = new Container();
	private readonly doorSprite: Sprite;
	private readonly vortexHolder = new Container();
	private readonly vortexSprite: Sprite;
	private readonly slotSprites: Sprite[] = [];
	private state: PortalState;
	private reserved = 0;
	private arrived = 0;
	private bobTime = 0;

	public constructor(data: LevelExit) {
		const portalTexture = LevelPortal.requireTexture('portal');
		const slotTexture = LevelPortal.requireTexture('slot');
		const doorTexture = LevelPortal.requireTexture('door');
		const vortexTexture = LevelPortal.requireTexture('vortex');

		const body = Bodies.circle(data.x, data.y, PORTAL_TRIGGER_RADIUS, {
			isStatic: true,
			isSensor: true,
			label: LEVEL_EXIT_BODY_LABEL,
		});

		const display = new Container();
		display.eventMode = 'none';

		super(body, display);

		this.artRoot.eventMode = 'none';
		display.addChild(this.artRoot);

		// The ring has a painted (opaque) centre, so the fill goes on top of it.
		const portalSprite = new Sprite(portalTexture);
		portalSprite.anchor.set(0.5);
		portalSprite.eventMode = 'none';
		this.artRoot.addChild(portalSprite);

		this.vortexSprite = new Sprite(vortexTexture);
		this.vortexSprite.anchor.set(0.5);
		this.vortexSprite.eventMode = 'none';
		// The swirl art is round: the oval squash lives on the holder so the sprite
		// itself can spin without shearing.
		this.vortexHolder.eventMode = 'none';
		this.vortexHolder.scale.set(
			(portalTexture.width * HOLE_WIDTH_RATIO) / vortexTexture.width,
			(portalTexture.height * HOLE_HEIGHT_RATIO) / vortexTexture.height,
		);
		this.vortexHolder.addChild(this.vortexSprite);
		this.artRoot.addChild(this.vortexHolder);

		this.doorSprite = new Sprite(doorTexture);
		this.doorSprite.anchor.set(0.5);
		this.doorSprite.eventMode = 'none';
		this.artRoot.addChild(this.doorSprite);

		this.slotCount = Math.max(0, Math.min(PORTAL_SLOT_CAPACITY, data.slots));
		this.buildSlots(
			slotTexture,
			portalTexture.width * 0.6 - SLOT_INSET_PX,
			portalTexture.height * 0.6 - SLOT_INSET_PX,
		);

		// `slots: 0` is the authoring escape hatch for a portal that needs no fireflies.
		this.state = this.slotCount === 0 ? 'open' : 'locked';
		this.applyStateVisuals();
	}

	public get portalState(): PortalState {
		return this.state;
	}

	/** True while the portal accepts a player overlap as a level exit. */
	public get canTrigger(): boolean {
		return this.state === 'open';
	}

	public setState(next: PortalState): void {
		if (this.state === next) {
			return;
		}

		this.state = next;
		this.applyStateVisuals();
	}

	public get filledCount(): number {
		return this.arrived;
	}

	/**
	 * Claims the next empty rim slot. Returns its index, or `null` when the
	 * portal is already full (extra fireflies go to the centre later).
	 * Does not open the door — that waits until `notifySlotArrived`.
	 */
	public reserveNextSlot(): number | null {
		if (this.reserved >= this.slotCount) {
			return null;
		}

		const index = this.reserved;
		this.reserved += 1;
		if (this.state === 'locked') {
			this.setState('charging');
		}

		return index;
	}

	/** A firefly reached its reserved slot; opens the door when the last one lands. */
	public notifySlotArrived(): void {
		this.arrived = Math.min(this.slotCount, this.arrived + 1);
		if (this.arrived >= this.slotCount) {
			this.open();
		}
	}

	public update(deltaTime: number): void {
		const dtSec = Math.max(deltaTime, 0) / FRAME_HZ;

		this.bobTime += dtSec;
		this.artRoot.y = Math.sin((this.bobTime * Math.PI * 2) / BOB_PERIOD_SEC) * BOB_AMPLITUDE;

		if (this.state === 'open' || this.state === 'entered') {
			this.vortexSprite.rotation += VORTEX_SPIN * dtSec;
		}
	}

	public override destroy(): void {
		gsap.killTweensOf(this.doorSprite);
		gsap.killTweensOf(this.vortexHolder);
		super.destroy({ children: true });
	}

	/** Centre of the portal art, bob included — the target for extra fireflies. */
	public getCenterWorldPosition(): PortalSlotWorldPos {
		return {
			x: this.display.position.x + this.artRoot.x,
			y: this.display.position.y + this.artRoot.y,
		};
	}

	/** Absolute position of one rim slot, bob included. */
	public getSlotWorldPosition(index: number): PortalSlotWorldPos | null {
		const slot = this.slotSprites[index];
		if (!slot) {
			return null;
		}

		const origin = this.getCenterWorldPosition();
		return { x: origin.x + slot.position.x, y: origin.y + slot.position.y };
	}

	public getSlotWorldPositions(): PortalSlotWorldPos[] {
		const origin = this.getCenterWorldPosition();
		return this.slotSprites.map((slot) => ({
			x: origin.x + slot.position.x,
			y: origin.y + slot.position.y,
		}));
	}

	private open(): void {
		if (this.state === 'open' || this.state === 'entered') {
			return;
		}

		this.state = 'open';
		SoundManager.playSound('portal-ready');
		gsap.killTweensOf(this.doorSprite);
		gsap.killTweensOf(this.vortexHolder);
		this.vortexHolder.visible = true;
		this.vortexHolder.alpha = 0;

		gsap.timeline()
			.to(this.doorSprite, {
				pixi: { alpha: 0, scaleX: 0.55, scaleY: 0.55 },
				duration: DOOR_OPEN_SEC,
				ease: 'back.in(1.6)',
			})
			.set(this.doorSprite, { visible: false })
			.to(this.vortexHolder, {
				pixi: { alpha: 1 },
				duration: DOOR_OPEN_SEC * 0.8,
				ease: 'power2.out',
			}, '-=0.2');
	}

	private applyStateVisuals(): void {
		const isOpen = this.state === 'open' || this.state === 'entered';
		gsap.killTweensOf(this.doorSprite);
		gsap.killTweensOf(this.vortexHolder);

		this.doorSprite.visible = !isOpen;
		this.doorSprite.alpha = 1;
		this.doorSprite.scale.set(1);
		this.vortexHolder.visible = isOpen;
		this.vortexHolder.alpha = isOpen ? 1 : 0;
	}

	private buildSlots(slotTexture: Texture, radiusX: number, radiusY: number): void {
		const visibleIndices = LevelPortal.pickVisibleSlotIndices(this.slotCount);

		for (const index of visibleIndices) {
			const angle = -Math.PI / 2 + index * ((Math.PI * 2) / PORTAL_SLOT_CAPACITY);
			const slot = new Sprite(slotTexture);
			slot.anchor.set(0.5);
			slot.eventMode = 'none';
			slot.position.set(radiusX * Math.cos(angle), radiusY * Math.sin(angle));
			this.artRoot.addChild(slot);
			this.slotSprites.push(slot);
		}

		// Fill order is array order: left → right, top before bottom on a tie.
		this.slotSprites.sort((left, right) => left.position.x - right.position.x || left.position.y - right.position.y);
	}

	private static requireTexture(alias: string): Texture {
		const texture = Assets.get<Texture>(alias);
		if (!texture) {
			throw new Error(`Asset "${alias}" is not loaded. Load game bundle before the level.`);
		}

		return texture;
	}

	/**
	 * Full oval = 12 indices (0 at top, clockwise).
	 * Fewer slots: drop from the bottom of the oval first (symmetric pairs).
	 */
	private static pickVisibleSlotIndices(slotCount: number): number[] {
		if (slotCount <= 0) {
			return [];
		}

		if (slotCount >= PORTAL_SLOT_CAPACITY) {
			return Array.from({ length: PORTAL_SLOT_CAPACITY }, (_, index) => index);
		}

		// Bottom-first removal: south, then paired steps toward the top.
		const removeOrder = [6, 5, 7, 4, 8, 3, 9, 2, 10, 1, 11, 0];
		const removed = new Set(removeOrder.slice(0, PORTAL_SLOT_CAPACITY - slotCount));
		const visible: number[] = [];

		for (let index = 0; index < PORTAL_SLOT_CAPACITY; index += 1) {
			if (!removed.has(index)) {
				visible.push(index);
			}
		}

		return visible;
	}
}

export const isLevelExitBody = (body: Body): boolean => body.label === LEVEL_EXIT_BODY_LABEL;
