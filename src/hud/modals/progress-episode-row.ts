import { Container, FillGradient, Graphics, NineSliceSprite, Sprite, Spritesheet, Text, Texture, TextStyle } from 'pixi.js';

import { EpisodeProgressSummary, formatEpisodeCompletionPercent } from '../../managers/progress-episodes';
import { computeProgressTileRegions, ProgressTileRegions } from './progress-tile-layout';
import { formatRunTime, MODAL_TITLE_FILL } from './modal-title';

/** Logical border on the 150×150 (resolution 2) paper panels. */
const PANEL_SLICE = 30;
const LOCKED_ICON_TINT = 0x8f8f8f;

/** Stats row is authored at these sizes and scaled down to the tile band. */
const STAT_FILL = 0x4a2c14;
const STAT_ICON_SIZE = 40;
const STAT_ICON_TEXT_GAP = 8;
const STAT_CLUSTER_GAP = 16;
const STAT_DIVIDER_HEIGHT = 34;

const BAR_TRACK_FILL = 0x5d3c07; //0xaa9f8f; //0xe4bf88; //0xd9c79a;
const BAR_TRACK_FILL_ALPHA = 0.25;
const BAR_OUTLINE = 0x5d3c07; //0x1e4f0b;
const BAR_FILL_OUTLINE = 0x1e4f0b;
const BAR_FILL_EDGE = 0x34af23;
const BAR_FILL_CORE = 0x5fd841;
const BAR_TEXT_FILL = 0xffffff;
const BAR_TEXT_OUTLINE = 0x222222;
const BAR_TEXT_ALPHA = 0.65;

/** Light brown hint text "Coming Soon" and other. */
export const HINT_TEXT_FILL = 0x795e41;

export type ProgressStatusTextures = {
	complete: Texture;
	open: Texture;
	locked: Texture;
};

export type ProgressTileTextures = {
	panelLight: Texture;
	panelGray: Texture;
	icons: Spritesheet;
	status: ProgressStatusTextures;
};

export type ProgressStatIconTextures = {
	fireflies: Texture;
	time: Texture;
	deaths: Texture;
};

type StatCell = {
	root: Container;
	icon: Sprite;
	value: Text;
};

const createTitleStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Nunito, Helvetica, sans-serif',
		fontSize: 32,
		fontWeight: 'bold',
		fill: MODAL_TITLE_FILL,
		align: 'center',
		wordWrap: true,
		wordWrapWidth: 200,
	});
};

const createStatStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Arial',
		fontSize: 24,
		fontWeight: 'bold',
		fill: STAT_FILL,
		align: 'left',
		stroke: { color: 0xf5e6c8, width: 1, join: 'round' },
	});
};

const createComingSoonStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Nunito, Helvetica, sans-serif',
		fontSize: 20,
		fontWeight: '600',
		fill: HINT_TEXT_FILL,
		align: 'center',
	});
};

const createPercentStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Nunito, Helvetica, sans-serif',
		fontSize: 24,
		fontWeight: '900',
		fill: BAR_TEXT_FILL,
		align: 'right',
		stroke: { color: BAR_TEXT_OUTLINE, alpha: BAR_TEXT_ALPHA, width: 3, join: 'round' },
	});
};

const createStatCell = (iconTexture: Texture, style: TextStyle): StatCell => {
	const root = new Container();

	const icon = new Sprite(iconTexture);
	icon.anchor.set(0, 0.5);
	icon.width = STAT_ICON_SIZE;
	icon.height = STAT_ICON_SIZE;

	const value = new Text({
		text: '0',
		style,
		resolution: 2,
		roundPixels: true,
	});
	value.anchor.set(0, 0.5);
	value.x = STAT_ICON_SIZE + STAT_ICON_TEXT_GAP;

	root.addChild(icon);
	root.addChild(value);
	return { root, icon, value };
};

const statCellWidth = (cell: StatCell): number => {
	return STAT_ICON_SIZE + STAT_ICON_TEXT_GAP + cell.value.width;
};

const createStatDivider = (): Graphics => {
	const divider = new Graphics();
	divider.rect(-0.5, -STAT_DIVIDER_HEIGHT * 0.5, 1, STAT_DIVIDER_HEIGHT);
	divider.fill({ color: STAT_FILL, alpha: 0.28 });
	return divider;
};

const createBarFillGradient = (): FillGradient => {
	return new FillGradient({
		type: 'linear',
		start: { x: 0, y: 0 },
		end: { x: 0, y: 1 },
		textureSpace: 'local',
		colorStops: [
			{ offset: 0, color: BAR_FILL_EDGE },
			{ offset: 0.35, color: BAR_FILL_CORE },
			{ offset: 0.7, color: BAR_FILL_CORE },
			{ offset: 1, color: BAR_FILL_EDGE },
		],
	});
};

/**
 * One episode on its own paper panel: location icon, name, completion bar and
 * the run totals, with a status badge on the right. Purely presentational.
 */
export class ProgressEpisodeRow extends Container {
	private readonly panel: NineSliceSprite;
	private readonly icon: Sprite;
	private readonly title: Text;
	private readonly barTrack = new Graphics();
	private readonly barFill = new Graphics();
	private readonly percentText: Text;
	private readonly comingSoonText: Text;
	private readonly statsRoot = new Container();
	private readonly firefliesCell: StatCell;
	private readonly timeCell: StatCell;
	private readonly deathsCell: StatCell;
	private readonly dividerLeft = createStatDivider();
	private readonly dividerRight = createStatDivider();
	private readonly statusIcon = new Sprite();
	private readonly textures: ProgressTileTextures;
	private summary: EpisodeProgressSummary | null = null;
	private tileWidth = 400;
	private tileHeight = 120;
	private portrait = false;

	public constructor(textures: ProgressTileTextures, statIcons: ProgressStatIconTextures) {
		super();

		this.textures = textures;
		this.eventMode = 'none';

		this.panel = new NineSliceSprite({
			texture: textures.panelLight,
			leftWidth: PANEL_SLICE,
			rightWidth: PANEL_SLICE,
			topHeight: PANEL_SLICE,
			bottomHeight: PANEL_SLICE,
			width: this.tileWidth,
			height: this.tileHeight,
			anchor: 0.5,
		});

		this.icon = new Sprite();
		this.icon.anchor.set(0.5);

		this.title = new Text({
			text: '',
			style: createTitleStyle(),
			resolution: 2,
			roundPixels: true,
		});
		this.title.anchor.set(0.5);

		this.percentText = new Text({
			text: '0%',
			style: createPercentStyle(),
			resolution: 2,
			roundPixels: true,
		});
		this.percentText.anchor.set(1, 0.5);

		this.comingSoonText = new Text({
			text: 'Coming Soon',
			style: createComingSoonStyle(),
			resolution: 2,
			roundPixels: true,
		});
		this.comingSoonText.anchor.set(0.5);
		this.comingSoonText.visible = false;

		const statStyle = createStatStyle();
		this.firefliesCell = createStatCell(statIcons.fireflies, statStyle);
		this.timeCell = createStatCell(statIcons.time, statStyle);
		this.deathsCell = createStatCell(statIcons.deaths, statStyle);
		this.statsRoot.addChild(this.firefliesCell.root);
		this.statsRoot.addChild(this.dividerLeft);
		this.statsRoot.addChild(this.timeCell.root);
		this.statsRoot.addChild(this.dividerRight);
		this.statsRoot.addChild(this.deathsCell.root);

		this.statusIcon.anchor.set(0.5);

		this.addChild(this.panel);
		this.addChild(this.icon);
		this.addChild(this.title);
		this.addChild(this.barTrack);
		this.addChild(this.barFill);
		this.addChild(this.percentText);
		this.addChild(this.comingSoonText);
		this.addChild(this.statsRoot);
		this.addChild(this.statusIcon);
	}

	public setSummary(summary: EpisodeProgressSummary): void {
		this.summary = summary;

		const iconTexture = this.textures.icons.textures[summary.locationIcon];
		if (iconTexture) {
			this.icon.texture = iconTexture;
			this.icon.visible = true;
		} else {
			console.warn(`ProgressEpisodeRow: missing location icon "${summary.locationIcon}"`);
			this.icon.visible = false;
		}

		const comingSoon = summary.comingSoon;
		const locked = comingSoon || summary.status === 'locked';
		this.panel.texture = locked ? this.textures.panelGray : this.textures.panelLight;
		this.icon.tint = locked ? LOCKED_ICON_TINT : 0xffffff;
		this.statusIcon.texture = comingSoon
			? this.textures.status.locked
			: this.resolveStatusTexture(summary);

		this.title.text = summary.locationTitle;
		this.comingSoonText.visible = comingSoon;
		this.barTrack.visible = !comingSoon;
		this.barFill.visible = !comingSoon;
		this.percentText.visible = !comingSoon;
		this.statsRoot.visible = !comingSoon;
		if (!comingSoon) {
			this.percentText.text = `${formatEpisodeCompletionPercent(summary)}%`;
			this.firefliesCell.value.text = `${summary.bestCollected}/${summary.totalFireflies}`;
			this.timeCell.value.text = formatRunTime(summary.totalTimeSec);
			this.deathsCell.value.text = `${summary.totalDeaths}`;
		}

		this.layoutTile();
	}

	public setLayout(width: number, height: number, portrait: boolean): void {
		this.tileWidth = width;
		this.tileHeight = height;
		this.portrait = portrait;
		this.layoutTile();
	}

	private resolveStatusTexture(summary: EpisodeProgressSummary): Texture {
		if (summary.status === 'complete') {
			return this.textures.status.complete;
		}

		return summary.status === 'open'
			? this.textures.status.open
			: this.textures.status.locked;
	}

	private layoutTile(): void {
		const regions = computeProgressTileRegions(this.tileWidth, this.tileHeight, this.portrait);

		this.panel.width = this.tileWidth;
		this.panel.height = this.tileHeight;

		this.icon.width = regions.iconSize;
		this.icon.height = regions.iconSize;
		this.icon.x = regions.iconCenterX;
		this.icon.y = regions.iconCenterY;

		this.title.style.fontSize = regions.titleFontSize;
		this.title.style.wordWrapWidth = regions.titleMaxWidth;
		this.title.x = regions.titleCenterX;
		this.title.y = regions.titleCenterY;

		if (this.summary?.comingSoon) {
			this.barTrack.clear();
			this.barFill.clear();
			this.layoutComingSoon(regions);
		} else {
			this.layoutBar(regions.barLeft, regions.barCenterY, regions.barWidth, regions.barHeight);
			this.layoutStats(regions.statsLeft, regions.statsCenterY, regions.statsHeight);
		}

		const status = this.statusIcon.texture;
		const aspect = status.height > 0 ? status.width / status.height : 1;
		this.statusIcon.height = regions.statusSize;
		this.statusIcon.width = regions.statusSize * aspect;
		this.statusIcon.x = regions.statusCenterX;
		this.statusIcon.y = regions.statusCenterY;
	}

	private layoutComingSoon(regions: ProgressTileRegions): void {
		this.comingSoonText.style.fontSize = regions.titleFontSize * 0.8;
		this.comingSoonText.x = regions.barLeft + regions.barWidth * 0.5;
		this.comingSoonText.y = (regions.barCenterY + regions.statsCenterY) * 0.5;
	}

	private layoutBar(left: number, centerY: number, width: number, height: number): void {
		const radius = height * 0.5;
		const top = centerY - radius;
		const outline = Math.max(2, height * 0.09);

		this.barTrack.clear()
			.roundRect(left, top, width, height, radius)
			.fill({ color: BAR_TRACK_FILL, alpha: BAR_TRACK_FILL_ALPHA })
			.stroke({ color: BAR_OUTLINE, width: outline, alignment: 0.5, join: 'round' });

		const percent = this.summary ? formatEpisodeCompletionPercent(this.summary) : 0;
		const ratio = Math.max(0, Math.min(1, percent / 100));
		// A pill narrower than its own radius renders as a sliver, so hide the fill instead.
		const fillWidth = ratio > 0 ? Math.max(height, width * ratio) : 0;

		this.barFill.clear();
		if (fillWidth > 0) {
			this.barFill
				.roundRect(left, top, fillWidth, height, radius)
				.fill(createBarFillGradient())
				.stroke({ color: BAR_FILL_OUTLINE, width: outline, alignment: 0.5, join: 'round' });
		}

		this.percentText.style.fontSize = Math.max(10, height * 0.72);
		this.percentText.style.stroke = { color: BAR_TEXT_OUTLINE, alpha: BAR_TEXT_ALPHA, width: Math.max(2, height * 0.1), join: 'round' };

		const pad = height * 0.35;
		const fillRight = left + (fillWidth > 0 ? fillWidth : 0);
		const minRight = left + pad + this.percentText.width;
		const maxRight = left + width - pad;
		this.percentText.x = Math.min(Math.max(fillRight - pad, minRight), maxRight);
		this.percentText.y = centerY;
	}

	private layoutStats(left: number, centerY: number, height: number): void {
		const scale = height / STAT_ICON_SIZE;
		this.statsRoot.scale.set(scale);
		this.statsRoot.x = left;
		this.statsRoot.y = centerY;

		let x = 0;
		this.firefliesCell.root.x = x;
		x += statCellWidth(this.firefliesCell) + STAT_CLUSTER_GAP;

		this.dividerLeft.x = x;
		x += STAT_CLUSTER_GAP;

		this.timeCell.root.x = x;
		x += statCellWidth(this.timeCell) + STAT_CLUSTER_GAP;

		this.dividerRight.x = x;
		x += STAT_CLUSTER_GAP;

		this.deathsCell.root.x = x;
	}
}
