import { describe, it, expect } from 'vitest';
import { FleetSpawnSchema, FleetCloseSchema } from '../../apps/web/lib/schemas';

describe('Fleet API schemas', () => {
  it('FleetSpawnSchema accepts a valid count', () => {
    expect(FleetSpawnSchema.safeParse({ count: 12 }).success).toBe(true);
  });

  it('FleetSpawnSchema rejects count below 1', () => {
    expect(FleetSpawnSchema.safeParse({ count: 0 }).success).toBe(false);
  });

  it('FleetSpawnSchema rejects count above the 25 (Developer-tier) cap', () => {
    expect(FleetSpawnSchema.safeParse({ count: 26 }).success).toBe(false);
  });

  it('FleetSpawnSchema rejects a non-integer count', () => {
    expect(FleetSpawnSchema.safeParse({ count: 3.5 }).success).toBe(false);
  });

  it('FleetCloseSchema requires a sessionId', () => {
    expect(FleetCloseSchema.safeParse({ sessionId: 'sess-1' }).success).toBe(true);
    expect(FleetCloseSchema.safeParse({}).success).toBe(false);
  });
});
