import { HazardFacing } from '../levels/level-schema';

/** Fraction of the max inward depth used when level JSON omits `length`. */
export const SPIKE_TOOTH_LENGTH_DEFAULT = 0.5;

const TOOTH_BASES = [16, 22, 18, 24];
const TOOTH_BASE_AVG = TOOTH_BASES.reduce((sum, width) => sum + width, 0) / TOOTH_BASES.length;
/** Period 3 so the combined width/height pattern repeats every 12 teeth. */
const TOOTH_HEIGHTS = [0.85, 1, 0.92];
const MIN_TOOTH_DEPTH = 2;
const POINT_EPS = 1e-4;
/** Offset from the inner top-left before the first undirected base point. */
const HALF_TOOTH_BASE = 10;

type Point = {
	x: number;
	y: number;
};

type Edge = {
	origin: Point;
	alongX: number;
	alongY: number;
	inwardX: number;
	inwardY: number;
	length: number;
	thickness: number;
};

type Located = {
	edge: Edge;
	distance: number;
};

export type SpikeOutlineInput = {
	width: number;
	height: number;
	inset: number;
	facing?: HazardFacing;
	length?: number;
};

/**
 * Closed spike silhouette in local Graphics space (top-left of the AABB).
 * Returns null when teeth would be invisible — caller should draw a rect.
 */
export const buildSpikePolygon = (input: SpikeOutlineInput): Point[] | null => {
	const innerWidth = Math.max(0, input.width - input.inset * 2);
	const innerHeight = Math.max(0, input.height - input.inset * 2);
	if (innerWidth <= 0 || innerHeight <= 0) {
		return null;
	}

	const toothLength = input.length ?? SPIKE_TOOTH_LENGTH_DEFAULT;
	if (toothLength <= 0) {
		return null;
	}

	const x = input.inset;
	const y = input.inset;
	const facing = input.facing;
	const depth = facing
		? facingThickness(facing, innerWidth, innerHeight) * toothLength
		: Math.min(innerWidth, innerHeight) * 0.5 * toothLength;
	if (depth < MIN_TOOTH_DEPTH) {
		return null;
	}

	return facing
		? buildDirectedPolygon(x, y, innerWidth, innerHeight, depth, facing)
		: buildUndirectedPolygon(x, y, innerWidth, innerHeight, depth);
};

const toothBaseWidth = (index: number): number => TOOTH_BASES[index % TOOTH_BASES.length];

/** Distances along the inner perimeter; the last step may shrink to TOOTH_BASES[0] to land on the 4th edge. */
const collectUndirectedBaseTs = (perimeter: number, lastEdgeStart: number): number[] => {
	const ts = [HALF_TOOTH_BASE];
	let t = HALF_TOOTH_BASE;
	let index = 0;
	while (true) {
		let nextT = t + toothBaseWidth(index);
		if (nextT >= perimeter) {
			nextT = t + toothBaseWidth(0);
			if (nextT >= perimeter || nextT < lastEdgeStart) {
				break;
			}
		}

		t = nextT;
		ts.push(t);
		index += 1;
	}

	return ts;
};

const packToothWidths = (span: number): number[] => {
	if (span <= 0) {
		return [];
	}

	const count = Math.max(1, Math.round(span / TOOTH_BASE_AVG));
	const raw = Array.from({ length: count }, (_, index) => TOOTH_BASES[index % TOOTH_BASES.length]);
	const sum = raw.reduce((total, width) => total + width, 0);
	return raw.map((width) => width * (span / sum));
};

const toothHeightScale = (index: number): number => TOOTH_HEIGHTS[index % TOOTH_HEIGHTS.length];

const facingThickness = (facing: HazardFacing, width: number, height: number): number => {
	return facing === 'left' || facing === 'right' ? width : height;
};

const pointsMatch = (a: Point, b: Point): boolean => Math.hypot(a.x - b.x, a.y - b.y) < POINT_EPS;

const pushPoint = (points: Point[], point: Point): void => {
	const last = points[points.length - 1];
	if (last && pointsMatch(last, point)) {
		return;
	}
	points.push(point);
};

const pointOnEdge = (edge: Edge, distance: number, inset: number): Point => ({
	x: edge.origin.x + edge.alongX * distance + edge.inwardX * inset,
	y: edge.origin.y + edge.alongY * distance + edge.inwardY * inset,
});

/** Clockwise from the top-left: up, right, down, left. */
const rectEdges = (x: number, y: number, width: number, height: number): Edge[] => [
	{ origin: { x, y }, alongX: 1, alongY: 0, inwardX: 0, inwardY: 1, length: width, thickness: height },
	{ origin: { x: x + width, y }, alongX: 0, alongY: 1, inwardX: -1, inwardY: 0, length: height, thickness: width },
	{ origin: { x: x + width, y: y + height }, alongX: -1, alongY: 0, inwardX: 0, inwardY: -1, length: width, thickness: height },
	{ origin: { x, y: y + height }, alongX: 0, alongY: -1, inwardX: 1, inwardY: 0, length: height, thickness: width },
];

const FACING_EDGE_INDEX: Record<HazardFacing, number> = {
	up: 0,
	right: 1,
	down: 2,
	left: 3,
};

const perimeterLength = (edges: Edge[]): number => {
	return edges.reduce((total, edge) => total + edge.length, 0);
};

/** Exact corners belong to the next edge so inset uses that edge's inward normal. */
const locateOnPerimeter = (edges: Edge[], perimeter: number, t: number): Located => {
	const first = edges[0];
	let u = t % perimeter;
	if (u < 0) {
		u += perimeter;
	}
	if (u < POINT_EPS || u > perimeter - POINT_EPS) {
		return { edge: first, distance: 0 };
	}

	for (const edge of edges) {
		if (u < edge.length) {
			return { edge, distance: u };
		}
		u -= edge.length;
	}

	return { edge: first, distance: 0 };
};

const perimeterPoint = (edges: Edge[], perimeter: number, t: number): Point => {
	const located = locateOnPerimeter(edges, perimeter, t);
	return pointOnEdge(located.edge, located.distance, 0);
};

const dropClosingDuplicate = (points: Point[]): void => {
	if (points.length < 2) {
		return;
	}

	const first = points[0];
	const last = points[points.length - 1];
	if (pointsMatch(first, last)) {
		points.pop();
	}
};

/**
 * Isosceles tip on segment start→end (the two base vertices, even if they sit on
 * different core edges). Altitude from the chord midpoint, pointing away from `interior`.
 */
const isoscelesTip = (start: Point, end: Point, height: number, interior: Point): Point | null => {
	const dx = end.x - start.x;
	const dy = end.y - start.y;
	const chord = Math.hypot(dx, dy);
	if (chord < POINT_EPS) {
		return null;
	}

	const midX = (start.x + end.x) * 0.5;
	const midY = (start.y + end.y) * 0.5;
	let nx = dy / chord;
	let ny = -dx / chord;
	if (nx * (midX - interior.x) + ny * (midY - interior.y) < 0) {
		nx = -nx;
		ny = -ny;
	}

	return {
		x: midX + nx * height,
		y: midY + ny * height,
	};
};

const buildDirectedPolygon = (
	x: number,
	y: number,
	width: number,
	height: number,
	depth: number,
	facing: HazardFacing,
): Point[] => {
	const edges = rectEdges(x, y, width, height);
	const edge = edges[FACING_EDGE_INDEX[facing]];
	const widths = packToothWidths(edge.length);
	const interior = pointOnEdge(edge, edge.length * 0.5, edge.thickness);
	const points: Point[] = [];
	pushPoint(points, pointOnEdge(edge, 0, edge.thickness));

	let distance = 0;
	for (let index = 0; index < widths.length; index += 1) {
		const widthAlong = widths[index];
		const start = pointOnEdge(edge, distance, depth);
		distance += widthAlong;
		const end = pointOnEdge(edge, distance, depth);
		const tip = isoscelesTip(start, end, depth * toothHeightScale(index), interior);
		pushPoint(points, start);
		if (tip) {
			pushPoint(points, tip);
		}
		pushPoint(points, end);
	}

	pushPoint(points, pointOnEdge(edge, edge.length, edge.thickness));
	dropClosingDuplicate(points);
	return points;
};

const buildUndirectedPolygon = (
	x: number,
	y: number,
	width: number,
	height: number,
	toothHeight: number,
): Point[] | null => {
	const coreWidth = width - toothHeight * 2;
	const coreHeight = height - toothHeight * 2;
	if (coreWidth < HALF_TOOTH_BASE || coreHeight <= 0) {
		return null;
	}

	const edges = rectEdges(x + toothHeight, y + toothHeight, coreWidth, coreHeight);
	const perimeter = perimeterLength(edges);
	if (perimeter <= HALF_TOOTH_BASE) {
		return null;
	}

	const lastEdgeStart = perimeter - coreHeight;
	const baseTs = collectUndirectedBaseTs(perimeter, lastEdgeStart);
	const bases = baseTs.map((t) => perimeterPoint(edges, perimeter, t));
	if (bases.length < 2) {
		return null;
	}

	const interior = {
		x: x + toothHeight + coreWidth * 0.5,
		y: y + toothHeight + coreHeight * 0.5,
	};
	const points: Point[] = [];
	for (let index = 0; index < bases.length; index += 1) {
		const start = bases[index];
		const end = bases[(index + 1) % bases.length];
		const tip = isoscelesTip(start, end, toothHeight * toothHeightScale(index), interior);
		if (!tip) {
			continue;
		}

		pushPoint(points, start);
		pushPoint(points, tip);
	}

	dropClosingDuplicate(points);
	return points.length >= 3 ? points : null;
};
