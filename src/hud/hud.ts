import { Scene } from '../scenes/scene';

export abstract class HUD extends Scene {

	public abstract init(): Promise<void>;

	public abstract update(deltaTime: number): void;

	protected abstract onResize(): void;

}
