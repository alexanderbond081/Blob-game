/** Shared control bits for keyboard, touch zones, and future on-screen buttons. */
export type PlayerControls = {
	moveLeft: boolean;
	moveRight: boolean;
	jump: boolean;
};

export const createEmptyPlayerControls = (): PlayerControls => ({
	moveLeft: false,
	moveRight: false,
	jump: false,
});
