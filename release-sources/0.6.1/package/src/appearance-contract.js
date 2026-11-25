// Shared scene identity and age policy. No window launch or companion protocol.
export const CATALOG_ID_PATTERN = /^we-[0-9a-f]{24}$/;

export function isSceneId(value) {
  return value === 'lucy' || (typeof value === 'string' && CATALOG_ID_PATTERN.test(value));
}

export const AGE_RATINGS = Object.freeze(['Everyone', 'Questionable', 'Mature']);
export const DEFAULT_AGE_RATINGS = Object.freeze(['Everyone']);

export function parseAgeRatings(strOrArr) {
  if (Array.isArray(strOrArr)) {
    if (strOrArr.length === 0) return [];
    const allValid = strOrArr.every(r => typeof r === 'string' && AGE_RATINGS.includes(r));
    if (!allValid) {
      return [...DEFAULT_AGE_RATINGS];
    }
    const filtered = [...new Set(strOrArr)];
    filtered.sort((a, b) => AGE_RATINGS.indexOf(a) - AGE_RATINGS.indexOf(b));
    return filtered;
  }
  if (typeof strOrArr === 'string') {
    const trimmed = strOrArr.trim();
    if (trimmed === '') return [];
    const parts = trimmed.split(',').map(s => s.trim()).filter(Boolean);
    if (parts.length === 0) {
      return [...DEFAULT_AGE_RATINGS];
    }
    const allValid = parts.every(r => AGE_RATINGS.includes(r));
    if (!allValid) {
      return [...DEFAULT_AGE_RATINGS];
    }
    const filtered = [...new Set(parts)];
    filtered.sort((a, b) => AGE_RATINGS.indexOf(a) - AGE_RATINGS.indexOf(b));
    return filtered;
  }
  return [...DEFAULT_AGE_RATINGS];
}

