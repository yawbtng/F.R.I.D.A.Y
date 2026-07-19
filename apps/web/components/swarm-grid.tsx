'use client';

import { GridTile, type TileState } from './grid-tile';

export type { TileState };

/** One unit of swarm work plus the live session handle the page needs to drive + release it.
 *  `id`/`label` are target-generic (a state code + name for KYB, or a planned label for any
 *  task); `result` is the extracted answer surfaced on the tile. */
export interface Tile {
  id: string;
  label: string;
  url: string;
  sessionId: string;
  token: string;
  liveViewUrl: string;
  screenshotUrl?: string;
  result?: string;
  /** Transient worker note shown while working (e.g. "searching", "retrying"). */
  note?: string;
  status: TileState;
  ms?: number;
}

export function SwarmGrid({ tiles, onSelect }: { tiles: Tile[]; onSelect?: (t: Tile) => void }) {
  return (
    <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
      {tiles.map((t) => (
        <GridTile
          key={t.id}
          label={t.label}
          url={t.url}
          liveViewUrl={t.liveViewUrl}
          screenshotUrl={t.screenshotUrl}
          result={t.result}
          note={t.note}
          status={t.status}
          ms={t.ms}
          onClick={onSelect ? () => onSelect(t) : undefined}
        />
      ))}
    </div>
  );
}
