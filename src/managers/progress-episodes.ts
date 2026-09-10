import { gameSceneCatalog, getLevelTotalFireflies } from './scenes-catalog';
import { GameProgress } from './game-progress';

/** Locked → no level reachable yet; open → reachable but unfinished; complete → every level cleared. */
export type EpisodeStatus = 'locked' | 'open' | 'complete';

export type EpisodeProgressSummary = {
	locationIcon: string;
	locationTitle: string;
	completedLevels: number;
	totalLevels: number;
	bestCollected: number;
	totalFireflies: number;
	/** Sum of best run times over cleared levels. */
	totalTimeSec: number;
	totalDeaths: number;
	status: EpisodeStatus;
	/** Icon-only placeholder; not in the playable catalog. */
	comingSoon: boolean;
};

/** Progress-modal placeholders. Order is the display order after catalog episodes. */
const UPCOMING_EPISODES: readonly { locationIcon: string; locationTitle: string }[] = [
	{ locationIcon: 'stream', locationTitle: 'Stream' },
	{ locationIcon: 'cave', locationTitle: 'Cave' },
	{ locationIcon: 'house', locationTitle: 'House' },
	{ locationIcon: 'forest', locationTitle: 'Forest' },
	{ locationIcon: 'mushroom', locationTitle: 'Mushrooms' },
];

const createEmptySummary = (
	locationIcon: string,
	locationTitle: string,
	comingSoon: boolean,
): EpisodeProgressSummary => {
	return {
		locationIcon,
		locationTitle,
		completedLevels: 0,
		totalLevels: 0,
		bestCollected: 0,
		totalFireflies: 0,
		totalTimeSec: 0,
		totalDeaths: 0,
		status: 'locked',
		comingSoon,
	};
};

/** Aggregate catalog levels by `locationIcon` (episode), then append Coming Soon placeholders. */
export const collectEpisodeProgressSummaries = (): EpisodeProgressSummary[] => {
	const progress = GameProgress.shared;
	const order: string[] = [];
	const byIcon = new Map<string, EpisodeProgressSummary>();
	const unlockedIcons = new Set<string>();

	for (const scene of gameSceneCatalog) {
		let summary = byIcon.get(scene.locationIcon);
		if (!summary) {
			summary = createEmptySummary(scene.locationIcon, scene.locationTitle, false);
			byIcon.set(scene.locationIcon, summary);
			order.push(scene.locationIcon);
		}

		const level = progress.getLevelProgress(scene.id);
		summary.totalLevels += 1;
		if (level.completed) {
			summary.completedLevels += 1;
		}
		summary.bestCollected += level.bestCollected;
		summary.totalFireflies += getLevelTotalFireflies(scene.id);
		summary.totalTimeSec += level.bestTimeSec ?? 0;
		summary.totalDeaths += level.deaths;
		if (level.unlocked) {
			unlockedIcons.add(scene.locationIcon);
		}
	}

	const summaries = order.map((icon) => {
		const summary = byIcon.get(icon)!;
		summary.status = resolveEpisodeStatus(summary, unlockedIcons.has(icon));
		return summary;
	});

	for (const upcoming of UPCOMING_EPISODES) {
		if (byIcon.has(upcoming.locationIcon)) {
			continue;
		}

		summaries.push(createEmptySummary(upcoming.locationIcon, upcoming.locationTitle, true));
	}

	return summaries;
};

export const formatEpisodeCompletionPercent = (summary: EpisodeProgressSummary): number => {
	if (summary.totalLevels <= 0) {
		return 0;
	}

	return Math.round((summary.completedLevels / summary.totalLevels) * 100);
};

const resolveEpisodeStatus = (
	summary: EpisodeProgressSummary,
	hasUnlockedLevel: boolean,
): EpisodeStatus => {
	if (summary.totalLevels > 0 && summary.completedLevels >= summary.totalLevels) {
		return 'complete';
	}

	return hasUnlockedLevel ? 'open' : 'locked';
};
