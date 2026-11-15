import type { openDatabase } from './index.js';
import { assertDatabaseIntegrity } from './maintenance.js';

const DAY_MS = 86_400_000;
/** Maintenance for a stopped host. Session JWTs and character data are never pruned. */
export function sanitizeDatabase(database: ReturnType<typeof openDatabase>, options: { now?: number; retentionDays?: number } = {}) {
  const now = options.now ?? Date.now(), retentionDays = options.retentionDays ?? 30;
  if (!Number.isSafeInteger(now) || now < 0 || !Number.isSafeInteger(retentionDays) || retentionDays < 1 || retentionDays > 36500) {
    throw new Error('Data ou retenção inválida para manutenção.');
  }
  const { sqlite } = database;
  assertDatabaseIntegrity(sqlite);
  const cutoff = now - retentionDays * DAY_MS;
  const removed = sqlite.transaction(() => {
    const checkpoints = sqlite.prepare(`DELETE FROM crash_recovery_checkpoints
      WHERE updated_at < ? AND session_id IN (SELECT id FROM sessions WHERE status = 'CLOSED' AND updated_at < ?)`).run(cutoff, cutoff).changes;
    const sessions = sqlite.prepare(`DELETE FROM sessions WHERE status = 'CLOSED' AND updated_at < ?
      AND NOT EXISTS (SELECT 1 FROM crash_recovery_checkpoints c WHERE c.session_id = sessions.id)`).run(cutoff).changes;
    const history = sqlite.prepare('DELETE FROM editor_history WHERE discarded = 1').run().changes;
    // 60s reconnect lease + a conservative margin for the 20s heartbeat and transport delays.
    const reconnectionTokens = sqlite.prepare('UPDATE players SET reconnection_token = NULL WHERE reconnection_token IS NOT NULL AND last_seen_at < ?').run(now - 120_000).changes;
    assertDatabaseIntegrity(sqlite);
    return { checkpoints, sessions, history, reconnectionTokens };
  }).immediate();
  const wal = database.checkpointWal('TRUNCATE');
  if (wal.busy) throw new Error('WAL ocupado. Pare o host e feche outros leitores antes de sanitizar o banco.');
  assertDatabaseIntegrity(sqlite);
  return { removed, wal, integrity: 'ok' as const };
}
