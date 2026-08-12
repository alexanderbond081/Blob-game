import { MAX_PROGRESS_EPISODES } from '../../managers/progress-episodes';
import { hubModalTitleY } from './hub-modal-layout';

const GRID_SIDE_PAD = 8;
const GRID_BOTTOM_PAD = 64;
const GRID_BELOW_TITLE = 36;

export type ProgressGridLayout = {
	columns: number;
	rows: number;
	cellWidth: number;
	cellHeight: number;
	originX: number;
	originY: number;
};

export const computeProgressGridLayout = (
	contentWidth: number,
	panelHeight: number,
	portrait: boolean,
): ProgressGridLayout => {
	const columns = portrait ? 1 : 2;
	const rows = portrait ? MAX_PROGRESS_EPISODES : MAX_PROGRESS_EPISODES / columns;

	const gridTop = hubModalTitleY(panelHeight) + GRID_BELOW_TITLE;
	const gridBottom = panelHeight * 0.5 - GRID_BOTTOM_PAD;
	const gridHeight = Math.max(120, gridBottom - gridTop);
	const gridWidth = contentWidth - GRID_SIDE_PAD * 2;

	return {
		columns,
		rows,
		cellWidth: gridWidth / columns,
		cellHeight: gridHeight / rows,
		originX: -gridWidth / 2,
		originY: gridTop,
	};
};

/** Column-first fill: down the first column, then the next. */
export const progressGridSlotPosition = (
	slotIndex: number,
	grid: ProgressGridLayout,
): { x: number; y: number } => {
	const col = Math.floor(slotIndex / grid.rows);
	const row = slotIndex % grid.rows;

	return {
		x: grid.originX + col * grid.cellWidth + grid.cellWidth / 2,
		y: grid.originY + row * grid.cellHeight + grid.cellHeight / 2,
	};
};
