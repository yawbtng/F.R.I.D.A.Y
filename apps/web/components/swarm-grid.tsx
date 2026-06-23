'use client';

import { GridTile, type TileState } from './grid-tile';

export type { TileState };

/** A tile plus the live session handle the page needs to drive + release it. */
export interface Tile {
  state: string;
  name: string;
  sessionId: string;
  token: string;
  liveViewUrl: string;
  status: TileState;
  ms?: number;
}

export function SwarmGrid({ tiles }: { tiles: Tile[] }) {
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {tiles.map((t) => (
        <GridTile
          key={t.state}
          stateCode={t.state}
          stateName={t.name}
          liveViewUrl={t.liveViewUrl}
          status={t.status}
          ms={t.ms}
        />
      ))}
    </div>
  );
}
