import { gameSceneCatalog, getLevelTotalFireflies } from './scenes-catalog';
import { GameProgress } from './game-progress';

/** Fixed episode slots in the Progress modal; bump when the map grows. */
export const MAX_PROGRESS_EPISODES = 6;

export type EpisodeProgressSummary = {
	locationIcon: string;
	completedLevels: number;
	totalLevels: number;
	bestCollected: number;
	totalFireflies: number;
};

/** Aggregate catalog levels by `locationIcon` (episode), in first-seen order. */
export const collectEpisodeProgressSummaries = (): EpisodeProgressSummary[] => {
	const progress = GameProgress.shared;
	const order: string[] = [];
	const byIcon = new Map<string, EpisodeProgressSummary>();

	for (const scene of gameSceneCatalog) {
		let summary = byIcon.get(scene.locationIcon);
		if (!summary) {
			summary = {
				locationIcon: scene.locationIcon,
				completedLevels: 0,
				totalLevels: 0,
				bestCollected: 0,
				totalFireflies: 0,
			};
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
	}

	return order.map((icon) => byIcon.get(icon)!);
};

export const formatEpisodeCompletionPercent = (summary: EpisodeProgressSummary): number => {
	if (summary.totalLevels <= 0) {
		return 0;
	}

	return Math.round((summary.completedLevels / summary.totalLevels) * 100);
};

export const formatEpisodeStatsLine = (summary: EpisodeProgressSummary): string => {
	const percent = formatEpisodeCompletionPercent(summary);
	return `${percent}% · ${summary.bestCollected}/${summary.totalFireflies}`;
};
