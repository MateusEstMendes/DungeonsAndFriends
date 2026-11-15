import { Howl, Howler } from 'howler';
import sprite from '../../public/audio/sfx-sprite.json';
import { useAudioStore } from '../store/useAudioStore';
export type Sfx = keyof typeof sprite;
export type Bgm = 'bgm_exploration' | 'bgm_combat_pov';
let sfx: Howl | undefined, active: Bgm | undefined, desired: Bgm | undefined;
const tracks = new Map<Bgm, { howl: Howl; id: number; stop?: ReturnType<typeof setTimeout> }>();
const bgmVolume = () => useAudioStore.getState().bgmVolume;
export function playSfx(name: Sfx) {
  if (!useAudioStore.getState().audioUnlocked || !sfx) return;
  sfx.play(name);
}
export function crossfadeBgm(target?: Bgm, duration = 1200) {
  desired = target;
  if (!useAudioStore.getState().audioUnlocked || active === target) return;
  const old = active && tracks.get(active);
  if (old) {
    clearTimeout(old.stop); old.howl.fade((old.howl.volume(old.id) as number), 0, duration, old.id);
    old.stop = setTimeout(() => { old.howl.stop(old.id); }, duration + 50);
  }
  active = target;
  if (!target) return;
  let next = tracks.get(target);
  if (!next) {
    const howl = new Howl({ src: [`/audio/${target}.webm`, `/audio/${target}.mp3`], html5: false, loop: true, volume: 0 });
    next = { howl, id: howl.play() }; tracks.set(target, next);
  } else {
    clearTimeout(next.stop);
    if (!next.howl.playing(next.id)) next.id = next.howl.play();
  }
  next.howl.fade((next.howl.volume(next.id) as number), bgmVolume(), duration, next.id);
}
export function initializeAudio() {
  Howler.autoUnlock = true; // Current Howler API (replaces legacy mobileAutoEnable).
  const apply = () => {
    const prefs = useAudioStore.getState();
    Howler.volume(prefs.masterVolume); Howler.mute(prefs.isMuted);
    sfx?.volume(prefs.sfxVolume);
    const track = active && tracks.get(active); if (track) track.howl.volume(prefs.bgmVolume, track.id);
  };
  let disposed = false, resumeTimer: ReturnType<typeof setTimeout> | undefined;
  const unlock = () => {
    if (!sfx) sfx = new Howl({ src: ['/audio/sfx-sprite.webm', '/audio/sfx-sprite.mp3'], html5: false,
      sprite: Object.fromEntries(Object.entries(sprite).map(([name, timing]) => [name, [timing[0], timing[1]] as [number, number]])), volume: useAudioStore.getState().sfxVolume });
    apply();
    const context = Howler.ctx;
    if (!context) return;
    void context.resume().then(() => {
      if (disposed || context.state !== 'running') return;
      useAudioStore.setState({ audioUnlocked: true });
      for (const event of ['pointerdown', 'touchend', 'keydown']) document.removeEventListener(event, unlock);
      crossfadeBgm(desired);
    }).catch(() => {});
  };
  const visibility = () => {
    clearTimeout(resumeTimer);
    if (document.visibilityState === 'visible' && ['suspended', 'interrupted'].includes(Howler.ctx?.state as string))
      resumeTimer = setTimeout(unlock, 100);
  };
  for (const event of ['pointerdown', 'touchend', 'keydown']) document.addEventListener(event, unlock, { passive: true });
  document.addEventListener('visibilitychange', visibility);
  const unsubscribe = useAudioStore.subscribe(apply); apply();
  return () => {
    disposed = true; clearTimeout(resumeTimer); unsubscribe();
    for (const event of ['pointerdown', 'touchend', 'keydown']) document.removeEventListener(event, unlock);
    document.removeEventListener('visibilitychange', visibility);
    sfx?.unload(); sfx = undefined;
    for (const track of tracks.values()) { clearTimeout(track.stop); track.howl.unload(); }
    tracks.clear(); active = undefined; desired = undefined;
    useAudioStore.setState({ audioUnlocked: false });
  };
}
