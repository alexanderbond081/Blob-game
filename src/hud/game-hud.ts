import { Assets, Container, DestroyOptions, Spritesheet } from 'pixi.js';

import { bindDebouncedTap } from '../components/debounced-tap';
import { HighlightDecoration } from '../components/highlight-decoration';
import { UIButton } from '../components/ui-button';
import { DebugHudPanel } from '../debug/debug-hud-panel';
import { SoundManager } from '../managers/sound-manager';
import { Scene } from '../scenes/scene';
import { HUD } from './hud';

const HUD_MARGIN = 12;
const HUD_BUTTON_SIZE = 50;
const HUD_BUTTON_GAP = 12;

export class GameHUD extends HUD {
	private fullscreenButton!: UIButton;
	private soundButton!: UIButton;
	private musicButton!: UIButton;
	private modalLayer!: Container;
	private debugPanel!: DebugHudPanel;

	public async init(): Promise<void> {
		await this.addFullscreenButton();
		await this.addMusicButton();
		await this.addSoundButton();
		this.debugPanel = new DebugHudPanel();
		this.addChild(this.debugPanel);
		this.modalLayer = new Container();
		this.addChild(this.modalLayer);
		this.onResize();
	}

	public override destroy(options?: DestroyOptions): void {
		super.destroy(options);
	}

	public update(_deltaTime: number): void {
		// Icon HUD has no per-frame animation yet.
	}

	public isModalOpen(): boolean {
		return false;
	}

	public closeTopModal(): boolean {
		return false;
	}

	public syncFullscreenButton(isFullscreen: boolean): void {
		if (!this.fullscreenButton) {
			return;
		}

		this.fullscreenButton.setFrame(isFullscreen ? 'fullscreen-off' : 'fullscreen-on');
	}

	protected onResize(): void {
		this.adjustFullscreenButton();
		this.adjustMusicButton();
		this.adjustSoundButton();
		this.debugPanel?.adjustLayout();
	}

	private async addFullscreenButton(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>('fullscreen-button');
		const decorator = new HighlightDecoration(0.85);
		this.fullscreenButton = UIButton.fromSpritesheet(
			sheet,
			'fullscreen-on',
			HUD_BUTTON_SIZE,
			HUD_BUTTON_SIZE,
			decorator,
		);
		this.addChild(this.fullscreenButton);
		this.bindButtonSignal(this.fullscreenButton, 'toggle-fullscreen');
	}

	private async addSoundButton(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>('sound-button');
		const decorator = new HighlightDecoration(0.85);
		this.soundButton = UIButton.fromSpritesheet(
			sheet,
			'sound-on',
			HUD_BUTTON_SIZE,
			HUD_BUTTON_SIZE,
			decorator,
		);
		this.addChild(this.soundButton);

		bindDebouncedTap(this.soundButton, () => {
			SoundManager.playSound('hit-a-button');

			if (SoundManager.toggleSFX()) {
				this.soundButton.setFrame('sound-off');
			} else {
				this.soundButton.setFrame('sound-on');
			}
		});
	}

	private async addMusicButton(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>('music-button');
		const decorator = new HighlightDecoration(0.85);
		this.musicButton = UIButton.fromSpritesheet(
			sheet,
			'music-on',
			HUD_BUTTON_SIZE,
			HUD_BUTTON_SIZE,
			decorator,
		);
		this.addChild(this.musicButton);

		bindDebouncedTap(this.musicButton, () => {
			SoundManager.playSound('hit-a-button');

			if (SoundManager.toggleMusic()) {
				this.musicButton.setFrame('music-off');
			} else {
				this.musicButton.setFrame('music-on');
			}
		});
	}

	private bindButtonSignal(button: UIButton, eventName: string): void {
		bindDebouncedTap(button, () => {
			SoundManager.playSound('hit-a-button');
			this.emit(eventName);
		});
	}

	private adjustFullscreenButton(): void {
		if (!this.fullscreenButton) {
			return;
		}

		this.fullscreenButton.x = HUD_MARGIN + HUD_BUTTON_SIZE / 2;
		this.fullscreenButton.y = HUD_MARGIN + HUD_BUTTON_SIZE / 2;
	}

	private adjustMusicButton(): void {
		if (!this.musicButton) {
			return;
		}

		this.musicButton.x = Scene.viewportWidth - HUD_MARGIN - HUD_BUTTON_SIZE * 1.5 - HUD_BUTTON_GAP;
		this.musicButton.y = HUD_MARGIN + HUD_BUTTON_SIZE / 2;
	}

	private adjustSoundButton(): void {
		if (!this.soundButton) {
			return;
		}

		this.soundButton.x = Scene.viewportWidth - HUD_MARGIN - HUD_BUTTON_SIZE / 2;
		this.soundButton.y = HUD_MARGIN + HUD_BUTTON_SIZE / 2;
	}
}
