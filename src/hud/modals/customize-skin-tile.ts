import { gsap } from 'gsap';
import { Container, DestroyOptions, Graphics, Rectangle, Sprite, Spritesheet, Texture } from 'pixi.js';

import { IdleBounceAnimator } from '../../components/idle-bounce-animator';
import { bindDebouncedTap } from '../../components/debounced-tap';
import { playLockDeniedShake } from '../../components/lock-denied-shake';
import { SoundManager } from '../../managers/sound-manager';
import { MODAL_TITLE_FILL } from './modal-title';

const CHARACTER_FRAME_KEY = 'blob-right';
const SELECTION_FRAME_PAD = 8;
const SELECTION_FRAME_RADIUS = 12;
const SELECTION_STROKE_WIDTH = 2;
const SELECTION_STROKE_ALPHA = 0.5;
/** Dim only the character art; the padlock stays fully opaque. */
const LOCKED_CHARACTER_ALPHA = 0.55;
/** Lock height relative to the character box. */
const LOCK_SIZE_FACTOR = 0.75;

type CustomizeSkinTileVisuals = {
	lockTexture: Texture;
	iconSheet: Spritesheet;
};

type SetSelectedOptions = {
	playIntro?: boolean;
};

export class CustomizeSkinTile extends Container {
	private readonly skinId: string;
	private readonly idleAnimator = new IdleBounceAnimator(3, 16, 0);

	private readonly selectedFrame: Graphics;
	private readonly characterAnimationRoot: Container;
	private readonly characterSprite: Sprite;
	private readonly lockSprite: Sprite;

	private unlocked = true;
	private selected = false;
	private readonly characterSize: number;

	public constructor(
		skinId: string,
		visuals: CustomizeSkinTileVisuals,
		characterSize: number,
	) {
		super();

		this.skinId = skinId;
		this.characterSize = characterSize;
		const tileSize = characterSize + SELECTION_FRAME_PAD * 2;
		this.hitArea = new Rectangle(-tileSize / 2, -tileSize / 2, tileSize, tileSize);

		this.selectedFrame = new Graphics();
		this.selectedFrame.eventMode = 'none';
		this.drawSelectedFrame();
		this.selectedFrame.visible = false;
		this.addChild(this.selectedFrame);

		this.characterAnimationRoot = new Container();
		this.addChild(this.characterAnimationRoot);

		const texture = visuals.iconSheet.textures[CHARACTER_FRAME_KEY];
		this.characterSprite = new Sprite(texture ?? Texture.EMPTY);
		this.characterSprite.anchor.set(0.5);
		this.setCharacterSpriteScale();
		this.characterAnimationRoot.addChild(this.characterSprite);

		this.lockSprite = new Sprite(visuals.lockTexture);
		// Pivot at the shackle (top center) so shake rotation swings like a hanging padlock.
		this.lockSprite.anchor.set(0.5, 0.4);
		this.lockSprite.scale.set(characterSize * LOCK_SIZE_FACTOR / visuals.lockTexture.height);
		this.lockSprite.visible = false;
		this.addChild(this.lockSprite);

		// Animate a unit-scale wrapper so the animator cannot reset the sprite's
		// fitted texture scale. Selection frame and lock stay fixed on the tile.
		this.idleAnimator.attach(this.characterAnimationRoot);
	}

	public syncVisuals(visuals: CustomizeSkinTileVisuals): void {
		const texture = visuals.iconSheet.textures[CHARACTER_FRAME_KEY];
		this.characterSprite.texture = texture ?? Texture.EMPTY;
		this.setCharacterSpriteScale();
	}

	public isSelected(): boolean {
		return this.selected;
	}

	public getSkinId(): string {
		return this.skinId;
	}

	public setUnlocked(unlocked: boolean): void {
		this.unlocked = unlocked;
		this.characterAnimationRoot.alpha = unlocked ? 1 : LOCKED_CHARACTER_ALPHA;
		this.cursor = 'pointer';
		this.lockSprite.visible = !unlocked;
	}

	/** Classic "won't budge" shake: swing like a hanging padlock (rotation only). */
	public playLockDenied(): void {
		playLockDeniedShake(this.lockSprite);
	}

	public setSelected(selected: boolean, options: SetSelectedOptions = {}): void {
		if (!this.unlocked) {
			this.selected = false;
			this.selectedFrame.visible = false;
			this.idleAnimator.stop();
			return;
		}

		const wasSelected = this.selected;
		this.selected = selected;
		this.selectedFrame.visible = selected;

		if (!selected) {
			this.idleAnimator.stop();
			return;
		}

		const shouldPlayIntro = options.playIntro === true || !wasSelected;
		if (shouldPlayIntro) {
			this.idleAnimator.stop();
			this.idleAnimator.start({ introImmediately: true });
			return;
		}

		if (!this.idleAnimator.isRunning) {
			this.idleAnimator.start();
		}
	}

	public syncRestPositionAfterReflow(): void {
		this.idleAnimator.syncRestPosition();
	}

	public bindSelect(onSelect: (skinId: string) => void): void {
		this.eventMode = 'static';
		this.cursor = 'pointer';
		bindDebouncedTap(this, () => {
			if (!this.unlocked) {
				SoundManager.playSound('level-locked');
				this.playLockDenied();
				return;
			}
			SoundManager.playSound('blob-stick');
			onSelect(this.skinId);
		});
	}

	public override destroy(options?: DestroyOptions): void {
		gsap.killTweensOf(this.lockSprite);
		this.idleAnimator.destroy();
		super.destroy(options);
	}

	private drawSelectedFrame(): void {
		const width = this.characterSize + SELECTION_FRAME_PAD * 2;
		const height = this.characterSize + SELECTION_FRAME_PAD * 2;

		this.selectedFrame.clear()
			.roundRect(-width / 2, -height / 2, width, height, SELECTION_FRAME_RADIUS)
			.stroke({
				color: MODAL_TITLE_FILL,
				width: SELECTION_STROKE_WIDTH,
				alpha: SELECTION_STROKE_ALPHA,
				join: 'round',
			});
	}

	private setCharacterSpriteScale(): void {
		const texture = this.characterSprite.texture;
		const baseScale = this.characterSize / Math.max(texture.width, texture.height);
		this.characterSprite.width = texture.width * baseScale;
		this.characterSprite.height = texture.height * baseScale;
	}
}
