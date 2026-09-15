import { Assets, Container, Sprite, Texture } from 'pixi.js';

export type ParallaxAnchor = 'center' | 'floor';

export type ParallaxLayerOptions = {
	textureAlias: string;
	/** Factor for X and Y camera scroll (0 = fixed to viewport, 1 = moves with world). */
	parallaxFactor: number;
	viewportWidth: number;
	viewportHeight: number;
	/** Full iframe in playfield pixels (view + letterbox pads). Used by center/sky cover. */
	screenWidth?: number;
	screenHeight?: number;
	/** Level height in world pixels — used for Y parallax vs the world floor. */
	levelHeight: number;
	/**
	 * `center` — sky: extra pixels split around the playfield.
	 * `floor` — far/mid: image bottom = playfield bottom (horizon).
	 */
	anchor?: ParallaxAnchor;
};

/**
 * Screen-space parallax layer (not stretched, not clamped).
 *
 * Floor layers pin the painted horizon to the playfield bottom. Extra
 * height goes up; extra width is split left/right of the playfield.
 *
 * Center (sky / parallax 0): native size when the plate covers the iframe;
 * otherwise uniform scale-up so letterbox does not show the clear color.
 */
export class ParallaxLayer extends Container {
	private readonly sprite: Sprite;
	private readonly parallaxFactor: number;
	private readonly anchor: ParallaxAnchor;
	private viewportWidth: number;
	private viewportHeight: number;
	private screenWidth: number;
	private screenHeight: number;
	private readonly levelHeight: number;
	private originX = 0;
	private originY = 0;
	private ready = false;
	private lastCameraX = 0;
	private lastCameraY = 0;

	public constructor(options: ParallaxLayerOptions) {
		super();
		this.parallaxFactor = options.parallaxFactor;
		this.anchor = options.anchor ?? 'floor';
		this.viewportWidth = options.viewportWidth;
		this.viewportHeight = options.viewportHeight;
		this.screenWidth = options.screenWidth ?? options.viewportWidth;
		this.screenHeight = options.screenHeight ?? options.viewportHeight;
		this.levelHeight = options.levelHeight;
		this.sprite = new Sprite(Texture.EMPTY);
		this.sprite.eventMode = 'none';
		this.addChild(this.sprite);
		this.eventMode = 'none';
		void this.loadTexture(options.textureAlias);
	}

	public setViewport(
		viewportWidth: number,
		viewportHeight: number,
		screenWidth: number = viewportWidth,
		screenHeight: number = viewportHeight,
	): void {
		this.viewportWidth = viewportWidth;
		this.viewportHeight = viewportHeight;
		this.screenWidth = screenWidth;
		this.screenHeight = screenHeight;
		this.layoutSprite();
		this.update(this.lastCameraX, this.lastCameraY);
	}

	public update(cameraX: number, cameraY: number): void {
		this.lastCameraX = cameraX;
		this.lastCameraY = cameraY;

		if (!this.ready) {
			return;
		}

		this.sprite.x = this.originX - cameraX * this.parallaxFactor;
		const horizonInView = this.getHorizonInView();
		this.sprite.y = this.originY
			+ (this.levelHeight - cameraY - horizonInView) * this.parallaxFactor;
	}

	private async loadTexture(textureAlias: string): Promise<void> {
		const texture = await Assets.load<Texture>(textureAlias);
		this.sprite.texture = texture;
		this.sprite.anchor.set(0, 0);
		this.ready = true;
		this.layoutSprite();
		this.update(this.lastCameraX, this.lastCameraY);
	}

	private getHorizonInView(): number {
		if (this.anchor === 'center') {
			return this.viewportHeight * 0.5;
		}

		return this.viewportHeight;
	}

	private layoutSprite(): void {
		if (!this.ready) {
			return;
		}

		const tileWidth = this.sprite.texture.width;
		const tileHeight = this.sprite.texture.height;

		if (this.anchor === 'center') {
			// Scale up only when the plate is smaller than the iframe (beyond ~24:9 / 9:24).
			const scale = Math.max(
				1,
				this.screenWidth / tileWidth,
				this.screenHeight / tileHeight,
			);
			this.sprite.scale.set(scale);
			const drawWidth = tileWidth * scale;
			const drawHeight = tileHeight * scale;
			this.originX = (this.viewportWidth - drawWidth) * 0.5;
			this.originY = (this.viewportHeight - drawHeight) * 0.5;
			return;
		}

		this.sprite.scale.set(1);
		this.originX = (this.viewportWidth - tileWidth) * 0.5;
		this.originY = this.viewportHeight - tileHeight;
	}
}
