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
		id: 'testlevel-00',
		title: 'test',
		assetBundle: 'test-scene',
		createScene: () => new PlatformLevelScene('testlevel-00'),
	},
];

export const findGameScene = (sceneId: string): GameSceneCatalogEntry | undefined => {
	return gameSceneCatalog.find((entry) => entry.id === sceneId);
};
