export type PlayerState = 'idle' | 'run' | 'jump' | 'fall' | 'cling' | 'crouch' | 'dying';

export type PlayerMotion = {
	velocityX: number;
	velocityY: number;
	onGround: boolean;
	clinging: boolean;
	crouching: boolean;
	dying: boolean;
};

export const resolvePlayerState = (motion: PlayerMotion): PlayerState => {
	if (motion.dying) {
		return 'dying';
	}

	if (motion.clinging) {
		return 'cling';
	}

	if (!motion.onGround) {
		return motion.velocityY < -0.2 ? 'jump' : 'fall';
	}

	if (motion.crouching) {
		return 'crouch';
	}

	if (Math.abs(motion.velocityX) > 0.3) {
		return 'run';
	}

	return 'idle';
};
