import { Text, TextStyle } from 'pixi.js';

/** Dark-brown cartoon italic used on pause / result modal titles. */
export const MODAL_TITLE_FILL = 0x4a2c14;

/** Light cream label on graydirt OK buttons. */
export const MODAL_OK_LABEL_FILL = 0xe8dcc8;

const createModalTitleStyle = (fontSize: number): TextStyle => {
	return new TextStyle({
		fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive',
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
		fontFamily: '"Comic Sans MS", "Chalkboard SE", "Marker Felt", cursive',
		fontSize: 26,
		fontWeight: 'bold',
		fill: MODAL_OK_LABEL_FILL,
		align: 'center',
		stroke: { color: 0x5c4a32, width: 2, join: 'round' },
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
