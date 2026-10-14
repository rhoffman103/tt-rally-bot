// Drill repository: the preset drills plus the custom drills saved in this browser.
// Every function is async so storage can move to IndexedDB or Capacitor Preferences later without changing callers.
// Only this module, ~/lib/plans/storage and ~/lib/settings touch localStorage.
import { parseDrillText } from '~/lib/drills/text-format';
import type { Ball, Drill, DrillLine } from '~/lib/drills/types';
import { BALL_LIMITS } from '~/lib/robot/protocol';

// PLACEHOLDER presets: the mockup's preset names and values, with speed/spin turned into rpm by the placeholder
// mapping in speed-spin.ts. The real presets will be captured from the official app.
import presetData from './presets.json';
// The drills of the built-in "Zero to hero" training plan (docs/zero-to-hero.md). In their own file, so a new
// presets.json from a capture doesn't remove them.
import zeroToHeroData from './zero-to-hero.json';

const PRESETS = [...presetData, ...zeroToHeroData] as Drill[];
const PRESET_IDS = new Set(PRESETS.map((drill) => drill.id));

const KEY = 'tt-rally-bot.drills';
const FAVORITES_KEY = 'tt-rally-bot.favorites';
const EXPORT_FORMAT = 'tt-rally-bot-drills';
const EXPORT_VERSION = 1;

/** A drill to save. Storage sets `source` and `updatedAt`, and makes an `id` when there is none. */
export type DrillDraft = Omit<Drill, 'id' | 'source' | 'updatedAt'> & { id?: string };

export type ImportResult = { ok: true; drills: Drill[] } | { ok: false; error: string };
/** Drills read from a file but not saved. A drill from a text file has no `id`. */
export type ReadResult = { ok: true; drills: DrillDraft[] } | { ok: false; error: string };

export const isPreset = (id: string) => PRESET_IDS.has(id);

/** Custom drills, newest first, then the presets in their file order. */
export async function listDrills(): Promise<Drill[]> {
  const custom = readCustom().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return [...custom, ...PRESETS.map(copy)];
}

export async function getDrill(id: string): Promise<Drill | null> {
  const drill = PRESETS.find((d) => d.id === id) ?? readCustom().find((d) => d.id === id);
  return drill ? copy(drill) : null;
}

/** Saves a custom drill and sets `updatedAt` to now. Presets can't be changed: duplicate them first. */
export async function saveDrill(draft: DrillDraft): Promise<Drill> {
  if (draft.id && isPreset(draft.id)) {
    throw new Error('Preset drills can’t be changed. Duplicate the drill, then change the copy.');
  }
  const drill: Drill = {
    ...copy(draft),
    id: draft.id || newDrillId(),
    source: 'custom',
    updatedAt: new Date().toISOString(),
  };
  writeCustom(upsert(readCustom(), [drill]));
  return copy(drill);
}

/** Deletes a custom drill. Does nothing if there is no drill with this id. Presets can't be deleted. */
export async function deleteDrill(id: string): Promise<void> {
  if (isPreset(id)) throw new Error('Preset drills can’t be deleted.');
  writeCustom(readCustom().filter((drill) => drill.id !== id));
  await setFavorite(id, false);
}

/** The ids of the drills starred as favorites, presets or custom, in the order they were starred. */
export async function listFavorites(): Promise<string[]> {
  return readFavorites();
}

/** Stars a drill as a favorite, or takes it out of the favorites. Starring a drill twice keeps one star. */
export async function setFavorite(id: string, favorite: boolean): Promise<void> {
  const others = readFavorites().filter((stored) => stored !== id);
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favorite ? [...others, id] : others));
}

/** Saves a copy of any drill, preset or custom, as a new custom drill with a new `id`. */
export async function duplicateDrill(id: string): Promise<Drill> {
  const source = await getDrill(id);
  if (!source) throw new Error('This drill no longer exists.');
  return saveDrill({ ...source, id: undefined, name: `${source.name} (copy)` });
}

/**
 * Saves drills from a file or share code. Each drill keeps its `id`, so importing it again updates it instead of
 * making a copy, and keeps its `updatedAt`, which tells which copy is newer. A drill with a preset's `id` gets a
 * new `id`, because presets can't be changed.
 */
export async function importDrills(drills: Drill[]): Promise<Drill[]> {
  const now = new Date().toISOString();
  const imported = drills.map((drill): Drill => ({
    ...copy(drill),
    id: drill.id && !isPreset(drill.id) ? drill.id : newDrillId(),
    source: 'custom',
    updatedAt: isIsoTime(drill.updatedAt) ? drill.updatedAt : now,
  }));
  writeCustom(upsert(readCustom(), imported));
  return imported.map(copy);
}

/**
 * Saves a shared drill as a new custom drill next to the one with the same `id`: "Keep both" on the import screen.
 * The copy gets a new `id` and the first free name of the form "<name> (2)".
 */
export async function importDrillCopy(drill: Drill): Promise<Drill> {
  return saveDrill({ ...drill, id: undefined, name: await copyName(drill.name) });
}

/** The name `importDrillCopy` gives a copy of a drill with this name. */
export async function copyName(name: string): Promise<string> {
  const names = new Set(readCustom().map((d) => d.name));
  let n = 2;
  while (names.has(`${name} (${n})`)) n++;
  return `${name} (${n})`;
}

/** Reads a JSON file made by `exportDrills` (or one drill, or a list of drills) and saves its drills. */
export async function importDrillsJson(text: string): Promise<ImportResult> {
  const read = readDrillsJson(text);
  return read.ok ? { ok: true, drills: await importDrills(read.drills) } : read;
}

/**
 * Reads a file the person picked and saves its drills: JSON from `exportDrills`, or one drill in the plain text format
 * (text-format.ts). A text drill without a name in its first comment is named after the file.
 */
export async function importDrillFile(fileName: string, text: string): Promise<ImportResult> {
  if (isJsonFile(fileName, text)) return importDrillsJson(text);
  const read = readDrillText(fileName, text);
  return read.ok ? { ok: true, drills: [await saveDrill(read.drills[0])] } : read;
}

/** Reads a drill file like `importDrillFile` does, without saving anything. */
export function readDrillFile(fileName: string, text: string): ReadResult {
  return isJsonFile(fileName, text) ? readDrillsJson(text) : readDrillText(fileName, text);
}

/** JSON text with the chosen drills, or every custom drill when no ids are given. */
export async function exportDrills(ids?: string[]): Promise<string> {
  const drills = ids
    ? (await Promise.all(ids.map(getDrill))).filter((d): d is Drill => d !== null)
    : readCustom();
  return drillsToJson(drills);
}

/** JSON text with these drills, in the format `importDrillsJson` reads. */
export function drillsToJson(drills: Drill[]): string {
  return JSON.stringify({ format: EXPORT_FORMAT, version: EXPORT_VERSION, drills }, null, 2);
}

// ---------- localStorage ----------

function readCustom(): Drill[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(KEY) ?? '[]');
    if (!Array.isArray(stored)) return [];
    // Skip drills that no longer read, so one broken entry doesn't hide the rest.
    return stored.map(readDrill).filter((d): d is Drill => typeof d !== 'string');
  } catch {
    return [];
  }
}

function writeCustom(drills: Drill[]) {
  localStorage.setItem(KEY, JSON.stringify(drills));
}

function readFavorites(): string[] {
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]');
    return Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

/** Replaces drills with the same `id` in place and adds the rest at the end. */
function upsert(stored: Drill[], changed: Drill[]): Drill[] {
  const byId = new Map(changed.map((drill) => [drill.id, drill]));
  const result = stored.map((drill) => byId.get(drill.id) ?? drill);
  const storedIds = new Set(stored.map((drill) => drill.id));
  return [...result, ...changed.filter((drill) => !storedIds.has(drill.id))];
}

const newDrillId = () => crypto.randomUUID();
const copy = <T>(value: T): T => structuredClone(value);

// ---------- Reading drill files ----------

const isJsonFile = (fileName: string, text: string) =>
  /\.json$/i.test(fileName) || /^\s*[[{]/.test(text);

function readDrillsJson(
  text: string,
): { ok: true; drills: Drill[] } | { ok: false; error: string } {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return { ok: false, error: 'This file isn’t a TT Rally Bot drill file. It isn’t valid JSON.' };
  }
  const items = isRecord(value) && Array.isArray(value.drills) ? value.drills : value;
  const list = Array.isArray(items) ? items : [items];
  if (list.length === 0) return { ok: false, error: 'This file has no drills in it.' };
  const drills: Drill[] = [];
  for (const [i, item] of list.entries()) {
    const drill = readDrill(item);
    if (typeof drill === 'string') {
      return { ok: false, error: list.length > 1 ? `Drill ${i + 1}: ${drill}` : drill };
    }
    drills.push(drill);
  }
  return { ok: true, drills };
}

function readDrillText(fileName: string, text: string): ReadResult {
  const parsed = parseDrillText(text);
  if (!parsed.ok) {
    const [first, ...more] = parsed.errors;
    const rest = more.length > 0 ? ` (and ${more.length} more)` : '';
    return { ok: false, error: `This file isn’t a TT Rally Bot drill file. ${first}${rest}` };
  }
  const name = parsed.name ?? (fileName.replace(/\.[^.]*$/, '').trim() || 'Imported drill');
  return {
    ok: true,
    drills: [{ name, lines: parsed.lines, randomOrder: false, duration: { kind: 'endless' } }],
  };
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const isIsoTime = (value: unknown): value is string =>
  typeof value === 'string' && !Number.isNaN(Date.parse(value));
const isWholeNumber = (value: unknown, min: number): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= min;

/** A drill read from untrusted JSON, or a message that says what is wrong with it. */
function readDrill(value: unknown): Drill | string {
  if (!isRecord(value)) return 'A drill must be an object.';
  const { id, name, lines, randomOrder, duration, pauseBetweenSetsSec, source, updatedAt } = value;
  if (typeof id !== 'string') return 'The drill has no id.';
  if (typeof name !== 'string') return 'The drill has no name.';
  if (!Array.isArray(lines) || lines.length === 0) return `“${name}” has no balls.`;
  const readLines: DrillLine[] = [];
  for (const [i, line] of lines.entries()) {
    const read = readLine(line);
    if (typeof read === 'string') return `“${name}”, ball ${i + 1}: ${read}`;
    readLines.push(read);
  }
  const readDuration = readDrillDuration(duration);
  if (!readDuration) return `“${name}” has a duration this version of TT Rally Bot can’t read.`;
  if (pauseBetweenSetsSec !== undefined && !isWholeNumber(pauseBetweenSetsSec, 0)) {
    return `“${name}” has a pause between sets that isn’t a whole number of seconds.`;
  }
  return {
    id,
    name,
    lines: readLines,
    randomOrder: randomOrder === true,
    duration: readDuration,
    ...(pauseBetweenSetsSec === undefined ? {} : { pauseBetweenSetsSec }),
    source: source === 'preset' ? 'preset' : 'custom',
    updatedAt: isIsoTime(updatedAt) ? updatedAt : new Date(0).toISOString(),
  };
}

function readDrillDuration(value: unknown): Drill['duration'] | null {
  if (!isRecord(value)) return null;
  if (value.kind === 'endless') return { kind: 'endless' };
  if (value.kind === 'combos' && isWholeNumber(value.value, 1)) {
    return { kind: value.kind, value: value.value };
  }
  // Minutes go in steps of 30 seconds.
  if (
    value.kind === 'minutes' &&
    typeof value.value === 'number' &&
    isWholeNumber(value.value * 2, 1)
  ) {
    return { kind: value.kind, value: value.value };
  }
  return null;
}

function readLine(value: unknown): DrillLine | string {
  if (!isRecord(value) || !Array.isArray(value.alternatives) || value.alternatives.length === 0) {
    return 'A ball is missing.';
  }
  const alternatives: Ball[] = [];
  for (const item of value.alternatives) {
    const ball = readBall(item);
    if (typeof ball === 'string') return ball;
    alternatives.push(ball);
  }
  return { alternatives };
}

/** Checks the ranges, not the editor's steps, so values captured from the robot still import. */
function readBall(value: unknown): Ball | string {
  if (!isRecord(value)) return 'A ball is missing.';
  const ball: Partial<Ball> = {};
  for (const field of Object.keys(BALL_LIMITS) as (keyof Ball)[]) {
    const n = value[field];
    const { min, max } = BALL_LIMITS[field];
    if (typeof n !== 'number' || !Number.isFinite(n) || n < min || n > max) {
      return `${FIELD_NAMES[field]} must be a number from ${min} to ${max}.`;
    }
    ball[field] = n;
  }
  return ball as Ball;
}

const FIELD_NAMES: Record<keyof Ball, string> = {
  upperRpm: 'The upper wheel speed',
  lowerRpm: 'The lower wheel speed',
  height: 'The height',
  dropPoint: 'The drop point',
  frequency: 'The frequency',
  repetitions: 'The repetitions',
};
