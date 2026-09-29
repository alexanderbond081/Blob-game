import { Sprite } from 'pixi.js';

import { LevelTraceData } from '../../levels/level-schema';
import { requireHintTexture } from './hint-layout';

/** Faint so the meadow shows through full-white outline art. */
const TRACE_ALPHA = 0.8;

/** Static world-space outline. Top-left is the texture origin; size comes from the asset. */
export class LevelTrace extends Sprite {
	public constructor(data: LevelTraceData) {
		super(requireHintTexture(data.texture));
		this.eventMode = 'none';
		this.alpha = TRACE_ALPHA;
		this.position.set(data.x, data.y);
	}
}
