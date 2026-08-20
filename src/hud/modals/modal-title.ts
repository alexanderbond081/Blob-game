import { Text, TextStyle } from 'pixi.js';

/** Dark-brown italic titles on pause / result / hub modals. */
export const MODAL_TITLE_FILL = 0x4a2c14;

/** Dark brown on graydirt OK buttons — cream washed out on phones. */
export const MODAL_OK_LABEL_FILL = 0x4a2c14;

const MODAL_TITLE_FONT = 'Arial, Helvetica, sans-serif';

const createModalTitleStyle = (fontSize: number): TextStyle => {
	return new TextStyle({
		fontFamily: MODAL_TITLE_FONT,
		fontSize,
		fontStyle: 'italic',
		fontWeight: 'bold',
		fill: MODAL_TITLE_FILL,
		align: 'center',
		stroke: { color: 0xf5e6c8, width: 4, join: 'round' },
	});
};

const createModalOkLabelStyle = (): TextStyle => {
	return new TextStyle({
		fontFamily: MODAL_TITLE_FONT,
		fontSize: 26,
		fontWeight: 'bold',
		fill: MODAL_OK_LABEL_FILL,
		align: 'center',
		stroke: { color: 0xf5e6c8, width: 3, join: 'round' },
	});
};

export const createModalTitle = (label: string, fontSize = 42): Text => {
	const text = new Text({
		text: label,
		style: createModalTitleStyle(fontSize),
		resolution: 2,
		roundPixels: true,
	});
	text.anchor.set(0.5);
	text.eventMode = 'none';
	return text;
};

export const createModalOkLabel = (): Text => {
	const text = new Text({
		text: 'Ok',
		style: createModalOkLabelStyle(),
		resolution: 2,
		roundPixels: true,
	});
	text.anchor.set(0.5);
	text.eventMode = 'none';
	return text;
};

export const formatRunTime = (seconds: number): string => {
	const total = Math.max(0, Math.floor(seconds));
	const minutes = Math.floor(total / 60);
	const secs = total % 60;
	return `${minutes}:${secs.toString().padStart(2, '0')}`;
};
