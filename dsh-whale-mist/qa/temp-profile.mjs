// Temporary browser profiles for the isolated QA checks, with ownership and path boundaries.
//
// Every check starts headless Edge with its own `--user-data-dir`, which the browser fills with tens
// of megabytes of profile data. Creating those with `mkdtemp` alone left them behind after every run.
// Removing them needs care, because the removal is recursive: this module therefore only ever removes
// a directory that it created in this process, that resolves to inside the system temporary folder,
// and that is not a link of any kind. Anything else is refused with an error rather than deleted.
//
// Reports must not live inside a profile: they would be removed with it. Use `createRunDirectory`
// for anything that has to survive the cleanup, and `verifyPersisted` to prove it reached the disk.
//
// `WM_KEEP_TEMP=1` keeps profiles for inspection; the path is printed when it is kept.
import { mkdir, mkdtemp, readdir, rm, lstat, realpath, stat } from 'node:fs/promises';
import { basename, dirname, join, relative, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const KEEP = process.env.WM_KEEP_TEMP === '1';
/** Directories this process created through createProfile, by resolved path. */
const owned = new Set();

const message = error => (error && (error.code || error.message)) || "unknown error";

/** True when `path` is `root` itself or lies inside it, comparing resolved paths. */
function isInside(root, path) {
  const rel = relative(root, path);
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

/**
 * Resolves the directory and proves it is somewhere this module is allowed to delete: inside the
 * system temporary folder, not the folder itself, and not a symbolic link or other reparse point.
 * Throws with a specific reason instead of returning a flag, so a mistaken call is loud.
 */
async function assertRemovable(directory, label) {
  if (typeof directory !== "string" || directory.trim() === "") {
    throw new Error(`${label}: a directory path is required, got ${JSON.stringify(directory)}`);
  }
  const resolvedTemp = await realpath(tmpdir());
  let resolved;
  try {
    resolved = await realpath(resolve(directory));
  } catch (error) {
    throw new Error(`${label}: cannot resolve ${directory} (${message(error)})`);
  }
  if (resolved === resolvedTemp) {
    throw new Error(`${label}: refusing to remove the temporary folder itself (${resolved})`);
  }
  if (!isInside(resolvedTemp, resolved)) {
    throw new Error(`${label}: refusing to remove ${resolved}, which is outside ${resolvedTemp}`);
  }
  const info = await lstat(resolve(directory));
  if (info.isSymbolicLink()) {
    throw new Error(`${label}: refusing to remove the symbolic link ${resolved}`);
  }
  if (!info.isDirectory()) {
    throw new Error(`${label}: ${resolved} is not a directory`);
  }
  return resolved;
}

/** Creates a temporary browser profile directory and records it as owned by this process. */
export async function createProfile(prefix) {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  owned.add(await realpath(directory));
  return directory;
}

/**
 * Removes a profile this process created. Refuses unregistered directories: a path that was not
 * returned by `createProfile` is a bug in the caller, and deleting it directly could take unrelated
 * data with it.
 */
export async function removeProfile(directory) {
  const resolved = await assertRemovable(directory, "removeProfile");
  if (!owned.has(resolved)) {
    throw new Error(`removeProfile: ${resolved} was not created by createProfile in this run, refusing to remove it`);
  }
  if (KEEP) {
    console.log(`temporary profile kept: ${directory}`);
    return false;
  }
  try {
    await rm(resolved, { recursive: true, force: true, maxRetries: 5, retryDelay: 120 });
    owned.delete(resolved);
    return true;
  } catch (error) {
    // A file still held by a dying browser must not turn a passing check into a failure, but the
    // path is reported so the leftover is visible rather than silently kept.
    console.log(`temporary profile could not be removed: ${resolved} (${message(error)})`);
    return false;
  }
}

/**
 * Creates a directory for this run's evidence and returns its path. It lives in the repository's own
 * .tmp directory by default, never inside a browser profile: a report written into a profile would be
 * deleted with it. `WM_RUN_DIR` overrides the location.
 */
export async function createRunDirectory(label) {
  const here = dirname(fileURLToPath(import.meta.url));
  if (process.env.WM_RUN_DIR) {
    // A caller-supplied base is honoured only when it cannot be removed with a profile later, and the
    // directory inside it is still allocated uniquely: two runs must not share one, or the second
    // would overwrite the first's evidence.
    const base = await assertOutsideProfiles(process.env.WM_RUN_DIR, "WM_RUN_DIR");
    await mkdir(base, { recursive: true });
    const physicalBase = await realpath(base);
    const target = await assertOutsideProfiles(join(physicalBase, `${label}-`), "WM_RUN_DIR entry");
    return mkdtemp(target);
  }
  const base = join(here, '..', '.tmp');
  await mkdir(base, { recursive: true });
  return mkdtemp(join(base, `${label}-`));
}

/**
 * Fails when a file that should have been written is not on disk, or is empty. Called before a
 * profile is removed, so a report that failed to land is loud instead of being cleaned away.
 */
export async function verifyPersisted(path) {
  await assertOutsideProfiles(path, "verifyPersisted");
  const info = await stat(path).catch(error => {
    throw new Error(`expected evidence at ${path} but it is not readable (${message(error)})`);
  });
  if (!info.isFile() || info.size === 0) {
    throw new Error(`expected evidence at ${path} but it is ${info.isFile() ? "empty" : "not a file"}`);
  }
  return { path, bytes: info.size };
}

/**
 * Resolves a path to where it physically is, even when it does not exist yet.
 *
 * `resolve()` is only a syntactic operation: a directory junction inside the evidence folder can point
 * at a browser profile, and a path through it looks like it is outside the profile while the bytes end
 * up inside it. This walks up to the nearest ancestor that exists, resolves that ancestor for real, and
 * re-appends the part that does not exist yet. The result is what the file system will actually use.
 */
async function physicalPath(path) {
  const resolved = resolve(path);
  const missing = [];
  let current = resolved;
  for (;;) {
    try {
      const real = await realpath(current);
      return missing.length === 0 ? real : join(real, ...missing.reverse());
    } catch (error) {
      if (error.code !== "ENOENT") throw new Error(`cannot resolve ${current} (${message(error)})`);
      const parent = dirname(current);
      if (parent === current) return resolved;
      missing.push(basename(current));
      current = parent;
    }
  }
}

/** Windows paths are compared without regard to case; other platforms are case-sensitive. */
const normalize = path => (process.platform === "win32" ? path.toLowerCase() : path);

/** True when `path` is equal to or inside `root`, comparing physical paths. */
async function isPhysicallyInside(root, path) {
  const [physicalRoot, physicalTarget] = [normalize(await physicalPath(root)), normalize(await physicalPath(path))];
  return physicalTarget === physicalRoot || isInside(physicalRoot, physicalTarget);
}

/**
 * Refuses a path that lies inside a profile this run created, or inside one being created. A report
 * written there would be deleted by `removeProfile`, so the check fails before any evidence is lost
 * rather than reporting success and then removing the file. Comparison uses physical paths, so a
 * junction or symlink pointing into the profile is refused as well.
 */
export async function assertOutsideProfiles(path, label, extra = null) {
  if (typeof path !== "string" || path.trim() === "") {
    throw new Error(`${label}: a path is required, got ${JSON.stringify(path)}`);
  }
  const resolved = await physicalPath(path);
  const candidates = [...owned];
  if (extra) candidates.push(await realpath(extra).catch(() => resolve(extra)));
  for (const profile of candidates) {
    const physicalProfile = normalize(await physicalPath(profile));
    const target = normalize(resolved);
    if (target === physicalProfile || isInside(physicalProfile, target)) {
      throw new Error(`${label}: ${path} resolves to ${resolved}, inside the browser profile ${profile}, which is removed at the end of the run; write it somewhere else`);
    }
    // The other direction: the profile would end up nested under the target.
    if (isInside(target, physicalProfile)) {
      throw new Error(`${label}: ${path} contains the browser profile ${profile}, which is removed at the end of the run; write it somewhere else`);
    }
  }
  return resolved;
}

/**
 * Resolves an evidence path for a check: the caller's environment override when present, otherwise a
 * file inside the run directory. An override inside a profile is refused instead of accepted and
 * then deleted.
 */
export async function evidencePath(envName, runDir, fileName) {
  const override = process.env[envName];
  if (override) {
    const resolved = await assertOutsideProfiles(override, envName);
    await mkdir(dirname(resolved), { recursive: true });
    return resolved;
  }
  const path = join(runDir, fileName);
  await assertOutsideProfiles(path, `default ${fileName}`);
  return path;
}

/** The directories this run created and has not removed yet. Used by the checks' own assertions. */
export function ownedProfiles() {
  return [...owned];
}
