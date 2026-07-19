import { AnimatedSprite, Container, DestroyOptions, Sprite, Spritesheet, Texture } from 'pixi.js';
import { Decoratable } from './decoratable';
import { MouseActionDecoration } from './mouse-action-decoration';

type ButtonTextures = Record<string, Texture>;

type PlayAnimationOptions = {
	loop?: boolean;
	speed?: number;
};

export class UIButton extends Container implements Decoratable {
	private view: Sprite | AnimatedSprite;
	private readonly textures: ButtonTextures;
	private readonly spritesheet?: Spritesheet;

	public get interactiveTarget(): Container { return this; }
	public get animationTarget(): Container { return this; }

	protected _actualScaleX: number = 1;
	protected _actualScaleY: number = 1;

	public get actualScaleX(): number { return this._actualScaleX; }
	public get actualScaleY(): number { return this._actualScaleY; }

	private constructor(
		textures: ButtonTextures,
		initialKey: string,
		readonly baseWidth: number,
		readonly baseHeight: number,
		readonly decorator?: MouseActionDecoration,
		spritesheet?: Spritesheet,
	) {
		super();

		this.textures = textures;
		this.spritesheet = spritesheet;

		const initialTexture = this.resolveTexture(initialKey) ?? Texture.EMPTY;
		this.view = spritesheet
			? new AnimatedSprite([initialTexture])
			: new Sprite(initialTexture);

		this.view.width = baseWidth;
		this.view.height = baseHeight;
		this.view.anchor.set(0.5);
		this.addChild(this.view);

		this.eventMode = 'static';
		this.cursor = 'pointer';

		if (decorator) {
			decorator.attach(this);
		}
	}

	public static fromTexture(
		texture: Texture,
		baseWidth: number,
		baseHeight: number,
		decorator?: MouseActionDecoration,
	): UIButton {
		return new UIButton({ default: texture }, 'default', baseWidth, baseHeight, decorator);
	}

	public static fromTextures(
		textures: ButtonTextures,
		initialKey: string,
		baseWidth: number,
		baseHeight: number,
		decorator?: MouseActionDecoration,
	): UIButton {
		return new UIButton(textures, initialKey, baseWidth, baseHeight, decorator);
	}

	public static fromSpritesheet(
		sheet: Spritesheet,
		initialFrame: string,
		baseWidth: number,
		baseHeight: number,
		decorator?: MouseActionDecoration,
	): UIButton {
		return new UIButton({ ...sheet.textures }, initialFrame, baseWidth, baseHeight, decorator, sheet);
	}

	override destroy(options?: DestroyOptions): void {
		if (this.decorator) {
			this.decorator.detach();
		}
		super.destroy(options);
	}

	public setFrame(key: string): void {
		const texture = this.resolveTexture(key);
		if (!texture) {
			return;
		}

		if (this.view instanceof AnimatedSprite) {
			this.view.textures = [texture];
			this.view.gotoAndStop(0);
		} else {
			this.view.texture = texture;
		}

		this.view.width = this.baseWidth;
		this.view.height = this.baseHeight;
		this.view.anchor.set(0.5);
	}

	public playAnimation(name: string, options: PlayAnimationOptions = {}): void {
		if (!this.spritesheet || !(this.view instanceof AnimatedSprite)) {
			return;
		}

		const frames = this.spritesheet.animations[name];
		if (!frames?.length) {
			console.warn(`UIButton: unknown animation "${name}"`);
			return;
		}

		this.view.textures = frames;
		this.view.loop = options.loop ?? false;
		this.view.animationSpeed = options.speed ?? 0.2;
		this.view.gotoAndPlay(0);
	}

	public adjustScale(scaleX: number, scaleY: number): void {
		this._actualScaleX = scaleX;
		this._actualScaleY = scaleY;

		if (this.decorator) {
			this.decorator.updateAnimations();
		}

		this.scale.set(scaleX, scaleY);
	}

	private resolveTexture(key: string): Texture | null {
		const texture = this.textures[key];
		if (!texture) {
			console.warn(`UIButton: unknown texture key "${key}"`);
			return null;
		}
		return texture;
	}
}
