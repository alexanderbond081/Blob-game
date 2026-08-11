import { Scene } from '../scenes/scene';
import { PlatformLevelScene } from '../scenes/platform-level-scene';
import { countLevelFireflies, hasLevelData } from '../levels/level-loader';

export type GameSceneCreateArgs = Record<string, unknown>;

/**
 * Static playable-level registry: launch info + carousel art.
 * Unlock / stats / last-played live in GameProgress, not here.
 */
export interface GameSceneCatalogEntry {
	id: string;
	title: string;
	assetBundle: string;
	/** Frame name inside the `location-icons` spritesheet. */
	locationIcon: string;
	createScene: (args?: GameSceneCreateArgs) => Scene;
}

export const gameSceneCatalog: GameSceneCatalogEntry[] = [
	{
		id: 'meadow-01',
		title: 'Meadow',
		assetBundle: 'meadow-scene',
		locationIcon: 'meadow',
		createScene: () => new PlatformLevelScene('meadow-01'),
	},
	{
		id: 'testlevel-00',
		title: 'Forest',
		// JSON currently shares meadow backgrounds; swap back to test-scene when those art assets return.
		assetBundle: 'test-scene',
		locationIcon: 'forest',
		createScene: () => new PlatformLevelScene('testlevel-00'),
	},
];

export const findGameScene = (sceneId: string): GameSceneCatalogEntry | undefined => {
	return gameSceneCatalog.find((entry) => entry.id === sceneId);
};

export const findGameSceneIndex = (sceneId: string): number => {
	return gameSceneCatalog.findIndex((entry) => entry.id === sceneId);
};

/** Total fireflies for carousel UI; 0 if level JSON is not registered yet. */
export const getLevelTotalFireflies = (levelId: string): number => {
	if (!hasLevelData(levelId)) {
		return 0;
	}

	return countLevelFireflies(levelId);
};

/**
 * Next catalog entry after `levelId` that passes `isUnlocked`.
 * Order = `gameSceneCatalog` array order (linear map).
 */
export const getNextGameSceneId = (
	levelId: string,
	isUnlocked: (id: string) => boolean,
): string | null => {
	const index = findGameSceneIndex(levelId);
	if (index < 0) {
		return null;
	}

	for (let i = index + 1; i < gameSceneCatalog.length; i += 1) {
		const entry = gameSceneCatalog[i];
		if (isUnlocked(entry.id)) {
			return entry.id;
		}
	}

	return null;
};
