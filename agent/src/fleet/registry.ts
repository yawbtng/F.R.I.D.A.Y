// In-memory fleet registry. Browserbase has no official session pool, so we roll
// our own: a Map<browserId, FleetBrowser> the orchestrator and (later) the live-view
// grid read from. One instance per swarm run; cleared on teardown.

import type { FleetBrowser, BrowserStatus } from './types.js';

export class FleetRegistry {
  private browsers = new Map<string, FleetBrowser>();

  add(browser: FleetBrowser): void {
    this.browsers.set(browser.browserId, browser);
  }

  /** Throws on an unknown id so a routing bug fails loudly instead of deref-ing undefined. */
  get(browserId: string): FleetBrowser {
    const b = this.browsers.get(browserId);
    if (!b) throw new Error(`Unknown browserId: ${browserId}`);
    return b;
  }

  has(browserId: string): boolean {
    return this.browsers.has(browserId);
  }

  list(): FleetBrowser[] {
    return [...this.browsers.values()];
  }

  setStatus(browserId: string, status: BrowserStatus): void {
    this.get(browserId).status = status;
  }

  remove(browserId: string): FleetBrowser {
    const b = this.get(browserId);
    this.browsers.delete(browserId);
    return b;
  }

  get size(): number {
    return this.browsers.size;
  }

  clear(): void {
    this.browsers.clear();
  }
}
