import { Bodies, Body, Engine, Events } from 'matter-js';
import { AnimatedSprite, Assets, Spritesheet, Texture } from 'pixi.js';

import { createEmptyPlayerControls, PlayerControls } from '../input/player-controls';
import { getPlatformBody, isWalkableContact, PhysicsCollisionInfo } from '../physics/ground-contact';
import { PhysicsBody } from '../physics/physics-body';
import { PhysicsWorld } from '../physics/physics-world';
import { PlayerJelly } from './player-jelly';
import { PlayerState, resolvePlayerState } from './player-state';
import { SoundManager } from '../managers/sound-manager';

const PLAYER_RADIUS = 30;
const MOVE_SPEED_X = 6;
const LANDING_VELOCITY_THRESHOLD = 2;
const JUMP_VELOCITY = -15;
/** Crouch wind-up frames before the jump impulse is applied */
const JUMP_CROUCH_FRAMES = 5;
/** Remember jump press in air so a near-landing tap still jumps */
const JUMP_BUFFER_FRAMES = 5;
const RUN_ANIMATION_SPEED = 0.15;

export class Player extends PhysicsBody {
	private readonly keysDown = new Set<string>();
	private readonly groundContacts = new Set<Body>();
	private readonly jelly = new PlayerJelly();
	private touchControls: PlayerControls = createEmptyPlayerControls();
	private state: PlayerState = 'idle';
	private facingRight = true;
	private airVelocityX = 0;
	private wasOnGround = false;
	/** Vertical velocity before the physics step resolves collisions (useful for landing SFX / fall damage). */
	private preStepVelocityY = 0;
	private jumpHeld = false;
	private crouchFramesLeft = 0;
	private jumpBufferFrames = 0;
	private baseScale = 1;
	private spritesheet: Spritesheet | null = null;
	private currentVisual: string | null = null;
	private boundEngine: Engine | null = null;
	private boundWorld: PhysicsWorld | null = null;
	private renderPrevX = 0;
	private renderPrevY = 0;
	private renderX = 0;
	private renderY = 0;

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		this.keysDown.add(event.code);
	};

	private readonly onKeyUp = (event: KeyboardEvent): void => {
		this.keysDown.delete(event.code);
	};

	private readonly onBeforeUpdate = (): void => {
		// Capture velocity before Matter resolves contacts — after the step, landing velocity is ~0.
		this.preStepVelocityY = this.body.velocity.y;
		this.applyInput();
	};

	private readonly onAfterUpdate = (): void => {
		this.renderPrevX = this.renderX;
		this.renderPrevY = this.renderY;
		this.renderX = this.body.position.x;
		this.renderY = this.body.position.y;
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

		this.renderX = x;
		this.renderY = y;
		this.renderPrevX = x;
		this.renderPrevY = y;

		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
		void this.loadSpritesheet();
	}

	/** Merge invisible touch pad / future on-screen buttons with keyboard. */
	public setTouchControls(controls: PlayerControls): void {
		this.touchControls = controls;
	}

	public bindPhysics(world: PhysicsWorld): void {
		this.boundWorld = world;
		this.boundEngine = world.engine;
		Events.on(world.engine, 'beforeUpdate', this.onBeforeUpdate);
		Events.on(world.engine, 'afterUpdate', this.onAfterUpdate);

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

	public update(deltaTime: number): void {
		Body.setAngularVelocity(this.body, 0);
		Body.setAngle(this.body, 0);
		this.updateState();
		this.updateVisual();
		this.syncRenderPosition();
		this.applyJelly(deltaTime);
	}

	public get position(): { x: number; y: number } {
		return { x: this.body.position.x, y: this.body.position.y };
	}

	/** Interpolated pose used for camera follow and drawing. */
	public getRenderPosition(): { x: number; y: number } {
		const alpha = this.boundWorld?.getInterpolationAlpha() ?? 1;
		return {
			x: this.renderPrevX + (this.renderX - this.renderPrevX) * alpha,
			y: this.renderPrevY + (this.renderY - this.renderPrevY) * alpha,
		};
	}

	/**
	 * Snap sprite to the same screen-pixel grid as the camera scroll.
	 * Avoids 1px left/right shimmer when camera rounds but the player does not.
	 */
	public alignDisplayToCameraPixels(cameraX: number, cameraY: number, renderScale: number): void {
		const scale = renderScale > 0 ? renderScale : 1;
		const worldX = this.display.position.x;
		const worldY = this.display.position.y;
		const screenX = Math.round((worldX - cameraX) * scale);
		const screenY = Math.round((worldY - cameraY) * scale);
		this.display.position.set(screenX / scale + cameraX, screenY / scale + cameraY);
	}

	public get playerState(): PlayerState {
		return this.state;
	}

	/** Stub for death / fall-off: snap back to a point and clear motion. */
	public respawnAt(x: number, y: number): void {
		Body.setPosition(this.body, { x, y });
		Body.setVelocity(this.body, { x: 0, y: 0 });
		Body.setAngularVelocity(this.body, 0);
		Body.setAngle(this.body, 0);
		this.groundContacts.clear();
		this.airVelocityX = 0;
		this.wasOnGround = true;
		this.preStepVelocityY = 0;
		this.crouchFramesLeft = 0;
		this.jumpBufferFrames = 0;
		this.renderX = x;
		this.renderY = y;
		this.renderPrevX = x;
		this.renderPrevY = y;
		this.syncRenderPosition();
	}

	public override destroy(options?: Parameters<PhysicsBody['destroy']>[0]): void {
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);

		if (this.boundEngine) {
			Events.off(this.boundEngine, 'beforeUpdate', this.onBeforeUpdate);
			Events.off(this.boundEngine, 'afterUpdate', this.onAfterUpdate);
			this.boundEngine = null;
		}
		this.boundWorld = null;

		this.groundContacts.clear();
		super.destroy(options);
	}

	private get sprite(): AnimatedSprite {
		return this.display as AnimatedSprite;
	}

	private syncRenderPosition(): void {
		const pose = this.getRenderPosition();
		this.display.position.set(pose.x, pose.y);
		this.display.rotation = 0;
	}

	private applyInput(): void {
		const moveLeft =
			this.keysDown.has('ArrowLeft')
			|| this.keysDown.has('KeyA')
			|| this.touchControls.moveLeft;
		const moveRight =
			this.keysDown.has('ArrowRight')
			|| this.keysDown.has('KeyD')
			|| this.touchControls.moveRight;
		const jumpDown =
			this.keysDown.has('Space')
			|| this.keysDown.has('ArrowUp')
			|| this.keysDown.has('KeyW')
			|| this.touchControls.jump;
		const jumpPressed = jumpDown && !this.jumpHeld;
		this.jumpHeld = jumpDown;
		const onGround = this.isOnGround();

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
			if (onGround && this.crouchFramesLeft <= 0) {
				this.beginJumpCrouch();
			} else if (!onGround) {
				this.jumpBufferFrames = JUMP_BUFFER_FRAMES;
			}
		}

		if (this.jumpBufferFrames > 0) {
			this.jumpBufferFrames -= 1;

			if (onGround && this.crouchFramesLeft <= 0) {
				this.jumpBufferFrames = 0;
				this.beginJumpCrouch();
			}
		}

		if (this.crouchFramesLeft > 0) {
			this.crouchFramesLeft -= 1;

			// Left the platform during wind-up — commit the jump immediately
			// instead of canceling (avoids walking off an edge during crouch).
			if (!onGround) {
				this.launchJump(speedX);
				return;
			}

			if (this.crouchFramesLeft <= 0) {
				this.launchJump(speedX);
				return;
			}
		}

		Body.setVelocity(this.body, {
			x: speedX,
			y: this.body.velocity.y,
		});
	}

	private beginJumpCrouch(): void {
		this.crouchFramesLeft = JUMP_CROUCH_FRAMES;
		this.jelly.anticipateJump();
	}

	private launchJump(speedX: number): void {
		this.crouchFramesLeft = 0;
		this.jumpBufferFrames = 0;
		Body.setVelocity(this.body, {
			x: speedX,
			y: JUMP_VELOCITY,
		});
		this.groundContacts.clear();
		SoundManager.playSound('blob-jump', 1, { speed: Math.random() * 0.4 + 0.8 });
	}

	private updateState(): void {
		const onGround = this.isOnGround();

		if (onGround && !this.wasOnGround && this.preStepVelocityY > LANDING_VELOCITY_THRESHOLD) {
			void SoundManager.playSound('blob-land', 1, { speed: Math.random() * 0.4 + 0.9 });
		}

		this.wasOnGround = onGround;
		this.state = resolvePlayerState({
			velocityX: this.body.velocity.x,
			velocityY: this.body.velocity.y,
			onGround,
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

	private applyJelly(deltaTime: number): void {
		const pose = this.jelly.update({
			state: this.state,
			velocityX: this.body.velocity.x,
			velocityY: this.body.velocity.y,
			onGround: this.isOnGround(),
			crouching: this.crouchFramesLeft > 0,
			moveSpeedX: MOVE_SPEED_X,
			halfHeight: PLAYER_RADIUS,
			deltaTime,
		});

		this.sprite.scale.set(this.baseScale * pose.scaleX, this.baseScale * pose.scaleY);
		this.sprite.skew.x = pose.skewX;
		this.display.position.y += pose.offsetY;
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

		this.baseScale = displaySize / Math.max(texture.width, texture.height);
		this.sprite.scale.set(this.baseScale);
		this.currentVisual = frameKey;
	}
}
