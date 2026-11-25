import { parseCurrentWallpaperResult } from './desktop-follow-selection.js';

// No locale guessing: ASCII or an explicit BOM is self-describing. A non-ASCII stream
// without a BOM is retained for inspection until its actual encoding is established.
export function decodeQueryBytes(bytes, encoding = 'auto') {
  if (!(bytes instanceof Uint8Array) || bytes.byteLength > 65536) throw Error('invalid-query-bytes');
  const bom = bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf ? 'utf-8'
    : bytes[0] === 0xff && bytes[1] === 0xfe ? 'utf-16le'
      : bytes[0] === 0xfe && bytes[1] === 0xff ? 'utf-16be' : null;
  const allowed = ['auto', 'utf-8', 'utf-16le', 'utf-16be', 'gbk'];
  if (!allowed.includes(encoding)) throw Error('unsupported-query-encoding');
  if (encoding !== 'auto' && bom && encoding !== bom) throw Error('encoding-bom-conflict');
  if (encoding === 'auto') {
    if (bom) encoding = bom;
    else if (bytes.every(value => value > 0 && value < 128)) encoding = 'utf-8';
    else throw Error('explicit-query-encoding-required');
  }
  return { text: new TextDecoder(encoding, { fatal: true }).decode(bytes), encoding };
}

export function consumeNativeQuery(envelope, encoding = 'auto') {
  if (envelope?.inBudget !== true || envelope?.data?.result?.Succeeded !== true) {
    return { status: 'query-error', reason: envelope?.data?.result?.Reason ?? 'native-query-unconfirmed' };
  }
  const result = envelope.data.result, command = result.Command;
  if (command?.Started !== true || command?.Exited !== true || command?.ExitCode !== 0 ||
      command?.TimedOut !== false || command?.Forced !== false || command?.OutputLimit !== false ||
      command?.ExitUnconfirmed !== false || command?.Error !== null) {
    return { status: 'query-error', reason: 'command-unconfirmed' };
  }
  if (typeof command.StdoutBase64 !== 'string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(command.StdoutBase64)) {
    return { status: 'query-error', reason: 'invalid-base64' };
  }
  try {
    const decoded = decodeQueryBytes(Buffer.from(command.StdoutBase64, 'base64'), encoding);
    const query = { exited: true, timedOut: false, exitCode: 0, signal: null, stdout: decoded.text };
    return { ...parseCurrentWallpaperResult(query), encoding: decoded.encoding, query };
  } catch (error) { return { status: 'query-error', reason: error.message }; }
}
