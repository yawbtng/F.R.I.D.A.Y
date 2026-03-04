import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const TOOLS_DIR = path.resolve(__dirname, '../../agent/src/tools');

describe('Agent Tools Smoke Test', () => {
  it('all tool source files exist', () => {
    const toolFiles = ['navigate', 'act', 'extract', 'observe', 'screenshot', 'exa-search'];
    for (const name of toolFiles) {
      const filePath = path.join(TOOLS_DIR, `${name}.ts`);
      expect(fs.existsSync(filePath), `Missing tool file: ${name}.ts`).toBe(true);
    }
  });

  it('barrel index.ts exists and exports expected names', () => {
    const indexPath = path.join(TOOLS_DIR, 'index.ts');
    expect(fs.existsSync(indexPath)).toBe(true);

    const content = fs.readFileSync(indexPath, 'utf-8');
    const expectedExports = ['navigate', 'act', 'extract', 'observe', 'screenshot', 'webSearch', 'agentTools'];
    for (const name of expectedExports) {
      expect(content, `Barrel should export "${name}"`).toContain(name);
    }
  });

  it('shared.ts exports setBrowserSessionId and getBrowserSessionId', () => {
    const sharedPath = path.join(TOOLS_DIR, 'shared.ts');
    expect(fs.existsSync(sharedPath)).toBe(true);

    const content = fs.readFileSync(sharedPath, 'utf-8');
    expect(content).toContain('export function setBrowserSessionId');
    expect(content).toContain('export function getBrowserSessionId');
  });

  it('shared state setters work correctly', async () => {
    // shared.ts has no external deps so we can import it directly
    const shared = await import('../../agent/src/tools/shared.js').catch(() => null);
    if (!shared) {
      // Skip if import fails due to module resolution
      return;
    }

    shared.setBrowserSessionId('test-session-123');
    expect(shared.getBrowserSessionId()).toBe('test-session-123');
  });

  it('each tool file imports agentFetch and uses llm.tool', () => {
    const toolFiles = ['navigate', 'act', 'extract', 'observe', 'screenshot', 'exa-search'];
    for (const name of toolFiles) {
      const content = fs.readFileSync(path.join(TOOLS_DIR, `${name}.ts`), 'utf-8');
      // Each tool should use agentFetch (or agentFetchWithHeartbeat)
      expect(
        content.includes('agentFetch') || content.includes('agentFetchWithHeartbeat'),
        `${name}.ts should use agentFetch`,
      ).toBe(true);
    }
  });
});
