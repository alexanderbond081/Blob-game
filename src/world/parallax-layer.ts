import { Assets, Container, Sprite, Texture } from 'pixi.js';

export type ParallaxLayerOptions = {
	textureAlias: string;
	/** Same factor for X and Y camera scroll (0 = locked to viewport, 1 = moves with world). */
	parallaxFactor: number;
	viewportWidth: number;
	viewportHeight: number;
};

/**
 * Viewport-centered background with bleed (e.g. logical 1100×600 on 960×540).
 * Expects `resolution: 2` in the manifest so texture size is already logical.
 *
 * No tiling: parallax shifts within the bleed only, then stops so the texture
 * always covers the viewport (no cropped edges / empty gaps).
 */
export class ParallaxLayer extends Container {
	private readonly sprite: Sprite;
	private readonly parallaxFactor: number;
	private readonly viewportWidth: number;
	private readonly viewportHeight: number;
	private bleedX = 0;
	private bleedY = 0;
	private originX = 0;
	private originY = 0;
	private ready = false;

	public constructor(options: ParallaxLayerOptions) {
		super();
		this.parallaxFactor = options.parallaxFactor;
		this.viewportWidth = options.viewportWidth;
		this.viewportHeight = options.viewportHeight;
		this.sprite = new Sprite(Texture.EMPTY);
		this.sprite.eventMode = 'none';
		this.addChild(this.sprite);
		this.eventMode = 'none';
		void this.loadTexture(options.textureAlias);
	}

	public update(cameraX: number, cameraY: number): void {
		if (!this.ready) {
			return;
		}

		const shiftX = this.clamp(cameraX * this.parallaxFactor, -this.bleedX, this.bleedX);
		const shiftY = this.clamp(cameraY * this.parallaxFactor, -this.bleedY, this.bleedY);
		this.sprite.x = this.originX - shiftX;
		this.sprite.y = this.originY - shiftY;
	}

	private async loadTexture(textureAlias: string): Promise<void> {
		const texture = await Assets.load<Texture>(textureAlias);
		this.sprite.texture = texture;
		this.sprite.anchor.set(0, 0);

		const tileWidth = texture.width;
		const tileHeight = texture.height;
		this.bleedX = Math.max(0, (tileWidth - this.viewportWidth) * 0.5);
		this.bleedY = Math.max(0, (tileHeight - this.viewportHeight) * 0.5);
		this.originX = (this.viewportWidth - tileWidth) * 0.5;
		this.originY = (this.viewportHeight - tileHeight) * 0.5;
		this.ready = true;
		this.update(0, 0);
	}

	private clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
}
