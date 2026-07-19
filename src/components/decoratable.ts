import { Container } from 'pixi.js';

export interface Decoratable {
    readonly interactiveTarget: Container;
    readonly animationTarget: Container;

    readonly actualScaleX: number;
    readonly actualScaleY: number;
}
