import { Bodies, Body, Engine, Events } from 'matter-js';
import { AnimatedSprite, Assets, Spritesheet, Texture } from 'pixi.js';

import { createEmptyPlayerControls, PlayerControls } from '../input/player-controls';
import {
	getPlatformBody,
	getWallContactSide,
	isStickyWallBody,
	isWalkableContact,
	PhysicsCollisionInfo,
	WallSide,
} from '../physics/ground-contact';
import { PhysicsBody } from '../physics/physics-body';
import { PhysicsWorld } from '../physics/physics-world';
import { PlayerJelly } from './player-jelly';
import { PlayerState, resolvePlayerState } from './player-state';
import { SoundManager } from '../managers/sound-manager';

export const PLAYER_RADIUS = 30;
const MOVE_SPEED_X = 5;
const LANDING_VELOCITY_THRESHOLD = 2;
const JUMP_VELOCITY = -12;
/** Ground jump from hide crouch (any crouchBlend above the state threshold). */
const CROUCH_JUMP_VELOCITY = -14;
/** Max |vy| allowed to start a sticky cling (half of jump speed; stays independent if jump changes). */
const STICKY_CLING_MAX_SPEED_Y = Math.abs(JUMP_VELOCITY) * 0.8;
/** Slow slide while clinging (px per physics frame). */
const STICKY_SLIDE_SPEED_Y = 0.05;
/** Small push into the wall so Matter keeps the contact while clinging. */
const STICKY_HOLD_SPEED_X = 0.8;
/** Wall jump vertical impulse = 4/5 of a normal jump. */
const WALL_JUMP_VELOCITY_Y = -10;
/** Frames to force horizontal move-speed away from the wall after a wall jump. */
const WALL_JUMP_HORIZONTAL_FRAMES = 8;
/** Stretch away from the wall before peel-off when pressing move-away. */
const CLING_PEEL_FRAMES = 8;
/** Jump wind-up frames before the jump impulse is applied */
const JUMP_CROUCH_FRAMES = 5;
/** Remember jump press in air so a near-landing tap still jumps */
const JUMP_BUFFER_FRAMES = 5;
/** Hold-to-hide crouch: blend-in duration (seconds). Exit is a tiny hop. */
const CROUCH_BLEND_SEC = 0.1;
/** Sprite alpha at full hide crouch. */
const CROUCH_HIDE_ALPHA = 0.6;
/** Matter collider scaleY at full hide crouch (half height). */
const CROUCH_BODY_SCALE_Y = 0.5;
/** Blend threshold to report crouch state / isHidden readiness. */
const CROUCH_STATE_BLEND = 0.05;
/** Upward hop when releasing crouch into idle (Y-down, same units as JUMP_VELOCITY). */
const CROUCH_STAND_HOP_VELOCITY = -3;
const RUN_ANIMATION_SPEED = 0.15;
const BURST_ANIMATION_SPEED = 0.4;
/** Hold on the last burst frame before respawn. */
const DEATH_PAUSE_SEC = 1;
const FRAME_HZ = 60;

type StickyWallContact = {
	body: Body;
	side: WallSide;
};

export class Player extends PhysicsBody {
	private readonly keysDown = new Set<string>();
	private readonly groundContacts = new Set<Body>();
	private readonly stickyWallContacts = new Map<number, StickyWallContact>();
	private readonly jelly = new PlayerJelly();
	private touchControls: PlayerControls = createEmptyPlayerControls();
	private state: PlayerState = 'idle';
	private facingRight = true;
	private airVelocityX = 0;
	private wasOnGround = false;
	/** Vertical velocity before the physics step resolves collisions (useful for landing SFX / fall damage). */
	private preStepVelocityY = 0;
	private jumpHeld = false;
	private jumpCrouchFramesLeft = 0;
	private wallCrouchFramesLeft = 0;
	private clingPeelFramesLeft = 0;
	private jumpBufferFrames = 0;
	private wallJumpFramesLeft = 0;
	private wallJumpDirection = 0;
	private clinging = false;
	private clingSide: WallSide | null = null;
	/** Hide crouch blend 0…1 (visual + collider). */
	private crouchBlend = 0;
	/** Current Matter body scaleY relative to spawn circle (1 = full). */
	private colliderScaleY = 1;
	private dying = false;
	private deathComplete = false;
	private deathPauseSecondsLeft = 0;
	private baseScale = 1;
	private spritesheet: Spritesheet | null = null;
	private currentVisual: string | null = null;
	private readonly blobSheetAlias: string;
	private boundEngine: Engine | null = null;
	private boundWorld: PhysicsWorld | null = null;
	private renderPrevX = 0;
	private renderPrevY = 0;
	private renderX = 0;
	private renderY = 0;
	/** Fired when burst animation ends (death VFX spawn point). */
	private onBurstFx: ((x: number, y: number, radius: number) => void) | null = null;

	private readonly onKeyDown = (event: KeyboardEvent): void => {
		this.keysDown.add(event.code);
	};

	private readonly onKeyUp = (event: KeyboardEvent): void => {
		this.keysDown.delete(event.code);
	};

	/** Browser/OS UI often swallows keyup while a key is held — drop stuck keys. */
	private readonly onWindowBlur = (): void => {
		this.clearKeysDown();
	};

	private readonly onVisibilityChange = (): void => {
		if (document.visibilityState === 'hidden') {
			this.clearKeysDown();
		}
	};

	private clearKeysDown(): void {
		this.keysDown.clear();
		this.jumpHeld = false;
	}

	private readonly onBeforeUpdate = (): void => {
		// Capture velocity before Matter resolves contacts — after the step, landing velocity is ~0.
		this.preStepVelocityY = this.body.velocity.y;
		if (this.dying) {
			Body.setVelocity(this.body, { x: 0, y: 0 });
			return;
		}
		this.applyInput();
	};

	private readonly onAfterUpdate = (): void => {
		this.renderPrevX = this.renderX;
		this.renderPrevY = this.renderY;
		this.renderX = this.body.position.x;
		this.renderY = this.body.position.y;
	};

	public constructor(x: number, y: number, blobSheetAlias = 'blob') {
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

		this.blobSheetAlias = blobSheetAlias;
		this.renderX = x;
		this.renderY = y;
		this.renderPrevX = x;
		this.renderPrevY = y;

		window.addEventListener('keydown', this.onKeyDown);
		window.addEventListener('keyup', this.onKeyUp);
		window.addEventListener('blur', this.onWindowBlur);
		document.addEventListener('visibilitychange', this.onVisibilityChange);
		void this.loadSpritesheet();
	}

	/** Merge invisible touch pad / future on-screen buttons with keyboard. */
	public setTouchControls(controls: PlayerControls): void {
		this.touchControls = controls;
	}

	public setBurstFxHandler(handler: ((x: number, y: number, radius: number) => void) | null): void {
		this.onBurstFx = handler;
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
		this.updateDeathPause(deltaTime);
		if (!this.dying) {
			this.updateCrouchBlend(deltaTime);
			this.syncCrouchCollider();
		}
		this.updateState();
		this.updateVisual();
		this.syncRenderPosition();
		if (!this.dying) {
			this.applyJelly(deltaTime);
			this.sprite.alpha = 1 - (1 - CROUCH_HIDE_ALPHA) * this.crouchBlend;
		} else {
			this.sprite.scale.set(this.baseScale);
			this.sprite.skew.x = 0;
			this.sprite.skew.y = 0;
			this.sprite.alpha = 1;
		}
	}

	public get isDying(): boolean {
		return this.dying;
	}

	/**
	 * Start burst death. Ignored if already dying.
	 * Call `finishDeathIfReady` each frame to respawn after burst + pause.
	 */
	public beginDeath(): void {
		if (this.dying) {
			return;
		}

		this.dying = true;
		this.deathComplete = false;
		this.deathPauseSecondsLeft = 0;
		this.clinging = false;
		this.clingSide = null;
		this.jumpCrouchFramesLeft = 0;
		this.wallCrouchFramesLeft = 0;
		this.clingPeelFramesLeft = 0;
		this.jumpBufferFrames = 0;
		this.wallJumpFramesLeft = 0;
		this.resetCrouchPose();
		this.groundContacts.clear();
		this.stickyWallContacts.clear();
		Body.setVelocity(this.body, { x: 0, y: 0 });
		this.body.isSensor = true;
		this.state = 'dying';
		SoundManager.playSound('blob-burst', 1, { speed: Math.random() * 0.3 + 1.2 });
		this.playBurstAnimation();
	}

	/** Respawn once burst animation and death pause have finished. Returns true if respawn happened. */
	public finishDeathIfReady(x: number, y: number): boolean {
		if (!this.dying || !this.deathComplete) {
			return false;
		}

		this.respawnAt(x, y);
		return true;
	}

	private updateDeathPause(deltaTime: number): void {
		if (!this.dying || this.deathComplete || this.deathPauseSecondsLeft <= 0) {
			return;
		}

		this.deathPauseSecondsLeft -= Math.max(deltaTime, 0) / FRAME_HZ;
		if (this.deathPauseSecondsLeft <= 0) {
			this.deathPauseSecondsLeft = 0;
			this.deathComplete = true;
		}
	}

	private startDeathPause(): void {
		this.deathPauseSecondsLeft = DEATH_PAUSE_SEC;
		this.onBurstFx?.(this.body.position.x, this.body.position.y, PLAYER_RADIUS);
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

	/** Fully blended hide crouch — for future enemy LOS. */
	public get isHidden(): boolean {
		return this.crouchBlend >= 1;
	}

	/** Snap back to a point and clear motion / death state. */
	public respawnAt(x: number, y: number): void {
		this.sprite.onComplete = undefined;
		Body.setPosition(this.body, { x, y });
		Body.setVelocity(this.body, { x: 0, y: 0 });
		Body.setAngularVelocity(this.body, 0);
		Body.setAngle(this.body, 0);
		this.body.isSensor = false;
		this.groundContacts.clear();
		this.stickyWallContacts.clear();
		this.airVelocityX = 0;
		this.wasOnGround = true;
		this.preStepVelocityY = 0;
		this.jumpCrouchFramesLeft = 0;
		this.wallCrouchFramesLeft = 0;
		this.clingPeelFramesLeft = 0;
		this.jumpBufferFrames = 0;
		this.wallJumpFramesLeft = 0;
		this.wallJumpDirection = 0;
		this.clinging = false;
		this.clingSide = null;
		this.resetCrouchPose();
		this.dying = false;
		this.deathComplete = false;
		this.deathPauseSecondsLeft = 0;
		this.renderX = x;
		this.renderY = y;
		this.renderPrevX = x;
		this.renderPrevY = y;
		this.currentVisual = null;
		this.sprite.visible = true;
		this.sprite.alpha = 1;
		this.syncRenderPosition();
		const frameKey = this.facingRight ? 'blob-right' : 'blob-left';
		this.setStaticFrame(frameKey);
	}

	public override destroy(options?: Parameters<PhysicsBody['destroy']>[0]): void {
		window.removeEventListener('keydown', this.onKeyDown);
		window.removeEventListener('keyup', this.onKeyUp);
		window.removeEventListener('blur', this.onWindowBlur);
		document.removeEventListener('visibilitychange', this.onVisibilityChange);
		this.clearKeysDown();

		if (this.boundEngine) {
			Events.off(this.boundEngine, 'beforeUpdate', this.onBeforeUpdate);
			Events.off(this.boundEngine, 'afterUpdate', this.onAfterUpdate);
			this.boundEngine = null;
		}
		this.boundWorld = null;

		this.groundContacts.clear();
		this.stickyWallContacts.clear();
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
		const crouchHeld =
			this.keysDown.has('ArrowDown')
			|| this.keysDown.has('KeyS')
			|| this.touchControls.crouch;
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

		if (this.clinging) {
			this.applyClingInput(moveDirection, jumpPressed, onGround);
			return;
		}

		// Hold crouch on ground: stand still (no crawl in Poki). Facing still follows input.
		const hideStanding = onGround && crouchHeld && this.jumpCrouchFramesLeft <= 0;
		if (hideStanding) {
			if (moveLeft && !moveRight) {
				this.facingRight = false;
			} else if (moveRight && !moveLeft) {
				this.facingRight = true;
			}
			moveDirection = 0;
		} else if (moveDirection !== 0) {
			this.facingRight = moveDirection > 0;
		}

		const speedX = this.resolveHorizontalSpeed(moveDirection);
		this.airVelocityX = speedX;

		if (jumpPressed) {
			if (onGround && this.jumpCrouchFramesLeft <= 0) {
				this.startGroundJump(speedX);
			} else if (!onGround) {
				this.jumpBufferFrames = JUMP_BUFFER_FRAMES;
			}
		} else if (!crouchHeld && this.crouchBlend > 0 && this.jumpCrouchFramesLeft <= 0) {
			// Release crouch: tiny hop instead of blend-out stand-up (jump path clears crouch itself).
			if (onGround && this.crouchBlend > CROUCH_STATE_BLEND) {
				this.launchCrouchStandHop();
			} else {
				this.clearHideCrouch();
			}
		}

		if (this.jumpBufferFrames > 0) {
			this.jumpBufferFrames -= 1;

			if (onGround && this.jumpCrouchFramesLeft <= 0) {
				this.jumpBufferFrames = 0;
				this.startGroundJump(speedX);
			}
		}

		if (this.jumpCrouchFramesLeft > 0) {
			this.jumpCrouchFramesLeft -= 1;

			// Left the platform during wind-up — commit the jump immediately
			// instead of canceling (avoids walking off an edge during crouch).
			if (!onGround) {
				this.launchJump(speedX);
				return;
			}

			if (this.jumpCrouchFramesLeft <= 0) {
				this.launchJump(speedX);
				return;
			}
		}

		if (!onGround) {
			this.tryStartCling(moveDirection);
		}

		if (this.clinging) {
			this.applyClingVelocity();
			return;
		}

		Body.setVelocity(this.body, {
			x: speedX,
			y: this.body.velocity.y,
		});
	}

	private applyClingInput(moveDirection: number, jumpPressed: boolean, onGround: boolean): void {
		if (onGround) {
			this.endCling();
			Body.setVelocity(this.body, {
				x: moveDirection * MOVE_SPEED_X,
				y: this.body.velocity.y,
			});
			return;
		}

		if (!this.hasActiveClingContact()) {
			this.endCling();
			Body.setVelocity(this.body, {
				x: moveDirection * MOVE_SPEED_X,
				y: this.body.velocity.y,
			});
			return;
		}

		const awayDirection = this.clingSide === 'left' ? 1 : -1;
		const movingAway = moveDirection === awayDirection;

		// Jump wins over peel / move-away (fixes same-frame move stealing the jump).
		if (jumpPressed && this.wallCrouchFramesLeft <= 0) {
			this.clingPeelFramesLeft = 0;
			this.beginWallJumpCrouch();
		}

		if (this.wallCrouchFramesLeft > 0) {
			this.wallCrouchFramesLeft -= 1;

			if (!this.hasActiveClingContact()) {
				this.launchWallJump();
				return;
			}

			if (this.wallCrouchFramesLeft <= 0) {
				this.launchWallJump();
				return;
			}

			this.applyClingVelocity();
			return;
		}

		if (movingAway) {
			if (this.clingPeelFramesLeft <= 0) {
				this.clingPeelFramesLeft = CLING_PEEL_FRAMES;
				this.jelly.beginClingPeel();
			}

			this.clingPeelFramesLeft -= 1;

			if (this.clingPeelFramesLeft <= 0) {
				this.endCling();
				Body.setVelocity(this.body, {
					x: moveDirection * MOVE_SPEED_X,
					y: this.body.velocity.y,
				});
				return;
			}
		} else {
			this.clingPeelFramesLeft = 0;
		}

		this.applyClingVelocity();
	}

	private tryStartCling(moveDirection: number): void {
		if (this.jumpCrouchFramesLeft > 0 || this.wallJumpFramesLeft > 0) {
			return;
		}

		if (Math.abs(this.body.velocity.y) >= STICKY_CLING_MAX_SPEED_Y) {
			return;
		}

		const contact = this.findClingableContact(moveDirection);
		if (!contact) {
			return;
		}

		this.clinging = true;
		this.clingSide = contact.side;
		this.facingRight = contact.side === 'left';
		this.jumpBufferFrames = 0;
		this.jumpCrouchFramesLeft = 0;
		this.clearHideCrouch();
		SoundManager.playSound('blob-stick', 1, { speed: Math.random() * 0.2 + 0.9 });
		//void SoundManager.playSound('blob-land', 1, { speed: Math.random() * 0.2 + 1.8 });
	}

	private findClingableContact(moveDirection: number): StickyWallContact | null {
		for (const contact of this.stickyWallContacts.values()) {
			const towardWall = contact.side === 'left' ? -1 : 1;
			if (moveDirection === towardWall && this.isStickyWallClingHeightOk(contact.body)) {
				return contact;
			}
		}

		return null;
	}

	private hasActiveClingContact(): boolean {
		if (!this.clingSide) {
			return false;
		}

		for (const contact of this.stickyWallContacts.values()) {
			if (contact.side === this.clingSide && this.isStickyWallClingHeightOk(contact.body)) {
				return true;
			}
		}

		return false;
	}

	/**
	 * Cling only when the wall top is above the blob center.
	 * Blocks corner grabs where the hang pose looks attached to empty air.
	 */
	private isStickyWallClingHeightOk(wallBody: Body): boolean {
		return wallBody.bounds.min.y < this.body.position.y;
	}

	private applyClingVelocity(): void {
		if (!this.clingSide) {
			return;
		}

		const holdX = this.clingSide === 'left' ? -STICKY_HOLD_SPEED_X : STICKY_HOLD_SPEED_X;
		this.facingRight = this.clingSide === 'left';
		Body.setVelocity(this.body, {
			x: holdX,
			y: STICKY_SLIDE_SPEED_Y,
		});
	}

	private endCling(playUnstickSound = true): void {
		const wasClinging = this.clinging;
		this.clinging = false;
		this.clingSide = null;
		this.wallCrouchFramesLeft = 0;
		this.clingPeelFramesLeft = 0;

		if (wasClinging && playUnstickSound) {
			SoundManager.playSound('blob-unstick', 1, { speed: Math.random() * 0.2 + 0.9 });
			//SoundManager.playSound('blob-jump', 1, { speed: Math.random() * 0.2 + 1.8 });
		}
	}

	/**
	 * Ground jump. From hide crouch the blob is already compressed — skip the
	 * squat wind-up and launch with CROUCH_JUMP_VELOCITY.
	 */
	private startGroundJump(speedX: number): void {
		if (this.crouchBlend > CROUCH_STATE_BLEND) {
			this.clearHideCrouch();
			this.launchJump(speedX, CROUCH_JUMP_VELOCITY, Math.random() * 0.1 + 0.7);
			return;
		}

		this.beginJumpCrouch();
	}

	private beginJumpCrouch(): void {
		this.jumpCrouchFramesLeft = JUMP_CROUCH_FRAMES;
		this.jelly.anticipateJump();
	}

	private beginWallJumpCrouch(): void {
		this.wallCrouchFramesLeft = JUMP_CROUCH_FRAMES;
		this.jelly.anticipateWallJump();
	}

	private launchJump(speedX: number, velocityY = JUMP_VELOCITY, soundSpeed = Math.random() * 0.3 + 1): void {
		this.jumpCrouchFramesLeft = 0;
		this.jumpBufferFrames = 0;
		Body.setVelocity(this.body, {
			x: speedX,
			y: velocityY,
		});
		this.groundContacts.clear();
		SoundManager.playSound('blob-jump', 1, { speed: soundSpeed });
	}

	/** Micro-hop out of hide crouch — leave/land jelly provides the settle wobble. */
	private launchCrouchStandHop(): void {
		this.clearHideCrouch();
		Body.setVelocity(this.body, {
			x: this.body.velocity.x,
			y: CROUCH_STAND_HOP_VELOCITY,
		});
		this.groundContacts.clear();
	}

	private isCrouchHeld(): boolean {
		return this.keysDown.has('ArrowDown')
			|| this.keysDown.has('KeyS')
			|| this.touchControls.crouch;
	}

	/** Snap hide crouch off (jump / cling) and expand collider immediately. */
	private clearHideCrouch(): void {
		this.crouchBlend = 0;
		this.syncCrouchCollider();
	}

	/** Full reset for death / respawn — restore circle without planting shift. */
	private resetCrouchPose(): void {
		this.crouchBlend = 0;
		if (Math.abs(this.colliderScaleY - 1) < 1e-6) {
			this.colliderScaleY = 1;
			return;
		}

		Body.scale(this.body, 1, 1 / this.colliderScaleY);
		this.colliderScaleY = 1;
	}

	private updateCrouchBlend(deltaTime: number): void {
		const dtSec = Math.max(deltaTime, 0) / FRAME_HZ;
		const onGround = this.isOnGround();
		const wantCrouch = onGround
			&& !this.clinging
			&& this.jumpCrouchFramesLeft <= 0
			&& this.isCrouchHeld();

		// Blend in only — release is a stand hop from applyInput, not a blend-out.
		if (!wantCrouch) {
			return;
		}

		const step = CROUCH_BLEND_SEC > 0 ? dtSec / CROUCH_BLEND_SEC : 1;
		this.crouchBlend = Math.min(1, this.crouchBlend + step);
	}

	/**
	 * Scale the circle into a flatter ellipse and shift the center so the
	 * bottom contact point stays planted (Matter scales about the center).
	 * Also nudge the render pose — display uses interpolated renderY, not body.y,
	 * so a plant shift must not lag a frame behind jelly stretch (jump-from-crouch).
	 */
	private syncCrouchCollider(): void {
		const targetScaleY = 1 - (1 - CROUCH_BODY_SCALE_Y) * this.crouchBlend;
		if (Math.abs(targetScaleY - this.colliderScaleY) < 1e-6) {
			return;
		}

		const prevScaleY = this.colliderScaleY;
		const factorY = targetScaleY / prevScaleY;
		const plantDy = PLAYER_RADIUS * (prevScaleY - targetScaleY);
		Body.scale(this.body, 1, factorY);
		// Y-down: shrinking moves the bottom up; push center down to keep feet planted.
		Body.setPosition(this.body, {
			x: this.body.position.x,
			y: this.body.position.y + plantDy,
		});
		this.renderY += plantDy;
		this.renderPrevY += plantDy;
		this.colliderScaleY = targetScaleY;
	}

	private launchWallJump(): void {
		const awayDirection = this.clingSide === 'left' ? 1 : -1;
		this.wallCrouchFramesLeft = 0;
		this.jumpBufferFrames = 0;
		this.wallJumpDirection = awayDirection;
		this.wallJumpFramesLeft = WALL_JUMP_HORIZONTAL_FRAMES;
		this.facingRight = awayDirection > 0;
		// Wall jump already has jump SFX — skip peel unstick.
		this.endCling(false);
		Body.setVelocity(this.body, {
			x: awayDirection * MOVE_SPEED_X,
			y: WALL_JUMP_VELOCITY_Y,
		});
		SoundManager.playSound('blob-jump', 1, { speed: Math.random() * 0.4 + 0.8 });
	}

	private resolveHorizontalSpeed(moveDirection: number): number {
		if (this.wallJumpFramesLeft > 0) {
			this.wallJumpFramesLeft -= 1;
			return this.wallJumpDirection * MOVE_SPEED_X;
		}

		return moveDirection * MOVE_SPEED_X;
	}

	private updateState(): void {
		if (this.dying) {
			this.state = 'dying';
			return;
		}

		const onGround = this.isOnGround();

		if (onGround && !this.wasOnGround && this.preStepVelocityY > LANDING_VELOCITY_THRESHOLD) {
			void SoundManager.playSound('blob-land', 1, { speed: Math.random() * 0.4 + 0.9 });
		}

		this.wasOnGround = onGround;
		this.state = resolvePlayerState({
			velocityX: this.body.velocity.x,
			velocityY: this.body.velocity.y,
			onGround,
			clinging: this.clinging,
			crouching: onGround && this.crouchBlend > CROUCH_STATE_BLEND,
			dying: false,
		});
	}

	private updateVisual(): void {
		if (!this.spritesheet || this.dying) {
			return;
		}

		if (this.state === 'cling') {
			this.playAnimation(this.facingRight ? 'hang-right' : 'hang-left');
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
			jumpCrouching: this.jumpCrouchFramesLeft > 0,
			crouchBlend: this.crouchBlend,
			clinging: this.clinging,
			wallSide: this.clingSide,
			wallCrouching: this.wallCrouchFramesLeft > 0,
			wallPeeling: this.clingPeelFramesLeft > 0,
			moveSpeedX: MOVE_SPEED_X,
			halfHeight: PLAYER_RADIUS,
			colliderScaleY: this.colliderScaleY,
			deltaTime,
		});

		this.sprite.scale.set(this.baseScale * pose.scaleX, this.baseScale * pose.scaleY);
		this.sprite.skew.x = pose.skewX;
		this.sprite.skew.y = pose.skewY;
		this.display.position.x += pose.offsetX;
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

		this.sprite.onComplete = undefined;
		this.sprite.textures = frames;
		this.sprite.loop = true;
		this.sprite.animationSpeed = RUN_ANIMATION_SPEED;
		this.sprite.play();
		this.currentVisual = animationName;
	}

	private playBurstAnimation(): void {
		if (!this.spritesheet) {
			this.startDeathPause();
			return;
		}

		const frames = this.spritesheet.animations.burst;

		if (!frames?.length) {
			this.startDeathPause();
			return;
		}

		this.sprite.onComplete = () => {
			this.startDeathPause();
		};
		this.sprite.textures = frames;
		this.sprite.loop = false;
		this.sprite.animationSpeed = BURST_ANIMATION_SPEED;
		this.sprite.gotoAndPlay(0);
		this.currentVisual = 'burst';
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
			this.stickyWallContacts.delete(platformBody.id);
			return;
		}

		if (isWalkableContact(this.body, bodyA, bodyB, normal)) {
			this.groundContacts.add(platformBody);
			this.stickyWallContacts.delete(platformBody.id);
			return;
		}

		this.groundContacts.delete(platformBody);

		const wallSide = getWallContactSide(this.body, bodyA, bodyB, normal);
		if (wallSide && isStickyWallBody(platformBody)) {
			this.stickyWallContacts.set(platformBody.id, { body: platformBody, side: wallSide });
			return;
		}

		this.stickyWallContacts.delete(platformBody.id);
	}

	private async loadSpritesheet(): Promise<void> {
		const sheet = await Assets.load<Spritesheet>(this.blobSheetAlias);
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
