// ponytail: median of 5 samples is enough for ±150–250ms beta tolerance.
// Upgrade to Kalman filter if sync target drops below 100ms.
export async function getServerOffset(
  fetchServerTime: () => Promise<number>,
  samples = 5,
): Promise<number> {
  const offsets: number[] = [];
  for (let i = 0; i < samples; i++) {
    const t0 = Date.now();
    const serverNow = await fetchServerTime();
    const t1 = Date.now();
    const rtt = t1 - t0;
    if (rtt > 1000) continue; // discard slow sample (§9)
    offsets.push(serverNow - (t0 + rtt / 2));
  }
  if (offsets.length === 0) return 0;
  offsets.sort((a, b) => a - b);
  return offsets[Math.floor(offsets.length / 2)];
}

export const correctedNow = (offset: number) => Date.now() + offset;
