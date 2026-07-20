import { Assets, Container, Sprite, Texture } from 'pixi.js';

export type ParallaxLayerOptions = {
	textureAlias: string;
	parallaxFactor: number;
	levelWidth: number;
	levelHeight: number;
};

export class ParallaxLayer extends Container {
	private readonly sprite: Sprite;
	private readonly parallaxFactor: number;
	private readonly levelWidth: number;

	public constructor(options: ParallaxLayerOptions) {
		super();
		this.parallaxFactor = options.parallaxFactor;
		this.levelWidth = options.levelWidth;
		this.sprite = new Sprite(Texture.EMPTY);
		this.sprite.eventMode = 'none';
		this.addChild(this.sprite);
		this.eventMode = 'none';
		void this.loadTexture(options.textureAlias, options.levelHeight);
	}

	public update(cameraX: number): void {
		this.position.x = -cameraX * this.parallaxFactor;
	}

	private async loadTexture(textureAlias: string, levelHeight: number): Promise<void> {
		const texture = await Assets.load(textureAlias);
		this.sprite.texture = texture;
		this.sprite.anchor.set(0, 0);

		const scale = Math.max(this.levelWidth / texture.width, levelHeight / texture.height);
		this.sprite.scale.set(scale);
		this.sprite.y = levelHeight - this.sprite.height;
	}
}
