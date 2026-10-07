// Keep the old command as an alias of the rendered-history checks, never a substitute suite.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const qa = dirname(fileURLToPath(import.meta.url));
const result = spawnSync(process.execPath, [join(qa, 'appearance-wallpaper-pixels.mjs')], { stdio: 'inherit' });
process.exit(result.status ?? 1);
