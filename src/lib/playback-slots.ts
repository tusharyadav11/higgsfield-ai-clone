/**
 * Bounded concurrent video playback. Pure (no DOM) so it is unit-testable.
 * - request(): granted immediately while below the cap; otherwise queued (FIFO) and granted via onGrant when a slot frees.
 * - steal: take a slot now, pausing the oldest holder (used for explicit hover / tap).
 * - allowed() false (reduced motion, data saver) denies automatic playback and queues nothing; explicit taps bypass it.
 */
export type SlotClaim = { stop: () => void; onGrant?: () => void; steal?: boolean; /** user tapped play: bypasses allowed() */ explicit?: boolean };

export type SlotManager = {
  request(id: symbol, claim: SlotClaim): boolean;
  release(id: symbol): void;
  active(): number;
  waiting(): number;
};

export function createSlotManager(opts: { max: () => number; allowed?: () => boolean }): SlotManager {
  const held: { id: symbol; stop: () => void }[] = [];
  const queue: { id: symbol; claim: SlotClaim }[] = [];
  const drop = <T extends { id: symbol }>(list: T[], id: symbol) => {
    const i = list.findIndex((a) => a.id === id);
    if (i >= 0) list.splice(i, 1);
  };
  const drain = () => {
    while (queue.length && held.length < opts.max()) {
      const next = queue.shift()!;
      held.push({ id: next.id, stop: next.claim.stop });
      next.claim.onGrant?.();
    }
  };
  return {
    request(id, claim) {
      if (!claim.explicit && opts.allowed && !opts.allowed()) return false;
      drop(queue, id);
      drop(held, id);
      const cap = Math.max(1, opts.max());
      if (held.length >= cap && claim.steal) {
        while (held.length >= cap) held.shift()?.stop();
      }
      if (held.length < cap) {
        held.push({ id, stop: claim.stop });
        return true;
      }
      queue.push({ id, claim });
      return false;
    },
    release(id) {
      drop(queue, id);
      const had = held.some((h) => h.id === id);
      drop(held, id);
      if (had) drain();
    },
    active: () => held.length,
    waiting: () => queue.length,
  };
}
