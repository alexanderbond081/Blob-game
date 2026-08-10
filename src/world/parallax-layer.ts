import { Assets, Container, Sprite, Texture } from 'pixi.js';

export type ParallaxLayerOptions = {
	textureAlias: string;
	/** Factor for X and Y camera scroll (0 = fixed to viewport, 1 = moves with world). */
	parallaxFactor: number;
	viewportWidth: number;
	viewportHeight: number;
	/** Level height in world pixels — anchors Y when the camera is at the floor. */
	levelHeight: number;
};

/**
 * Screen-space parallax layer (not stretched, not clamped).
 *
 * Anchor (camera at level floor, cameraX = 0):
 * - horizontally centered on the viewport;
 * - image bottom = viewport bottom
 *
 * Then: sprite moves by -(camera − anchorCamera) * parallaxFactor on both axes.
 * No edge stops — level/art sizing is the designer's job.
 */
export class ParallaxLayer extends Container {
	private readonly sprite: Sprite;
	private readonly parallaxFactor: number;
	private readonly viewportWidth: number;
	private readonly viewportHeight: number;
	/** Camera Y at the bottom of the level (levelHeight − viewportHeight). */
	private readonly anchorCameraY: number;
	/** Sprite X when cameraX = 0 (horizontally centered). */
	private originX = 0;
	/** Sprite Y when cameraY = anchorCameraY (bottom-aligned + bleed). */
	private originY = 0;
	private ready = false;
	/** Last requested camera pose, replayed once the texture arrives. */
	private lastCameraX = 0;
	private lastCameraY: number;

	public constructor(options: ParallaxLayerOptions) {
		super();
		this.parallaxFactor = options.parallaxFactor;
		this.viewportWidth = options.viewportWidth;
		this.viewportHeight = options.viewportHeight;
		this.anchorCameraY = Math.max(0, options.levelHeight - options.viewportHeight);
		this.lastCameraY = this.anchorCameraY;
		this.sprite = new Sprite(Texture.EMPTY);
		this.sprite.eventMode = 'none';
		this.addChild(this.sprite);
		this.eventMode = 'none';
		void this.loadTexture(options.textureAlias);
	}

	public update(cameraX: number, cameraY: number): void {
		this.lastCameraX = cameraX;
		this.lastCameraY = cameraY;

		if (!this.ready) {
			return;
		}

		// No clamp: always follow camera × factor from the floor-center anchor.
		this.sprite.x = this.originX - cameraX * this.parallaxFactor;
		this.sprite.y = this.originY + (this.anchorCameraY - cameraY) * this.parallaxFactor;
	}

	private async loadTexture(textureAlias: string): Promise<void> {
		const texture = await Assets.load<Texture>(textureAlias);
		this.sprite.texture = texture;
		this.sprite.anchor.set(0, 0);

		const tileWidth = texture.width;
		const tileHeight = texture.height;

		this.originX = 0;
		// Bottom of image = viewport bottom (cameraY = floor).
		this.originY = this.viewportHeight - tileHeight;

		this.ready = true;
		this.update(this.lastCameraX, this.lastCameraY);
	}
}
