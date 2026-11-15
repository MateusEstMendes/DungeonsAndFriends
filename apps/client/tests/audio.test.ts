import { afterEach, expect, it, vi } from 'vitest';
const mocks = vi.hoisted(() => ({ howls: [] as any[], resume: vi.fn(), state: 'running' }));
vi.mock('howler', () => ({
  Howler: { autoUnlock: false, volume: vi.fn(), mute: vi.fn(), ctx: { get state() { return mocks.state; }, resume: mocks.resume } },
  Howl: class {
    id = 1001; playingNow = false; vol = 0;
    constructor(public options: any) { mocks.howls.push(this); }
    play = vi.fn(() => { this.playingNow = true; return this.id; });
    stop = vi.fn(() => { this.playingNow = false; });
    playing = () => this.playingNow;
    volume = (v?: number, id?: number) => { if (v === undefined || v > 1) return this.vol; this.vol = v; return this; };
    fade = vi.fn((_from: number, to: number) => { this.vol = to; });
    unload = vi.fn();
  },
}));
import { crossfadeBgm, initializeAudio } from '../src/audio/soundManager';
import { useAudioStore } from '../src/store/useAudioStore';
import { combatSfx } from '../src/audio/events';
import sprite from '../public/audio/sfx-sprite.json';
let cleanup: (() => void) | undefined;
afterEach(() => { cleanup?.(); cleanup = undefined; vi.useRealTimers(); vi.unstubAllGlobals(); mocks.howls.length = 0; });
it('unlocks from a gesture, cancels stale crossfade stops on rapid scene changes and resumes visibility', async () => {
  vi.useFakeTimers(); const document = new EventTarget(); Object.assign(document, { visibilityState: 'visible' }); vi.stubGlobal('document', document);
  mocks.resume.mockResolvedValue(undefined); mocks.state = 'running';
  useAudioStore.setState({ audioUnlocked: false }); cleanup = initializeAudio();
  crossfadeBgm('bgm_exploration'); expect(mocks.howls).toHaveLength(0);
  document.dispatchEvent(new Event('pointerdown')); await Promise.resolve();
  expect(useAudioStore.getState().audioUnlocked).toBe(true);
  const exploration = mocks.howls[1];
  crossfadeBgm('bgm_combat_pov'); crossfadeBgm('bgm_exploration');
  vi.advanceTimersByTime(1300);
  expect(exploration.stop).not.toHaveBeenCalled(); expect(exploration.play).toHaveBeenCalledTimes(1);
  expect(mocks.howls[2].stop).toHaveBeenCalledTimes(1);
  mocks.state = 'interrupted'; document.dispatchEvent(new Event('visibilitychange')); vi.advanceTimersByTime(100);
  expect(mocks.resume).toHaveBeenCalledTimes(2);
});
it('keeps sprite boundaries separated by 500ms and maps real dodge, magic and heal outcomes', () => {
  const times = Object.values(sprite); for (let i = 1; i < times.length; i++) expect(times[i][0] - times[i-1][0] - times[i-1][1]).toBeGreaterThanOrEqual(500);
  expect(times).toHaveLength(15);
  const event = { targets: [], outcome: 'DODGED_PASSIVE' } as unknown as import('@df/shared').CombatEvent;
  expect(combatSfx(event)).toBe('dodge_whoosh');
  expect(combatSfx({ ...event, outcome: 'HIT', vfxType: 'FIRE' })).toBe('spell_fire');
  expect(combatSfx({ ...event, healAmount: 5 })).toBe('spell_heal');
});
