import { Scene } from '../scenes/scene';
import { MainGameScene } from '../scenes/main-game-scene';

export type GameSceneCreateArgs = Record<string, unknown>;

export interface GameSceneCatalogEntry {
	id: string;
	title: string;
	assetBundle: string;
	createScene: (args?: GameSceneCreateArgs) => Scene;
}

const createForestScene = (args?: GameSceneCreateArgs): Scene => {
	return new MainGameScene();
};

export const gameSceneCatalog: GameSceneCatalogEntry[] = [
	{
		id: 'main-scene',
		title: 'Forest',
		assetBundle: 'main-scene',
		createScene: createForestScene,
	},
];
