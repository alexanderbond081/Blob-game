import { Assets, Container, DestroyOptions, Spritesheet } from 'pixi.js';

import { MAX_PROGRESS_EPISODES, collectEpisodeProgressSummaries } from '../../managers/progress-episodes';
import { hubModalTitleY } from './hub-modal-layout';

import { computeProgressGridLayout, progressGridSlotPosition } from './progress-grid-layout';
import { createModalTitle } from './modal-title';
import { ProgressEpisodeRow } from './progress-episode-row';

/**
 * Progress hub modal: per-episode completion % and firefly totals on a fixed 6-slot grid.
 */
export class ProgressModalContent extends Container {
	private title!: ReturnType<typeof createModalTitle>;
	private iconSheet!: Spritesheet;
	private readonly episodeRows: ProgressEpisodeRow[] = [];
	private panelHeight = 480;
	private contentWidth = 400;

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

		for (let slot = 0; slot < MAX_PROGRESS_EPISODES; slot += 1) {
			const row = this.episodeRows[slot];
			const summary = summaries[slot];

			if (!summary) {
				row.hideRow();
				continue;
			}

			row.setSummary(summary, this.iconSheet);
		}

		this.applyGridLayout();
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

		this.layoutTitle();
		this.applyGridLayout();
	}

	public override destroy(options?: DestroyOptions): void {
		super.destroy(options);
	}

	private async build(): Promise<void> {
		this.iconSheet = await Assets.load<Spritesheet>('location-icons');
		this.title = createModalTitle('Progress', 38);
		this.addChild(this.title);

		for (let slot = 0; slot < MAX_PROGRESS_EPISODES; slot += 1) {
			const row = new ProgressEpisodeRow(this.iconSheet);
			this.episodeRows.push(row);
			this.addChild(row);
		}

		this.layoutTitle();
	}

	private layoutTitle(): void {
		this.title.x = 0;
		this.title.y = hubModalTitleY(this.panelHeight);
	}

	private applyGridLayout(): void {
		// D1 needs only a stable grid direction (portrait vs landscape).
		// We approximate portrait by panel geometry rather than tracking viewport.
		const portrait = this.panelHeight > this.contentWidth;
		const grid = computeProgressGridLayout(this.contentWidth, this.panelHeight, portrait);

		for (let slot = 0; slot < MAX_PROGRESS_EPISODES; slot += 1) {
			const row = this.episodeRows[slot];
			if (!row.visible) {
				continue;
			}

			const position = progressGridSlotPosition(slot, grid);
			row.x = position.x;
			row.y = position.y;
		}
	}
}
