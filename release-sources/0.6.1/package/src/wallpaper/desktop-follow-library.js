// Host-private candidate. Observe only this library's approved snapshots; never import a
// returned desktop path into the catalogue or expose paths through public status/routes.
import { verifyCatalogItemRating } from './catalog.js';
import { parseAgeRatings } from '../appearance-contract.js';
import { resolveDesktopSelection } from './desktop-follow-selection.js';

const refused = code => Object.assign(Error(code), { followReason: code });

export function createDesktopLibraryBridge(library, { readRating = verifyCatalogItemRating } = {}) {
  let records = null, revision = 0, disposed = false;
  const off = library.subscribe(snapshot => {
    records = snapshot.items.map(item => ({ ...item })); revision += 1;
  });
  const fresh = (signal, isCurrent, expectedRevision = revision) => {
    if (disposed || signal?.aborted || !isCurrent() || expectedRevision !== revision) throw refused('cancelled-or-catalog-changed');
  };
  async function verifyForPlayback(sceneId, { allowedRatings = ['Everyone'], signal, isCurrent = () => true } = {}) {
    const currentRevision = revision;
    fresh(signal, isCurrent, currentRevision);
    if (!records) throw refused('catalog-refresh-required');
    const item = records.find(record => record.id === sceneId);
    if (!item || item.available !== true) throw refused('catalog-item-unavailable');
    const ratings = parseAgeRatings(allowedRatings);
    if (!ratings.includes(item.contentRating)) throw refused('rating-not-allowed');
    let descriptor;
    try { descriptor = await library.resolveForPlayback(sceneId); }
    catch { throw refused('path-reverification-failed'); }
    fresh(signal, isCurrent, currentRevision);
    let rating;
    try { rating = await readRating(item, { roots: library.roots, signal }); }
    catch { throw refused('rating-reverification-failed'); }
    fresh(signal, isCurrent, currentRevision);
    if (!['Everyone', 'Questionable', 'Mature'].includes(rating) || !ratings.includes(rating)) throw refused('rating-not-allowed');
    if (descriptor.sceneId !== sceneId || descriptor.type !== item.type) throw refused('catalog-descriptor-changed');
    return descriptor; // Private descriptor for the existing Host verifier, never UI data.
  }
  return {
    async resolve(query, options = {}) {
      try {
        fresh(options.signal, options.isCurrent ?? (() => true));
        const selected = resolveDesktopSelection(query, records, options.allowedRatings);
        if (selected.status !== 'candidate') return selected;
        await verifyForPlayback(selected.sceneId, options);
        return { status: 'ready', sceneId: selected.sceneId, type: selected.type, synchronization: selected.synchronization };
      } catch (error) { return { status: 'blocked', reason: error.followReason ?? 'library-verification-failed' }; }
    },
    verifyForPlayback,
    // One explicit enable/refresh can prime an already-loaded library's observer.
    // Polls never rescan: caller decides when to request an approved-root refresh.
    refresh: () => { if (disposed) throw refused('disposed'); return library.refresh(); },
    dispose() { if (!disposed) { disposed = true; records = null; revision += 1; off(); } },
  };
}
