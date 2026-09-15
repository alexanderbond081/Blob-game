import { Graphics } from 'pixi.js';

/**
 * 2× matches the rest of the art. Rasterize in the Graphics' local space
 * (identity). Parent rotation is applied later when the quad is drawn —
 * never bake a world/spawn angle into the texture (stair-stepped edges).
 */
const BAKE_RESOLUTION = 2;

/** Rasterize a static Graphics once; later frames submit a quad. */
export const bakeStaticGraphics = (graphics: Graphics): void => {
	graphics.cacheAsTexture({
		resolution: BAKE_RESOLUTION,
		antialias: false,
	});
};
