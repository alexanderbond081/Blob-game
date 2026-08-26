import { LevelObstacle } from '../levels/level-schema';
import { BranchObstacle, Obstacle, StoneObstacle } from './obstacle';

export const createObstacle = (data: LevelObstacle): Obstacle => {
	switch (data.type) {
		case 'stone':
			return new StoneObstacle(data);
		case 'branch':
			return new BranchObstacle(data);
	}
};
