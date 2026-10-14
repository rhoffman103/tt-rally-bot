// RobotClient: the one place that talks to the robot (rule W8). It runs the connection handshake, sends one
// message at a time, plays drills and reports status, progress and a debug log through events.
import type { Ball, Drill } from '~/lib/drills/types';
import {
  challengeResponse,
  DRILL_ENDED_STATE,
  encodeControl,
  encodeDrill,
  encodeReplaceBalls,
  encodeRequestChallenge,
  encodeRequestDeviceStatus,
  encodeRequestVersion,
  type Notification,
  parseNotification,
  toHex,
} from '~/lib/robot/protocol';
import {
  ballsBetween,
  ballsPerSet,
  needsSequencer,
  type PlannedBall,
  planSet,
  type RobotCount,
  robotBalls,
} from '~/lib/robot/sequencer';
import type { RobotTransport } from '~/lib/robot/transport';

export type RobotStatus =
  'unsupported' | 'disconnected' | 'connecting' | 'standby' | 'playing' | 'paused';
/** The client always has a transport, so it is never `unsupported`. The provider adds that. */
type ClientStatus = Exclude<RobotStatus, 'unsupported'>;

export type DrillProgress = {
  drillId: string;
  set: number; // sets finished so far
  ballsShot: number; // in the whole session
  elapsedSec: number;
  currentLine: number; // index into drill.lines, for highlighting
};

export type LogEntry = { at: number; dir: 'in' | 'out' | 'info'; hex: string; text: string };

export type RobotInfo = { serial: string; firmware?: string };

export type RobotSnapshot = {
  status: ClientStatus;
  robot: RobotInfo | null;
  /** The drill playing now, or the last one played. Cleared when the robot disconnects. */
  progress: DrillProgress | null;
  error: string | null;
  log: LogEntry[];
};

type RobotEvents = {
  status: ClientStatus;
  robot: RobotInfo | null;
  progress: DrillProgress | null;
  error: string | null;
  log: LogEntry;
};

export const ROBOT_EVENTS: (keyof RobotEvents)[] = ['status', 'robot', 'progress', 'error', 'log'];

export type RobotClientOptions = {
  /** How long each handshake step waits for the robot. */
  timeoutMs?: number;
  /** Picks random lines and shuffles sets. Defaults to `Math.random`. */
  random?: () => number;
};

const HANDSHAKE_TIMEOUT_MS = 5000;
const LOG_LIMIT = 200;
const TICK_MS = 1000;

type Timer = ReturnType<typeof setTimeout>;

type Waiter = {
  match: (notification: Notification) => boolean;
  remaining: number;
  first: Notification | null;
  resolve: (notification: Notification) => void;
  reject: (error: Error) => void;
  timer: Timer;
};

type Playback = {
  drill: Drill;
  /** `robot`: the robot plays the whole drill. `lines`: the app sends one line at a time (sequencer.ts). */
  mode: 'robot' | 'lines';
  robotSetSize: number; // balls in one pass through what the robot holds now
  count: RobotCount; // from the last drill-status notification
  set: PlannedBall[]; // lines mode: the set being played
  position: number; // lines mode: index into `set`
  ballsInLine: number; // lines mode
  sets: number;
  ballsShot: number;
  currentLine: number;
  activeMs: number; // time played before `resumedAt`
  resumedAt: number | null; // null while paused
  ticker: ReturnType<typeof setInterval>;
  /** The robot has reported on this drill. Until then a "drill ended" status is left over from before. */
  started: boolean;
  rest: { timer: Timer | null; remainingMs: number; startedAt: number } | null;
};

const INITIAL: RobotSnapshot = {
  status: 'disconnected',
  robot: null,
  progress: null,
  error: null,
  log: [],
};

export class RobotClient {
  private snapshot = INITIAL;
  private readonly listeners: { [K in keyof RobotEvents]: Set<(value: RobotEvents[K]) => void> } = {
    status: new Set(),
    robot: new Set(),
    progress: new Set(),
    error: new Set(),
    log: new Set(),
  };
  private readonly timeoutMs: number;
  private readonly random: () => number;
  private queue: Promise<void> = Promise.resolve();
  private waiters: Waiter[] = [];
  private attempt = 0; // goes up on every connect and disconnect, so a stale connect gives up
  private playback: Playback | null = null;

  constructor(
    private readonly transport: RobotTransport,
    options: RobotClientOptions = {},
  ) {
    this.timeoutMs = options.timeoutMs ?? HANDSHAKE_TIMEOUT_MS;
    this.random = options.random ?? Math.random;
    transport.onNotify(this.handleNotification);
    transport.onDisconnect(this.handleDisconnect);
  }

  /** The current state. A new object after every change, so it works with `useSyncExternalStore`. */
  readonly getSnapshot = (): RobotSnapshot => this.snapshot;

  on<K extends keyof RobotEvents>(event: K, listener: (value: RobotEvents[K]) => void): () => void {
    const set = this.listeners[event];
    set.add(listener);
    return () => void set.delete(listener);
  }

  // ---------- Connection ----------

  /** Connects and runs the handshake. With Web Bluetooth, call it only from a click handler. */
  async connect(): Promise<void> {
    if (this.snapshot.status !== 'disconnected') return;
    const attempt = ++this.attempt;
    this.update({ status: 'connecting', error: null, robot: null });
    this.info('Connecting');
    try {
      await this.transport.connect();
      if (attempt !== this.attempt) {
        // disconnect() was called while the transport was connecting: close the link it just opened.
        void this.transport.disconnect().catch(() => {});
        return;
      }
      await this.handshake(attempt);
      this.update({ status: 'standby' });
      this.info(`Connected to ${this.snapshot.robot?.serial ?? 'the robot'}`);
    } catch (error) {
      if (attempt !== this.attempt) return; // disconnect() or the transport already cleaned up
      this.attempt++;
      this.rejectWaiters(new Error('Connecting failed.'));
      const cancelled = error instanceof DOMException && error.name === 'NotFoundError';
      this.update({
        status: 'disconnected',
        robot: null,
        error: cancelled ? null : message(error),
      });
      this.info(cancelled ? 'No robot chosen' : `Connecting failed: ${message(error)}`);
      void this.transport.disconnect().catch(() => {});
    }
  }

  async disconnect(): Promise<void> {
    const { status } = this.snapshot;
    if (status === 'disconnected') return;
    if (status === 'playing' || status === 'paused') {
      await this.send(encodeControl('stop'), 'stop').catch(() => {});
    }
    this.attempt++;
    this.endPlayback();
    this.rejectWaiters(new Error('Disconnected.'));
    this.update({ status: 'disconnected', robot: null, progress: null, error: null });
    this.info('Disconnected');
    await this.transport.disconnect();
  }

  // docs/robot-protocol.md "Connection handshake": each step waits for the robot before the next.
  private async handshake(attempt: number) {
    const challenge = await this.request(
      attempt,
      encodeRequestChallenge(),
      'ask for challenge',
      (n) => n.kind === 'challenge',
    );
    if (challenge.kind !== 'challenge') throw new Error('The robot sent no challenge.');
    this.update({ robot: { ...this.snapshot.robot, serial: challenge.serial } });
    await this.request(
      attempt,
      challengeResponse(challenge.serial, challenge.code),
      'answer the challenge',
    );
    await this.request(attempt, encodeRequestVersion(), 'ask for version');
    await this.request(attempt, encodeRequestDeviceStatus(), 'ask for device status');
    await this.request(attempt, encodeControl('wakeUp'), 'wake up', () => true, 2);
  }

  /** Sends a message and waits for `count` notifications that match. Returns the first. */
  private request(
    attempt: number,
    bytes: Uint8Array,
    text: string,
    match: (notification: Notification) => boolean = () => true,
    count = 1,
  ): Promise<Notification> {
    this.checkAttempt(attempt);
    const answer = new Promise<Notification>((resolve, reject) => {
      const waiter: Waiter = {
        match,
        remaining: count,
        first: null,
        resolve,
        reject,
        timer: setTimeout(() => {
          this.waiters = this.waiters.filter((w) => w !== waiter);
          reject(new Error('The robot did not answer. Switch it off and on, then try again.'));
        }, this.timeoutMs),
      };
      this.waiters.push(waiter);
    });
    // A failed write rejects `answer` too, so the caller sees one error.
    this.send(bytes, text).catch((error: unknown) => this.rejectWaiters(toError(error)));
    return answer;
  }

  private checkAttempt(attempt: number) {
    if (attempt !== this.attempt) throw new Error('Connecting was cancelled.');
  }

  private rejectWaiters(error: Error) {
    const waiters = this.waiters;
    this.waiters = [];
    for (const waiter of waiters) {
      clearTimeout(waiter.timer);
      waiter.reject(error);
    }
  }

  private readonly handleDisconnect = () => {
    const { status } = this.snapshot;
    if (status === 'disconnected') return;
    this.attempt++;
    this.endPlayback();
    this.rejectWaiters(new Error('The robot disconnected.'));
    const error =
      status === 'playing' || status === 'paused'
        ? 'Robot disconnected. The drill stopped.'
        : 'The robot disconnected.';
    this.update({ status: 'disconnected', robot: null, progress: null, error });
    this.info(error);
  };

  // ---------- Notifications ----------

  private readonly handleNotification = (bytes: Uint8Array) => {
    const notification = parseNotification(bytes);
    this.log('in', bytes, describe(notification));

    if (notification.kind === 'version') {
      this.update({
        robot: {
          serial: this.snapshot.robot?.serial ?? notification.serial,
          firmware: notification.firmware,
        },
      });
    }

    const waiter = this.waiters[0];
    if (waiter?.match(notification)) {
      waiter.first ??= notification;
      waiter.remaining -= 1;
      if (waiter.remaining === 0) {
        clearTimeout(waiter.timer);
        this.waiters.shift();
        waiter.resolve(waiter.first);
      }
    }

    const p = this.playback;
    if (!p) return;
    switch (notification.kind) {
      case 'drill-status':
        p.started = true;
        return this.handleDrillStatus(p, notification);
      case 'device-status':
        // (verify) A test fire that just ended also reports DRILL_ENDED_STATE, maybe after Play was pressed.
        if (notification.stateName === 'running') p.started = true;
        else if (notification.stateName === DRILL_ENDED_STATE && p.started) this.finish(false);
        return;
      case 'drill-rejected':
        this.endPlayback();
        this.update({
          status: 'standby',
          progress: null,
          error: 'The robot did not accept the drill.',
        });
        return;
    }
  };

  private handleDrillStatus(p: Playback, status: RobotCount & { ballIndex: number }) {
    const shot = ballsBetween(p.count, status, p.robotSetSize);
    const robotFinishedSet = status.sets > p.count.sets;
    p.count = { sets: status.sets, balls: status.balls };
    p.ballsShot += shot;

    if (p.mode === 'robot') {
      p.sets = status.sets;
      p.currentLine = Math.min(status.ballIndex, p.drill.lines.length - 1);
      this.emitProgress();
      if (robotFinishedSet && !this.isLastSet(p)) this.startRest(p);
      return;
    }

    p.ballsInLine += shot;
    if (p.ballsInLine >= p.set[p.position].ball.repetitions) this.nextLine(p);
    this.emitProgress();
  }

  // ---------- Playing ----------

  /** Starts a drill. It already has the session's duration, order and pause between sets. */
  async play(drill: Drill): Promise<void> {
    this.requireConnected();
    if (drill.lines.length === 0 || drill.lines.some((line) => line.alternatives.length === 0)) {
      throw new Error('The drill has no balls.');
    }
    if (this.playback) await this.stop();

    const p: Playback = {
      drill,
      mode: needsSequencer(drill) ? 'lines' : 'robot',
      robotSetSize: 0,
      count: { sets: 0, balls: 0 },
      set: [],
      position: 0,
      ballsInLine: 0,
      sets: 0,
      ballsShot: 0,
      currentLine: 0,
      activeMs: 0,
      resumedAt: Date.now(),
      ticker: setInterval(() => this.tick(), TICK_MS),
      started: false,
      rest: null,
    };
    let bytes: Uint8Array;
    let text: string;
    if (p.mode === 'lines') {
      // The robot plays one line on repeat until the app sends the next one.
      p.set = planSet(drill, this.random);
      const first = p.set[0];
      p.robotSetSize = first.ball.repetitions;
      p.currentLine = first.line;
      bytes = encodeDrill([first.ball], { duration: { kind: 'endless' }, random: false });
      text = `new drill, line by line: line ${first.line + 1}`;
    } else {
      const balls = robotBalls(drill);
      p.robotSetSize = ballsPerSet(balls);
      bytes = encodeDrill(balls, { duration: drill.duration, random: drill.randomOrder });
      text = `new drill, ${balls.length} balls`;
    }

    this.playback = p;
    this.update({ status: 'playing', error: null });
    this.emitProgress();
    try {
      await this.send(bytes, text);
    } catch (error) {
      if (this.playback === p) {
        this.endPlayback();
        this.update({ status: 'standby', progress: null, error: message(error) });
      }
      throw error;
    }
  }

  async pause(): Promise<void> {
    const p = this.playback;
    if (!p || this.snapshot.status !== 'playing') return;
    this.stopClock(p);
    this.update({ status: 'paused' });
    if (p.rest) {
      // The robot is already paused for the rest between sets. Hold the rest timer too.
      if (p.rest.timer) clearTimeout(p.rest.timer);
      p.rest = { timer: null, remainingMs: restLeft(p.rest), startedAt: Date.now() };
      return;
    }
    await this.send(encodeControl('pause'), 'pause');
  }

  async resume(): Promise<void> {
    const p = this.playback;
    if (!p || this.snapshot.status !== 'paused') return;
    p.resumedAt = Date.now();
    this.update({ status: 'playing' });
    if (p.rest) {
      const { remainingMs, timer } = p.rest;
      if (timer) clearTimeout(timer);
      p.rest = {
        timer: setTimeout(() => this.endRest(p), remainingMs),
        remainingMs,
        startedAt: Date.now(),
      };
      return;
    }
    await this.send(encodeControl('resume'), 'resume');
  }

  async stop(): Promise<void> {
    if (!this.playback) return;
    this.endPlayback();
    this.update({ status: 'standby' });
    await this.send(encodeControl('stop'), 'stop');
  }

  /** Fires one ball, once: the builder's "Test fire". */
  async fireBall(ball: Ball): Promise<void> {
    this.requireConnected();
    if (this.playback) throw new Error('Stop the drill before you test a ball.');
    const bytes = encodeDrill([{ ...ball, repetitions: 1 }], {
      duration: { kind: 'combos', value: 1 },
      random: false,
    });
    await this.send(bytes, 'test fire');
  }

  private requireConnected() {
    const { status } = this.snapshot;
    if (status === 'disconnected' || status === 'connecting') {
      throw new Error('Connect to the robot first.');
    }
  }

  private isLastSet(p: Playback) {
    return p.drill.duration.kind === 'combos' && p.sets >= p.drill.duration.value;
  }

  /** Lines mode: the robot has played the current line, so send the next one. */
  private nextLine(p: Playback) {
    p.ballsInLine = 0;
    p.position += 1;
    if (p.position < p.set.length) {
      p.currentLine = p.set[p.position].line;
      this.sendLine(p);
      return;
    }
    p.sets += 1;
    if (this.isLastSet(p)) {
      this.finish(true);
      return;
    }
    p.set = planSet(p.drill, this.random);
    p.position = 0;
    p.currentLine = p.set[0].line;
    if (!this.startRest(p)) this.sendLine(p);
  }

  private sendLine(p: Playback) {
    const { ball, line } = p.set[p.position];
    p.robotSetSize = ball.repetitions;
    this.sendInBackground(encodeReplaceBalls([ball]), `next balls: line ${line + 1}`);
  }

  /** Pauses the robot between sets, if the drill asks for it. Returns false when it doesn't. */
  private startRest(p: Playback): boolean {
    const seconds = p.drill.pauseBetweenSetsSec ?? 0;
    if (seconds <= 0) return false;
    const ms = seconds * 1000;
    // Paused when the set ended: the rest starts counting on resume.
    const paused = this.snapshot.status === 'paused';
    p.rest = {
      timer: paused ? null : setTimeout(() => this.endRest(p), ms),
      remainingMs: ms,
      startedAt: Date.now(),
    };
    this.sendInBackground(encodeControl('pause'), `rest ${seconds} s between sets`);
    return true;
  }

  private endRest(p: Playback) {
    if (this.playback !== p) return;
    p.rest = null;
    if (p.mode === 'lines') this.sendLine(p);
    this.sendInBackground(encodeControl('resume'), 'resume after rest');
  }

  private tick() {
    const p = this.playback;
    if (!p) return;
    this.emitProgress();
    const { duration } = p.drill;
    // In robot mode the robot keeps time itself, but only in whole minutes: the app stops a half minute.
    if (
      duration.kind === 'minutes' &&
      (p.mode === 'lines' || !Number.isInteger(duration.value)) &&
      elapsedMs(p) >= duration.value * 60_000
    ) {
      this.finish(true);
    }
  }

  /** The drill is over: the robot said so, or the app counted the last set or minute. */
  private finish(sendStop: boolean) {
    const p = this.playback;
    if (!p) return;
    this.emitProgress();
    this.endPlayback();
    if (sendStop) this.sendInBackground(encodeControl('stop'), 'stop: drill done');
    this.update({ status: 'standby' });
    this.info(`Done: ${p.sets} sets, ${p.ballsShot} balls in ${mmss(elapsedMs(p))}`);
  }

  private endPlayback() {
    const p = this.playback;
    if (!p) return;
    clearInterval(p.ticker);
    if (p.rest?.timer) clearTimeout(p.rest.timer);
    this.stopClock(p);
    this.playback = null;
  }

  private stopClock(p: Playback) {
    if (p.resumedAt === null) return;
    p.activeMs += Date.now() - p.resumedAt;
    p.resumedAt = null;
  }

  private emitProgress() {
    const p = this.playback;
    if (!p) return;
    const next: DrillProgress = {
      drillId: p.drill.id,
      set: p.sets,
      ballsShot: p.ballsShot,
      elapsedSec: Math.floor(elapsedMs(p) / 1000),
      currentLine: p.currentLine,
    };
    const current = this.snapshot.progress;
    const same =
      current !== null &&
      (Object.keys(next) as (keyof DrillProgress)[]).every((key) => current[key] === next[key]);
    if (!same) this.update({ progress: next });
  }

  // ---------- Writing ----------

  /** Queues a message. Each write waits for the one before it (docs/robot-protocol.md "GATT"). */
  private send(bytes: Uint8Array, text: string): Promise<void> {
    const write = this.queue.then(async () => {
      this.log('out', bytes, text);
      await this.transport.write(bytes);
    });
    this.queue = write.catch(() => {});
    return write;
  }

  /** For messages the sequencer sends on its own: nobody awaits them, so a failure goes to `error`. */
  private sendInBackground(bytes: Uint8Array, text: string) {
    this.send(bytes, text).catch((error: unknown) => {
      if (this.snapshot.status === 'disconnected') return;
      this.update({ error: message(error) });
      this.info(`Sending failed: ${message(error)}`);
    });
  }

  // ---------- State and events ----------

  private update(patch: Partial<Omit<RobotSnapshot, 'log'>>) {
    const previous = this.snapshot;
    this.snapshot = { ...previous, ...patch };
    if ('status' in patch && patch.status !== previous.status) {
      this.emit('status', this.snapshot.status);
    }
    if ('robot' in patch && patch.robot !== previous.robot) this.emit('robot', this.snapshot.robot);
    if ('progress' in patch && patch.progress !== previous.progress) {
      this.emit('progress', this.snapshot.progress);
    }
    if ('error' in patch && patch.error !== previous.error) this.emit('error', this.snapshot.error);
  }

  private log(dir: LogEntry['dir'], bytes: Uint8Array | null, text: string) {
    const entry: LogEntry = { at: Date.now(), dir, hex: bytes ? toHex(bytes, ' ') : '', text };
    this.snapshot = { ...this.snapshot, log: [...this.snapshot.log.slice(1 - LOG_LIMIT), entry] };
    this.emit('log', entry);
  }

  private info(text: string) {
    this.log('info', null, text);
  }

  private emit<K extends keyof RobotEvents>(event: K, value: RobotEvents[K]) {
    for (const listener of [...this.listeners[event]]) listener(value);
  }
}

function elapsedMs(p: Playback) {
  return p.activeMs + (p.resumedAt === null ? 0 : Date.now() - p.resumedAt);
}

function restLeft(rest: NonNullable<Playback['rest']>) {
  if (rest.timer === null) return rest.remainingMs;
  return Math.max(0, rest.remainingMs - (Date.now() - rest.startedAt));
}

function describe(n: Notification): string {
  switch (n.kind) {
    case 'challenge':
      return `challenge from ${n.serial}`;
    case 'device-status':
      return `device status: ${n.stateName ?? n.state}`;
    case 'drill-status':
      return `drill status: ${n.sets} sets, ball ${n.balls} of this set`;
    case 'version':
      return `version: firmware ${n.firmware}`;
    case 'drill-rejected':
      return 'drill rejected';
    case 'other':
      return `reply to 0x${n.type.toString(16).padStart(2, '0')}${n.ok ? '' : ', not ok'}`;
  }
}

function mmss(ms: number) {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

function toError(error: unknown) {
  return error instanceof Error ? error : new Error(String(error));
}

function message(error: unknown) {
  return toError(error).message;
}
