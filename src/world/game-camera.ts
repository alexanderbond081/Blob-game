import { Container } from 'pixi.js';

export class GameCamera {
	public x = 0;
	public y = 0;

	private readonly viewportWidth: number;
	private readonly viewportHeight: number;
	private readonly levelWidth: number;
	private readonly levelHeight: number;
	private readonly followLerp: number;

	public constructor(
		viewportWidth: number,
		viewportHeight: number,
		levelWidth: number,
		levelHeight: number,
		followLerp = 0.12,
	) {
		this.viewportWidth = viewportWidth;
		this.viewportHeight = viewportHeight;
		this.levelWidth = levelWidth;
		this.levelHeight = levelHeight;
		this.followLerp = followLerp;
	}

	/** @param deltaTime Pixi ticker deltaTime (1.0 = one frame at 60 FPS). */
	public update(targetX: number, targetY: number, deltaTime = 1): void {
		const maxX = Math.max(0, this.levelWidth - this.viewportWidth);
		const maxY = Math.max(0, this.levelHeight - this.viewportHeight);

		const desiredX = this.clamp(targetX - this.viewportWidth * 0.5, 0, maxX);
		const desiredY = this.clamp(targetY - this.viewportHeight * 0.5, 0, maxY);

		const alpha = 1 - Math.pow(1 - this.followLerp, deltaTime);
		this.x += (desiredX - this.x) * alpha;
		this.y += (desiredY - this.y) * alpha;

		if (Math.abs(desiredX - this.x) < 0.05) {
			this.x = desiredX;
		}

		if (Math.abs(desiredY - this.y) < 0.05) {
			this.y = desiredY;
		}

		this.x = this.clamp(this.x, 0, maxX);
		this.y = this.clamp(this.y, 0, maxY);
	}

	/** Snaps scroll to screen pixels to avoid sub-pixel shimmer under stage scale. */
	public applyToContainer(container: Container, renderScale = 1): void {
		const scale = renderScale > 0 ? renderScale : 1;
		const x = Math.round(this.x * scale) / scale;
		const y = Math.round(this.y * scale) / scale;
		container.position.set(-x, -y);
	}

	public getRenderX(renderScale = 1): number {
		const scale = renderScale > 0 ? renderScale : 1;
		return Math.round(this.x * scale) / scale;
	}

	private clamp(value: number, min: number, max: number): number {
		return Math.max(min, Math.min(max, value));
	}
}
