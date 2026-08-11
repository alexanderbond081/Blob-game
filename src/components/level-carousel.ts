import { gsap } from 'gsap';
import { Assets, Container, DestroyOptions, FederatedPointerEvent, FillGradient, Graphics, NineSliceSprite, Rectangle, Sprite, Spritesheet, Text, TextStyle, Texture } from 'pixi.js';

import { isCarouselLevelPlayable, LevelCarouselEntry } from '../managers/game-progress';
import { SoundManager } from '../managers/sound-manager';
import { bindDebouncedTap } from './debounced-tap';
import { HighlightDecoration } from './highlight-decoration';
import { UIButton } from './ui-button';

const TILE_WIDTH = 160;
const TILE_HEIGHT = 220;
const TILE_RADIUS = 28;
const TILE_STEP = 165;
const SIDE_TILE_SCALE = 0.75;

/**
 * true  → paper 9-slice panels (yellow / gray).
 * false → Graphics radial fill + stroke (previous look, for A/B comparison).
 */
const USE_TILE_NINE_SLICE_PANEL = true;
/** Logical border on the 150×150 (resolution 2) panel textures. */
const TILE_PANEL_SLICE = 30;

const TILE_FILL = 0xf6c944; //0xfcda73;
const TILE_FILL_CENTER = 0xffe8a4;
const TILE_FILL_LOCKED = 0x8a8474; //0x9a9483
const TILE_FILL_LOCKED_CENTER = 0xa8a294;
const TILE_STROKE = 0x000000;
const TILE_STROKE_WIDTH = 6;
/** Soft vignette: bright center, slightly darker toward the edges (like the paper panel). */
const TILE_FILL_OUTER_RADIUS = 0.78;
/** Logical on-tile size; keep tunable so source art need not be re-exported. */
const TILE_ICON_SIZE = 120;
const TILE_LOCK_HEIGHT = 88;
const TILE_TEXT_RESOLUTION = 2;
const TILE_TEXT_LOCKED_ALPHA = 0.72;

const ARROW_SIZE = 60;
const ARROW_SIDE_OFFSET_X = 295;
const ARROW_BELOW_OFFSET_Y = 158;
const ARROW_DISABLED_ALPHA = 0.35;

/** Tiles fade out between one and this many steps away from the center. */
const VISIBLE_SPAN = 1.75;
const SNAP_DURATION = 0.28;
/** Pointer travel (design px) below which a drag counts as a tap. */
const TAP_MAX_TRAVEL = 8;
/** Fraction of a step the finger must pull before the carousel advances. */
const STEP_COMMIT_FRACTION = 0.3;
/** Index units per millisecond that count as a flick. */
const FLICK_VELOCITY = 0.004;
const EDGE_RUBBER_FACTOR = 0.35;

export type CarouselArrowLayout = 'sides' | 'below';

const clamp = (value: number, min: number, max: number): number => {
	return value < min ? min : (value > max ? max : value);
};

const createTileTextStyle = (fontSize: number): TextStyle => {
	return new TextStyle({
		fontFamily: 'Arial',
		fontSize,
		fontWeight: 'bold',
		fill: 0xffffff,
		stroke: { color: 0x000000, width: 4, join: 'round' },
		dropShadow: {
			color: 0x000000,
			alpha: 0.55,
			blur: 2,
			distance: 3,
			angle: Math.PI / 4,
		},
	});
};

const createTileText = (value: string, fontSize: number, playable: boolean): Text => {
	const text = new Text({
		text: value,
		style: createTileTextStyle(fontSize),
		resolution: TILE_TEXT_RESOLUTION,
		roundPixels: true,
	});
	text.anchor.set(0.5);
	text.alpha = playable ? 1 : TILE_TEXT_LOCKED_ALPHA;
	return text;
};

const createTileFillGradient = (playable: boolean): FillGradient => {
	return new FillGradient({
		type: 'radial',
		center: { x: 0.5, y: 0.5 },
		outerCenter: { x: 0.5, y: 0.5 },
		innerRadius: 0,
		outerRadius: TILE_FILL_OUTER_RADIUS,
		// Stretch into an ellipse matching the portrait tile so corners darken evenly.
		scale: TILE_HEIGHT / TILE_WIDTH,
		colorStops: playable
			? [
				{ offset: 0, color: TILE_FILL_CENTER },
				{ offset: 1, color: TILE_FILL },
			]
			: [
				{ offset: 0, color: TILE_FILL_LOCKED_CENTER },
				{ offset: 1, color: TILE_FILL_LOCKED },
			],
	});
};

type LevelTilePanelTextures = {
	yellow: Texture;
	gray: Texture;
};

class LevelTile extends Container {
	private lockSprite: Sprite | null = null;

	public constructor(
		entry: LevelCarouselEntry,
		levelNumber: number,
		iconSheet: Spritesheet,
		lockTexture: Texture,
		panels: LevelTilePanelTextures,
	) {
		super();

		const playable = isCarouselLevelPlayable(entry);
		this.addChild(this.createBackground(playable, panels));

		const numberText = createTileText(String(levelNumber), 30, playable);
		numberText.y = -TILE_HEIGHT / 2 + 30;
		this.addChild(numberText);

		const iconTexture = iconSheet.textures[entry.locationIcon];
		if (iconTexture) {
			const icon = new Sprite(iconTexture);
			icon.anchor.set(0.5);
			icon.width = TILE_ICON_SIZE;
			icon.height = TILE_ICON_SIZE;
			icon.y = -4;
			if (!playable) {
				icon.tint = 0x8f8f8f;
			}
			this.addChild(icon);
		} else {
			console.warn(`LevelCarousel: missing location icon "${entry.locationIcon}"`);
		}

		const countText = createTileText(
			`${entry.collected} / ${entry.totalFireflies}`,
			22,
			playable,
		);
		countText.y = TILE_HEIGHT / 2 - 30;
		this.addChild(countText);

		if (!playable) {
			const lock = new Sprite(lockTexture);
			// Pivot at the shackle (top center) so shake rotation swings like a hanging padlock.
			lock.anchor.set(0.5, 0.4);
			lock.scale.set(TILE_LOCK_HEIGHT / lockTexture.height);
			// Keep the same visual center as the old mid-anchor placement (y = -4).
			lock.y = -4;
			this.addChild(lock);
			this.lockSprite = lock;
		}
	}

	private createBackground(playable: boolean, panels: LevelTilePanelTextures): Graphics | NineSliceSprite {
		if (USE_TILE_NINE_SLICE_PANEL) {
			return new NineSliceSprite({
				texture: playable ? panels.yellow : panels.gray,
				leftWidth: TILE_PANEL_SLICE,
				rightWidth: TILE_PANEL_SLICE,
				topHeight: TILE_PANEL_SLICE,
				bottomHeight: TILE_PANEL_SLICE,
				width: TILE_WIDTH,
				height: TILE_HEIGHT,
				anchor: 0.5,
			});
		}

		return new Graphics()
			.roundRect(-TILE_WIDTH / 2, -TILE_HEIGHT / 2, TILE_WIDTH, TILE_HEIGHT, TILE_RADIUS)
			.fill(createTileFillGradient(playable))
			.stroke({ width: TILE_STROKE_WIDTH, color: TILE_STROKE, alignment: 0.5, join: 'round' });
	}

	public override destroy(options?: DestroyOptions): void {
		if (this.lockSprite) {
			gsap.killTweensOf(this.lockSprite);
		}
		super.destroy(options);
	}

	/** Classic "won't budge" shake: swing like a hanging padlock (rotation only). */
	public playLockDenied(): void {
		if (!this.lockSprite) {
			return;
		}

		const lock = this.lockSprite;
		gsap.killTweensOf(lock);
		// Keep the shackle fixed — translating x while rotating makes the pivot look mid-body.
		lock.x = 0;
		lock.rotation = 0;

		const shakeAngle = 0.18;

		gsap.timeline()
			.to(lock, { rotation: -shakeAngle, duration: 0.05, ease: 'power2.out' })
			.to(lock, { rotation: shakeAngle, duration: 0.08, ease: 'power2.inOut' })
			.to(lock, { rotation: -shakeAngle * 0.85, duration: 0.07, ease: 'power2.inOut' })
			.to(lock, { rotation: shakeAngle * 0.7, duration: 0.07, ease: 'power2.inOut' })
			.to(lock, { rotation: -shakeAngle * 0.4, duration: 0.06, ease: 'power2.inOut' })
			.to(lock, { rotation: 0, duration: 0.12, ease: 'power2.out' });
	}
}

/**
 * Horizontal level picker: three visible tiles, the centered one is the selection.
 * Drag follows the pointer continuously and snaps to the nearest tile on release.
 */
export class LevelCarousel extends Container {
	private readonly entries: LevelCarouselEntry[];
	private readonly tiles: LevelTile[] = [];
	private readonly tilesLayer = new Container();
	private readonly dragArea = new Container();
	private leftArrow!: UIButton;
	private rightArrow!: UIButton;

	/** Fractional index of the tile currently under the center slot. */
	private scrollIndex = 0;
	private selectedIndex = 0;
	private arrowLayout: CarouselArrowLayout = 'sides';

	private isDragging = false;
	private dragStartScroll = 0;
	private dragStartGlobalX = 0;
	private dragTravel = 0;
	private lastPointerGlobalX = 0;
	private lastPointerTime = 0;
	private dragVelocity = 0;
	private snapTween: gsap.core.Tween | null = null;

	public constructor(entries: LevelCarouselEntry[], initialIndex: number = 0) {
		super();

		this.entries = entries;
		this.selectedIndex = clamp(initialIndex, 0, Math.max(0, entries.length - 1));
		this.scrollIndex = this.selectedIndex;
	}

	public get selectedEntry(): LevelCarouselEntry {
		return this.entries[this.selectedIndex];
	}

	public async init(): Promise<void> {
		const iconSheet = await Assets.load<Spritesheet>('location-icons');
		const lockTexture = await Assets.load<Texture>('level-lock');
		const arrowSheet = await Assets.load<Spritesheet>('list-buttons');
		const panels: LevelTilePanelTextures = USE_TILE_NINE_SLICE_PANEL
			? {
				yellow: await Assets.load<Texture>('9slice-panel-yellow'),
				gray: await Assets.load<Texture>('9slice-panel-gray'),
			}
			: { yellow: Texture.EMPTY, gray: Texture.EMPTY };

		this.dragArea.eventMode = 'static';
		this.dragArea.cursor = 'grab';
		this.dragArea.hitArea = new Rectangle(
			-TILE_STEP * 1.5,
			-TILE_HEIGHT / 2 - 20,
			TILE_STEP * 3,
			TILE_HEIGHT + 40,
		);
		this.addChild(this.dragArea);

		this.tilesLayer.sortableChildren = true;
		this.addChild(this.tilesLayer);

		for (const [index, entry] of this.entries.entries()) {
			const tile = new LevelTile(entry, index + 1, iconSheet, lockTexture, panels);
			this.tiles.push(tile);
			this.tilesLayer.addChild(tile);
		}

		this.addArrows(arrowSheet);
		this.bindDragHandlers();
		this.applyArrowLayout();
		this.layoutTiles();
		this.syncArrowState();
	}

	public override destroy(options?: DestroyOptions): void {
		this.snapTween?.kill();
		this.snapTween = null;
		super.destroy(options);
	}

	/** Called every frame by the owning scene: drag and snap both animate `scrollIndex`. */
	public update(): void {
		this.layoutTiles();
	}

	public setArrowLayout(layout: CarouselArrowLayout): void {
		if (this.arrowLayout === layout) {
			return;
		}

		this.arrowLayout = layout;
		this.applyArrowLayout();
	}

	public stepBy(delta: number): void {
		const target = clamp(this.selectedIndex + delta, 0, this.entries.length - 1);
		if (target === this.selectedIndex && !this.isDragging) {
			return;
		}

		this.animateTo(target);
	}

	/** Shake the lock on the currently centered tile (no-op if that level is unlocked). */
	public playSelectedLockDenied(): void {
		this.tiles[this.selectedIndex]?.playLockDenied();
	}

	private addArrows(arrowSheet: Spritesheet): void {
		this.leftArrow = UIButton.fromSpritesheet(arrowSheet, 'list-left', ARROW_SIZE, ARROW_SIZE, new HighlightDecoration(0.85));
		this.rightArrow = UIButton.fromSpritesheet(arrowSheet, 'list-right', ARROW_SIZE, ARROW_SIZE, new HighlightDecoration(0.85));
		this.addChild(this.leftArrow);
		this.addChild(this.rightArrow);

		bindDebouncedTap(this.leftArrow, () => {
			SoundManager.playSound('hit-a-button');
			this.stepBy(-1);
		});
		bindDebouncedTap(this.rightArrow, () => {
			SoundManager.playSound('hit-a-button');
			this.stepBy(1);
		});
	}

	private applyArrowLayout(): void {
		if (!this.leftArrow || !this.rightArrow) {
			return;
		}

		if (this.arrowLayout === 'below') {
			this.leftArrow.x = -TILE_STEP;
			this.rightArrow.x = TILE_STEP;
			this.leftArrow.y = ARROW_BELOW_OFFSET_Y;
			this.rightArrow.y = ARROW_BELOW_OFFSET_Y;
			return;
		}

		this.leftArrow.x = -ARROW_SIDE_OFFSET_X;
		this.rightArrow.x = ARROW_SIDE_OFFSET_X;
		this.leftArrow.y = 0;
		this.rightArrow.y = 0;
	}

	private bindDragHandlers(): void {
		this.dragArea.on('pointerdown', this.onDragStart);
		this.dragArea.on('globalpointermove', this.onDragMove);
		this.dragArea.on('pointerup', this.onDragEnd);
		this.dragArea.on('pointerupoutside', this.onDragEnd);
		this.dragArea.on('pointercancel', this.onDragCancel);
	}

	private readonly onDragStart = (event: FederatedPointerEvent): void => {
		this.snapTween?.kill();
		this.snapTween = null;

		this.isDragging = true;
		this.dragStartScroll = this.scrollIndex;
		this.dragStartGlobalX = event.global.x;
		this.lastPointerGlobalX = event.global.x;
		this.lastPointerTime = performance.now();
		this.dragTravel = 0;
		this.dragVelocity = 0;
		this.dragArea.cursor = 'grabbing';
	};

	private readonly onDragMove = (event: FederatedPointerEvent): void => {
		if (!this.isDragging) {
			return;
		}

		const worldScale = this.worldTransform.a || 1;
		const travelled = (event.global.x - this.dragStartGlobalX) / worldScale;
		this.dragTravel = Math.max(this.dragTravel, Math.abs(travelled));
		this.scrollIndex = this.applyRubberBand(this.dragStartScroll - travelled / TILE_STEP);

		const now = performance.now();
		const elapsed = now - this.lastPointerTime;
		if (elapsed > 0) {
			const stepDelta = (event.global.x - this.lastPointerGlobalX) / worldScale / TILE_STEP;
			this.dragVelocity = -stepDelta / elapsed;
			this.lastPointerGlobalX = event.global.x;
			this.lastPointerTime = now;
		}
	};

	private readonly onDragEnd = (event: FederatedPointerEvent): void => {
		if (!this.isDragging) {
			return;
		}

		this.isDragging = false;
		this.dragArea.cursor = 'grab';

		if (this.dragTravel < TAP_MAX_TRAVEL) {
			this.handleTap(event);
			return;
		}

		this.animateTo(this.resolveSnapTarget());
	};

	private readonly onDragCancel = (): void => {
		if (!this.isDragging) {
			return;
		}

		this.isDragging = false;
		this.dragArea.cursor = 'grab';
		this.animateTo(this.selectedIndex);
	};

	/** A tap on a side tile advances the reel one step towards it. */
	private handleTap(event: FederatedPointerEvent): void {
		const localX = this.tilesLayer.toLocal(event.global).x;

		if (localX > TILE_WIDTH / 2) {
			SoundManager.playSound('hit-a-button');
			this.stepBy(1);
			return;
		}

		if (localX < -TILE_WIDTH / 2) {
			SoundManager.playSound('hit-a-button');
			this.stepBy(-1);
			return;
		}

		this.animateTo(this.selectedIndex);
	}

	private resolveSnapTarget(): number {
		const startIndex = Math.round(this.dragStartScroll);
		const delta = this.scrollIndex - startIndex;
		const isFlick = Math.abs(this.dragVelocity) > FLICK_VELOCITY;

		if (Math.abs(delta) < STEP_COMMIT_FRACTION && !isFlick) {
			return clamp(startIndex, 0, this.entries.length - 1);
		}

		const direction = Math.sign(delta) || Math.sign(this.dragVelocity);
		const steps = Math.max(1, Math.round(Math.abs(delta) + (0.5 - STEP_COMMIT_FRACTION)));

		return clamp(startIndex + direction * steps, 0, this.entries.length - 1);
	}

	private applyRubberBand(value: number): number {
		const maxIndex = this.entries.length - 1;

		if (value < 0) {
			return value * EDGE_RUBBER_FACTOR;
		}

		if (value > maxIndex) {
			return maxIndex + (value - maxIndex) * EDGE_RUBBER_FACTOR;
		}

		return value;
	}

	private animateTo(targetIndex: number): void {
		this.snapTween?.kill();
		this.snapTween = gsap.to(this, {
			scrollIndex: targetIndex,
			duration: SNAP_DURATION,
			ease: 'power2.out',
			overwrite: 'auto',
		});
	}

	private layoutTiles(): void {
		for (const [index, tile] of this.tiles.entries()) {
			const distance = index - this.scrollIndex;
			const absDistance = Math.abs(distance);

			if (absDistance > VISIBLE_SPAN) {
				tile.visible = false;
				continue;
			}

			const shrink = Math.min(absDistance, 1);
			tile.visible = true;
			tile.x = distance * TILE_STEP;
			tile.scale.set(1 - (1 - SIDE_TILE_SCALE) * shrink);
			tile.alpha = absDistance <= 1 ? 1 : 1 - (absDistance - 1) / (VISIBLE_SPAN - 1);
			tile.zIndex = -absDistance;
		}

		this.syncSelection();
	}

	private syncSelection(): void {
		const nearest = clamp(Math.round(this.scrollIndex), 0, this.entries.length - 1);

		if (nearest === this.selectedIndex) {
			return;
		}

		this.selectedIndex = nearest;
		this.syncArrowState();
		this.emit('selectionChanged', nearest);
	}

	private syncArrowState(): void {
		this.setArrowEnabled(this.leftArrow, this.selectedIndex > 0);
		this.setArrowEnabled(this.rightArrow, this.selectedIndex < this.entries.length - 1);
	}

	private setArrowEnabled(arrow: UIButton | undefined, enabled: boolean): void {
		if (!arrow) {
			return;
		}

		arrow.alpha = enabled ? 1 : ARROW_DISABLED_ALPHA;
		arrow.eventMode = enabled ? 'static' : 'none';
		arrow.cursor = enabled ? 'pointer' : 'default';
	}
}
