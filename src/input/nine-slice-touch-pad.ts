import { Container, FederatedPointerEvent, Rectangle } from 'pixi.js';

import { createEmptyPlayerControls, PlayerControls } from './player-controls';

export type NineSliceZone =
	| 'top-left'
	| 'top-center'
	| 'top-right'
	| 'mid-left'
	| 'mid-center'
	| 'mid-right'
	| 'bottom-left'
	| 'bottom-center'
	| 'bottom-right'
	| 'outside';

type ZoneRect = {
	zone: NineSliceZone;
	x: number;
	y: number;
	width: number;
	height: number;
};

export type NineSliceTouchPadOptions = {
	width: number;
	height: number;
	/** Inset from the design rect edges (px). */
	edgeInset?: number;
	/** Side : center : side column weights. Center is wider for casual thumbs. */
	columnWeights?: readonly [number, number, number];
	/** Top : mid : bottom row weights. */
	rowWeights?: readonly [number, number, number];
};

/**
 * Invisible 9-slice touch pad over the design viewport.
 * Bottom-left / bottom-right → move.
 * Mid-left / mid-right → jump + move.
 * Center reserved for future gestures.
 */
export class NineSliceTouchPad extends Container {
	private readonly viewWidth: number;
	private readonly viewHeight: number;
	private readonly edgeInset: number;
	private readonly columnWeights: readonly [number, number, number];
	private readonly rowWeights: readonly [number, number, number];
	private readonly activePointers = new Map<number, NineSliceZone>();
	private readonly controls: PlayerControls = createEmptyPlayerControls();
	private zoneRects: ZoneRect[] = [];

	public constructor(options: NineSliceTouchPadOptions) {
		super();
		this.viewWidth = options.width;
		this.viewHeight = options.height;
		this.edgeInset = options.edgeInset ?? 30;
		this.columnWeights = options.columnWeights ?? [1, 1.35, 1];
		this.rowWeights = options.rowWeights ?? [1, 1, 1];

		this.eventMode = 'static';
		this.cursor = 'default';
		this.hitArea = new Rectangle(0, 0, this.viewWidth, this.viewHeight);
		this.rebuildZones();

		this.on('pointerdown', this.onPointerDown);
		this.on('pointermove', this.onPointerMove);
		this.on('pointerup', this.onPointerUp);
		this.on('pointerupoutside', this.onPointerUp);
		this.on('pointercancel', this.onPointerUp);
	}

	public getControls(): PlayerControls {
		return { ...this.controls };
	}

	public override destroy(options?: Parameters<Container['destroy']>[0]): void {
		this.off('pointerdown', this.onPointerDown);
		this.off('pointermove', this.onPointerMove);
		this.off('pointerup', this.onPointerUp);
		this.off('pointerupoutside', this.onPointerUp);
		this.off('pointercancel', this.onPointerUp);
		this.activePointers.clear();
		super.destroy(options);
	}

	private readonly onPointerDown = (event: FederatedPointerEvent): void => {
		event.preventDefault();
		const local = event.getLocalPosition(this);
		const zone = this.hitZone(local.x, local.y);
		this.activePointers.set(event.pointerId, zone);
		this.recomputeControls();
	};

	private readonly onPointerMove = (event: FederatedPointerEvent): void => {
		if (!this.activePointers.has(event.pointerId)) {
			return;
		}

		const local = event.getLocalPosition(this);
		const zone = this.hitZone(local.x, local.y);
		this.activePointers.set(event.pointerId, zone);
		this.recomputeControls();
	};

	private readonly onPointerUp = (event: FederatedPointerEvent): void => {
		this.activePointers.delete(event.pointerId);
		this.recomputeControls();
	};

	private rebuildZones(): void {
		const inset = this.edgeInset;
		const innerWidth = Math.max(0, this.viewWidth - inset * 2);
		const innerHeight = Math.max(0, this.viewHeight - inset * 2);
		const colWidths = this.splitByWeights(innerWidth, this.columnWeights);
		const rowHeights = this.splitByWeights(innerHeight, this.rowWeights);

		const colX = [
			inset,
			inset + colWidths[0],
			inset + colWidths[0] + colWidths[1],
		];
		const rowY = [
			inset,
			inset + rowHeights[0],
			inset + rowHeights[0] + rowHeights[1],
		];

		const zoneGrid: NineSliceZone[][] = [
			['top-left', 'top-center', 'top-right'],
			['mid-left', 'mid-center', 'mid-right'],
			['bottom-left', 'bottom-center', 'bottom-right'],
		];

		this.zoneRects = [];
		for (let row = 0; row < 3; row += 1) {
			for (let col = 0; col < 3; col += 1) {
				this.zoneRects.push({
					zone: zoneGrid[row][col],
					x: colX[col],
					y: rowY[row],
					width: colWidths[col],
					height: rowHeights[row],
				});
			}
		}
	}

	private splitByWeights(total: number, weights: readonly [number, number, number]): [number, number, number] {
		const sum = weights[0] + weights[1] + weights[2];
		const a = (total * weights[0]) / sum;
		const b = (total * weights[1]) / sum;
		const c = total - a - b;
		return [a, b, c];
	}

	private hitZone(localX: number, localY: number): NineSliceZone {
		for (const rect of this.zoneRects) {
			if (
				localX >= rect.x
				&& localX < rect.x + rect.width
				&& localY >= rect.y
				&& localY < rect.y + rect.height
			) {
				return rect.zone;
			}
		}

		return 'outside';
	}

	private recomputeControls(): void {
		const next = createEmptyPlayerControls();

		for (const zone of this.activePointers.values()) {
			switch (zone) {
				case 'bottom-left':
					next.moveLeft = true;
					break;
				case 'bottom-right':
					next.moveRight = true;
					break;
				case 'mid-left':
					next.moveLeft = true;
					next.jump = true;
					break;
				case 'mid-right':
					next.moveRight = true;
					next.jump = true;
					break;
				case 'mid-center':
					next.jump = true;
					break;
				default:
					break;
			}
		}

		this.controls.moveLeft = next.moveLeft;
		this.controls.moveRight = next.moveRight;
		this.controls.jump = next.jump;
	}
}
