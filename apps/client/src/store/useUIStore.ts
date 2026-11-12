import { create } from "zustand";
interface UIState {
  screen: "LOBBY" | "WAITING" | "ROOM";
  queueOpen: boolean;
  notice: string;
  setNotice: (notice: string) => void;
}
export const useUIStore = create<UIState>(set => ({ screen: "LOBBY", queueOpen: false, notice: "", setNotice: notice => set({ notice }) }));
