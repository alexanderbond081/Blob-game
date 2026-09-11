import { gsap } from 'gsap';
import { Container, DestroyOptions, FederatedPointerEvent, FederatedWheelEvent, Graphics, Rectangle } from 'pixi.js';

import { normalizeWheelDelta } from './wheel-delta';

/** Overscroll follows the finger at this fraction before snapping back. */
const RUBBER_FACTOR = 0.35;
const SETTLE_DURATION = 0.3;
/** Coasting distance for a flick, in milliseconds of the release velocity. */
const FLICK_COAST_MS = 180;
const FLICK_MIN_VELOCITY = 0.15;
/** Pointer travel (design px) below which a drag is treated as a tap. */
const TAP_MAX_TRAVEL = 8;

const clamp = (value: number, min: number, max: number): number => {
	return value < min ? min : (value > max ? max : value);
};

/**
 * Masked vertical viewport with drag / wheel scrolling.
 * Local origin is the viewport top-left; children go into `content`.
 */
export class VerticalScroller extends Container {
	public readonly content = new Container();
	private readonly clipShape = new Graphics();
	private viewportWidth = 0;
	private viewportHeight = 0;
	private contentHeight = 0;
	private offset = 0;
	private dragging = false;
	private dragStartOffset = 0;
	private dragStartGlobalY = 0;
	private dragTravel = 0;
	private lastGlobalY = 0;
	private lastMoveTime = 0;
	private velocity = 0;
	private settleTween: gsap.core.Tween | null = null;

	public constructor() {
		super();

		this.eventMode = 'static';
		this.clipShape.eventMode = 'none';
		this.content.eventMode = 'none';
		this.addChild(this.clipShape);
		this.addChild(this.content);
		this.content.mask = this.clipShape;
		this.bindHandlers();
	}

	public get isDragging(): boolean {
		return this.dragging;
	}

	public setViewport(width: number, height: number): void {
		this.viewportWidth = Math.max(0, width);
		this.viewportHeight = Math.max(0, height);

		this.clipShape.clear()
			.rect(0, 0, this.viewportWidth, this.viewportHeight)
			.fill({ color: 0xffffff });
		this.hitArea = new Rectangle(0, 0, this.viewportWidth, this.viewportHeight);
		this.clampOffsetIntoRange();
	}

	public setContentHeight(height: number): void {
		this.contentHeight = Math.max(0, height);
		this.clampOffsetIntoRange();
	}

	public scrollToTop(): void {
		this.stopSettle();
		this.offset = 0;
		this.applyOffset();
	}

	public override destroy(options?: DestroyOptions): void {
		this.stopSettle();
		this.content.mask = null;
		super.destroy(options);
	}

	private get maxOffset(): number {
		return Math.max(0, this.contentHeight - this.viewportHeight);
	}

	private bindHandlers(): void {
		this.on('pointerdown', this.onDragStart);
		this.on('globalpointermove', this.onDragMove);
		this.on('pointerup', this.onDragEnd);
		this.on('pointerupoutside', this.onDragEnd);
		this.on('pointercancel', this.onDragEnd);
		this.on('wheel', this.onWheel);
	}

	private readonly onDragStart = (event: FederatedPointerEvent): void => {
		if (this.maxOffset <= 0) {
			return;
		}

		this.stopSettle();
		this.dragging = true;
		this.dragStartOffset = this.offset;
		this.dragStartGlobalY = event.global.y;
		this.lastGlobalY = event.global.y;
		this.lastMoveTime = performance.now();
		this.dragTravel = 0;
		this.velocity = 0;
		this.cursor = 'grabbing';
	};

	private readonly onDragMove = (event: FederatedPointerEvent): void => {
		if (!this.dragging) {
			return;
		}

		const scale = this.worldTransform.d || 1;
		const travelled = (event.global.y - this.dragStartGlobalY) / scale;
		this.dragTravel = Math.max(this.dragTravel, Math.abs(travelled));
		this.offset = this.applyRubberBand(this.dragStartOffset - travelled);
		this.applyOffset();

		const now = performance.now();
		const elapsed = now - this.lastMoveTime;
		if (elapsed > 0) {
			this.velocity = -((event.global.y - this.lastGlobalY) / scale) / elapsed;
			this.lastGlobalY = event.global.y;
			this.lastMoveTime = now;
		}
	};

	private readonly onDragEnd = (): void => {
		if (!this.dragging) {
			return;
		}

		this.dragging = false;
		this.cursor = 'grab';

		const isFlick = this.dragTravel > TAP_MAX_TRAVEL
			&& Math.abs(this.velocity) > FLICK_MIN_VELOCITY;
		const coast = isFlick ? this.velocity * FLICK_COAST_MS : 0;
		this.settleTo(clamp(this.offset + coast, 0, this.maxOffset));
	};

	private readonly onWheel = (event: FederatedWheelEvent): void => {
		if (this.maxOffset <= 0) {
			return;
		}

		this.stopSettle();
		this.offset = clamp(this.offset + normalizeWheelDelta(event), 0, this.maxOffset);
		this.applyOffset();
		event.preventDefault();
	};

	private applyRubberBand(value: number): number {
		if (value < 0) {
			return value * RUBBER_FACTOR;
		}

		const max = this.maxOffset;
		if (value > max) {
			return max + (value - max) * RUBBER_FACTOR;
		}

		return value;
	}

	private settleTo(target: number): void {
		this.stopSettle();
		if (Math.abs(target - this.offset) < 0.5) {
			this.offset = target;
			this.applyOffset();
			return;
		}

		this.settleTween = gsap.to(this, {
			offset: target,
			duration: SETTLE_DURATION,
			ease: 'power2.out',
			overwrite: 'auto',
			onUpdate: () => this.applyOffset(),
		});
	}

	private stopSettle(): void {
		this.settleTween?.kill();
		this.settleTween = null;
	}

	private clampOffsetIntoRange(): void {
		const clamped = clamp(this.offset, 0, this.maxOffset);
		if (clamped === this.offset) {
			this.applyOffset();
			return;
		}

		this.stopSettle();
		this.offset = clamped;
		this.applyOffset();
	}

	private applyOffset(): void {
		this.content.y = -this.offset;
	}
}
