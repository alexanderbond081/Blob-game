export type SkinCatalogEntry = {
	id: string;
	displayName: string;
	/** Spritesheet alias from `src/assets/manifest.json`. */
	blobSheetAlias: string;
};

export const skinsCatalog: SkinCatalogEntry[] = [
	{ id: 'default', displayName: 'Default', blobSheetAlias: 'blob' },
	{ id: 'green', displayName: 'Green', blobSheetAlias: 'blob-green' },
	{ id: 'pink', displayName: 'Pink', blobSheetAlias: 'blob-pink' },
	{ id: 'red', displayName: 'Red', blobSheetAlias: 'blob-red' },
];

/** Demo/test UI: first three catalog skins start unlocked. */
export const DEFAULT_UNLOCKED_SKIN_IDS = skinsCatalog.slice(0, 3).map((entry) => entry.id);

export const skinById = new Map<string, SkinCatalogEntry>(skinsCatalog.map((e) => [e.id, e]));

