import { z } from 'zod';

/**
 * Level JSON uses authoring coordinates (converted to Pixi/Matter Y-down in loadLevelData):
 * - `y` = height above the bottom of the level (`size.height`).
 * - Platforms / hazards / hints: `x` = left edge, `y` = **top** edge
 *   (ground with `y: 0` sits entirely below the playfield and is not visible).
 * - Spawn / collectibles / exit (points): `x`, `y` = **center**.
 * - Hints store only `kind` + top-left; plate size lives in code per kind.
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

export const platformTypeSchema = z.enum(['ground', 'wall', 'leaf', 'sticky']);
export type PlatformType = z.infer<typeof platformTypeSchema>;

const platformSchema = z.object({
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
	type: platformTypeSchema,
});

const exitSchema = z.object({
	x: z.number(),
	y: z.number(),
	/** Firefly socket count around the portal rim (0–12). Layout uses a fixed 12-slot oval grid. */
	slots: z.number().int().min(0).max(12).default(0),
});

const collectibleSchema = z.object({
	id: z.string(),
	x: z.number(),
	y: z.number(),
	type: z.string(),
});

export const hazardFacingSchema = z.enum(['up', 'down', 'left', 'right']);
export type HazardFacing = z.infer<typeof hazardFacingSchema>;

const hazardSchema = z.object({
	type: z.string(),
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
	/** Spike teeth on this side only; omit for teeth on all four sides. */
	facing: hazardFacingSchema.optional(),
	/** Tooth length as a fraction of the max inward depth (0 = flat rect, 1 = full basis). Default 0.5. */
	length: z.number().min(0).max(1).optional(),
});

export const hintKindSchema = z.enum([
	'move-right',
	'move-left',
	'jump-right',
	'jump-left',
	'jump',
	'crouch',
	'crouchJump-right',
	'crouchJump-left',
	'cling-right',
	'cling-left',
	'dash',
	'glide',
	'flight',
]);
export type HintKind = z.infer<typeof hintKindSchema>;

const hintSchema = z.object({
	kind: hintKindSchema,
	x: z.number(),
	y: z.number(),
});

export const levelSchema = z.object({
	id: z.string(),
	size: sizeSchema,
	spawn: pointSchema,
	exit: exitSchema,
	/** Back-to-front draw order. Engine uses texture + parallax only; `id` is optional designer markup. */
	backgrounds: z.array(backgroundLayerSchema).min(1),
	/** World-space control posters. Drawn behind platforms; size comes from `kind`. */
	hints: z.array(hintSchema).default([]),
	platforms: z.array(platformSchema),
	hazards: z.array(hazardSchema),
	collectibles: z.array(collectibleSchema),
});

/** Parsed level after authoring→runtime conversion (Y-down from top of level). */
export type LevelData = z.infer<typeof levelSchema>;
export type LevelPlatform = z.infer<typeof platformSchema>;
export type LevelExit = z.infer<typeof exitSchema>;
export type LevelHazard = z.infer<typeof hazardSchema>;
export type LevelCollectible = z.infer<typeof collectibleSchema>;
export type LevelBackgroundLayer = z.infer<typeof backgroundLayerSchema>;
export type LevelHintData = z.infer<typeof hintSchema>;
