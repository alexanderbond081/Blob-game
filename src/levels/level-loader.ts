import { levelSchema, LevelData } from './level-schema';
import forest01 from './levels/forest-01.json';

const LEVEL_REGISTRY: Record<string, unknown> = {
	'forest-01': forest01,
};

export const loadLevelData = (levelId: string): LevelData => {
	const raw = LEVEL_REGISTRY[levelId];

	if (!raw) {
		throw new Error(`loadLevelData: unknown level id "${levelId}"`);
	}

	return levelSchema.parse(raw);
};
