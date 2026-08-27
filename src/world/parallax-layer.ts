import { Assets, Container, Sprite, Texture } from 'pixi.js';

export type ParallaxAnchor = 'center' | 'floor';

export type ParallaxLayerOptions = {
	textureAlias: string;
	/** Factor for X and Y camera scroll (0 = fixed to viewport, 1 = moves with world). */
	parallaxFactor: number;
	viewportWidth: number;
	viewportHeight: number;
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
 */
export class ParallaxLayer extends Container {
	private readonly sprite: Sprite;
	private readonly parallaxFactor: number;
	private readonly anchor: ParallaxAnchor;
	private viewportWidth: number;
	private viewportHeight: number;
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
		this.levelHeight = options.levelHeight;
		this.sprite = new Sprite(Texture.EMPTY);
		this.sprite.eventMode = 'none';
		this.addChild(this.sprite);
		this.eventMode = 'none';
		void this.loadTexture(options.textureAlias);
	}

	public setViewport(viewportWidth: number, viewportHeight: number): void {
		this.viewportWidth = viewportWidth;
		this.viewportHeight = viewportHeight;
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
		this.originX = (this.viewportWidth - tileWidth) * 0.5;

		if (this.anchor === 'center') {
			this.originY = (this.viewportHeight - tileHeight) * 0.5;
			return;
		}

		this.originY = this.viewportHeight - tileHeight;
	}
}
