"""Sequential, separately typed checks using the existing bounded Node executor."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import argparse
import contextlib
import os
import runpy
import shutil
import time

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
QA = ROOT / 'dsh-whale-mist/qa'
sys.path.insert(0, str(QA / 'typescript-check'))
import common


def execute_entry(entry, arguments, deadline):
    """No outer worker to kill: each real Node child keeps its original supervisor."""
    assert time.monotonic() < deadline, 'Overall deadline expired before entry'
    original_stages = common.Stages
    original_argv, original_path, original_cwd = sys.argv, sys.path[:], Path.cwd()

    class BudgetedStages(original_stages):
        def __init__(self, output, total_seconds=80):
            super().__init__(output, total_seconds)
            self.deadline = min(self.deadline, deadline)

    common.Stages = BudgetedStages
    try:
        sys.argv = [str(entry), *map(str, arguments)]
        sys.path.insert(0, str(entry.parent))
        try:
            runpy.run_path(str(entry), run_name='__main__')
        except SystemExit as error:
            if error.code not in (None, 0):
                raise
    finally:
        common.Stages = original_stages
        sys.argv, sys.path[:] = original_argv, original_path
        os.chdir(original_cwd)


def validate_result(kind, result):
    assert result['passed'] is True, 'Entry result did not pass'
    commands = result['commands']
    stage_counts = {'es-only': 18, 'node-hub': 8, 'node-managed-window': 9}
    assert kind in stage_counts
    assert len(commands) == stage_counts[kind]
    assert all(type(row['code']) is int and row['code'] == 0
               and row['exitConfirmed'] is True and row['timedOut'] is False
               and row['cleanupError'] is None for row in commands), 'Unsuccessful or unknown child exit'
    assert result['nativeOrLiveAppsUsed'] is False
    assert result['protectedInputs'] == 432
    if kind == 'es-only':
        assert result['checkedActualDevelopmentSources'] is True
        assert (result['negativeCases'], result['runtimeTests'], result['positiveConsumers']) == (35, 56, 4)
        assert (result['actualDevelopmentModules'], result['generatedDecoderUnits']) == (3, 1)
        assert result['standardLibraryFiles'] == 57 and result['compilerEmittedFiles'] == 0
        return dict(environment='ES2022; types:[]; no Node/DOM/SDK',
                    negativeCases=35, runtimeTests=56, positiveConsumers=4,
                    standardLibraryFiles=57, entryStages=18)
    if kind == 'node-hub':
        assert result['checkedActualDevelopmentHub'] is True
        negative_count, runtime_count, recipe_folder = 14, 17, 'typescript-frame-hub'
    else:
        assert result['checkedActualDevelopmentManagedWindow'] is True
        negative_count, runtime_count, recipe_folder = 16, 21, 'typescript-managed-window'
    recipe = QA / recipe_folder / 'annotate.py'
    assert Path(result['annotationRecipe']['file']).resolve() == recipe.resolve()
    assert result['annotationRecipe']['sha256'] == common.sha(recipe)
    typed = result['typeResults']
    assert typed['positivePassed'] is True and len(typed['negativeCases']) == negative_count
    assert all(row['rejected'] is True for row in typed['negativeCases'])
    assert (typed['standardLibraryFiles'], typed['nodeDeclarationFiles'], typed['undiciDeclarationFiles']) == (59, 66, 41)
    assert typed['skipLibCheck'] is False and typed['compilerEmittedFiles'] == 0
    assert result['runtimeTests'] == runtime_count
    return dict(environment='ES2022 + pinned real Node24/undici; no DOM/SDK',
                negativeCases=negative_count, runtimeTests=runtime_count, standardLibraryFiles=59,
                nodeDeclarationFiles=66, undiciDeclarationFiles=41,
                nonLibraryFiles=typed['checkedNonLibraryFiles'], entryStages=stage_counts[kind],
                annotationRecipe=result['annotationRecipe'])


def run_scope(kind, entry, arguments, directory, deadline, status):
    row = dict(scope=kind, state='running', output=str(directory))
    status.append(row)
    try:
        execute_entry(entry, arguments, deadline)
        result_path = directory / 'result.json'
        validated = validate_result(kind, common.read(result_path))
        row.update(state='passed', result=str(result_path), resultSha256=common.sha(result_path), **validated)
    except BaseException as error:
        row.update(state='failed', errorType=type(error).__name__, error=str(error))
        raise


def main(out, compiler, cache):
    started = time.monotonic()
    deadline = started + 160
    states = []
    manifest = QA / 'typescript-check/protected-baseline-v7.json'
    protected = common.read(manifest)
    assert len(protected) == 432
    protected[manifest.relative_to(ROOT).as_posix()] = common.sha(manifest)
    own = [HERE / name for name in ['run.py', 'selftest.py', 'README.md']]
    assert all(protected[p.relative_to(ROOT).as_posix()] == common.sha(p) for p in own)
    assert len(protected) == 433
    frozen = out / 'frozen'
    frozen.mkdir()
    for file in own:
        shutil.copyfile(file, frozen / file.name)
    common.save(out / 'protected-before.json', protected)
    failure = None
    verified_after = False
    try:
        common.verify_protected(ROOT, protected)
        for kind, entry, extra in [
            ('es-only', QA / 'typescript-check/run.py', []),
            ('node-hub', QA / 'typescript-frame-hub/check-source.py', ['--cache', cache]),
            ('node-managed-window', QA / 'typescript-managed-window/check-source.py', ['--cache', cache]),
        ]:
            directory = out / kind
            print('Checking ' + kind + ' (separate environment)', flush=True)
            with (out / (kind + '.entry.log')).open('w', encoding='utf-8') as log:
                with contextlib.redirect_stdout(log), contextlib.redirect_stderr(log):
                    run_scope(kind, entry, ['--output', directory, '--compiler-root', compiler, *extra],
                              directory, deadline, states)
        common.verify_protected(ROOT, protected)
        verified_after = True
        common.save(out / 'protected-after.json', protected)
    except BaseException as error:
        failure = dict(errorType=type(error).__name__, error=str(error))
        try:
            common.verify_protected(ROOT, protected)
            verified_after = True
        except Exception as drift:
            failure['postflightError'] = str(drift)
    finally:
        for kind in ['es-only', 'node-hub', 'node-managed-window']:
            if not any(row['scope'] == kind for row in states):
                states.append(dict(scope=kind, state='not-run'))
        common.save(out / 'result.json', dict(passed=failure is None, scopes=states, failure=failure,
            protectedInputs=433, inputsVerifiedAfter=verified_after, elapsedSeconds=time.monotonic()-started,
            globalChildDeadlineSeconds=160, retainedEntryLimitsSeconds={'es-only': 80, 'node-hub': 75, 'node-managed-window': 75},
            perNodeStageSeconds=20, timeoutCleanupSeconds=3, environmentsMerged=False,
            outerWorkerSpawned=False, nativeOrLiveAppsUsed=False, sourceOrDependencyChanges=False))
    if failure is not None:
        raise RuntimeError('Combined check failed; inspect retained result.json and per-scope logs')
    print('PASS: ES-only 35/56, Node Hub 14/17, managed-window 16/21; separate graphs, 35 confirmed stages')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    parser.add_argument('--compiler-root', required=True)
    parser.add_argument('--cache', required=True)
    args = parser.parse_args()
    output = Path(args.output).resolve()
    assert output.is_relative_to(ROOT / '.tmp') and not output.exists(), 'Use a fresh .tmp output directory'
    output.mkdir()
    main(output, Path(args.compiler_root).resolve(), Path(args.cache).resolve())
