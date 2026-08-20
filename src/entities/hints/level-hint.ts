import { gsap } from 'gsap';
import { Container, DestroyOptions, Graphics } from 'pixi.js';

import { getInputMode, InputMode, subscribeInputMode } from '../../input/input-mode';
import { HintSize, HINT_CORNER_RADIUS, HINT_KEY_HOLD_SEC, HINT_KEY_IDLE_SEC, HINT_KEY_RELEASE_SEC, HINT_PLATE_ALPHA, HINT_PLATE_COLOR, HINT_SCHEME_FADE_SEC, HINT_SCHEME_GAP_SEC } from './hint-layout';
import { KeySlot, KeyboardCluster } from './keyboard-cluster';
import { TouchPointer } from './touch-pointer';

type TipPose = {
	x: number;
	y: number;
};

/**
 * World-space control poster: 50% black rounded plate, touch and keyboard loops.
 * Subclasses own the GSAP timelines for each input mode.
 */
export abstract class LevelHint extends Container {
	protected readonly touchLayer: Container;
	protected readonly keyboardLayer: Container;
	protected readonly pointer: TouchPointer;
	protected readonly cluster: KeyboardCluster;
	protected readonly tip: TipPose = { x: 0, y: 0 };

	private readonly maskGfx: Graphics;
	private readonly unsubscribeInput: () => void;
	private samplingTrail = false;
	private touchTimeline: gsap.core.Timeline | null = null;
	private keyboardTimeline: gsap.core.Timeline | null = null;
	private playbackReady = false;

	protected constructor(x: number, y: number, size: HintSize) {
		super();
		this.eventMode = 'none';
		this.position.set(x, y);

		const plate = new Graphics()
			.roundRect(0, 0, size.width, size.height, HINT_CORNER_RADIUS)
			.fill({ color: HINT_PLATE_COLOR, alpha: HINT_PLATE_ALPHA });
		plate.eventMode = 'none';
		this.addChild(plate);

		this.maskGfx = new Graphics()
			.roundRect(0, 0, size.width, size.height, HINT_CORNER_RADIUS)
			.fill(0xffffff);
		this.maskGfx.eventMode = 'none';
		// Do not set renderable=false: Pixi v8 stencil then collects nothing and clips all art.
		this.addChild(this.maskGfx);

		const content = new Container();
		content.eventMode = 'none';
		content.mask = this.maskGfx;
		this.addChild(content);

		this.touchLayer = new Container();
		this.touchLayer.eventMode = 'none';
		this.pointer = new TouchPointer();
		this.touchLayer.addChild(this.pointer);
		this.touchLayer.visible = false;
		content.addChild(this.touchLayer);

		this.keyboardLayer = new Container();
		this.keyboardLayer.eventMode = 'none';
		this.cluster = new KeyboardCluster();
		this.cluster.position.set(
			(size.width - this.cluster.clusterWidth) * 0.5,
			(size.height - this.cluster.clusterHeight) * 0.5,
		);
		this.keyboardLayer.addChild(this.cluster);
		this.keyboardLayer.visible = false;
		content.addChild(this.keyboardLayer);

		this.unsubscribeInput = subscribeInputMode((mode) => {
			this.applyInputMode(mode);
		});
		gsap.ticker.add(this.onTicker);
	}

	/** Call from the subclass constructor after kind-specific fields are set. */
	protected beginPlayback(): void {
		this.playbackReady = true;
		this.applyInputMode(getInputMode());
	}

	public override destroy(options?: DestroyOptions): void {
		this.unsubscribeInput();
		gsap.ticker.remove(this.onTicker);
		this.stopPlayback();
		super.destroy(options);
	}

	protected abstract buildTouchTimeline(): gsap.core.Timeline;
	protected abstract buildKeyboardTimeline(): gsap.core.Timeline;

	protected setSamplingTrail(sampling: boolean): void {
		this.samplingTrail = sampling;
	}

	protected applyTip(): void {
		this.pointer.setFingertip(this.tip.x, this.tip.y);
		if (this.samplingTrail) {
			this.pointer.sampleTrail(this.tip.x, this.tip.y);
		}
	}

	protected hold(timeline: gsap.core.Timeline, durationSec: number): void {
		timeline.to({}, { duration: durationSec });
	}

	protected playKeyboardCycle(
		held: readonly KeySlot[],
		prelude?: { slots: readonly KeySlot[]; durationSec: number },
	): gsap.core.Timeline {
		const timeline = gsap.timeline({ repeat: -1 });
		timeline.set(this.cluster, { alpha: 0 });
		timeline.call(() => {
			this.cluster.setScheme('arrows');
			this.cluster.setPressed([]);
		});
		timeline.to(this.cluster, { alpha: 1, duration: HINT_SCHEME_FADE_SEC });
		this.appendSchemeHold(timeline, held, prelude);
		timeline.to(this.cluster, { alpha: 0, duration: HINT_SCHEME_FADE_SEC });
		this.hold(timeline, HINT_SCHEME_GAP_SEC);
		timeline.call(() => {
			this.cluster.setScheme('wasd');
			this.cluster.setPressed([]);
		});
		timeline.to(this.cluster, { alpha: 1, duration: HINT_SCHEME_FADE_SEC });
		this.appendSchemeHold(timeline, held, prelude);
		timeline.to(this.cluster, { alpha: 0, duration: HINT_SCHEME_FADE_SEC });
		this.hold(timeline, HINT_SCHEME_GAP_SEC);
		return timeline;
	}

	private appendSchemeHold(
		timeline: gsap.core.Timeline,
		held: readonly KeySlot[],
		prelude?: { slots: readonly KeySlot[]; durationSec: number },
	): void {
		timeline.call(() => {
			this.cluster.setPressed([]);
		});
		this.hold(timeline, HINT_KEY_IDLE_SEC);
		if (prelude) {
			timeline.call(() => {
				this.cluster.setPressed(prelude.slots);
			});
			this.hold(timeline, prelude.durationSec);
		}
		timeline.call(() => {
			this.cluster.setPressed(held);
		});
		this.hold(timeline, HINT_KEY_HOLD_SEC);
		timeline.call(() => {
			this.cluster.setPressed([]);
		});
		this.hold(timeline, HINT_KEY_RELEASE_SEC);
	}

	private readonly onTicker = (): void => {
		this.pointer.redrawTrail();
	};

	private applyInputMode(mode: InputMode): void {
		if (!this.playbackReady) {
			return;
		}

		this.stopPlayback();
		const showTouch = mode === 'touch';
		this.touchLayer.visible = showTouch;
		this.keyboardLayer.visible = !showTouch;
		if (showTouch) {
			this.touchTimeline = this.buildTouchTimeline();
			this.touchTimeline.play();
			return;
		}

		this.keyboardTimeline = this.buildKeyboardTimeline();
		this.keyboardTimeline.play();
	}

	private stopPlayback(): void {
		this.samplingTrail = false;
		if (this.touchTimeline) {
			this.touchTimeline.kill();
			this.touchTimeline = null;
		}
		if (this.keyboardTimeline) {
			this.keyboardTimeline.kill();
			this.keyboardTimeline = null;
		}
		gsap.killTweensOf(this.tip);
		gsap.killTweensOf(this.pointer.hand);
		gsap.killTweensOf(this.pointer.contact);
		gsap.killTweensOf(this.cluster);
		this.pointer.resetTrail();
	}
}
