import { levelSchema, LevelData } from './level-schema';
import meadow01 from './levels/meadow-01.json';
import testlevel from './levels/testlevel-00.json';

const LEVEL_REGISTRY: Record<string, unknown> = {
	'meadow-01': meadow01,
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
		platforms: data.platforms.map((platform) => ({
			...platform,
			y: authorYToRuntimeY(platform.y, levelHeight),
		})),
		hazards: data.hazards.map((hazard) => ({
			...hazard,
			y: authorYToRuntimeY(hazard.y, levelHeight),
		})),
		collectibles: data.collectibles.map((collectible) => ({
			...collectible,
			y: authorYToRuntimeY(collectible.y, levelHeight),
		})),
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
