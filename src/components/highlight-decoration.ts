import { Decoratable } from './decoratable';
import { MouseActionDecoration } from './mouse-action-decoration';
import { gsap } from 'gsap';

export class HighlightDecoration extends MouseActionDecoration {
	private scaleEffect: number;

	constructor(scaleEffect: number = 0.8) {
		super();
		this.scaleEffect = scaleEffect;
	}

	protected onUpdateAnimations(host: Decoratable) {
		for (const tween of gsap.getTweensOf(host.animationTarget)) {
			const pixi = tween.vars.pixi as Record<string, number> | undefined;
			if (!pixi || pixi.scaleX === undefined) continue;
			pixi.scaleX = host.actualScaleX;
			pixi.scaleY = host.actualScaleY;
			tween.invalidate();
		}
	}

	protected onAttach(host: Decoratable): void {

	}

	protected onDetach(host: Decoratable): void {
		const target = host.animationTarget;

		for (const tween of gsap.getTweensOf(target)) {
			tween.kill();
		}

		target.filters = null;
		target.tint = 0xffffff;
	}

	protected onPointerOver(host: Decoratable): void {
		gsap.to(host.animationTarget,
			{
				pixi: { contrast: 0.9, brightness: 1.1 },
				duration: 0.1,
				overwrite: 'auto',
			});
	}

	protected onPointerOut(host: Decoratable): void {
		gsap.to(host.animationTarget,
			{
				pixi: { contrast: 1, brightness: 1 },
				duration: 0.1,
				overwrite: 'auto',
			});
	}

	protected onPointerDown(host: Decoratable): void {
		gsap.to(host.animationTarget,
			{
				pixi: {
					tint: "#bbbbbb",
					//scaleX: host.actualScaleX * this.scaleEffect,
					//scaleY: host.actualScaleY * this.scaleEffect,
				},
				duration: 0.1,
				overwrite: 'auto',
			});
	}

	protected onPointerUp(host: Decoratable): void {
		// not used
	}

	protected onPointerTap(host: Decoratable): void {
		gsap.fromTo(host.animationTarget,
			{
				pixi: {
					scaleX: host.actualScaleX * this.scaleEffect,
					scaleY: host.actualScaleY * this.scaleEffect
				},
			},
			{
				pixi: {
					scaleX: host.actualScaleX,
					scaleY: host.actualScaleY,
				},
				duration: 0.5,
				ease: "elastic.out(0.5, 0.3)",
				overwrite: "auto",
			});

		gsap.to(host.animationTarget,
			{
				pixi: { tint: "#ffffff" },
				duration: 0.3,
				overwrite: "auto",
			});
	}

	protected onPointerUpOutside(host: Decoratable): void {
		gsap.to(host.animationTarget,
			{
				pixi: {
					tint: "#ffffff",
					//scaleX: host.actualScaleX,
					//scaleY: host.actualScaleY
				},
				duration: 0.1,
				overwrite: "auto",
			});
	}
}
