import { create } from 'zustand';
import { persist } from 'zustand/middleware';
export interface AudioPreferences { masterVolume: number; bgmVolume: number; sfxVolume: number; isMuted: boolean }
type AudioState = AudioPreferences & { audioUnlocked: boolean };
export const useAudioStore = create<AudioState>()(persist((): AudioState => ({
  masterVolume: 0.8, bgmVolume: 0.5, sfxVolume: 0.9, isMuted: false, audioUnlocked: false,
}), { name: 'df_audio_prefs', partialize: ({ masterVolume, bgmVolume, sfxVolume, isMuted }) => ({ masterVolume, bgmVolume, sfxVolume, isMuted }),
  merge: (saved, current) => {
    const data = saved as Partial<AudioPreferences> | null;
    const volume = (v: unknown, fallback: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : fallback;
    return { ...current, masterVolume: volume(data?.masterVolume, 0.8), bgmVolume: volume(data?.bgmVolume, 0.5), sfxVolume: volume(data?.sfxVolume, 0.9), isMuted: data?.isMuted === true };
  },
}));
