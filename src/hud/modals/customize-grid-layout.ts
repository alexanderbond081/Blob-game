import { hubModalTitleY } from './hub-modal-layout';

const CHARACTER_SIZE = 80;
const CHARACTER_GAP = 40;
const TILE_STEP = CHARACTER_SIZE + CHARACTER_GAP;
/** Horizontal margin from the panel content edges to the first/last skin column. */
const EDGE_PAD_X = 60;
/** Vertical gap between the title band and the first skin row. */
const EDGE_PAD_Y = 100;

export type CustomizeGridLayout = {
	columns: number;
	rows: number;
	tileSize: number;
	tileStep: number;
	originX: number;
	originY: number;
};

export const getCustomizeTileGeometry = (): {
	characterSize: number;
	characterGap: number;
} => {
	return { characterSize: CHARACTER_SIZE, characterGap: CHARACTER_GAP };
};

export const computeCustomizeGridLayout = (
	contentWidth: number,
	panelHeight: number,
): CustomizeGridLayout => {
	// Fill left -> right, top -> bottom.
	const tileSize = CHARACTER_SIZE;
	const usableWidth = contentWidth - EDGE_PAD_X * 2;
	const columns = Math.max(1, Math.floor(usableWidth / TILE_STEP));
	const rows = Math.max(1, Math.floor((panelHeight - 160) / TILE_STEP));

	// Place under title band.
	const originY = hubModalTitleY(panelHeight) + EDGE_PAD_Y + tileSize / 2;
	const originX = -contentWidth / 2 + EDGE_PAD_X + tileSize / 2;

	return {
		columns,
		rows,
		tileSize,
		tileStep: TILE_STEP,
		originX,
		originY,
	};
};

export const computeCustomizeTilePosition = (
	tileIndex: number,
	grid: CustomizeGridLayout,
): { x: number; y: number } => {
	const col = tileIndex % grid.columns;
	const row = Math.floor(tileIndex / grid.columns);

	return {
		x: grid.originX + col * grid.tileStep,
		y: grid.originY + row * grid.tileStep,
	};
};

