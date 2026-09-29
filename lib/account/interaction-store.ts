export type InteractionTable = "likes" | "saves" | "follows";
export type InteractionSnapshot = {
  owner: string | null | undefined;
  ready: boolean;
  values: ReadonlySet<string>;
  pending: ReadonlySet<string>;
  failures: ReadonlySet<string>;
  error: boolean;
};

export const EMPTY_INTERACTIONS: InteractionSnapshot = {
  owner: undefined, ready: false, values: new Set(), pending: new Set(), failures: new Set(), error: false,
};

type Transport = {
  read: (owner: string | null, table: InteractionTable) => Promise<string[]>;
  write: (owner: string | null, table: InteractionTable, id: string, active: boolean) => Promise<void>;
  committed?: (table: InteractionTable) => void;
};

export class InteractionStore {
  private owner: string | null | undefined = undefined;
  private epoch = 0;
  private listeners = new Set<() => void>();
  private requested = new Set<InteractionTable>();
  private snapshots = new Map<InteractionTable, InteractionSnapshot>();
  private versions = new Map<InteractionTable, number>();
  private refreshAfterWrite = new Set<InteractionTable>();
  private reading = new Map<InteractionTable, number>();
  private transport: Transport;

  constructor(transport: Transport) { this.transport = transport; }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  get = (table: InteractionTable) => this.snapshots.get(table) ?? EMPTY_INTERACTIONS;
  private publish(table: InteractionTable, value: InteractionSnapshot) {
    this.snapshots.set(table, value);
    for (const listener of this.listeners) listener();
  }
  private nextVersion(table: InteractionTable) {
    const version = (this.versions.get(table) ?? 0) + 1;
    this.versions.set(table, version);
    return version;
  }
  activate(owner: string | null | undefined) {
    if (owner === this.owner) return;
    this.owner = owner;
    this.epoch++;
    this.refreshAfterWrite.clear();
    this.reading.clear();
    for (const table of this.requested) {
      this.nextVersion(table);
      this.publish(table, { ...EMPTY_INTERACTIONS, owner });
      if (owner !== undefined) void this.refresh(table);
    }
  }
  request(table: InteractionTable) {
    if (this.requested.has(table)) return;
    this.requested.add(table);
    this.publish(table, { ...EMPTY_INTERACTIONS, owner: this.owner });
    if (this.owner !== undefined) void this.refresh(table);
  }
  async refresh(table: InteractionTable) {
    if (!this.requested.has(table) || this.owner === undefined) return;
    if (this.get(table).pending.size) { this.refreshAfterWrite.add(table); return; }
    const owner = this.owner;
    const epoch = this.epoch;
    const version = this.nextVersion(table);
    this.reading.set(table, version);
    try {
      const ids = await this.transport.read(owner, table);
      if (epoch !== this.epoch || version !== this.versions.get(table)) return;
      this.publish(table, { owner, ready: true, values: new Set(ids), pending: new Set(), failures: new Set(), error: false });
    } catch {
      if (epoch !== this.epoch || version !== this.versions.get(table)) return;
      this.publish(table, { ...this.get(table), error: true });
    } finally {
      if (this.reading.get(table) === version) this.reading.delete(table);
    }
  }
  async set(table: InteractionTable, id: string, active: boolean): Promise<boolean> {
    const initial = this.get(table);
    if (!initial.ready || initial.owner === undefined || initial.pending.has(id)) return false;
    const owner = initial.owner;
    const epoch = this.epoch;
    const previous = initial.values.has(id);
    const values = new Set(initial.values);
    if (active) values.add(id); else values.delete(id);
    // Invalidate reads started before this write so they cannot erase its optimistic state.
    if (this.reading.has(table)) this.refreshAfterWrite.add(table);
    this.nextVersion(table);
    this.publish(table, { ...initial, values, pending: new Set([...initial.pending, id]), failures: new Set([...initial.failures].filter((value) => value !== id)) });
    let saved = false;
    try {
      await this.transport.write(owner, table, id, active);
      if (epoch !== this.epoch) return false;
      saved = true;
    } catch {
      if (epoch !== this.epoch) return false;
      const current = this.get(table);
      const restored = new Set(current.values);
      if (previous) restored.add(id); else restored.delete(id);
      this.publish(table, { ...current, values: restored, failures: new Set([...current.failures, id]) });
    } finally {
      if (epoch === this.epoch) {
        const current = this.get(table);
        this.publish(table, { ...current, pending: new Set([...current.pending].filter((value) => value !== id)) });
        if (saved) this.transport.committed?.(table);
        if (!this.get(table).pending.size && this.refreshAfterWrite.delete(table)) void this.refresh(table);
      }
    }
    return saved;
  }
}
