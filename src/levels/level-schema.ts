import { z } from 'zod';

/**
 * Level JSON uses authoring coordinates (converted to Pixi/Matter Y-down in loadLevelData):
 * - `y` = height above the bottom of the level (`size.height`).
 * - Platforms / hazards: `x` = left edge, `y` = **top** edge
 *   (ground with `y: 0` sits entirely below the playfield and is not visible).
 * - Spawn / collectibles (points): `x`, `y` = **center**.
 */

const sizeSchema = z.object({
	width: z.number().positive(),
	height: z.number().positive(),
});

const pointSchema = z.object({
	x: z.number(),
	y: z.number(),
});

const backgroundLayerSchema = z.object({
	/** Designer label only (far / mid / near / …). Ignored by the runtime. */
	id: z.string().optional(),
	texture: z.string(),
	/** Parallax factor for both X and Y camera axes (0 = fixed to viewport, 1 = world-locked). */
	parallax: z.number().min(0).max(1),
});

const platformSchema = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
	label: z.string().optional(),
});

const collectibleSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	type: z.string(),
});

const hazardSchema = z.object({
	type: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
});

export const levelSchema = z.object({
	id: z.string(),
	size: sizeSchema,
	spawn: pointSchema,
	/** Back-to-front draw order. Engine uses texture + parallax only; `id` is optional designer markup. */
	backgrounds: z.array(backgroundLayerSchema).min(1),
	platforms: z.array(platformSchema),
	hazards: z.array(hazardSchema),
	collectibles: z.array(collectibleSchema),
});

/** Parsed level after authoring→runtime conversion (Y-down from top of level). */
export type LevelData = z.infer<typeof levelSchema>;
export type LevelPlatform = z.infer<typeof platformSchema>;
export type LevelHazard = z.infer<typeof hazardSchema>;
export type LevelCollectible = z.infer<typeof collectibleSchema>;
export type LevelBackgroundLayer = z.infer<typeof backgroundLayerSchema>;
