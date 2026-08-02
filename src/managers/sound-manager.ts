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
	private static _musicVolume: number = 0.6;
	private static _ambienceVolume: number = 0.8;
	private static _sfxVolume: number = 0.8;

	private static musicBus = _createGain(this._musicVolume);
	private static ambienceBus = _createGain(this._ambienceVolume);
	private static sfxBus = _createGain(this._sfxVolume);

	private static musicAlias: string = '';
	private static ambientAlias: string = '';
	private static _suspended: boolean = false;
	private static _globalMuted: boolean = false;

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

	public static get isSuspended(): boolean {
		return this._suspended;
	}

	public static get isGlobalMuted(): boolean {
		return this._globalMuted;
	}

	public static init(): void {
		// Keep Pixi's auto-pause off: window blur must not mute/stop audio while the
		// page stays visible (multi-monitor / Poki iframe focus). Suspending on tab
		// hide or on an ad is the platform layer's call, not this manager's.
		sound.disableAutoPause = true;
	}

	/**
	 * Suspend the whole audio context. Single flag by design: the platform layer
	 * owns every reason to suspend and passes the already-combined state here.
	 */
	public static setSuspended(suspended: boolean): void {
		if (suspended === this._suspended) {
			return;
		}

		this._suspended = suspended;

		if (suspended) {
			sound.pauseAll();
		} else {
			sound.resumeAll();
		}
	}

	/**
	 * Master mute. Rides the global gain applied per playing instance, so it is a
	 * separate axis from the music / ambience / SFX buses: muting and unmuting
	 * globally never resurrects a channel the player switched off.
	 */
	public static muteGlobal(muted: boolean): void {
		if (muted === this._globalMuted) {
			return;
		}

		this._globalMuted = muted;

		if (muted) {
			sound.muteAll();
		} else {
			sound.unmuteAll();
		}
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

	/**
	 * Play an SFX by Assets / @pixi/sound alias.
	 * Note: @pixi/sound registers only one library name per loaded src
	 * (usually alias[0]). Two manifest aliases pointing at the same file
	 * will not both be playable — use distinct src paths.
	 */
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
		// !! be careful using together with toggleGlobal() - it will not be unmuted by toggleGlobal()
		if (this._musicVolume > 0 && this.musicBus.gain.value === 0) {
			this.musicBus.gain.value = this._musicVolume;
			return false;
		} else {
			this.musicBus.gain.value = 0;
			return true;
		}
	}

	public static toggleAmbience(): boolean {
		// !! be careful using together with toggleGlobal() - it will not be unmuted by toggleGlobal()
		if (this._ambienceVolume > 0 && this.ambienceBus.gain.value === 0) {
			this.ambienceBus.gain.value = this._ambienceVolume;
			return false;
		} else {
			this.ambienceBus.gain.value = 0;
			return true;
		}
	}

	public static toggleSFX(): boolean {
		// !! be careful using together with toggleGlobal() - it will not be unmuted by toggleGlobal()
		if (this._sfxVolume > 0 && this.sfxBus.gain.value === 0) {
			this.sfxBus.gain.value = this._sfxVolume;
			return false;
		} else {
			this.sfxBus.gain.value = 0;
			return true;
		}
	}

	public static toggleGlobal(): boolean {
		// !! be careful using together with other toggle functions - it will not unmute music, ambient or sfx beibg turned off by corresponding method
		this.muteGlobal(!this._globalMuted);
		return this._globalMuted;
	}
}
