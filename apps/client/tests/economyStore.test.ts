import { afterEach, expect, it } from 'vitest';
import type { EphemeralChatMessage, SessionLogEntry } from '@df/shared';
import { useEconomyStore, initialEconomyState, receiveChat, expireChat, receiveLog } from '../src/store/useEconomyStore';
afterEach(() => useEconomyStore.setState({ ...initialEconomyState }));
const chat: EphemeralChatMessage = { id: 'first', actorId: 'a', actorName: 'Ael', actorKind: 'PLAYER', chamberId: 'room', text: 'Olá', createdAt: 1000, expiresAt: 8000 };
it('keeps only current speech per actor and cannot expire a replacement bubble with an old timer', () => {
  receiveChat(chat, 1000); receiveChat({ ...chat, id: 'second', text: 'Outra', expiresAt: 9000 }, 2000);
  expireChat('first'); expect(useEconomyStore.getState().chats.map(e => e.id)).toEqual(['second']);
  expireChat('second'); expect(useEconomyStore.getState().chats).toEqual([]);
  receiveChat(chat, 8000); expect(useEconomyStore.getState().chats).toEqual([]);
});
it('merges logs chronologically without duplicates, bounds history and replaces it on reconnect', () => {
  const entry = (id: string, createdAt: number): SessionLogEntry => ({ id, chamberId: 'room', createdAt, type: 'DICE', result: { id, createdAt, chamberId: 'room', actorId: 'a', actorName: 'Ael', faces: 20, value: 10 } });
  receiveLog([entry('b', 2000)]); receiveLog([entry('a', 1000), entry('b', 2000)]);
  expect(useEconomyStore.getState().log.map(e => e.id)).toEqual(['a', 'b']);
  receiveLog(Array.from({ length: 250 }, (_, i) => entry(String(i), 3000 + i))); expect(useEconomyStore.getState().log).toHaveLength(200);
  receiveLog([entry('reconnected', 1)], true); expect(useEconomyStore.getState().log.map(e => e.id)).toEqual(['reconnected']);
});
