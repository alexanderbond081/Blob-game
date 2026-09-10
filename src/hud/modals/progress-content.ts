import { Assets, Container, DestroyOptions, Spritesheet, Texture } from 'pixi.js';

import { VerticalScroller } from '../../components/vertical-scroller';
import { collectEpisodeProgressSummaries } from '../../managers/progress-episodes';
import { hubModalTitleY, isPortraitViewport } from './hub-modal-layout';
import { createModalTitle } from './modal-title';
import { ProgressEpisodeRow, ProgressStatIconTextures, ProgressTileTextures } from './progress-episode-row';
import { computeProgressTileHeight, PROGRESS_TILE_GAP } from './progress-tile-layout';

const LIST_SIDE_PAD = 8;
const LIST_BOTTOM_PAD = 64;
const LIST_BELOW_TITLE = 44;
const LIST_MIN_HEIGHT = 120;

/**
 * Progress hub modal: one scrollable paper tile per episode with completion bar and run totals.
 */
export class ProgressModalContent extends Container {
	private title!: ReturnType<typeof createModalTitle>;
	private tileTextures!: ProgressTileTextures;
	private statIcons!: ProgressStatIconTextures;
	private readonly scroller = new VerticalScroller();
	private readonly tiles: ProgressEpisodeRow[] = [];
	private panelHeight = 480;
	private contentWidth = 400;
	private portrait = false;

	private constructor() {
		super();
	}

	public static async create(): Promise<ProgressModalContent> {
		const content = new ProgressModalContent();
		await content.build();
		return content;
	}

	public refresh(): void {
		const summaries = collectEpisodeProgressSummaries();

		while (this.tiles.length < summaries.length) {
			const tile = new ProgressEpisodeRow(this.tileTextures, this.statIcons);
			this.tiles.push(tile);
			this.scroller.content.addChild(tile);
		}

		for (let i = 0; i < this.tiles.length; i += 1) {
			const tile = this.tiles[i];
			const summary = summaries[i];
			if (!summary) {
				tile.visible = false;
				continue;
			}

			tile.visible = true;
			tile.setSummary(summary);
		}

		this.scroller.scrollToTop();
		this.layoutList();
	}

	public reflow(
		contentWidth: number,
		panelHeight?: number,
		viewportWidth?: number,
		viewportHeight?: number,
	): void {
		this.contentWidth = contentWidth;

		if (panelHeight !== undefined) {
			this.panelHeight = panelHeight;
		}

		this.portrait = viewportWidth !== undefined && viewportHeight !== undefined
			? isPortraitViewport(viewportWidth, viewportHeight)
			: this.panelHeight > this.contentWidth;

		this.layoutTitle();
		this.layoutList();
	}

	public override destroy(options?: DestroyOptions): void {
		super.destroy(options);
	}

	private async build(): Promise<void> {
		const icons = await Assets.load<Spritesheet>('location-icons');
		this.tileTextures = {
			panelLight: await Assets.load<Texture>('9slice-panel-raised-light'),
			panelGray: await Assets.load<Texture>('9slice-panel-raised-gray'),
			icons,
			status: {
				complete: await Assets.load<Texture>('checked-icon'),
				open: await Assets.load<Texture>('arrow-icon'),
				locked: await Assets.load<Texture>('level-lock'),
			},
		};
		this.statIcons = {
			fireflies: await Assets.load<Texture>('firefly-icon'),
			time: await Assets.load<Texture>('watch-icon'),
			deaths: await Assets.load<Texture>('scull-icon'),
		};

		this.title = createModalTitle('Progress', 38);
		this.addChild(this.title);
		this.addChild(this.scroller);

		this.layoutTitle();
		this.refresh();
	}

	private layoutTitle(): void {
		this.title.x = 0;
		this.title.y = hubModalTitleY(this.panelHeight);
	}

	private layoutList(): void {
		const listWidth = Math.max(120, this.contentWidth - LIST_SIDE_PAD * 2);
		const listTop = hubModalTitleY(this.panelHeight) + LIST_BELOW_TITLE;
		const listBottom = this.panelHeight * 0.5 - LIST_BOTTOM_PAD;
		const listHeight = Math.max(LIST_MIN_HEIGHT, listBottom - listTop);

		this.scroller.x = -listWidth / 2;
		this.scroller.y = listTop;
		this.scroller.setViewport(listWidth, listHeight);

		const tileHeight = computeProgressTileHeight(listWidth, this.portrait);
		const step = tileHeight + PROGRESS_TILE_GAP;
		let visibleCount = 0;

		for (const tile of this.tiles) {
			if (!tile.visible) {
				continue;
			}

			tile.setLayout(listWidth, tileHeight, this.portrait);
			tile.x = listWidth / 2;
			tile.y = visibleCount * step + tileHeight / 2;
			visibleCount += 1;
		}

		const contentHeight = visibleCount > 0 ? visibleCount * step - PROGRESS_TILE_GAP : 0;
		this.scroller.setContentHeight(contentHeight);
	}
}
