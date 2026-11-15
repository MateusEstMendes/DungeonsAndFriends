/** Includes the reconnect grace period, but never an unplaced or unapproved character. */
export function isCharacterPresent(player: { status: string; connected: boolean; reconnecting: boolean; awaitingPosition: boolean }) {
  return player.status === "READY" && (player.connected || player.reconnecting) && !player.awaitingPosition;
}
