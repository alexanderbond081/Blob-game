import { LevelHintData } from '../../levels/level-schema';
import { CrouchHint } from './crouch-hint';
import { CrouchJumpHint } from './crouch-jump-hint';
import { JumpHint } from './jump-hint';
import { LevelHint } from './level-hint';
import { MoveHint } from './move-hint';

export const createLevelHint = (data: LevelHintData): LevelHint | null => {
	switch (data.kind) {
		case 'move-right':
			return new MoveHint(data.x, data.y, 1);
		case 'move-left':
			return new MoveHint(data.x, data.y, -1);
		case 'jump-right':
			return new JumpHint(data.x, data.y, 1);
		case 'jump-left':
			return new JumpHint(data.x, data.y, -1);
		case 'crouchJump-right':
			return new CrouchJumpHint(data.x, data.y, 1);
		case 'crouchJump-left':
			return new CrouchJumpHint(data.x, data.y, -1);
		case 'crouch':
			return new CrouchHint(data.x, data.y);
		default:
			return null;
	}
};
