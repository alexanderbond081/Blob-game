import { Container, Sprite, Spritesheet, Text, TextStyle } from 'pixi.js';

import { EpisodeProgressSummary, formatEpisodeStatsLine } from '../../managers/progress-episodes';
import { MODAL_TITLE_FILL } from './modal-title';

const EPISODE_ICON_SIZE = 100;
const ICON_TEXT_GAP = 16;

const createStatsStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: 'Arial',
		fontSize: 24,
		fontWeight: 'bold',
		fill: MODAL_TITLE_FILL,
		align: 'left',
		stroke: { color: 0xf5e6c8, width: 3, join: 'round' },
	});
};

export class ProgressEpisodeRow extends Container {
	private readonly icon: Sprite;
	private readonly statsText: Text;

	public constructor(iconSheet: Spritesheet) {
		super();

		this.icon = new Sprite();
		this.icon.anchor.set(0.5);

		this.statsText = new Text({
			text: '',
			style: createStatsStyle(),
			resolution: 2,
			roundPixels: true,
		});
		this.statsText.anchor.set(0, 0.5);

		this.addChild(this.icon);
		this.addChild(this.statsText);
		this.visible = false;
	}

	public setSummary(summary: EpisodeProgressSummary, iconSheet: Spritesheet): void {
		const texture = iconSheet.textures[summary.locationIcon];
		if (!texture) {
			console.warn(`ProgressEpisodeRow: missing location icon "${summary.locationIcon}"`);
			this.visible = false;
			return;
		}

		this.icon.texture = texture;
		this.icon.width = EPISODE_ICON_SIZE;
		this.icon.height = EPISODE_ICON_SIZE;
		this.statsText.text = formatEpisodeStatsLine(summary);
		this.layoutRow();
		this.visible = true;
	}

	public hideRow(): void {
		this.visible = false;
	}

	private layoutRow(): void {
		const textWidth = this.statsText.width;
		const rowWidth = EPISODE_ICON_SIZE + ICON_TEXT_GAP + textWidth;

		this.icon.x = -rowWidth / 2 + EPISODE_ICON_SIZE / 2;
		this.statsText.x = -rowWidth / 2 + EPISODE_ICON_SIZE + ICON_TEXT_GAP;
	}
}
