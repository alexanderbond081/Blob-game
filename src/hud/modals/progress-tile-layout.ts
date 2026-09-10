/**
 * Episode tile geometry, in tile-local coordinates with the origin at the tile centre.
 * Ratios are taken from the landscape / portrait mock-ups, so a tile keeps its
 * proportions at any panel width.
 */
export type ProgressTileRegions = {
	iconCenterX: number;
	iconCenterY: number;
	iconSize: number;
	titleCenterX: number;
	titleCenterY: number;
	titleMaxWidth: number;
	titleFontSize: number;
	barLeft: number;
	barCenterY: number;
	barWidth: number;
	barHeight: number;
	statsLeft: number;
	statsCenterY: number;
	statsHeight: number;
	statusCenterX: number;
	statusCenterY: number;
	statusSize: number;
};

export const PROGRESS_TILE_GAP = 14;

const LANDSCAPE_ASPECT = 0.2
const LANDSCAPE_MIN_HEIGHT = 110;
const LANDSCAPE_MAX_HEIGHT = 110;

const PORTRAIT_ASPECT = 0.6;
const PORTRAIT_MIN_HEIGHT = 240;
const PORTRAIT_MAX_HEIGHT = 240;

const clamp = (value: number, min: number, max: number): number => {
	return value < min ? min : (value > max ? max : value);
};

export const computeProgressTileHeight = (tileWidth: number, portrait: boolean): number => {
	if (portrait) {
		return clamp(tileWidth * PORTRAIT_ASPECT, PORTRAIT_MIN_HEIGHT, PORTRAIT_MAX_HEIGHT);
	}

	return clamp(tileWidth * LANDSCAPE_ASPECT, LANDSCAPE_MIN_HEIGHT, LANDSCAPE_MAX_HEIGHT);
};

/** Landscape: icon | (title over bar over stats) | status, all on one line. */
const landscapeRegions = (w: number, h: number): ProgressTileRegions => {
	return {
		iconCenterX: -0.5 * w + 0.81 * h, //-0.326 * w,
		iconCenterY: 0,
		iconSize: 0.81 * h,
		titleCenterX: 0.022 * w,
		titleCenterY: -0.327 * h,
		titleMaxWidth: 0.42 * w,
		titleFontSize: 0.19 * h,
		barLeft: -0.189 * w,
		barCenterY: -0.047 * h,
		barWidth: 0.424 * w,
		barHeight: 0.168 * h,
		statsLeft: -0.167 * w,
		statsCenterY: 0.218 * h,
		statsHeight: 0.21 * h,
		statusCenterX: 0.5 * w - 0.53 * h, //0.404 * w,
		statusCenterY: 0,
		statusSize: 0.53 * h,
	};
};

/** Portrait: icon + title share the top row, bar and stats sit below, status stays right. */
const portraitRegions = (w: number, h: number): ProgressTileRegions => {
	return {
		iconCenterX: -0.5 * w + 0.4 * h,
		iconCenterY: -0.2 * h,
		iconSize: 0.44 * h,
		titleCenterX: 0.1 * h, //0.11 * w,
		titleCenterY: -0.2 * h,
		titleMaxWidth: 0.34 * w,
		titleFontSize: 0.125 * h,
		barLeft: -0.5 * w + 0.15 * h, //-0.434 * w,
		barCenterY: 0.1 * h,
		barWidth: 0.8 * w - 0.2 * h, //0.69 * w,
		barHeight: 0.091 * h,
		statsLeft: -0.5 * w + 0.2 * h, //-0.431 * w,
		statsCenterY: 0.284 * h,
		statsHeight: 0.117 * h,
		statusCenterX: 0.386 * w,
		statusCenterY: 0,
		statusSize: 0.221 * h,
	};
};

export const computeProgressTileRegions = (
	width: number,
	height: number,
	portrait: boolean,
): ProgressTileRegions => {
	return portrait ? portraitRegions(width, height) : landscapeRegions(width, height);
};
