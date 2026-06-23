// Capped-concurrency runner. Like Promise.allSettled but with a worker-pool cap,
// so a 20-state fan-out never opens 20 simultaneous LLM-backed requests at once
// (the real bottleneck is LLM rate limits, not Browserbase). Never rejects.

/**
 * Run `fn` over `items` with at most `concurrency` in flight at any moment.
 * Results are returned in input order. A throwing `fn` becomes a 'rejected'
 * settle entry — the returned promise itself never rejects.
 */
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let next = 0;
  const lanes = Math.max(1, Math.min(concurrency, items.length || 1));

  async function lane(): Promise<void> {
    for (let i = next++; i < items.length; i = next++) {
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i], i) };
      } catch (reason) {
        results[i] = { status: 'rejected', reason };
      }
    }
  }

  await Promise.all(Array.from({ length: lanes }, () => lane()));
  return results;
}
