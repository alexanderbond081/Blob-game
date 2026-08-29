import { Body, Vector } from 'matter-js';

import { PlatformType } from '../levels/level-schema';

/** Matter `body.label` for walkable surfaces (static or moving). */
export const PLATFORM_BODY_LABEL = 'platform';

/** Matter `body.label` for dynamic stones / branches (walkable, not sticky, not lethal). */
export const OBSTACLE_BODY_LABEL = 'obstacle';

/** Minimum dot(normal, worldUp) for a contact to count as standing on a surface (~60° max slope). */
export const WALKABLE_NORMAL_THRESHOLD = 0.5;

/**
 * Max slope that still counts as ground via contact-X inset.
 * A circle on a 50° slope has |contact.x − center.x| = radius × sin(50°);
 * steeper / rim / cube-corner hits sit further out and are not support.
 */
export const MAX_WALKABLE_SLOPE_DEG = 45;

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
	/** Average X of this step's contact points, or null if the pair has none. */
	contactX: number | null;
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

const MAX_WALKABLE_CONTACT_OFFSET_RATIO = Math.sin((MAX_WALKABLE_SLOPE_DEG * Math.PI) / 180);

/** True when the player is supported from below (floor, slope, moving platform). */
export const isWalkableContact = (
	playerBody: Body,
	bodyA: Body,
	bodyB: Body,
	pairNormal: Vector,
	contactX: number | null = null,
	threshold = WALKABLE_NORMAL_THRESHOLD,
): boolean => {
	if (bodyA.id !== playerBody.id && bodyB.id !== playerBody.id) {
		return false;
	}

	const supportNormal = getSupportNormal(playerBody, bodyA, bodyB, pairNormal);
	if (Vector.dot(supportNormal, WORLD_UP) <= threshold) {
		return false;
	}

	const halfWidth = (playerBody.bounds.max.x - playerBody.bounds.min.x) * 0.5;
	const maxOffsetX = halfWidth * MAX_WALKABLE_CONTACT_OFFSET_RATIO;
	const resolvedContactX = contactX ?? (playerBody.position.x - supportNormal.x * halfWidth);
	return Math.abs(resolvedContactX - playerBody.position.x) <= maxOffsetX;
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

export const isWalkableSurfaceBody = (body: Body): boolean => {
	return body.label === PLATFORM_BODY_LABEL || body.label === OBSTACLE_BODY_LABEL;
};

export const getPlatformBody = (playerBody: Body, bodyA: Body, bodyB: Body): Body | null => {
	if (bodyA.id === playerBody.id && isWalkableSurfaceBody(bodyB)) {
		return bodyB;
	}

	if (bodyB.id === playerBody.id && isWalkableSurfaceBody(bodyA)) {
		return bodyA;
	}

	return null;
};
