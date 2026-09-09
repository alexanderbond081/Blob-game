import { Assets, Container, Sprite, Texture } from 'pixi.js';

export type DecorCornerAnchor = 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';

/** Static panel decor. `offsetX` / `offsetY` are from the named panel corner. `height` is logical. */
export type ModalDecorSpec = {
	readonly texture: string;
	readonly anchor: DecorCornerAnchor;
	readonly offsetX: number;
	readonly offsetY: number;
	readonly height: number;
	readonly scaleX: number;
	readonly scaleY: number;
	readonly alpha: number;
};

const cornerOrigin = (
	anchor: DecorCornerAnchor,
	panelWidth: number,
	panelHeight: number,
): { x: number; y: number } => {
	const halfW = panelWidth * 0.5;
	const halfH = panelHeight * 0.5;
	if (anchor === 'topLeft') {
		return { x: -halfW, y: -halfH };
	}
	if (anchor === 'topRight') {
		return { x: halfW, y: -halfH };
	}
	if (anchor === 'bottomLeft') {
		return { x: -halfW, y: halfH };
	}
	return { x: halfW, y: halfH };
};

const createDecorSprite = (spec: ModalDecorSpec, texture: Texture): Sprite => {
	const sprite = new Sprite(texture);
	sprite.anchor.set(0.5);
	sprite.eventMode = 'none';
	sprite.height = spec.height;
	sprite.width = spec.height * (texture.width / texture.height);
	sprite.scale.x = Math.abs(sprite.scale.x) * spec.scaleX;
	sprite.scale.y = Math.abs(sprite.scale.y) * spec.scaleY;
	sprite.alpha = spec.alpha;
	return sprite;
};

export const loadModalDecorTextures = async (
	layouts: readonly (readonly ModalDecorSpec[])[],
): Promise<Map<string, Texture>> => {
	const textures = new Map<string, Texture>();
	for (const layout of layouts) {
		for (const spec of layout) {
			if (!textures.has(spec.texture)) {
				textures.set(spec.texture, await Assets.load<Texture>(spec.texture));
			}
		}
	}

	return textures;
};

/**
 * One named layout of corner-anchored sprites, parented to a modal content root
 * whose origin is the panel centre.
 */
export class ModalDecorLayer {
	private readonly specs: readonly ModalDecorSpec[];
	private readonly sprites: Sprite[];

	private constructor(specs: readonly ModalDecorSpec[], sprites: Sprite[]) {
		this.specs = specs;
		this.sprites = sprites;
	}

	public static create(
		host: Container,
		layout: readonly ModalDecorSpec[],
		textures: Map<string, Texture>,
	): ModalDecorLayer {
		const sprites: Sprite[] = [];
		for (const spec of layout) {
			const texture = textures.get(spec.texture);
			if (!texture) {
				continue;
			}

			const sprite = createDecorSprite(spec, texture);
			sprites.push(sprite);
			host.addChild(sprite);
		}

		return new ModalDecorLayer(layout, sprites);
	}

	public setVisible(visible: boolean): void {
		for (const sprite of this.sprites) {
			sprite.visible = visible;
		}
	}

	public layout(panelWidth: number, panelHeight: number): void {
		for (let i = 0; i < this.sprites.length; i += 1) {
			const spec = this.specs[i];
			const sprite = this.sprites[i];
			if (!spec || !sprite) {
				continue;
			}

			const origin = cornerOrigin(spec.anchor, panelWidth, panelHeight);
			sprite.x = origin.x + spec.offsetX;
			sprite.y = origin.y + spec.offsetY;
			sprite.alpha = spec.alpha;
		}
	}
}
