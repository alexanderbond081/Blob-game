/** Almost-fullscreen Progress / Customize panels (landscape-first, portrait reflow). */
const HUB_MARGIN_X = 28;
const HUB_MARGIN_Y = 28;
const HUB_PORTRAIT_TOP_CLEARANCE = 48;

export type HubModalLayout = {
	width: number;
	height: number;
	centerY: number;
};

export const computeHubModalLayout = (
	viewportWidth: number,
	viewportHeight: number,
): HubModalLayout => {
	const portrait = viewportHeight > viewportWidth;

	if (portrait) {
		const width = viewportWidth - HUB_MARGIN_X * 2;
		const height = viewportHeight - HUB_MARGIN_Y * 2 - HUB_PORTRAIT_TOP_CLEARANCE;

		return {
			width,
			height: Math.max(280, height),
			centerY: viewportHeight * 0.52,
		};
	}

	const width = viewportWidth - HUB_MARGIN_X * 2;
	const height = viewportHeight - HUB_MARGIN_Y * 2;

	return {
		width: Math.max(400, width),
		height: Math.max(320, height),
		centerY: viewportHeight * 0.5,
	};
};

/** Title band offset from panel center (hub modals). */
export const hubModalTitleY = (panelHeight: number): number => {
	return -panelHeight * 0.5 + 70;
};

export const isPortraitViewport = (viewportWidth: number, viewportHeight: number): boolean => {
	return viewportHeight > viewportWidth;
};
