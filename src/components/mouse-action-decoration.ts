import { Decoratable } from './decoratable';

/**
 * Bridges Pixi mouse pointer events to abstract onPointer*(host) hooks.
 * Lifecycle: attach() registers listeners, detach() removes them and clears host.
 */
export abstract class MouseActionDecoration {
	private host: Decoratable | null = null;

	public attach(host: Decoratable): void {
		if (this.host) {
			if (this.host === host) return;
			this.detach();
		}

		this.host = host;
		const target = this.host.interactiveTarget;

		target.on('pointerover', this.handlePointerOver, this);
		target.on('pointerout', this.handlePointerOut, this);
		target.on('pointerdown', this.handlePointerDown, this);
		target.on('pointerup', this.handlePointerUp, this);
		target.on('pointerupoutside', this.handlePointerUpOutside, this);
		target.on('pointertap', this.handlePointerTap, this);

		this.onAttach(this.host);
	}

	public detach(): void {
		if (!this.host) return;

		this.onDetach(this.host);

		const target = this.host.interactiveTarget;
		target.off('pointerover', this.handlePointerOver, this);
		target.off('pointerout', this.handlePointerOut, this);
		target.off('pointerdown', this.handlePointerDown, this);
		target.off('pointerup', this.handlePointerUp, this);
		target.off('pointerupoutside', this.handlePointerUpOutside, this);
		target.off('pointertap', this.handlePointerTap, this);

		this.host = null;
	}

	public updateAnimations(): void {
		if (this.host) {
			this.onUpdateAnimations(this.host);
		}
	}

	protected abstract onAttach(host: Decoratable): void;
	protected abstract onDetach(host: Decoratable): void;

	protected abstract onPointerOver(host: Decoratable): void;
	protected abstract onPointerOut(host: Decoratable): void;
	protected abstract onPointerDown(host: Decoratable): void;
	protected abstract onPointerUp(host: Decoratable): void;
	protected abstract onPointerUpOutside(host: Decoratable): void;
	protected abstract onPointerTap(host: Decoratable): void;
	protected abstract onUpdateAnimations(host: Decoratable): void;

	private checkHost(): boolean {
		if (!this.host) {
			console.warn(`[${this.constructor.name}] is not attached`);
			return false;
		}
		return true;
	}

	private handlePointerOver(): void {
		if (this.checkHost()) {
			this.onPointerOver(this.host!);
		}
	}

	private handlePointerOut(): void {
		if (this.checkHost()) {
			this.onPointerOut(this.host!);
		}
	}

	private handlePointerDown(): void {
		if (this.checkHost()) {
			this.onPointerDown(this.host!);
		}
	}

	private handlePointerUp(): void {
		if (this.checkHost()) {
			this.onPointerUp(this.host!);
		}
	}

	private handlePointerUpOutside(): void {
		if (this.checkHost()) {
			this.onPointerUpOutside(this.host!);
		}
	}

	private handlePointerTap(): void {
		if (this.checkHost()) {
			this.onPointerTap(this.host!);
		}
	}
}
