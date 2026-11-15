import { create } from 'zustand';
export interface RecoverySummary { updatedAt: number; chamberId: string; inCombat: boolean; round: number; heroes: string[] }
export const useRecoveryStore = create<{ summary: RecoverySummary | null }>(() => ({ summary: null }));
