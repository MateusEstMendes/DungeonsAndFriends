/** Memory belongs only to the current chamber visit, never to a global map cache. */
export class FogMemory {
  private chamberId = "";
  private explored = new Set<string>();
  visit(chamberId: string, active: ReadonlySet<string>) {
    if (chamberId !== this.chamberId) { this.explored.clear(); this.chamberId = chamberId; }
    for (const cell of active) this.explored.add(cell);
  }
  has(cell: string) { return this.explored.has(cell); }
  clear() { this.chamberId = ""; this.explored.clear(); }
}
