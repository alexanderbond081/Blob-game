export type PlayerState = 'idle' | 'run' | 'jump' | 'fall';

export type PlayerMotion = {
	velocityX: number;
	velocityY: number;
	onGround: boolean;
};

export const resolvePlayerState = (motion: PlayerMotion): PlayerState => {
	if (!motion.onGround) {
		return motion.velocityY < -0.2 ? 'jump' : 'fall';
	}

	if (Math.abs(motion.velocityX) > 0.3) {
		return 'run';
	}

	return 'idle';
};
