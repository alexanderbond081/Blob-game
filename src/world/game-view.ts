/**
 * Playfield is a locked 16:9 (landscape) or 9:16 (portrait) camera.
 * The Pixi canvas fills the host iframe; the playfield is contain-scaled
 * and centered. Letterbox around it is filled by unclipped backgrounds, not
 * by a mask. HUD chrome uses the same scale as the world but is origin'd at
 * the canvas corner so buttons sit on the iframe edges.
 *
 * Raise both PORTRAIT_VIEW_* by the same factor to pull the camera back
 * (more world in the 9:16 frame) if the 540-wide view is too tight.
 */

export const LANDSCAPE_VIEW_WIDTH = 960;
export const LANDSCAPE_VIEW_HEIGHT = 540;
export const PORTRAIT_VIEW_WIDTH = 540;
export const PORTRAIT_VIEW_HEIGHT = 960;

/**
 * Logical extra around the playfield that art should cover so 21:9 phones
 * and ~1:1 fold inners do not show the renderer clear color.
 */
export const VIEW_BLEED = 240;

export type GameViewLayout = {
	clientWidth: number;
	clientHeight: number;
	isPortrait: boolean;
	/** Locked camera / Matter view (960×540 or 540×960). */
	viewWidth: number;
	viewHeight: number;
	/** Playfield → canvas contain scale. */
	scale: number;
	/** Playfield origin in canvas pixels. */
	offsetX: number;
	offsetY: number;
	/** Letterbox in playfield pixels (canvas / scale − view). */
	padLeft: number;
	padRight: number;
	padTop: number;
	padBottom: number;
	/** Full iframe in playfield pixels (view + pads). */
	screenWidth: number;
	screenHeight: number;
};

const initialLayout = (): GameViewLayout => {
	return {
		clientWidth: LANDSCAPE_VIEW_WIDTH,
		clientHeight: LANDSCAPE_VIEW_HEIGHT,
		isPortrait: false,
		viewWidth: LANDSCAPE_VIEW_WIDTH,
		viewHeight: LANDSCAPE_VIEW_HEIGHT,
		scale: 1,
		offsetX: 0,
		offsetY: 0,
		padLeft: 0,
		padRight: 0,
		padTop: 0,
		padBottom: 0,
		screenWidth: LANDSCAPE_VIEW_WIDTH,
		screenHeight: LANDSCAPE_VIEW_HEIGHT,
	};
};

let currentLayout: GameViewLayout = initialLayout();

export const getGameView = (): GameViewLayout => currentLayout;

export const setGameView = (layout: GameViewLayout): void => {
	currentLayout = layout;
};

export const computeGameView = (clientWidth: number, clientHeight: number): GameViewLayout => {
	const isPortrait = clientHeight > clientWidth;
	const viewWidth = isPortrait ? PORTRAIT_VIEW_WIDTH : LANDSCAPE_VIEW_WIDTH;
	const viewHeight = isPortrait ? PORTRAIT_VIEW_HEIGHT : LANDSCAPE_VIEW_HEIGHT;
	const width = Math.max(1, clientWidth);
	const height = Math.max(1, clientHeight);
	const scale = Math.min(width / viewWidth, height / viewHeight);
	const offsetX = (width - viewWidth * scale) * 0.5;
	const offsetY = (height - viewHeight * scale) * 0.5;
	const padLeft = offsetX / scale;
	const padTop = offsetY / scale;
	const screenWidth = width / scale;
	const screenHeight = height / scale;

	return {
		clientWidth: width,
		clientHeight: height,
		isPortrait,
		viewWidth,
		viewHeight,
		scale,
		offsetX,
		offsetY,
		padLeft,
		padRight: padLeft,
		padTop,
		padBottom: padTop,
		screenWidth,
		screenHeight,
	};
};
