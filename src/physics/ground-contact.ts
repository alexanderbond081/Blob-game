import { Body, Vector } from 'matter-js';

import { PlatformType } from '../levels/level-schema';

/** Matter `body.label` for walkable surfaces (static or moving). */
export const PLATFORM_BODY_LABEL = 'platform';

/** Minimum dot(normal, worldUp) for a contact to count as standing on a surface (~60° max slope). */
export const WALKABLE_NORMAL_THRESHOLD = 0.5;

/** Minimum |support.x| for a contact to count as a vertical wall (~60° from floor). */
export const WALL_NORMAL_THRESHOLD = 0.5;

const WORLD_UP: Vector = { x: 0, y: -1 };

/** Level platform kind; Matter `body.label` stays `platform` for all of these. */
const platformTypes = new WeakMap<Body, PlatformType>();

export type WallSide = 'left' | 'right';

export type PhysicsCollisionInfo = {
	bodyA: Body;
	bodyB: Body;
	normal: Vector;
};

export const setPlatformType = (body: Body, type: PlatformType): void => {
	platformTypes.set(body, type);
};

export const getPlatformType = (body: Body): PlatformType | null => {
	return platformTypes.get(body) ?? null;
};

export const isStickyWallBody = (body: Body): boolean => {
	return platformTypes.get(body) === 'sticky';
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

/**
 * Which side the wall is on relative to the player, or null if not a wall-like contact.
 * Support normal points from the wall toward the player.
 */
export const getWallContactSide = (
	playerBody: Body,
	bodyA: Body,
	bodyB: Body,
	pairNormal: Vector,
	threshold = WALL_NORMAL_THRESHOLD,
): WallSide | null => {
	if (bodyA.id !== playerBody.id && bodyB.id !== playerBody.id) {
		return null;
	}

	const supportNormal = getSupportNormal(playerBody, bodyA, bodyB, pairNormal);

	if (supportNormal.x > threshold) {
		return 'left';
	}

	if (supportNormal.x < -threshold) {
		return 'right';
	}

	return null;
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
