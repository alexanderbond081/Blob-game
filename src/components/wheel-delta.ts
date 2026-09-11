import { FederatedWheelEvent } from 'pixi.js';

/** Firefox can report wheel travel in lines or pages instead of pixels. */
const WHEEL_LINE_PX = 40;
const WHEEL_PAGE_PX = 400;

/** Wheel travel in design pixels, whatever unit the browser reports. */
export const normalizeWheelDelta = (event: FederatedWheelEvent): number => {
	if (event.deltaMode === FederatedWheelEvent.DOM_DELTA_LINE) {
		return event.deltaY * WHEEL_LINE_PX;
	}

	if (event.deltaMode === FederatedWheelEvent.DOM_DELTA_PAGE) {
		return event.deltaY * WHEEL_PAGE_PX;
	}

	return event.deltaY;
};
