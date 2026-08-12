import {
	gameSceneCatalog,
	getLevelTotalFireflies,
	getNextGameSceneId,
} from './scenes-catalog';
import { DEFAULT_UNLOCKED_SKIN_IDS } from './skins-catalog';

const SAVE_KEY = 'fairy-blob-progress-v1';
const SAVE_VERSION = 1;

export type LevelProgress = {
	unlocked: boolean;
	bestCollected: number;
	completed: boolean;
	bestTimeSec: number | null;
	deaths: number;
};

export type GameProgressSettings = {
	musicMuted: boolean;
	sfxMuted: boolean;
};

export type GameProgressState = {
	version: number;
	lastPlayedLevelId: string | null;
	levels: Record<string, LevelProgress>;
	settings: GameProgressSettings;
	abilities: string[];
	/**
	 * Unlocked skin ids.
	 * (Persisted, used by Customize modal test UI.)
	 */
	skins: string[];
	/** Currently selected skin id. */
	selectedSkinId: string;
};

/** Merged catalog + progress row for the main-menu carousel. */
export type LevelCarouselEntry = {
	id: string;
	title: string;
	locationIcon: string;
	totalFireflies: number;
	collected: number;
	unlocked: boolean;
};

const createEmptyLevelProgress = (unlocked: boolean): LevelProgress => ({
	unlocked,
	bestCollected: 0,
	completed: false,
	bestTimeSec: null,
	deaths: 0,
});

const createDefaultState = (): GameProgressState => {
	const levels: Record<string, LevelProgress> = {};

	for (let i = 0; i < gameSceneCatalog.length; i += 1) {
		const entry = gameSceneCatalog[i];
		levels[entry.id] = createEmptyLevelProgress(i === 0);
	}

	return {
		version: SAVE_VERSION,
		lastPlayedLevelId: gameSceneCatalog[0]?.id ?? null,
		levels,
		settings: {
			musicMuted: false,
			sfxMuted: false,
		},
		abilities: [],
		skins: [...DEFAULT_UNLOCKED_SKIN_IDS],
		selectedSkinId: 'default',
	};
};

const isObject = (value: unknown): value is Record<string, unknown> => {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
};

const parseLevelProgress = (raw: unknown, fallbackUnlocked: boolean): LevelProgress => {
	if (!isObject(raw)) {
		return createEmptyLevelProgress(fallbackUnlocked);
	}

	return {
		unlocked: typeof raw.unlocked === 'boolean' ? raw.unlocked : fallbackUnlocked,
		bestCollected: typeof raw.bestCollected === 'number' ? raw.bestCollected : 0,
		completed: typeof raw.completed === 'boolean' ? raw.completed : false,
		bestTimeSec: typeof raw.bestTimeSec === 'number' ? raw.bestTimeSec : null,
		deaths: typeof raw.deaths === 'number' ? raw.deaths : 0,
	};
};

const parseState = (raw: unknown): GameProgressState | null => {
	if (!isObject(raw) || raw.version !== SAVE_VERSION) {
		return null;
	}

	const defaults = createDefaultState();
	const rawLevels = isObject(raw.levels) ? raw.levels : {};
	const levels: Record<string, LevelProgress> = {};

	for (let i = 0; i < gameSceneCatalog.length; i += 1) {
		const entry = gameSceneCatalog[i];
		levels[entry.id] = parseLevelProgress(rawLevels[entry.id], i === 0);
	}

	const rawSettings = isObject(raw.settings) ? raw.settings : {};

	return {
		version: SAVE_VERSION,
		lastPlayedLevelId:
			typeof raw.lastPlayedLevelId === 'string' || raw.lastPlayedLevelId === null
				? (raw.lastPlayedLevelId as string | null)
				: defaults.lastPlayedLevelId,
		levels,
		settings: {
			musicMuted: typeof rawSettings.musicMuted === 'boolean' ? rawSettings.musicMuted : false,
			sfxMuted: typeof rawSettings.sfxMuted === 'boolean' ? rawSettings.sfxMuted : false,
		},
		abilities: Array.isArray(raw.abilities) ? raw.abilities.filter((item): item is string => typeof item === 'string') : [],
		skins: Array.isArray(raw.skins) ? raw.skins.filter((item): item is string => typeof item === 'string') : defaults.skins,
		selectedSkinId:
			typeof raw.selectedSkinId === 'string' ? raw.selectedSkinId : defaults.selectedSkinId,
	};
};

/**
 * Persistent player progress: unlocks, run stats, last-played cursor, settings stubs.
 * Single owner of localStorage for this save key.
 */
export class GameProgress {
	private static instance: GameProgress | null = null;

	private state: GameProgressState;
	private skinMigrationDirty = false;

	private constructor(state: GameProgressState) {
		this.state = state;
	}

	public static get shared(): GameProgress {
		if (!GameProgress.instance) {
			GameProgress.instance = new GameProgress(createDefaultState());
		}

		return GameProgress.instance;
	}

	public static load(): GameProgress {
		const progress = GameProgress.shared;

		try {
			const raw = localStorage.getItem(SAVE_KEY);
			if (!raw) {
				progress.state = createDefaultState();
				progress.save();
				return progress;
			}

			const parsed = parseState(JSON.parse(raw) as unknown);
			progress.state = parsed ?? createDefaultState();
			progress.ensureDefaultUnlockedSkins();
			if (!parsed) {
				progress.save();
			} else if (progress.consumeSkinMigrationDirty()) {
				progress.save();
			}
		} catch (error) {
			console.warn('[GameProgress] load failed, using defaults', error);
			progress.state = createDefaultState();
			progress.save();
		}

		return progress;
	}

	public save(): void {
		try {
			localStorage.setItem(SAVE_KEY, JSON.stringify(this.state));
		} catch (error) {
			console.warn('[GameProgress] save failed', error);
		}
	}

	public resetToDefaults(): void {
		this.state = createDefaultState();
		this.save();
	}

	public get lastPlayedLevelId(): string | null {
		return this.state.lastPlayedLevelId;
	}

	public get settings(): GameProgressSettings {
		return this.state.settings;
	}

	public isUnlocked(levelId: string): boolean {
		return this.state.levels[levelId]?.unlocked ?? false;
	}

	public getLevelProgress(levelId: string): LevelProgress {
		return this.ensureLevel(levelId);
	}

	public unlock(levelId: string): void {
		const level = this.ensureLevel(levelId);
		level.unlocked = true;
	}

	public setLastPlayed(levelId: string | null): void {
		this.state.lastPlayedLevelId = levelId;
	}

	public recordRunCollected(levelId: string, collected: number): void {
		const level = this.ensureLevel(levelId);
		level.bestCollected = Math.max(level.bestCollected, collected);
	}

	public markLevelCompleted(levelId: string): void {
		const level = this.ensureLevel(levelId);
		level.completed = true;
	}

	public recordDeath(levelId: string): void {
		const level = this.ensureLevel(levelId);
		level.deaths += 1;
	}

	public setSettings(partial: Partial<GameProgressSettings>): void {
		this.state.settings = {
			...this.state.settings,
			...partial,
		};
	}

	public get selectedSkinId(): string {
		return this.state.selectedSkinId;
	}

	public isSkinUnlocked(skinId: string): boolean {
		return this.state.skins.includes(skinId);
	}

	public setSelectedSkinId(skinId: string): void {
		if (!this.isSkinUnlocked(skinId)) {
			return;
		}

		this.state.selectedSkinId = skinId;
		this.save();
	}

	public unlockSkin(skinId: string): void {
		if (this.isSkinUnlocked(skinId)) {
			return;
		}
		this.state.skins.push(skinId);
		this.save();
	}

	/** Ensures demo default unlocks exist; fixes stale saves with empty `skins`. */
	private ensureDefaultUnlockedSkins(): void {
		for (const skinId of DEFAULT_UNLOCKED_SKIN_IDS) {
			if (!this.state.skins.includes(skinId)) {
				this.state.skins.push(skinId);
				this.skinMigrationDirty = true;
			}
		}

		if (!this.isSkinUnlocked(this.state.selectedSkinId)) {
			this.state.selectedSkinId = DEFAULT_UNLOCKED_SKIN_IDS[0] ?? 'default';
			this.skinMigrationDirty = true;
		}
	}

	private consumeSkinMigrationDirty(): boolean {
		const dirty = this.skinMigrationDirty;
		this.skinMigrationDirty = false;
		return dirty;
	}

	public getCarouselEntries(): LevelCarouselEntry[] {
		const entries: LevelCarouselEntry[] = [];

		for (const scene of gameSceneCatalog) {
			const level = this.ensureLevel(scene.id);
			entries.push({
				id: scene.id,
				title: scene.title,
				locationIcon: scene.locationIcon,
				totalFireflies: getLevelTotalFireflies(scene.id),
				collected: level.bestCollected,
				unlocked: level.unlocked,
			});
		}

		return entries;
	}

	public getCarouselStartIndex(): number {
		const entries = this.getCarouselEntries();
		if (entries.length === 0) {
			return 0;
		}

		if (this.state.lastPlayedLevelId) {
			const lastIndex = entries.findIndex((entry) => entry.id === this.state.lastPlayedLevelId);
			if (lastIndex >= 0) {
				return lastIndex;
			}
		}

		const firstUnlocked = entries.findIndex((entry) => entry.unlocked);
		return firstUnlocked < 0 ? 0 : firstUnlocked;
	}

	/**
	 * Apply exit-run rewards: complete current, unlock next, move last-played cursor.
	 * Returns the next scene id to start, or null if the chain ends.
	 */
	public applyLevelExit(levelId: string, collected: number, timeSec: number): string | null {
		this.recordRunCollected(levelId, collected);
		this.recordRunTime(levelId, timeSec);
		this.markLevelCompleted(levelId);

		const catalogNext = getNextGameSceneId(levelId, () => true);

		if (catalogNext) {
			this.unlock(catalogNext);
			this.setLastPlayed(catalogNext);
		} else {
			this.setLastPlayed(levelId);
		}

		this.save();
		return catalogNext;
	}

	public recordRunTime(levelId: string, timeSec: number): void {
		const level = this.ensureLevel(levelId);
		const rounded = Math.max(0, timeSec);
		if (level.bestTimeSec === null || rounded < level.bestTimeSec) {
			level.bestTimeSec = rounded;
		}
	}

	private ensureLevel(levelId: string): LevelProgress {
		const existing = this.state.levels[levelId];
		if (existing) {
			return existing;
		}

		const created = createEmptyLevelProgress(false);
		this.state.levels[levelId] = created;
		return created;
	}
}

export const isCarouselLevelPlayable = (entry: LevelCarouselEntry): boolean => entry.unlocked;
