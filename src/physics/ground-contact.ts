import { Body, Vector } from 'matter-js';

/** Bodies with this label count as walkable surfaces (static or moving). */
export const PLATFORM_BODY_LABEL = 'platform';

/** Minimum dot(normal, worldUp) for a contact to count as standing on a surface (~60° max slope). */
export const WALKABLE_NORMAL_THRESHOLD = 0.5;

const WORLD_UP: Vector = { x: 0, y: -1 };

export type PhysicsCollisionInfo = {
	bodyA: Body;
	bodyB: Body;
	normal: Vector;
};

/** Normal pointing from the surface toward the player (support direction). */
export const getSupportNormal = (
	playerBody: Body,
	bodyA: Body,
	bodyB: Body,
	pairNormal: Vector,
): Vector => {
	if (bodyA.id === playerBody.id) {
		return pairNormal;
	}

	return { x: -pairNormal.x, y: -pairNormal.y };
};

/** True when the player is supported from below (floor, slope, moving platform). */
export const isWalkableContact = (
	playerBody: Body,
	bodyA: Body,
	bodyB: Body,
	pairNormal: Vector,
	threshold = WALKABLE_NORMAL_THRESHOLD,
): boolean => {
	if (bodyA.id !== playerBody.id && bodyB.id !== playerBody.id) {
		return false;
	}

	const supportNormal = getSupportNormal(playerBody, bodyA, bodyB, pairNormal);
	return Vector.dot(supportNormal, WORLD_UP) > threshold;
};

export const getPlatformBody = (playerBody: Body, bodyA: Body, bodyB: Body): Body | null => {
	if (bodyA.id === playerBody.id && bodyB.label === PLATFORM_BODY_LABEL) {
		return bodyB;
	}

	if (bodyB.id === playerBody.id && bodyA.label === PLATFORM_BODY_LABEL) {
		return bodyA;
	}

	return null;
};
