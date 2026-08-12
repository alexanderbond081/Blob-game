import { Container, DestroyOptions } from 'pixi.js';

import { createModalTitle } from './modal-title';
import { hubModalTitleY } from './hub-modal-layout';

/**
 * Customize hub modal body (D0 shell). Skin grid lands in D2.
 */
export class CustomizeModalContent extends Container {
	private title!: ReturnType<typeof createModalTitle>;
	private panelHeight = 480;

	private constructor() {
		super();
	}

	public static async create(): Promise<CustomizeModalContent> {
		const content = new CustomizeModalContent();
		content.title = createModalTitle('Customize', 38);
		content.addChild(content.title);
		content.layout();
		return content;
	}

	public reflow(_contentWidth: number, panelHeight?: number): void {
		if (panelHeight !== undefined) {
			this.panelHeight = panelHeight;
		}

		this.layout();
	}

	public override destroy(options?: DestroyOptions): void {
		super.destroy(options);
	}

	private layout(): void {
		this.title.x = 0;
		this.title.y = hubModalTitleY(this.panelHeight);
	}
}
