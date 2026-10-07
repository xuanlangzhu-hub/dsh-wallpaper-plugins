// Superseded: the rendered-pixel checks live in qa/appearance-wallpaper-pixels.mjs.
//
// The rc.14 review rejected this file for two reasons, and both are fixed by its replacement:
//   - it only read computed styles, so an opaque application frame counted as a success even
//     though it hid the whole wallpaper; and
//   - its gradient parser reported a fully transparent gradient as opaque, so removing the
//     composer mask still passed.
// The replacement samples rendered pixels of a painted stack and carries parser sanity checks.
// This wrapper keeps the old command working, so nobody has to guess which check is current.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const qa = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [join(qa, 'appearance-wallpaper-pixels.mjs')], { stdio: 'inherit' });
process.exit(result.status ?? 1);