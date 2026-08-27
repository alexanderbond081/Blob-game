export type SkinCatalogEntry = {
	id: string;
	displayName: string;
	/** Spritesheet alias from `src/assets/manifest.json`. */
	blobSheetAlias: string;
	/** Droplet spritesheet alias (burst FX). Same frame names for every skin. */
	dropletAlias: string;
};

export const skinsCatalog: SkinCatalogEntry[] = [
	{ id: 'default', displayName: 'Default', blobSheetAlias: 'blob', dropletAlias: 'blob-droplet' },
	{ id: 'green', displayName: 'Green', blobSheetAlias: 'blob-green', dropletAlias: 'blob-droplet' },
	{ id: 'pink', displayName: 'Pink', blobSheetAlias: 'blob-pink', dropletAlias: 'blob-droplet' },
	{ id: 'red', displayName: 'Red', blobSheetAlias: 'blob-red', dropletAlias: 'blob-droplet' },
];

/** Demo/test UI: first three catalog skins start unlocked. */
export const DEFAULT_UNLOCKED_SKIN_IDS = skinsCatalog.slice(0, 4).map((entry) => entry.id);

export const skinById = new Map<string, SkinCatalogEntry>(skinsCatalog.map((e) => [e.id, e]));

export const resolveSkin = (skinId: string): SkinCatalogEntry => {
	return skinById.get(skinId) ?? skinsCatalog[0];
};
