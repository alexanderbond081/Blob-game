import { Bodies, Body } from 'matter-js';
import { Assets, Container, Sprite, Texture } from 'pixi.js';

import { LevelExit } from '../levels/level-schema';
import { PhysicsBody } from '../physics/physics-body';

/** Matter sensor label for the level-exit portal trigger. */
export const LEVEL_EXIT_BODY_LABEL = 'level-exit';

/** Circular exit sensor radius in world pixels (independent of portal art size). */
const PORTAL_TRIGGER_RADIUS = 30;

/** Fixed oval grid capacity — fewer slots omit positions from the bottom of this set. */
export const PORTAL_SLOT_CAPACITY = 12;

/**
 * Portal lifecycle (unlock / firefly fill land later).
 * This iteration always starts in `open` and moves to `entered` on trigger.
 */
export type PortalState = 'locked' | 'charging' | 'open' | 'entered';

export type PortalSlotWorldPos = { x: number; y: number };

/**
 * Level exit portal: brass ring sprite, rim slots on a 12-point oval grid,
 * and a circular sensor (`PORTAL_TRIGGER_RADIUS`).
 */
export class LevelPortal extends PhysicsBody {
	public readonly slotCount: number;

	private readonly portalSprite: Sprite;
	private readonly slotSprites: Sprite[] = [];
	private state: PortalState = 'open';

	public constructor(data: LevelExit) {
		const portalTexture = Assets.get<Texture>('portal');
		if (!portalTexture) {
			throw new Error('Asset "portal" is not loaded. Load game bundle before the level.');
		}

		const slotTexture = Assets.get<Texture>('slot');
		if (!slotTexture) {
			throw new Error('Asset "slot" is not loaded. Load game bundle before the level.');
		}

		const body = Bodies.circle(data.x, data.y, PORTAL_TRIGGER_RADIUS, {
			isStatic: true,
			isSensor: true,
			label: LEVEL_EXIT_BODY_LABEL,
		});

		const display = new Container();
		display.eventMode = 'none';

		const portalSprite = new Sprite(portalTexture);
		portalSprite.anchor.set(0.5);
		portalSprite.eventMode = 'none';
		display.addChild(portalSprite);

		super(body, display);

		this.portalSprite = portalSprite;
		this.slotCount = Math.max(0, Math.min(PORTAL_SLOT_CAPACITY, data.slots));
		this.buildSlots(slotTexture, portalTexture.width * 0.5, portalTexture.height * 0.5);
		this.applyStateVisuals();
	}

	public get portalState(): PortalState {
		return this.state;
	}

	public setState(next: PortalState): void {
		if (this.state === next) {
			return;
		}

		this.state = next;
		this.applyStateVisuals();
	}

	/** True while the portal accepts a player overlap as a level exit. */
	public get canTrigger(): boolean {
		return this.state === 'open';
	}

	/**
	 * Absolute world positions of visible slot sprites (container + local offset).
	 * Fireflies will use these later to fly into the rim.
	 */
	public getSlotWorldPositions(): PortalSlotWorldPos[] {
		const originX = this.display.position.x;
		const originY = this.display.position.y;
		const positions: PortalSlotWorldPos[] = [];

		for (const slot of this.slotSprites) {
			positions.push({
				x: originX + slot.position.x,
				y: originY + slot.position.y,
			});
		}

		return positions;
	}

	private buildSlots(slotTexture: Texture, radiusX: number, radiusY: number): void {
		const visibleIndices = LevelPortal.pickVisibleSlotIndices(this.slotCount);

		for (const index of visibleIndices) {
			const angle = -Math.PI / 2 + index * ((Math.PI * 2) / PORTAL_SLOT_CAPACITY);
			const slot = new Sprite(slotTexture);
			slot.anchor.set(0.5);
			slot.eventMode = 'none';
			slot.position.set(radiusX * Math.cos(angle), radiusY * Math.sin(angle));
			this.display.addChild(slot);
			this.slotSprites.push(slot);
		}
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

	private applyStateVisuals(): void {
		// Placeholder tinting until door / fill VFX exist.
		switch (this.state) {
			case 'locked':
				this.portalSprite.alpha = 0.55;
				this.portalSprite.tint = 0x888888;
				break;
			case 'charging':
				this.portalSprite.alpha = 0.85;
				this.portalSprite.tint = 0xffffff;
				break;
			case 'open':
				this.portalSprite.alpha = 1;
				this.portalSprite.tint = 0xffffff;
				break;
			case 'entered':
				this.portalSprite.alpha = 0.7;
				this.portalSprite.tint = 0xaad4ff;
				break;
			default:
				break;
		}
	}
}

export const isLevelExitBody = (body: Body): boolean => body.label === LEVEL_EXIT_BODY_LABEL;
