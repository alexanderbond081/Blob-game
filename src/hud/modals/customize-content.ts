import { Assets, Container, DestroyOptions, Spritesheet, Texture } from 'pixi.js';

import { createModalTitle } from './modal-title';
import { hubModalTitleY } from './hub-modal-layout';
import { skinsCatalog } from '../../managers/skins-catalog';
import { GameProgress } from '../../managers/game-progress';
import { CustomizeSkinTile } from './customize-skin-tile';
import {
	computeCustomizeGridLayout,
	computeCustomizeTilePosition,
	getCustomizeTileGeometry,
} from './customize-grid-layout';

/**
 * Customize hub modal body (D0 shell). Skin grid lands in D2.
 */
export class CustomizeModalContent extends Container {
	private title!: ReturnType<typeof createModalTitle>;
	private panelHeight = 480;
	private contentWidth = 400;

	private lockTexture!: Texture;
	private readonly tiles: CustomizeSkinTile[] = [];
	private selectedSkinId = 'default';

	private constructor() {
		super();
	}

	public static async create(): Promise<CustomizeModalContent> {
		const content = new CustomizeModalContent();
		await content.build();
		return content;
	}

	public refresh(): void {
		const progress = GameProgress.shared;
		this.selectedSkinId = progress.selectedSkinId ?? 'default';
		for (const tile of this.tiles) {
			const id = tile.getSkinId();
			const unlocked = progress.isSkinUnlocked(id);
			const selected = unlocked && id === this.selectedSkinId;
			tile.setUnlocked(unlocked);
			tile.setSelected(selected, { playIntro: selected });
		}
		this.applyGridLayout();
	}

	public stopSelectedAnimation(): void {
		for (const tile of this.tiles) {
			if (tile.isSelected()) {
				tile.setSelected(false);
			}
		}
	}

	public reflow(
		contentWidth: number,
		panelHeight?: number,
		_viewportWidth?: number,
		_viewportHeight?: number,
	): void {
		this.contentWidth = contentWidth;
		if (panelHeight !== undefined) {
			this.panelHeight = panelHeight;
		}

		this.layout();
	}

	public override destroy(options?: DestroyOptions): void {
		super.destroy(options);
	}

	private layout(): void {
		this.title.x = 0;
		this.title.y = hubModalTitleY(this.panelHeight);

		this.applyGridLayout();
	}

	private async build(): Promise<void> {
		this.title = createModalTitle('Customize', 38);
		this.addChild(this.title);

		this.lockTexture = await Assets.load<Texture>('level-lock');

		// Create all tiles once; we only update selection + unlocked visuals in `refresh`.
		const characterSize = getCustomizeTileGeometry().characterSize;

		for (const skin of skinsCatalog) {
			const iconSheet = await Assets.load<Spritesheet>(skin.blobSheetAlias);
			const tile = new CustomizeSkinTile(
				skin.id,
				{
					lockTexture: this.lockTexture,
					iconSheet,
				},
				characterSize,
			);

			tile.bindSelect((skinId) => {
				const progress = GameProgress.shared;
				progress.setSelectedSkinId(skinId);
				this.selectedSkinId = skinId;
				this.refresh();
			});

			this.tiles.push(tile);
			this.addChild(tile);
		}

		this.refresh();
	}

	private applyGridLayout(): void {
		if (this.tiles.length === 0) {
			return;
		}

		const grid = computeCustomizeGridLayout(this.contentWidth, this.panelHeight);

		for (let i = 0; i < this.tiles.length; i += 1) {
			const pos = computeCustomizeTilePosition(i, grid);
			const tile = this.tiles[i];
			tile.x = pos.x;
			tile.y = pos.y;
			tile.syncRestPositionAfterReflow();
		}
	}
}
