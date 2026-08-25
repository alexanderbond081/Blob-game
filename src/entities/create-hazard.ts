import { LevelHazard } from '../levels/level-schema';
import { CaterpillarHazard } from './caterpillar-hazard';
import { Hazard, SpikeHazard } from './hazard';
import { MosquitoHazard } from './mosquito-hazard';
import { SpiderHazard } from './spider-hazard';

export const createHazard = (data: LevelHazard): Hazard => {
	switch (data.type) {
		case 'spikes':
			return new SpikeHazard(data);
		case 'caterpillar':
			return new CaterpillarHazard(data);
		case 'spider':
			return new SpiderHazard(data);
		case 'mosquito':
			return new MosquitoHazard(data);
	}
};
