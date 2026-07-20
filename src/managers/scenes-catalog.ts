import { Scene } from '../scenes/scene';
import { PlatformLevelScene } from '../scenes/platform-level-scene';

export type GameSceneCreateArgs = Record<string, unknown>;

export interface GameSceneCatalogEntry {
	id: string;
	title: string;
	assetBundle: string;
	createScene: (args?: GameSceneCreateArgs) => Scene;
}

const createForestScene = (_args?: GameSceneCreateArgs): Scene => {
	return new PlatformLevelScene('forest-01');
};

export const gameSceneCatalog: GameSceneCatalogEntry[] = [
	{
		id: 'main-scene',
		title: 'Forest',
		assetBundle: 'main-scene',
		createScene: createForestScene,
	},
];
