import { Text, TextStyle } from 'pixi.js';

import { BUILD_INFO } from './build-info.generated';

export { BUILD_INFO };

const formatBuildDate = (): string => BUILD_INFO.builtAt.slice(0, 10);

/** Full label for console and BUILD.txt — sha, buildId, dirty mark */
export const formatBuildLabelFull = (): string => {
	const dirtyMark = BUILD_INFO.gitDirty ? '*' : '';

	if (BUILD_INFO.mode === 'development') {
		return `v${BUILD_INFO.version} · dev · ${BUILD_INFO.gitSha}${dirtyMark}`;
	}

	const head = `v${BUILD_INFO.version} · ${BUILD_INFO.channel} · ${BUILD_INFO.gitSha}${dirtyMark}`;
	return `${head} · ${BUILD_INFO.buildId}`;
};

/** Short label for HUD — version, channel, build date (no time) */
export const formatBuildLabel = (): string => {
	const dirtyMark = BUILD_INFO.gitDirty ? '*' : '';
	const date = formatBuildDate();

	if (BUILD_INFO.mode === 'development') {
		return `v${BUILD_INFO.version} dev ${date}${dirtyMark}`;
	}

	return `v${BUILD_INFO.version} ${BUILD_INFO.channel} ${date}`;
};

export const logBuildInfo = (): void => {
	console.info(`[Fairy Blob] ${formatBuildLabelFull()} (built ${BUILD_INFO.builtAt})`);
};

const VERSION_TEXT_FILL = '#D9B978';
const VERSION_TEXT_SHADOW = '#4A3520';

export const createVersionLabel = (): Text => {
	const label = new Text({
		text: formatBuildLabel(),
		style: new TextStyle({
			fontFamily: 'monospace',
			fontSize: 12,
			fill: VERSION_TEXT_FILL,
			align: 'center',
			dropShadow: {
				alpha: 0.95,
				angle: -Math.PI / 2,
				blur: 0,
				color: VERSION_TEXT_SHADOW,
				distance: 1,
			},
		}),
	});

	label.anchor.set(0.5);
	label.eventMode = 'none';

	return label;
};
