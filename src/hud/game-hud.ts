import { Assets, Container, DestroyOptions, NineSliceSprite, Sprite, Spritesheet, Text, TextStyle } from 'pixi.js';
import { gsap } from 'gsap';
import { bindDebouncedTap } from '../components/debounced-tap';
import { HighlightDecoration } from '../components/highlight-decoration';
import { UIButton } from '../components/ui-button';
import { DebugHudPanel } from '../debug/debug-hud-panel';
import { ErrorModalContent } from './error-modal-content';
import { HudModal } from './hud-modal';
import { SoundManager } from '../managers/sound-manager';
import { Scene } from '../scenes/scene';
import { createVersionLabel } from '../version';
import { HUD } from './hud';

const PANEL_MARGIN = 8;

// position
const FULLSCREEN_BUTTON_LEFT = 34;
const SOUND_BUTTON_LEFT = 92;
const INFO_BUTTON_LEFT = 150;
const INFO_LABEL_LEFT = 210;

// size
const HUD_BUTTON_SIZE = 48;
const INFO_PANEL_HEIGHT = 60;
const INFO_PANEL_WIDTH = 220;

export class GameHUD extends HUD {
	private panelSprite!: Sprite;
	private fullscreenButton!: UIButton;
	private soundButton!: UIButton;
	private infoButton!: UIButton;
	private infoPanel!: NineSliceSprite;
	private versionLabel!: Text;
	private modalLayer!: Container;
	private debugPanel!: DebugHudPanel;

	public async init(): Promise<void> {
		await this.addPanel();
		await this.addFullscreenButton();
		await this.addSoundButton();
		await this.addInfoButton();
		await this.addInfoPanel();
		this.debugPanel = new DebugHudPanel();
		this.addChild(this.debugPanel);
		this.modalLayer = new Container();
		this.addChild(this.modalLayer);
	}

	public override destroy(options?: DestroyOptions): void {
		super.destroy(options);
	}

	public update(deltaTime: number): void {
		// !! no animation yet
	}

	public isModalOpen(): boolean {
		// !! no modal windows yet
		return false;
	}

	public closeTopModal(): boolean {
		// !! no modal windows yet
		return true;
	}

	protected onResize(): void {
		this.adjustPanel();
		this.adjustFullscreenButton();
		this.adjustSoundButton();
		this.adjustInfoButton();
		this.adjustInfoPanel();
		this.debugPanel.adjustLayout();
	}

	private async addPanel(): Promise<void> {
		const texture = await Assets.load('ui-panel');
		this.panelSprite = new Sprite(texture);
		this.adjustPanel();
		this.addChildAt(this.panelSprite, 0);
	}

	private async addFullscreenButton(): Promise<void> {
		this.fullscreenButton = await this.createIconButton('button-fullscreen', HUD_BUTTON_SIZE);
		this.adjustFullscreenButton();
		this.addChild(this.fullscreenButton);
		this.bindButtonSignal(this.fullscreenButton, 'toggle-fullscreen');
	}

	private async addSoundButton(): Promise<void> {
		const soundButtonSheet = await Assets.load<Spritesheet>('button-sound');
		const decorator = new HighlightDecoration(0.85);
		this.soundButton = UIButton.fromSpritesheet(
			soundButtonSheet,
			'sound-on',
			HUD_BUTTON_SIZE,
			HUD_BUTTON_SIZE,
			decorator,
		);
		this.adjustSoundButton();
		this.addChild(this.soundButton);

		bindDebouncedTap(this.soundButton, () => {
			SoundManager.playSound('button-pressed');

			if (SoundManager.toggleGlobal()) {
				this.soundButton.setFrame('sound-off');
			} else {
				this.soundButton.setFrame('sound-on');
			}
		});
	}

	private async addInfoButton(): Promise<void> {
		this.infoButton = await this.createIconButton('button-info', HUD_BUTTON_SIZE);
		this.adjustInfoButton();
		this.addChild(this.infoButton);
		this.bindButtonSignal(this.infoButton, 'info-window');
	}

	private async addInfoPanel(): Promise<void> {
		const texture = await Assets.load('panel-info');
		this.infoPanel = new NineSliceSprite({
			texture,
			leftWidth: 15,
			rightWidth: 15,
			topHeight: 13,
			bottomHeight: 15,
			width: INFO_PANEL_WIDTH,
			height: INFO_PANEL_HEIGHT,
		});
		this.infoPanel.anchor.set(0.5);
		this.versionLabel = createVersionLabel();
		this.versionLabel.anchor.set(0.5);
		this.adjustInfoPanel();
		this.addChild(this.infoPanel);
		this.addChild(this.versionLabel);
	}

	private async createPopupWindow(
		width: number,
		height: number,
		fontSize: number,
	): Promise<{ container: Container; panel: NineSliceSprite; label: Text }> {
		const texture = await Assets.load('panel-window');
		const container = new Container();
		const panel = new NineSliceSprite({
			texture,
			leftWidth: 32,
			rightWidth: 32,
			topHeight: 32,
			bottomHeight: 32,
			width,
			height,
		});
		panel.anchor.set(0.5);
		const label = new Text({
			text: '',
			style: this.createWindowTextStyle(fontSize),
		});
		label.anchor.set(0.5);
		container.addChild(panel);
		container.addChild(label);
		container.visible = false;
		return { container, panel, label };
	}

	private createWindowTextStyle(fontSize: number): TextStyle {
		return new TextStyle({
			fontFamily: 'Arial, sans-serif',
			fontSize,
			fill: '#E8D5A8',
			align: 'center',
			wordWrap: true,
			lineHeight: fontSize * 1.35,
		});
	}

	private async createIconButton(alias: string, size: number): Promise<UIButton> {
		const texture = await Assets.load(alias);
		const decorator = new HighlightDecoration(0.85);
		return UIButton.fromTexture(texture, size, size, decorator);
	}

	private bindButtonSignal(button: UIButton, eventName: string): void {
		bindDebouncedTap(button, () => {
			SoundManager.playSound('button-pressed');
			this.emit(eventName);
		});
	}

	private adjustPanel(): void {
		const targetWidth = Scene.viewportWidth - PANEL_MARGIN * 2;
		this.panelSprite.scale.set(targetWidth / this.panelSprite.texture.width);
		this.panelSprite.x = PANEL_MARGIN;
		this.panelSprite.y = Scene.viewportHeight - PANEL_MARGIN - this.panelSprite.height;
	}

	private adjustFullscreenButton(): void {
		this.fullscreenButton.x = FULLSCREEN_BUTTON_LEFT + HUD_BUTTON_SIZE / 2;
		this.fullscreenButton.y = this.panelSprite.y + this.panelSprite.height / 2;
	}

	private adjustSoundButton(): void {
		this.soundButton.x = SOUND_BUTTON_LEFT + HUD_BUTTON_SIZE / 2;
		this.soundButton.y = this.panelSprite.y + this.panelSprite.height / 2;
	}

	private adjustInfoButton(): void {
		this.infoButton.x = INFO_BUTTON_LEFT + HUD_BUTTON_SIZE / 2;
		this.infoButton.y = this.panelSprite.y + this.panelSprite.height / 2;
	}

	private adjustInfoPanel(): void {
		this.infoPanel.x = INFO_LABEL_LEFT + INFO_PANEL_WIDTH / 2;
		this.infoPanel.y = this.panelSprite.y + this.panelSprite.height / 2;
		this.versionLabel.x = this.infoPanel.x;
		this.versionLabel.y = this.infoPanel.y;
	}

}
