import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  DEFAULT_SETTINGS,
  loadSettings,
  resetSettings,
  saveSettings,
  subscribeToSettings,
} from '~/lib/settings';
import { stubLocalStorage } from '~/testing/memory-storage';

let storage: Storage;
beforeEach(() => {
  storage = stubLocalStorage();
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe('settings', () => {
  it('starts with the defaults', () => {
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
    expect(DEFAULT_SETTINGS.rpmLimits).toEqual({ min: 400, max: 7500 });
  });

  it('saves changes and keeps the other settings', () => {
    saveSettings({ simulatedRobot: true });
    const saved = saveSettings({ rpmLimits: { min: 400, max: 6000 } });
    expect(saved).toEqual({
      ...DEFAULT_SETTINGS,
      simulatedRobot: true,
      rpmLimits: { min: 400, max: 6000 },
    });
    expect(loadSettings()).toEqual(saved);
  });

  it('keeps rpm limits inside the robot’s range, lowest first', () => {
    expect(saveSettings({ rpmLimits: { min: 100, max: 9000 } }).rpmLimits).toEqual({
      min: 400,
      max: 7500,
    });
    expect(saveSettings({ rpmLimits: { min: 5000, max: 2000.4 } }).rpmLimits).toEqual({
      min: 2000,
      max: 5000,
    });
  });

  it('uses the defaults for missing or broken values', () => {
    storage.setItem(
      'tt-rally-bot.settings',
      JSON.stringify({ debugLog: 'yes', speedSpin: { rpmPerSpin: 200 }, rpmLimits: null }),
    );
    expect(loadSettings()).toEqual({
      ...DEFAULT_SETTINGS,
      speedSpin: { ...DEFAULT_SETTINGS.speedSpin, rpmPerSpin: 200 },
    });
    storage.setItem('tt-rally-bot.settings', '{not json');
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('resets to the defaults', () => {
    saveSettings({ debugLog: false });
    expect(resetSettings()).toEqual(DEFAULT_SETTINGS);
    expect(loadSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('tells listeners about saves and resets until they stop listening', () => {
    const listener = vi.fn();
    const stop = subscribeToSettings(listener);
    saveSettings({ debugLog: false });
    resetSettings();
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    saveSettings({ debugLog: true });
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('?robot=sim', () => {
  // The address is read once per visit, so each test loads a fresh copy of the module.
  async function startAt(search: string) {
    vi.resetModules();
    vi.stubGlobal('window', { location: { search } });
    return import('~/lib/settings');
  }

  it('turns the simulated robot on for this visit without saving it', async () => {
    const settings = await startAt('?robot=sim');
    expect(settings.loadSettings().simulatedRobot).toBe(true);
    vi.stubGlobal('window', { location: { search: '' } }); // moved to another screen
    expect(settings.loadSettings().simulatedRobot).toBe(true);
    expect(settings.saveSettings({ debugLog: false }).simulatedRobot).toBe(true);
    expect(JSON.parse(storage.getItem('tt-rally-bot.settings') ?? '{}').simulatedRobot).toBe(false);
  });

  it('gives way to the switch on /settings', async () => {
    const settings = await startAt('?robot=sim');
    expect(settings.saveSettings({ simulatedRobot: false }).simulatedRobot).toBe(false);
    expect(settings.loadSettings().simulatedRobot).toBe(false);
  });

  it('is off without ?robot=sim', async () => {
    const settings = await startAt('?robot=other');
    expect(settings.loadSettings().simulatedRobot).toBe(false);
  });
});
