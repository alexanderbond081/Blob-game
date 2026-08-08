/**
 * Static level list for the main-menu carousel.
 *
 * STUB / WIP: `unlocked` is hardcoded and `getCollectedFireflies` always
 * returns 0. There is no GameProgress or save layer yet — those land on
 * stage D (see plans: Poki UI workflow A2 → D). Until then this file is
 * metadata for UI only; do not treat unlocks/collected as persistent state.
 *
 * `sceneId: null` means the level art/scene is not built yet (locked stub tile).
 */
export interface LevelCatalogEntry {
	/** Stable id used by progress storage (when GameProgress exists). */
	id: string;
	/** Scene id in the scene catalog; null while the level is not built yet. */
	sceneId: string | null;
	title: string;
	/** Frame name inside the `location-icons` spritesheet. */
	locationIcon: string;
	totalFireflies: number;
	/** Hardcoded until GameProgress drives unlocks from save data. */
	unlocked: boolean;
}

/** Carousel data for stage A — not wired to saves. */
export const levelCatalog: LevelCatalogEntry[] = [
	{ id: 'testlevel-00', sceneId: 'testlevel-00', title: 'Forest', locationIcon: 'forest', totalFireflies: 9, unlocked: true },
	{ id: 'meadow-01', sceneId: null, title: 'Meadow', locationIcon: 'meadow', totalFireflies: 12, unlocked: false },
	{ id: 'stream-01', sceneId: null, title: 'Stream', locationIcon: 'stream', totalFireflies: 12, unlocked: false },
	{ id: 'mushroom-01', sceneId: null, title: 'Mushrooms', locationIcon: 'mushroom', totalFireflies: 12, unlocked: false },
	{ id: 'cave-01', sceneId: null, title: 'Cave', locationIcon: 'cave', totalFireflies: 12, unlocked: false },
	{ id: 'house-01', sceneId: null, title: 'Home', locationIcon: 'house', totalFireflies: 12, unlocked: false },
];

export const isLevelPlayable = (entry: LevelCatalogEntry): boolean => {
	return entry.unlocked && entry.sceneId !== null;
};

/** Placeholder until GameProgress lands (stage D). Always 0 for now. */
export const getCollectedFireflies = (_levelId: string): number => 0;

export const findFirstPlayableIndex = (): number => {
	const index = levelCatalog.findIndex(isLevelPlayable);
	return index < 0 ? 0 : index;
};
