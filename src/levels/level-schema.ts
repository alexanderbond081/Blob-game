import { z } from 'zod';

/**
 * Level JSON uses authoring coordinates (converted to Pixi/Matter Y-down in loadLevelData):
 * - `y` = height above the bottom of the level (`size.height`).
 * - Platforms / spike hazards / hints: `x` = left edge, `y` = **top** edge
 *   (ground with `y: 0` sits entirely below the playfield and is not visible).
 * - Spawn / collectibles / exit / patrol `from`/`to`: `x`, `y` = **center**.
 * - Obstacles: stone `x`,`y` = **center**; branch `x`,`y` = **center of one end**.
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
	/** `sky` → centered plate; other ids are designer markup (far / mid / …). */
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

export const patrolHazardTypeSchema = z.enum(['caterpillar', 'spider', 'mosquito']);
export type PatrolHazardType = z.infer<typeof patrolHazardTypeSchema>;

const spikeHazardSchema = z.object({
	type: z.literal('spikes'),
	x: z.number(),
	y: z.number(),
	width: z.number().positive(),
	height: z.number().positive(),
	/** Spike teeth on this side only; omit for teeth on all four sides. */
	facing: hazardFacingSchema.optional(),
	/** Tooth length as a fraction of the max inward depth (0 = flat rect, 1 = full basis). Default 0.5. */
	length: z.number().min(0).max(1).optional(),
});

const patrolHazardSchema = z.object({
	type: patrolHazardTypeSchema,
	/** Rest-pose body centers; the enemy ping-pongs (or climbs) between these. */
	from: pointSchema,
	to: pointSchema,
	/** Travel speed in world pixels per second. */
	speed: z.number().positive(),
});

const hazardSchema = z.discriminatedUnion('type', [spikeHazardSchema, patrolHazardSchema]);

/**
 * Dynamic walkable props (push / fall / roll; they do not kill).
 *
 * Ogmo export:
 * - Stone: entity `width` is the diameter → runtime `size`. Ignore `originX` / `originY`
 *   (`x`,`y` is already the origin, typically the centre).
 * - Branch: unrotated rect is vertical (`width` = thickness, `height` = length).
 *   `rotation` is **radians** (0 = hanging down). `x`,`y` is the pivot end (top of the
 *   unrotated rect — the upper / right end after a lean). Authoring angle:
 *   `-90 - rotation * 180/π` (0 = right, CCW, Y-up).
 */
const stoneObstacleSchema = z.object({
	type: z.literal('stone'),
	x: z.number(),
	y: z.number(),
	/** Diameter in world pixels (not radius). */
	size: z.number().positive(),
});

const branchObstacleSchema = z.object({
	type: z.literal('branch'),
	/** Center of the start end-cap. */
	x: z.number(),
	y: z.number(),
	length: z.number().positive(),
	/** Cylinder diameter. */
	thickness: z.number().positive(),
	/** Degrees; 0 = right; CCW in authoring (Y-up). Loader negates after the Y-flip. */
	angle: z.number(),
});

const obstacleSchema = z.discriminatedUnion('type', [stoneObstacleSchema, branchObstacleSchema]);

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
	/** Dynamic stones / branches. Missing key → []. */
	obstacles: z.array(obstacleSchema).default([]),
	collectibles: z.array(collectibleSchema),
});

/** Parsed level after authoring→runtime conversion (Y-down from top of level). */
export type LevelData = z.infer<typeof levelSchema>;
export type LevelPlatform = z.infer<typeof platformSchema>;
export type LevelExit = z.infer<typeof exitSchema>;
export type LevelHazard = z.infer<typeof hazardSchema>;
export type LevelSpikeHazard = z.infer<typeof spikeHazardSchema>;
export type LevelPatrolHazard = z.infer<typeof patrolHazardSchema>;
export type LevelCollectible = z.infer<typeof collectibleSchema>;
export type LevelObstacle = z.infer<typeof obstacleSchema>;
export type LevelStoneObstacle = z.infer<typeof stoneObstacleSchema>;
export type LevelBranchObstacle = z.infer<typeof branchObstacleSchema>;
export type LevelBackgroundLayer = z.infer<typeof backgroundLayerSchema>;
export type LevelHintData = z.infer<typeof hintSchema>;
