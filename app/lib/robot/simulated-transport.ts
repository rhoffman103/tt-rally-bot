// A pretend robot, for tests and for trying the app without a robot (`?robot=sim`). It reads what the app
// sends with protocol.ts and answers the way docs/robot-protocol.md says the robot does. Its answers follow the
// same (verify) guesses as protocol.ts, so it can't confirm them.
import type { Ball } from '~/lib/drills/types';
import {
  challengeHash,
  COMMAND,
  type DrillDuration,
  encodeChallengeNotification,
  encodeDeviceStatusNotification,
  encodeDrillRejectedNotification,
  encodeDrillStatusNotification,
  encodeNotification,
  encodeVersionNotification,
  parseCommand,
} from '~/lib/robot/protocol';
import { listeners, type RobotTransport } from '~/lib/robot/transport';

export type SimulatedTransportOptions = {
  /** Runs the robot this many times faster than real time. Tests use 100 or more; the browser uses 1. */
  speed?: number;
  serial?: string;
  code?: string;
  hardware?: string;
  firmware?: string;
};

// Timings at speed 1, in milliseconds. Placeholders, close enough to feel like the robot.
const CONNECT_MS = 800;
const ANSWER_MS = 40;
/** Time between balls at frequency 0; frequency 100 halves it. */
const SLOWEST_BALL_MS = 2000;

type Run = {
  balls: Ball[];
  random: boolean;
  duration: DrillDuration;
  order: number[]; // ball indexes for the current set, one per repetition
  position: number; // next entry in `order`
  sets: number;
  activeMs: number; // time spent playing, not paused
  resumedAt: number | null;
  timer: ReturnType<typeof setTimeout> | null;
};

export class SimulatedTransport implements RobotTransport {
  private readonly speed: number;
  private readonly serial: string;
  private readonly code: string;
  private readonly hardware: string;
  private readonly firmware: string;
  private readonly notify = listeners<[Uint8Array]>();
  private readonly disconnected = listeners<[]>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();
  private connected = false;
  private unlocked = false; // the challenge was answered correctly
  private awake = false;
  private run: Run | null = null;

  constructor(options: SimulatedTransportOptions = {}) {
    this.speed = options.speed ?? 1;
    this.serial = options.serial ?? 'NSP0SIM00001';
    this.code = options.code ?? '4f1c2a9e7b3d5c60';
    this.hardware = options.hardware ?? 'sim';
    this.firmware = options.firmware ?? 'sim-1.0';
  }

  /** What the robot is doing, for tests. */
  get state(): 'off' | 'standby' | 'playing' | 'paused' {
    if (!this.connected) return 'off';
    if (!this.run) return 'standby';
    return this.run.resumedAt === null ? 'paused' : 'playing';
  }

  async connect(): Promise<void> {
    if (this.connected) return;
    await new Promise<void>((resolve) => this.later(() => resolve(), CONNECT_MS));
    this.connected = true;
    this.unlocked = false;
    this.awake = false;
  }

  async disconnect(): Promise<void> {
    this.goOff();
  }

  /** Acts as if the robot was switched off or went out of range. */
  simulateDisconnect(): void {
    this.goOff();
  }

  async write(bytes: Uint8Array): Promise<void> {
    if (!this.connected) throw new Error('Not connected to the robot.');
    this.handle(bytes);
  }

  onNotify(listener: (bytes: Uint8Array) => void) {
    return this.notify.add(listener);
  }

  onDisconnect(listener: () => void) {
    return this.disconnected.add(listener);
  }

  private handle(bytes: Uint8Array) {
    const command = parseCommand(bytes);
    // Until the challenge is answered, the robot answers nothing else.
    if (
      !this.unlocked &&
      command.kind !== 'request-challenge' &&
      command.kind !== 'challenge-response'
    ) {
      return;
    }
    switch (command.kind) {
      case 'request-challenge':
        this.unlocked = false;
        return this.answer(encodeChallengeNotification(this.serial, this.code));
      case 'challenge-response':
        this.unlocked = command.hash === challengeHash(this.serial, this.code);
        return this.answer(encodeNotification(bytes[0], undefined, this.unlocked));
      case 'request-version':
        return this.answer(
          encodeVersionNotification({
            serial: this.serial,
            hardware: this.hardware,
            firmware: this.firmware,
          }),
        );
      case 'request-device-status':
        return this.answer(encodeDeviceStatusNotification(this.deviceState()));
      case 'control':
        this.answer(encodeNotification(bytes[0]));
        return this.control(command.command);
      case 'new-drill':
        if (!this.awake) return this.answer(encodeDrillRejectedNotification());
        return this.startRun(command.drill.balls, command.drill.random, command.drill.duration);
      case 'replace-balls':
        if (!this.run) return this.answer(encodeNotification(bytes[0], undefined, false));
        this.run.balls = command.balls;
        this.run.order = this.planSet(this.run);
        this.run.position = 0;
        return this.answer(encodeNotification(bytes[0]));
      case 'unknown':
        if (command.command === COMMAND.newDrill)
          return this.answer(encodeDrillRejectedNotification());
        return this.answer(encodeNotification(command.command, undefined, false));
    }
  }

  private control(command: 'wakeUp' | 'stop' | 'pause' | 'resume') {
    const run = this.run;
    switch (command) {
      case 'wakeUp':
        this.awake = true;
        return this.answer(encodeDeviceStatusNotification('free'));
      case 'stop':
        this.endRun();
        return this.answer(encodeDeviceStatusNotification('free'));
      case 'pause':
        if (!run || run.resumedAt === null) return;
        run.activeMs += this.now() - run.resumedAt;
        run.resumedAt = null;
        this.clear(run.timer);
        return;
      case 'resume':
        if (!run || run.resumedAt !== null) return;
        run.resumedAt = this.now();
        this.scheduleBall(run);
        return;
    }
  }

  private deviceState() {
    if (!this.awake) return 'initializing' as const;
    return this.run ? ('running' as const) : ('free' as const);
  }

  private startRun(balls: Ball[], random: boolean, duration: DrillDuration | null) {
    this.endRun();
    const run: Run = {
      balls,
      random,
      duration: duration ?? { kind: 'endless' },
      order: [],
      position: 0,
      sets: 0,
      activeMs: 0,
      resumedAt: this.now(),
      timer: null,
    };
    run.order = this.planSet(run);
    this.run = run;
    this.answer(encodeDeviceStatusNotification('running'));
    this.scheduleBall(run);
  }

  private planSet(run: Run): number[] {
    const indexes = run.balls.map((_, i) => i);
    if (run.random) indexes.sort(() => Math.random() - 0.5);
    return indexes.flatMap((i) => Array.from({ length: run.balls[i].repetitions }, () => i));
  }

  private scheduleBall(run: Run) {
    const ball = run.balls[run.order[run.position]];
    const interval = SLOWEST_BALL_MS / (1 + ball.frequency / 100);
    run.timer = this.later(() => this.fireBall(run), interval);
  }

  private fireBall(run: Run) {
    if (this.run !== run || run.resumedAt === null) return;
    const ballIndex = run.order[run.position];
    run.position += 1;
    if (run.position >= run.order.length) {
      run.sets += 1;
      run.position = 0;
      run.order = this.planSet(run);
    }
    const runtime = Math.floor(this.activeMs(run) / 1000);
    this.emit(
      encodeDrillStatusNotification({
        runtime,
        sets: run.sets,
        balls: run.position,
        ballIndex,
      }),
    );
    const { duration } = run;
    const done =
      (duration.kind === 'combos' && run.sets >= duration.value) ||
      (duration.kind === 'minutes' && runtime >= duration.value * 60);
    if (!done) return this.scheduleBall(run);
    this.endRun();
    this.emit(encodeDeviceStatusNotification('stopping'));
    this.answer(encodeDeviceStatusNotification('free'));
  }

  /** Time the run has played, in robot time. */
  private activeMs(run: Run) {
    return run.activeMs + (run.resumedAt === null ? 0 : this.now() - run.resumedAt);
  }

  private endRun() {
    if (this.run) this.clear(this.run.timer);
    this.run = null;
  }

  private goOff() {
    if (!this.connected) return;
    this.endRun();
    this.timers.forEach((timer) => clearTimeout(timer));
    this.timers.clear();
    this.connected = false;
    this.unlocked = false;
    this.awake = false;
    this.disconnected.emit();
  }

  private answer(bytes: Uint8Array) {
    this.later(() => this.emit(bytes), ANSWER_MS);
  }

  private emit(bytes: Uint8Array) {
    if (this.connected) this.notify.emit(bytes);
  }

  /** Robot time: real time multiplied by `speed`. */
  private now() {
    return Date.now() * this.speed;
  }

  /** setTimeout in robot time. */
  private later(callback: () => void, ms: number) {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      callback();
    }, ms / this.speed);
    this.timers.add(timer);
    return timer;
  }

  private clear(timer: ReturnType<typeof setTimeout> | null) {
    if (timer === null) return;
    clearTimeout(timer);
    this.timers.delete(timer);
  }
}
