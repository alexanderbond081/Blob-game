import { levelSchema, LevelData } from './level-schema';
import meadow01 from './levels/meadow-01.json';
import meadow02 from './levels/meadow-02.json';
import meadow03 from './levels/meadow-03.json';
import meadow04 from './levels/meadow-04.json';
import meadow05 from './levels/meadow-05.json';
import meadow06 from './levels/meadow-06.json';
import meadow07 from './levels/meadow-07.json';
import meadow08 from './levels/meadow-08.json';
import meadow13 from './levels/meadow-13.json';
import testlevel from './levels/testlevel-00.json';

const LEVEL_REGISTRY: Record<string, unknown> = {
	'meadow-01': meadow01,
	'meadow-02': meadow02,
	'meadow-03': meadow03,
	'meadow-04': meadow04,
	'meadow-05': meadow05,
	'meadow-06': meadow06,
	'meadow-07': meadow07,
	'meadow-08': meadow08,
	'meadow-13': meadow13,
	'testlevel-00': testlevel,
};

/**
 * Authoring Y (from level bottom) → runtime Y (from level top, Pixi/Matter).
 * Same formula for rect tops and point centers.
 */
const authorYToRuntimeY = (authorY: number, levelHeight: number): number => {
	return levelHeight - authorY;
};

/** Convert JSON authoring coords into the Y-down space entities expect. */
const toRuntimeLevelData = (data: LevelData): LevelData => {
	const levelHeight = data.size.height;

	return {
		...data,
		spawn: {
			x: data.spawn.x,
			y: authorYToRuntimeY(data.spawn.y, levelHeight),
		},
		exit: {
			...data.exit,
			y: authorYToRuntimeY(data.exit.y, levelHeight),
		},
		hints: data.hints.map((hint) => ({
			...hint,
			y: authorYToRuntimeY(hint.y, levelHeight),
		})),
		platforms: data.platforms.map((platform) => ({
			...platform,
			y: authorYToRuntimeY(platform.y, levelHeight),
		})),
		hazards: data.hazards.map((hazard) => {
			if (hazard.type === 'spikes') {
				return {
					...hazard,
					y: authorYToRuntimeY(hazard.y, levelHeight),
				};
			}

			return {
				...hazard,
				from: {
					x: hazard.from.x,
					y: authorYToRuntimeY(hazard.from.y, levelHeight),
				},
				to: {
					x: hazard.to.x,
					y: authorYToRuntimeY(hazard.to.y, levelHeight),
				},
			};
		}),
		collectibles: data.collectibles.map((collectible) => ({
			...collectible,
			y: authorYToRuntimeY(collectible.y, levelHeight),
		})),
		obstacles: data.obstacles.map((obstacle) => {
			if (obstacle.type === 'stone') {
				return {
					...obstacle,
					y: authorYToRuntimeY(obstacle.y, levelHeight),
				};
			}

			// Y-down makes CCW authoring angles clockwise on screen — negate.
			return {
				...obstacle,
				y: authorYToRuntimeY(obstacle.y, levelHeight),
				angle: -obstacle.angle,
			};
		}),
	};
};

export const hasLevelData = (levelId: string): boolean => {
	return levelId in LEVEL_REGISTRY;
};

/** Firefly count from level JSON (authoring data, no runtime Y conversion needed). */
export const countLevelFireflies = (levelId: string): number => {
	const raw = LEVEL_REGISTRY[levelId];
	if (!raw) {
		return 0;
	}

	const parsed = levelSchema.parse(raw);
	let count = 0;
	for (const item of parsed.collectibles) {
		if (item.type === 'firefly') {
			count += 1;
		}
	}

	return count;
};

export const loadLevelData = (levelId: string): LevelData => {
	const raw = LEVEL_REGISTRY[levelId];

	if (!raw) {
		throw new Error(`loadLevelData: unknown level id "${levelId}"`);
	}

	return toRuntimeLevelData(levelSchema.parse(raw));
};
