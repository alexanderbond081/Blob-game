import { Assets, Container, DestroyOptions, Spritesheet, Texture } from 'pixi.js';

import { bindDebouncedTap } from '../components/debounced-tap';
import { HighlightDecoration } from '../components/highlight-decoration';
import { UIButton } from '../components/ui-button';
import { DebugHudPanel } from '../debug/debug-hud-panel';
import { SoundManager } from '../managers/sound-manager';
import { isFullscreenControlAllowed } from '../platform/platform';
import { Scene } from '../scenes/scene';
import { HUD } from './hud';
import { HudModal } from './hud-modal';
import { PauseModalContent } from './modals/pause-content';

const HUD_MARGIN = 12;
const HUD_BUTTON_SIZE = 50;
const HUD_BUTTON_GAP = 12;

const PAUSE_MODAL_WIDTH = 400;
const PAUSE_MODAL_HEIGHT = 180;

/** Which controls the HUD exposes for the currently active screen. */
export type HudProfile = 'menu' | 'gameplay';

export class GameHUD extends HUD {
	private fullscreenButton!: UIButton;
	private pauseButton!: UIButton;
	private soundButton!: UIButton;
	private musicButton!: UIButton;
	/** Dimmed modal stack — sits under chrome so FS/audio stay clickable while paused. */
	private modalLayer!: Container;
	/** Always-on HUD chrome (fullscreen, audio, pause). Above modals. */
	private controlsLayer!: Container;
	private debugPanel!: DebugHudPanel;
	private pauseModal: HudModal | null = null;
	private pauseContent: PauseModalContent | null = null;
	private isBuilt = false;
	private profile: HudProfile = 'menu';

	public async init(): Promise<void> {
		if (this.isBuilt) {
			return;
		}

		this.isBuilt = true;

		this.modalLayer = new Container();
		this.addChild(this.modalLayer);
		this.controlsLayer = new Container();
		this.addChild(this.controlsLayer);

		await this.addFullscreenButton();
		await this.addPauseButton();
		await this.addMusicButton();
		await this.addSoundButton();
		this.debugPanel = new DebugHudPanel();
		this.addChild(this.debugPanel);
		await this.ensurePauseModal();
		this.applyProfile();
		this.onResize();
	}

	public get activeProfile(): HudProfile {
		return this.profile;
	}

	public setProfile(profile: HudProfile): void {
		this.profile = profile;
		if (profile !== 'gameplay' && this.pauseModal?.isOpen) {
			this.closePauseModal();
		}
		this.applyProfile();
	}

	public override destroy(options?: DestroyOptions): void {
		super.destroy(options);
	}

	public update(_deltaTime: number): void {
		// Icon HUD has no per-frame animation yet.
	}

	public isModalOpen(): boolean {
		return this.pauseModal?.isOpen === true;
	}

	/**
	 * ESC handler: if the pause modal is open, request resume (same as Resume).
	 * Returns true when the key was consumed.
	 */
	public closeTopModal(): boolean {
		if (!this.pauseModal?.isOpen) {
			return false;
		}

		this.emit('pause-resume');
		return true;
	}

	public async openPauseModal(): Promise<void> {
		await this.ensurePauseModal();
		if (!this.pauseModal || this.pauseModal.isOpen) {
			return;
		}

		this.pauseModal.adjustLayout(
			Scene.viewportWidth,
			Scene.viewportHeight,
			Scene.viewportHeight * 0.5,
		);
		this.pauseModal.open();
	}

	public closePauseModal(): void {
		this.pauseModal?.close();
	}

	public syncFullscreenButton(isFullscreen: boolean): void {
		if (!this.fullscreenButton) {
			return;
		}

		this.fullscreenButton.setFrame(isFullscreen ? 'fullscreen-off' : 'fullscreen-on');
	}

	private applyProfile(): void {
		if (this.fullscreenButton) {
			this.fullscreenButton.visible = isFullscreenControlAllowed();
		}
		if (this.pauseButton) {
			this.pauseButton.visible = this.profile === 'gameplay';
		}
		// Pause visibility shifts the right-side Music/Sound cluster.
		this.adjustPauseButton();
		this.adjustMusicButton();
		this.adjustSoundButton();
	}

	protected onResize(): void {
		this.adjustFullscreenButton();
		this.adjustPauseButton();
		this.adjustMusicButton();
		this.adjustSoundButton();
		this.debugPanel?.adjustLayout();
		if (this.pauseModal?.isOpen) {
			this.pauseModal.adjustLayout(
				Scene.viewportWidth,
				Scene.viewportHeight,
				Scene.viewportHeight * 0.5,
			);
		}
	}

	private async ensurePauseModal(): Promise<void> {
		if (this.pauseModal) {
			return;
		}

		this.pauseModal = await HudModal.create({
			width: PAUSE_MODAL_WIDTH,
			height: PAUSE_MODAL_HEIGHT,
			showOkButton: false,
			closeOnBackdropTap: false,
			panelAlias: '9slice-panel-old',
		});
		this.pauseContent = await PauseModalContent.create();
		this.pauseModal.setContent(this.pauseContent);
		this.modalLayer.addChild(this.pauseModal);

		this.pauseContent.on('resume', () => this.emit('pause-resume'));
		this.pauseContent.on('home', () => this.emit('pause-home'));
		this.pauseContent.on('restart', () => this.emit('pause-restart'));
	}

	private async addFullscreenButton(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>('fullscreen-button');
		const decorator = new HighlightDecoration(0.75);
		this.fullscreenButton = UIButton.fromSpritesheet(
			sheet,
			'fullscreen-on',
			HUD_BUTTON_SIZE,
			HUD_BUTTON_SIZE,
			decorator,
		);
		this.controlsLayer.addChild(this.fullscreenButton);
		this.bindButtonSignal(this.fullscreenButton, 'toggle-fullscreen');
	}

	private async addPauseButton(): Promise<void> {
		const texture = await Assets.load<Texture>('pause-button');
		this.pauseButton = UIButton.fromTexture(
			texture,
			HUD_BUTTON_SIZE,
			HUD_BUTTON_SIZE,
			new HighlightDecoration(0.75),
		);
		this.pauseButton.visible = false;
		this.controlsLayer.addChild(this.pauseButton);
		this.bindButtonSignal(this.pauseButton, 'request-pause');
	}

	private async addSoundButton(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>('sound-button');
		const decorator = new HighlightDecoration(0.75);
		this.soundButton = UIButton.fromSpritesheet(
			sheet,
			'sound-on',
			HUD_BUTTON_SIZE,
			HUD_BUTTON_SIZE,
			decorator,
		);
		this.controlsLayer.addChild(this.soundButton);

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
		const decorator = new HighlightDecoration(0.75);
		this.musicButton = UIButton.fromSpritesheet(
			sheet,
			'music-on',
			HUD_BUTTON_SIZE,
			HUD_BUTTON_SIZE,
			decorator,
		);
		this.controlsLayer.addChild(this.musicButton);

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

	private adjustPauseButton(): void {
		if (!this.pauseButton) {
			return;
		}

		// Right cluster: Music | Sound | Pause (pause is rightmost when visible).
		this.pauseButton.x = Scene.viewportWidth - HUD_MARGIN - HUD_BUTTON_SIZE / 2;
		this.pauseButton.y = HUD_MARGIN + HUD_BUTTON_SIZE / 2;
	}

	private adjustMusicButton(): void {
		if (!this.musicButton) {
			return;
		}

		const slotsFromRight = this.pauseButton?.visible ? 2 : 1;
		this.musicButton.x = Scene.viewportWidth
			- HUD_MARGIN
			- HUD_BUTTON_SIZE * (slotsFromRight + 0.5)
			- HUD_BUTTON_GAP * slotsFromRight;
		this.musicButton.y = HUD_MARGIN + HUD_BUTTON_SIZE / 2;
	}

	private adjustSoundButton(): void {
		if (!this.soundButton) {
			return;
		}

		const slotsFromRight = this.pauseButton?.visible ? 1 : 0;
		this.soundButton.x = Scene.viewportWidth
			- HUD_MARGIN
			- HUD_BUTTON_SIZE * (slotsFromRight + 0.5)
			- HUD_BUTTON_GAP * slotsFromRight;
		this.soundButton.y = HUD_MARGIN + HUD_BUTTON_SIZE / 2;
	}
}
