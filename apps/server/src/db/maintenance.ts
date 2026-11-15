import type SQLite from 'better-sqlite3';

export type WalCheckpointMode = 'PASSIVE' | 'TRUNCATE';
export interface WalCheckpointResult { busy: number; log: number; checkpointed: number }
export function checkpointWal(sqlite: SQLite.Database, mode: WalCheckpointMode = 'PASSIVE'): WalCheckpointResult {
  if (mode !== 'PASSIVE' && mode !== 'TRUNCATE') throw new Error('Modo de checkpoint WAL inválido.');
  if (sqlite.inTransaction) throw new Error('Checkpoint WAL exige transação finalizada.');
  return (sqlite.pragma(`wal_checkpoint(${mode})`) as WalCheckpointResult[])[0];
}
export function assertDatabaseIntegrity(sqlite: SQLite.Database, quick = false) {
  const pragma = quick ? 'quick_check' : 'integrity_check';
  const rows = sqlite.pragma(pragma) as Record<string, unknown>[];
  if (rows.length !== 1 || rows[0]?.[pragma] !== 'ok') throw new Error(`SQLite: ${pragma} falhou.`);
  if ((sqlite.pragma('foreign_key_check') as unknown[]).length) throw new Error('SQLite: referências inválidas no banco.');
}
