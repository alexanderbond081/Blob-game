import { Bodies, Body, Engine, Events } from 'matter-js';
import { AnimatedSprite, Assets, Spritesheet, Texture } from 'pixi.js';

import { getPlatformBody, isWalkableContact, PhysicsCollisionInfo } from '../physics/ground-contact';
import { PhysicsBody } from '../physics/physics-body';
import { PhysicsWorld } from '../physics/physics-world';
import { PlayerState, resolvePlayerState } from './player-state';

const PLAYER_RADIUS = 36;
const MOVE_SPEED_X = 6;
const JUMP_VELOCITY = -9.5;
const RUN_ANIMATION_SPEED = 0.15;

export class Player extends PhysicsBody {
	private readonly keysDown = new Set<string>();
	private readonly groundContacts = new Set<Body>();
	private state: PlayerState = 'idle';
	private facingRight = true;
	private airVelocityX = 0;
	private spritesheet: Spritesheet | null = null;
	private currentVisual: string | null = null;
	private boundEngine: Engine | null = null;

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		this.keysDown.add(event.code);
	};

	private readonly onKeyUp = (event: KeyboardEvent): void => {
		this.keysDown.delete(event.code);
	};

	private readonly onBeforeUpdate = (): void => {
		this.applyInput();
	};

	public constructor(x: number, y: number) {
		const body = Bodies.circle(x, y, PLAYER_RADIUS, {
			label: 'player',
			friction: 0,
			frictionAir: 0,
			restitution: 0,
			density: 0.004,
			inertia: Infinity,
			frictionStatic: 0,
		});

		const display = new AnimatedSprite([Texture.EMPTY]);
		display.anchor.set(0.5);
		display.eventMode = 'none';
		super(body, display);

		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
		void this.loadSpritesheet();
	}

	public bindPhysics(world: PhysicsWorld): void {
		this.boundEngine = world.engine;
		Events.on(world.engine, 'beforeUpdate', this.onBeforeUpdate);

		world.onCollisionStart((collision) => {
			this.handleGroundCollision(collision, true);
		});

		world.onCollisionActive((collision) => {
			this.handleGroundCollision(collision, true);
		});

		world.onCollisionEnd((collision) => {
			this.handleGroundCollision(collision, false);
		});
	}

	public update(): void {
		Body.setAngularVelocity(this.body, 0);
		Body.setAngle(this.body, 0);
		this.updateState();
		this.updateVisual();
		this.syncFromBody();
	}

	public get position(): { x: number; y: number } {
		return { x: this.body.position.x, y: this.body.position.y };
	}

	public get playerState(): PlayerState {
		return this.state;
	}

	public override destroy(options?: Parameters<PhysicsBody['destroy']>[0]): void {
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);

		if (this.boundEngine) {
			Events.off(this.boundEngine, 'beforeUpdate', this.onBeforeUpdate);
			this.boundEngine = null;
		}

		this.groundContacts.clear();
		super.destroy(options);
	}

	private get sprite(): AnimatedSprite {
		return this.display as AnimatedSprite;
	}

	private applyInput(): void {
		const moveLeft = this.keysDown.has('ArrowLeft') || this.keysDown.has('KeyA');
		const moveRight = this.keysDown.has('ArrowRight') || this.keysDown.has('KeyD');
		const jumpPressed = this.keysDown.has('Space') || this.keysDown.has('ArrowUp') || this.keysDown.has('KeyW');
		const onGround = this.isOnGround();

		if (!onGround) {
			Body.setVelocity(this.body, {
				x: this.airVelocityX,
				y: this.body.velocity.y,
			});
			return;
		}

		let moveDirection = 0;
		if (moveLeft) {
			moveDirection -= 1;
		}
		if (moveRight) {
			moveDirection += 1;
		}

		if (moveDirection !== 0) {
			this.facingRight = moveDirection > 0;
		}

		const speedX = moveDirection * MOVE_SPEED_X;
		this.airVelocityX = speedX;

		if (jumpPressed) {
			Body.setVelocity(this.body, {
				x: speedX,
				y: JUMP_VELOCITY,
			});
			this.groundContacts.clear();
			return;
		}

		Body.setVelocity(this.body, {
			x: speedX,
			y: this.body.velocity.y,
		});
	}

	private updateState(): void {
		this.state = resolvePlayerState({
			velocityX: this.body.velocity.x,
			velocityY: this.body.velocity.y,
			onGround: this.isOnGround(),
		});
	}

	private updateVisual(): void {
		if (!this.spritesheet) {
			return;
		}

		const facingAnimation = this.facingRight ? 'right' : 'left';
		const staticFrame = this.facingRight ? 'blob-right' : 'blob-left';

		if (this.state === 'run') {
			this.playAnimation(facingAnimation);
			return;
		}

		this.setStaticFrame(staticFrame);
	}

	private setStaticFrame(frameKey: string): void {
		if (this.currentVisual === frameKey || !this.spritesheet) {
			return;
		}

		const texture = this.spritesheet.textures[frameKey];

		if (!texture) {
			return;
		}

		this.sprite.textures = [texture];
		this.sprite.gotoAndStop(0);
		this.currentVisual = frameKey;
	}

	private playAnimation(animationName: string): void {
		if (this.currentVisual === animationName || !this.spritesheet) {
			return;
		}

		const frames = this.spritesheet.animations[animationName];

		if (!frames?.length) {
			return;
		}

		this.sprite.textures = frames;
		this.sprite.loop = true;
		this.sprite.animationSpeed = RUN_ANIMATION_SPEED;
		this.sprite.play();
		this.currentVisual = animationName;
	}

	private isOnGround(): boolean {
		return this.groundContacts.size > 0;
	}

	private handleGroundCollision(collision: PhysicsCollisionInfo, isContact: boolean): void {
		const { bodyA, bodyB, normal } = collision;
		const platformBody = getPlatformBody(this.body, bodyA, bodyB);

		if (!platformBody) {
			return;
		}

		if (!isContact) {
			this.groundContacts.delete(platformBody);
			return;
		}

		if (isWalkableContact(this.body, bodyA, bodyB, normal)) {
			this.groundContacts.add(platformBody);
			return;
		}

		this.groundContacts.delete(platformBody);
	}

	private async loadSpritesheet(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>('blob');
		this.spritesheet = sheet;

		const displaySize = PLAYER_RADIUS * 2;
		const frameKey = this.facingRight ? 'blob-right' : 'blob-left';
		const texture = sheet.textures[frameKey] ?? Texture.EMPTY;

		this.sprite.textures = [texture];
		this.sprite.gotoAndStop(0);

		const scale = displaySize / Math.max(texture.width, texture.height);
		this.sprite.scale.set(scale);
		this.currentVisual = frameKey;
	}
}
