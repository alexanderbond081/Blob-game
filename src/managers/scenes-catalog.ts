import { Scene } from '../scenes/scene';
import { PlatformLevelScene } from '../scenes/platform-level-scene';

export type GameSceneCreateArgs = Record<string, unknown>;

export interface GameSceneCatalogEntry {
	id: string;
	title: string;
	assetBundle: string;
	createScene: (args?: GameSceneCreateArgs) => Scene;
}

export const gameSceneCatalog: GameSceneCatalogEntry[] = [
	{
		id: 'forest-01',
		title: 'Forest',
		assetBundle: 'play-scene',
		createScene: () => new PlatformLevelScene('forest-01'),
	},
];

export const findGameScene = (sceneId: string): GameSceneCatalogEntry | undefined => {
	return gameSceneCatalog.find((entry) => entry.id === sceneId);
};
