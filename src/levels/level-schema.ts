import { z } from 'zod';

const sizeSchema = z.object({
	width: z.number().positive(),
	height: z.number().positive(),
});

const pointSchema = z.object({
	x: z.number(),
	y: z.number(),
});

const backgroundLayerSchema = z.object({
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

export const levelSchema = z.object({
	id: z.string(),
	size: sizeSchema,
	spawn: pointSchema,
	backgrounds: z.object({
		far: backgroundLayerSchema,
		mid: backgroundLayerSchema,
	}),
	platforms: z.array(platformSchema),
	collectibles: z.array(collectibleSchema),
});

export type LevelData = z.infer<typeof levelSchema>;
export type LevelPlatform = z.infer<typeof platformSchema>;
export type LevelCollectible = z.infer<typeof collectibleSchema>;
