import { Bodies, Body, Engine, Events } from 'matter-js';
import { AnimatedSprite, Assets, Spritesheet, Texture } from 'pixi.js';

import { axisDirection, createEmptyPlayerControls, PlayerControls } from '../input/player-controls';
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
/** Walk speed while uncrouching. Stand-up only — dash must not use this. */
const CROUCH_MOVE_SPEED_X = 3;
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
/** Crouch-jump grace after releasing hide (~300 ms at 60 Hz). */
const CROUCH_JUMP_BUFFER_FRAMES = 22;
/** Slow stand-up start before the hop — visual cue that a crouch-jump is still available. */
const CROUCH_STAND_WINDUP_FRAMES = 16;
/** Crouch blend remaining at the end of stand windup (then hop unfurls). */
const CROUCH_STAND_WINDUP_END_RATIO = 0.78;
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
	/** Analog jump strength captured at press / updated while charging (keyboard = 1). */
	private jumpAxis = 1;
	private jumpCrouchFramesLeft = 0;
	/** True while a ground jump squat is held (including waiting for swipe commit). */
	private jumpWindupActive = false;
	/** Once the jump is locked in, wind-up must launch (keyboard / committed swipe). */
	private jumpWindupLocked = false;
	private wallCrouchFramesLeft = 0;
	private clingPeelFramesLeft = 0;
	private jumpBufferFrames = 0;
	private wallJumpFramesLeft = 0;
	private wallJumpDirection = 0;
	private clinging = false;
	private clingSide: WallSide | null = null;
	/** Hide crouch blend 0…1 (visual + collider). */
	private crouchBlend = 0;
	/** Extra frames where a locked-in jump still counts as a crouch-jump. */
	private crouchJumpBufferFrames = 0;
	/** Frames left in the slow stand-up start after releasing crouch. */
	private crouchStandWindupFramesLeft = 0;
	private crouchStandWindupStartBlend = 1;
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
		this.jumpBufferFrames = 0;
		if (this.jumpWindupActive) {
			this.jumpWindupActive = false;
			this.jumpWindupLocked = false;
			this.jumpCrouchFramesLeft = 0;
			this.jumpAxis = 1;
		}
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

	/** Merge gesture / future gamepad axes with keyboard. */
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
		this.jumpWindupActive = false;
		this.jumpWindupLocked = false;
		this.wallCrouchFramesLeft = 0;
		this.clingPeelFramesLeft = 0;
		this.jumpBufferFrames = 0;
		this.wallJumpFramesLeft = 0;
		this.crouchJumpBufferFrames = 0;
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

	public get isClinging(): boolean {
		return this.clinging;
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
		this.jumpWindupActive = false;
		this.jumpWindupLocked = false;
		this.wallCrouchFramesLeft = 0;
		this.clingPeelFramesLeft = 0;
		this.jumpBufferFrames = 0;
		this.wallJumpFramesLeft = 0;
		this.wallJumpDirection = 0;
		this.jumpHeld = false;
		this.jumpAxis = 1;
		this.crouchJumpBufferFrames = 0;
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
		const keyLeft = this.keysDown.has('ArrowLeft') || this.keysDown.has('KeyA');
		const keyRight = this.keysDown.has('ArrowRight') || this.keysDown.has('KeyD');
		const keyJump =
			this.keysDown.has('Space')
			|| this.keysDown.has('ArrowUp')
			|| this.keysDown.has('KeyW');
		const keyCrouch = this.keysDown.has('ArrowDown') || this.keysDown.has('KeyS');

		let moveX = this.touchControls.moveX;
		if (keyLeft && !keyRight) {
			moveX = -1;
		} else if (keyRight && !keyLeft) {
			moveX = 1;
		} else if (keyLeft && keyRight) {
			moveX = 0;
		}

		const jumpAmount = keyJump ? 1 : this.touchControls.jump;
		const crouchHeld = keyCrouch || this.touchControls.crouch;
		const jumpPressed = jumpAmount > 0 && !this.jumpHeld;
		this.jumpHeld = jumpAmount > 0;
		const onGround = this.isOnGround();
		this.tickCrouchJumpBuffer();
		const moveDirection = axisDirection(moveX);
		const jumpLockedIn = keyJump || this.touchControls.jumpCommitted;

		if (this.clinging) {
			this.applyClingInput(moveX, jumpPressed, jumpAmount, onGround);
			return;
		}

		// Hold crouch on ground: stand still (no crawl in Poki). Facing still follows input.
		const hideStanding = onGround && crouchHeld && !this.jumpWindupActive;
		if (hideStanding) {
			if (moveDirection < 0) {
				this.facingRight = false;
			} else if (moveDirection > 0) {
				this.facingRight = true;
			}
			moveX = 0;
		} else if (moveDirection !== 0) {
			this.facingRight = moveDirection > 0;
		}

		const speedX = this.resolveHorizontalSpeed(moveX);
		this.airVelocityX = speedX;

		if (jumpPressed) {
			this.jumpAxis = jumpAmount;
			if (onGround && !this.jumpWindupActive) {
				this.startGroundJump(speedX, jumpLockedIn);
			} else if (
				!onGround
				&& jumpLockedIn
				&& this.canCrouchJump()
				&& !this.jumpWindupActive
			) {
				// Stand-hop is airborne; 5-frame jump buffer expires before landing.
				this.launchFromHideCrouch(speedX);
				return;
			} else if (!onGround) {
				this.jumpBufferFrames = JUMP_BUFFER_FRAMES;
			}
		} else if (jumpAmount > 0 && this.jumpWindupActive) {
			this.jumpAxis = jumpAmount;
		} else if (!onGround && this.crouchBlend > 0 && !this.jumpWindupActive) {
			this.releaseCrouchIntoFall();
		} else if (!crouchHeld && this.crouchBlend > 0 && !this.jumpWindupActive) {
			if (this.crouchBlend > CROUCH_STATE_BLEND) {
				this.tickCrouchStandWindup();
			} else {
				this.clearHideCrouch();
			}
		} else if (crouchHeld) {
			this.crouchStandWindupFramesLeft = 0;
		}

		if (this.jumpBufferFrames > 0) {
			this.jumpBufferFrames -= 1;

			if (onGround && !this.jumpWindupActive) {
				this.jumpBufferFrames = 0;
				this.startGroundJump(speedX, true);
			}
		}

		if (this.jumpWindupActive) {
			if (jumpLockedIn) {
				this.jumpWindupLocked = true;
			}

			const abortCharge = onGround
				&& !this.jumpWindupLocked
				&& jumpAmount <= 0
				&& this.touchControls.cancelJumpOnRelease;
			if (abortCharge) {
				this.jumpWindupActive = false;
				this.jumpWindupLocked = false;
				this.jumpCrouchFramesLeft = 0;
				this.jumpAxis = 1;
				this.clearHideCrouch();
			} else {
				if (this.jumpWindupLocked && this.canCrouchJump()) {
					this.launchFromHideCrouch(speedX);
					return;
				}

				if (this.jumpCrouchFramesLeft > 0) {
					this.jumpCrouchFramesLeft -= 1;
				}

				if (!onGround || (this.jumpWindupLocked && this.jumpCrouchFramesLeft <= 0)) {
					if (this.canCrouchJump()) {
						this.launchFromHideCrouch(speedX);
					} else {
						this.launchJump(speedX, JUMP_VELOCITY * this.jumpAxis);
					}
					return;
				}
			}
		}

		if (!onGround) {
			this.tryStartCling();
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

	private applyClingInput(
		moveX: number,
		jumpPressed: boolean,
		jumpAmount: number,
		onGround: boolean,
	): void {
		let moveDirection = axisDirection(moveX);
		const towardWall = this.clingSide === 'left' ? -1 : 1;
		// Horizontal swipe into the wall is ignored; climb uses an upward swipe.
		if (!jumpPressed && this.wallCrouchFramesLeft <= 0 && moveDirection === towardWall) {
			moveDirection = 0;
		}

		if (onGround) {
			this.endCling();
			Body.setVelocity(this.body, {
				x: moveX * MOVE_SPEED_X,
				y: this.body.velocity.y,
			});
			return;
		}

		if (!this.hasActiveClingContact()) {
			this.endCling();
			Body.setVelocity(this.body, {
				x: moveX * MOVE_SPEED_X,
				y: this.body.velocity.y,
			});
			return;
		}

		const awayDirection = this.clingSide === 'left' ? 1 : -1;
		const movingAway = moveDirection === awayDirection;

		// Jump wins over peel / move-away (fixes same-frame move stealing the jump).
		if (jumpPressed && this.wallCrouchFramesLeft <= 0) {
			this.jumpAxis = jumpAmount;
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
					x: moveX * MOVE_SPEED_X,
					y: this.body.velocity.y,
				});
				return;
			}
		} else {
			this.clingPeelFramesLeft = 0;
		}

		this.applyClingVelocity();
	}

	private tryStartCling(): void {
		if (this.jumpCrouchFramesLeft > 0 || this.jumpWindupActive || this.wallJumpFramesLeft > 0) {
			return;
		}

		if (Math.abs(this.body.velocity.y) >= STICKY_CLING_MAX_SPEED_Y) {
			return;
		}

		const contact = this.findClingableContact();
		if (!contact) {
			return;
		}

		this.clinging = true;
		this.clingSide = contact.side;
		this.facingRight = contact.side === 'left';
		this.jumpBufferFrames = 0;
		this.jumpCrouchFramesLeft = 0;
		this.jumpWindupActive = false;
		this.jumpWindupLocked = false;
		this.clearHideCrouch();
		SoundManager.playSound('blob-stick', 1, { speed: Math.random() * 0.2 + 0.9 });
		//void SoundManager.playSound('blob-land', 1, { speed: Math.random() * 0.2 + 1.8 });
	}

	private findClingableContact(): StickyWallContact | null {
		for (const contact of this.stickyWallContacts.values()) {
			if (this.isStickyWallClingHeightOk(contact.body)) {
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
	private startGroundJump(speedX: number, lockedIn: boolean): void {
		if (lockedIn && this.canCrouchJump()) {
			this.launchFromHideCrouch(speedX);
			return;
		}

		this.jumpWindupActive = true;
		this.jumpWindupLocked = lockedIn;
		if (this.canCrouchJump()) {
			// Already compressed — wait for swipe commit, don't start a second squat.
			return;
		}

		this.beginJumpCrouch();
	}

	private launchFromHideCrouch(speedX: number): void {
		this.crouchJumpBufferFrames = 0;
		this.clearHideCrouch();
		this.launchJump(speedX, CROUCH_JUMP_VELOCITY * this.jumpAxis, Math.random() * 0.1 + 0.7);
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
		this.jumpWindupActive = false;
		this.jumpWindupLocked = false;
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
		// SoundManager.playSound('blob-wobble'); //!! find better sound - too annoying
	}

	/** Lost the floor while crouched — unfurl immediately, no stand delay / hop. */
	private releaseCrouchIntoFall(): void {
		this.jelly.absorbHideCrouchIntoFall(this.crouchBlend);
		this.clearHideCrouch();
	}

	private canCrouchJump(): boolean {
		return this.crouchBlend > CROUCH_STATE_BLEND || this.crouchJumpBufferFrames > 0;
	}

	private tickCrouchJumpBuffer(): void {
		if (this.isCrouchHeld() && this.crouchBlend > CROUCH_STATE_BLEND) {
			this.crouchJumpBufferFrames = CROUCH_JUMP_BUFFER_FRAMES;
			return;
		}

		if (this.crouchJumpBufferFrames > 0) {
			this.crouchJumpBufferFrames -= 1;
		}
	}

	/**
	 * Ease-in uncrouch for a few frames, then the existing stand hop.
	 * Keeps the blob visibly crouched so a follow-up jump still reads as a crouch-jump.
	 */
	private tickCrouchStandWindup(): void {
		if (this.crouchStandWindupFramesLeft <= 0) {
			this.crouchStandWindupFramesLeft = CROUCH_STAND_WINDUP_FRAMES;
			this.crouchStandWindupStartBlend = this.crouchBlend;
			this.crouchJumpBufferFrames = CROUCH_JUMP_BUFFER_FRAMES;
		}

		this.crouchStandWindupFramesLeft -= 1;
		const duration = CROUCH_STAND_WINDUP_FRAMES;
		const t = 1 - this.crouchStandWindupFramesLeft / duration;
		const eased = t * t;
		const endBlend = this.crouchStandWindupStartBlend * CROUCH_STAND_WINDUP_END_RATIO;
		this.crouchBlend = this.crouchStandWindupStartBlend
			+ (endBlend - this.crouchStandWindupStartBlend) * eased;

		if (this.crouchStandWindupFramesLeft <= 0) {
			this.launchCrouchStandHop();
		}
	}

	private isCrouchHeld(): boolean {
		return this.keysDown.has('ArrowDown')
			|| this.keysDown.has('KeyS')
			|| this.touchControls.crouch;
	}

	/** Snap hide crouch off (jump / cling) and expand collider immediately. */
	private clearHideCrouch(): void {
		this.crouchStandWindupFramesLeft = 0;
		this.crouchBlend = 0;
		this.syncCrouchCollider();
	}

	/** Full reset for death / respawn — restore circle without planting shift. */
	private resetCrouchPose(): void {
		this.crouchStandWindupFramesLeft = 0;
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
			&& !this.jumpWindupActive
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
			y: WALL_JUMP_VELOCITY_Y * this.jumpAxis,
		});
		SoundManager.playSound('blob-jump', 1, { speed: Math.random() * 0.4 + 0.8 });
	}

	private resolveHorizontalSpeed(moveX: number): number {
		if (this.wallJumpFramesLeft > 0) {
			this.wallJumpFramesLeft -= 1;
			return this.wallJumpDirection * MOVE_SPEED_X;
		}

		// Future dash should return before this — stand-up crawl is not dash.
		if (this.isStandingFromCrouch()) {
			return moveX * CROUCH_MOVE_SPEED_X;
		}

		return moveX * MOVE_SPEED_X;
	}

	/** True during the uncrouch windup/hop window (held crouch still stands still). */
	private isStandingFromCrouch(): boolean {
		return this.crouchStandWindupFramesLeft > 0
			|| (!this.isCrouchHeld() && this.crouchBlend > CROUCH_STATE_BLEND);
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
			jumpCrouching: this.jumpWindupActive && this.crouchBlend <= CROUCH_STATE_BLEND,
			crouchBlend: this.crouchBlend,
			clinging: this.clinging,
			wallSide: this.clingSide,
			wallCrouching: this.wallCrouchFramesLeft > 0,
			wallPeeling: this.clingPeelFramesLeft > 0,
			moveSpeedX: this.isStandingFromCrouch() ? CROUCH_MOVE_SPEED_X : MOVE_SPEED_X,
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

	public isOnGround(): boolean {
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
