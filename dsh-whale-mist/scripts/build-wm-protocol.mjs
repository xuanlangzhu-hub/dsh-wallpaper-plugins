// Injects the tested WHL1 frame protocol into the packaged theme client.
//
// src/client.js is a plain, hand-maintained client module (no bundler, no build step in
// the package). The Wallpaper Engine preview needs the same frame decoder that the
// browser regression tests exercise, so this script inlines the single tested source
// instead of keeping a second copy in the client file.
import { readFile, writeFile } from 'node:fs/promises';

const protocolPath = new URL('../src/wallpaper/frame-protocol.js', import.meta.url);
const clientPath = new URL('../src/client.js', import.meta.url);
const marker = '/* WM_FRAME_PROTOCOL */';

const protocol = (await readFile(protocolPath, 'utf8'))
  .replace(/^export /gm, '')
  .replace(/\bFrameDecoder\b/g, 'WM_FRAME_DECODER')
  .trimEnd();

const client = await readFile(clientPath, 'utf8');
const start = client.indexOf(marker);
if (start === -1) throw new Error(`client.js is missing the ${marker} marker`);
const end = client.indexOf('/* WM_FRAME_PROTOCOL_END */', start);
if (end === -1) throw new Error('client.js is missing the WM_FRAME_PROTOCOL_END marker');

// Indent the injected block and keep blank lines empty: no trailing whitespace.
const injected = protocol.split('\n').map(line => (line ? `      ${line}` : '')).join('\n');
const next = `${client.slice(0, start + marker.length)}\n${injected}\n      ${client.slice(end)}`;
if (next !== client) await writeFile(clientPath, next);
console.log(`wm-frame-protocol: ${next === client ? 'already up to date' : 'injected'} (${protocol.split('\n').length} lines)`);
