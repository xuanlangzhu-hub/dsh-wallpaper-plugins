import { readFile, readdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const root = resolve(process.argv[2] ?? '.');
const percentile = (values, p) => {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  return sorted.length ? +sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(3) : null;
};
const results = [];
for (const dir of await readdir(root, { withFileTypes: true })) {
  if (!dir.isDirectory()) continue;
  const path = join(root, dir.name);
  let summary;
  try { summary = JSON.parse(await readFile(join(path, 'summary.json'), 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  const rows = (await readFile(join(path, 'frames.jsonl'), 'utf8')).trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
  // Keep startup in the overall figure; also report the same 3 s warm-up exclusion for all modes.
  const steady = rows.filter(row => row.seconds >= 3);
  const timings = {};
  for (const key of ['acquireMs', 'readbackMs', 'jpegMs', 'packHashMs', 'imageWriteMs', 'encodeMs']) {
    timings[key] = { p50: percentile(steady.map(row => row[key]), .5), p95: percentile(steady.map(row => row[key]), .95) };
  }
  results.push({ run: dir.name, ...summary,
    overallFps: +(rows.length / summary.seconds).toFixed(2),
    steadyFps: steady.length > 1 ? +((steady.length - 1) / (steady.at(-1).seconds - steady[0].seconds)).toFixed(2) : null,
    distinctEncodedFrames: new Set(rows.map(row => row.hash).filter(Boolean)).size,
    distinctSourceTimestamps: new Set(rows.map(row => row.sourceTimestampMs)).size,
    foregroundRatio: rows.length ? +(rows.filter(row => row.foreground).length / rows.length).toFixed(3) : null,
    minimizedFrames: rows.filter(row => row.minimized).length,
    timings,
  });
}
await writeFile(join(root, 'performance.json'), JSON.stringify(results, null, 2));
console.log(JSON.stringify(results, null, 2));
