import { sound, filters, PlayOptions } from '@pixi/sound';

class BusSend extends filters.Filter {
	// !! not tested together with standard filters - expect doubling the sound
	constructor(busGain: GainNode) {
		const tap = sound.context.audioContext.createGain();
		tap.connect(busGain);
		super(tap);
	}

	public override connect(_destination: AudioNode): void {
		// workaround to prevent automatic connection to the ctx.destination
	}
}

function _createGain(volume: number = 1): GainNode {
	const bus = sound.context.audioContext.createGain();
	bus.gain.value = volume;
	bus.connect(sound.context.audioContext.destination);
	return bus;
}

export class SoundManager {
	private static _musicVolume: number = 0.8;
	private static _ambienceVolume: number = 0.8;
	private static _sfxVolume: number = 0.8;

	private static musicBus = _createGain(this._musicVolume);
	private static ambienceBus = _createGain(this._ambienceVolume);
	private static sfxBus = _createGain(this._sfxVolume);

	private static musicAlias: string = '';
	private static ambientAlias: string = '';
	private static _pausedByVisibility: boolean = false;

	public static get musicVolume(): number {
		return this.musicBus.gain.value;
	}

	public static set musicVolume(volume: number) {
		this._musicVolume = volume;
		this.musicBus.gain.value = volume;
	}

	public static get ambienceVolume(): number {
		return this.ambienceBus.gain.value;
	}

	public static set ambienceVolume(volume: number) {
		this._ambienceVolume = volume;
		this.ambienceBus.gain.value = volume;
	}

	public static get sfxVolume(): number {
		return this.sfxBus.gain.value;
	}

	public static set sfxVolume(volume: number) {
		this._sfxVolume = volume;
		this.sfxBus.gain.value = volume;
	}

	public static init(): void {
		sound.disableAutoPause = true;
		document.addEventListener('visibilitychange', this.onVisibilityChange);
	}

	private static onVisibilityChange = (): void => {
		if (document.visibilityState === 'hidden') {
			SoundManager.pauseOnHidden();
			return;
		}

		SoundManager.resumeOnVisible();
	};

	public static pauseOnHidden(): void {
		if (sound.context.paused) {
			return;
		}

		sound.pauseAll();
		this._pausedByVisibility = true;
	}

	public static resumeOnVisible(): void {
		if (!this._pausedByVisibility) {
			return;
		}

		sound.context.paused = false;
		sound.context.refreshPaused();
		this._pausedByVisibility = false;
	}

	public static playMusic(alias: string): void {
		if (!sound.exists(alias)) {
			console.warn(`Sound ${alias} doesn't exist`);
			return;
		}

		if (sound.exists(this.musicAlias)) {
			sound.stop(this.musicAlias);
		}

		const theSound = sound.find(alias);
		// !! to be implemented - check if there is a BusSend instance in the list instead
		if (!theSound.filters) {
			theSound.filters = [new BusSend(this.musicBus)];
			//console.log(`Add gain bus to the ${alias} sound`);
		}
		sound.play(alias, { loop: true, });

		this.musicAlias = alias;
	}

	public static playAmbience(alias: string): void {
		if (!sound.exists(alias)) {
			console.warn(`Sound ${alias} doesn't exist`);
			return;
		}

		if (sound.exists(this.ambientAlias)) {
			sound.stop(this.ambientAlias);
		}

		const theSound = sound.find(alias);
		// !! to be implemented - check if there is a BusSend instance in the list instead
		if (!theSound.filters) {
			theSound.filters = [new BusSend(this.ambienceBus)];
			//console.log(`Add gain bus to the ${alias} sound`);
		}
		sound.play(alias, { loop: true, });

		this.ambientAlias = alias;
	}

	public static async playSound(alias: string, maxAllowed: number = 1, options?: PlayOptions): Promise<void> {
		if (!sound.exists(alias)) {
			console.warn(`Sound ${alias} doesn't exist`);
			return;
		}

		const theSound = sound.find(alias);
		if (theSound.instances.length >= maxAllowed) {
			theSound.instances[0].stop();
		}

		// !! to be implemented - check if there is a BusSend instance in the list instead
		if (!theSound.filters) {
			theSound.filters = [new BusSend(this.sfxBus)];
			//console.log(`Add gain bus to the ${alias} sound`);
		}
		sound.play(alias, options);
	}

	public static stopSound(alias: string): void {
		if (!sound.exists(alias)) {
			console.warn(`Sound ${alias} doesn't exist`);
			return;
		}

		const theSound = sound.find(alias);
		if (theSound) {
			if (theSound.instances.length > 0) {
				theSound.instances[0].stop();
			}
		}
	}

	public static toggleMusic(): boolean {
		// !! do not use together with toggleGlobal() - synchronization is not implemented yet
		if (this._musicVolume > 0 && this.musicBus.gain.value === 0) {
			this.musicBus.gain.value = this._musicVolume;
			return false;
		} else {
			this.musicBus.gain.value = 0;
			return true;
		}
	}

	public static toggleAmbience(): boolean {
		// !! do not use together with toggleGlobal() - synchronization is not implemented yet
		if (this._ambienceVolume > 0 && this.ambienceBus.gain.value === 0) {
			this.ambienceBus.gain.value = this._ambienceVolume;
			return false;
		} else {
			this.ambienceBus.gain.value = 0;
			return true;
		}
	}

	public static toggleSFX(): boolean {
		// !! do not use together with toggleGlobal() - synchronization is not implemented yet
		if (this._sfxVolume > 0 && this.sfxBus.gain.value === 0) {
			this.sfxBus.gain.value = this._sfxVolume;
			return false;
		} else {
			this.sfxBus.gain.value = 0;
			return true;
		}
	}

	public static toggleGlobal(): boolean {
		// !! do not use together with other toggle functions - synchronization is not implemented yet
		return sound.toggleMuteAll();
	}
}
