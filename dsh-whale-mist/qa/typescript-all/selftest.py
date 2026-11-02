"""Orchestrator failure boundaries; synthetic entries do not prove production types."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import argparse
import importlib.util
import time
import types
import unittest

HERE = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location('combined_check', HERE / 'run.py')
runner = importlib.util.module_from_spec(spec)
spec.loader.exec_module(runner)


class Boundaries(unittest.TestCase):
    def folder(self):
        path = OUTPUT / self._testMethodName
        path.mkdir()
        return path

    def entry(self, out, body):
        file = out / 'entry.py'
        file.write_text(body, encoding='utf-8')
        return file

    def test_entry_exception_restores_supervisor_and_context(self):
        out = self.folder()
        entry = self.entry(out, "import os,sys\nos.chdir(sys.argv[1])\nsys.path.append('synthetic')\nraise ValueError('retained')\n")
        original = runner.common.Stages
        original_argv, original_path, original_cwd = sys.argv, sys.path[:], Path.cwd()
        with self.assertRaises(ValueError):
            runner.execute_entry(entry, [out], time.monotonic()+5)
        self.assertIs(runner.common.Stages, original)
        self.assertIs(sys.argv, original_argv)
        self.assertEqual(sys.path, original_path)
        self.assertEqual(Path.cwd(), original_cwd)

    def test_expired_budget_never_enters(self):
        out = self.folder()
        marker = out / 'entered'
        entry = self.entry(out, "from pathlib import Path\nPath("+repr(str(marker))+").touch()\n")
        with self.assertRaises(AssertionError):
            runner.execute_entry(entry, [], time.monotonic()-1)
        self.assertFalse(marker.exists())

    def test_shared_deadline_clamps_real_executor(self):
        out = self.folder()
        entry = self.entry(out, "import common,sys\nfrom pathlib import Path\ns=common.Stages(Path(sys.argv[1]),total_seconds=999)\ncommon.save(Path(sys.argv[1])/'observed.json',{'deadline':s.deadline})\ns.run('busy',[sys.executable,'-c','while True: pass'])\n")
        deadline = time.monotonic()+.3
        with self.assertRaises(AssertionError):
            runner.execute_entry(entry, [out], deadline)
        observed = runner.common.read(out / 'observed.json')
        self.assertLessEqual(observed['deadline'], deadline)
        row = runner.common.read(out / 'commands.json')[0]
        self.assertTrue(row['timedOut'])
        self.assertTrue(row['exitConfirmed'])
        self.assertIsNotNone(row['code'])

    def test_zero_exit_without_result_is_failure(self):
        out = self.folder()
        entry = self.entry(out, 'raise SystemExit(0)\n')
        states = []
        with self.assertRaises(FileNotFoundError):
            runner.run_scope('es-only', entry, [], out, time.monotonic()+5, states)
        self.assertEqual(states[0]['state'], 'failed')

    def test_nonzero_exit_is_failure(self):
        out = self.folder()
        states = []
        with self.assertRaises(SystemExit):
            runner.run_scope('es-only', self.entry(out, 'raise SystemExit(7)\n'), [], out, time.monotonic()+5, states)
        self.assertEqual(states[0]['state'], 'failed')
        self.assertEqual(states[0]['error'], '7')

    def good_es(self):
        return dict(passed=True, commands=[dict(code=0,exitConfirmed=True,timedOut=False,cleanupError=None) for _ in range(18)],
                    nativeOrLiveAppsUsed=False, protectedInputs=432, checkedActualDevelopmentSources=True,
                    negativeCases=35,runtimeTests=56,positiveConsumers=4,actualDevelopmentModules=3,
                    generatedDecoderUnits=1,standardLibraryFiles=57,compilerEmittedFiles=0)

    def test_pass_requires_confirmed_children(self):
        result = self.good_es()
        self.assertEqual(runner.validate_result('es-only', result)['negativeCases'], 35)
        result['commands'][0]['exitConfirmed'] = False
        with self.assertRaises(AssertionError):
            runner.validate_result('es-only', result)

    def test_scope_mixup_is_rejected(self):
        result = self.good_es()
        result['standardLibraryFiles'] = 59
        with self.assertRaises(AssertionError):
            runner.validate_result('es-only', result)

    def test_failed_receipt_is_not_success(self):
        result = self.good_es()
        result['passed'] = False
        with self.assertRaises(AssertionError):
            runner.validate_result('es-only', result)

    def test_real_recipes_ignore_poisoned_bare_cache_in_both_orders(self):
        prior = sys.modules.get('annotate')
        poison = types.ModuleType('annotate')
        poison.annotate = lambda text: 'WRONG RECIPE'
        sys.modules['annotate'] = poison
        try:
            pairs = [(runner.QA / folder, runner.ROOT / source) for folder, source in [
                ('typescript-frame-hub', 'dsh-whale-mist/src/wallpaper/frame-hub.js'),
                ('typescript-managed-window', 'dsh-whale-mist/src/wallpaper/managed-window.js'),
            ]]
            for order in [[0, 1, 0], [1, 0, 1]]:
                for index in order:
                    folder, source = pairs[index]
                    baseline = folder / 'baseline' / source.name
                    recipe = runner.common.load_annotation_recipe(folder / 'annotate.py')
                    self.assertEqual(recipe(baseline.read_text(encoding='utf-8')), source.read_text(encoding='utf-8'))
                    self.assertIs(sys.modules['annotate'], poison)
        finally:
            if prior is None:
                sys.modules.pop('annotate', None)
            else:
                sys.modules['annotate'] = prior

    def test_failed_recipe_load_keeps_import_context(self):
        out = self.folder()
        file = out / 'annotate.py'
        file.write_text("raise RuntimeError('recipe failed')\n", encoding='utf-8')
        path_before, prior = sys.path[:], sys.modules.get('annotate')
        with self.assertRaisesRegex(RuntimeError, 'recipe failed'):
            runner.common.load_annotation_recipe(file)
        self.assertEqual(sys.path, path_before)
        self.assertIs(sys.modules.get('annotate'), prior)

    def test_missing_callable_recipe_is_rejected(self):
        out = self.folder()
        file = out / 'annotate.py'
        file.write_text('annotate = None\n', encoding='utf-8')
        with self.assertRaisesRegex(AssertionError, 'callable annotate'):
            runner.common.load_annotation_recipe(file)

    def test_managed_receipt_requires_own_counts_and_recipe(self):
        recipe = runner.QA / 'typescript-managed-window/annotate.py'
        result = dict(passed=True, protectedInputs=432, nativeOrLiveAppsUsed=False,
            checkedActualDevelopmentManagedWindow=True, runtimeTests=21,
            annotationRecipe=dict(file=str(recipe), sha256=runner.common.sha(recipe)),
            commands=[dict(code=0,exitConfirmed=True,timedOut=False,cleanupError=None) for _ in range(9)],
            typeResults=dict(positivePassed=True,negativeCases=[dict(rejected=True) for _ in range(16)],
                standardLibraryFiles=59,nodeDeclarationFiles=66,undiciDeclarationFiles=41,
                skipLibCheck=False,compilerEmittedFiles=0,checkedNonLibraryFiles=['synthetic-consumer']))
        self.assertEqual(runner.validate_result('node-managed-window', result)['entryStages'], 9)
        result['runtimeTests'] = 17
        with self.assertRaises(AssertionError):
            runner.validate_result('node-managed-window', result)
        result['runtimeTests'] = 21
        result['annotationRecipe']['file'] = str(runner.QA / 'typescript-frame-hub/annotate.py')
        with self.assertRaises(AssertionError):
            runner.validate_result('node-managed-window', result)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', required=True)
    args = parser.parse_args()
    OUTPUT = Path(args.output).resolve()
    assert OUTPUT.is_relative_to(runner.ROOT / '.tmp') and not OUTPUT.exists()
    OUTPUT.mkdir()
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Boundaries))
    runner.common.save(OUTPUT / 'result.json', dict(passed=result.wasSuccessful(), tests=result.testsRun,
        failures=len(result.failures), errors=len(result.errors), syntheticEntriesOnly=True, nativeOrLiveAppsUsed=False))
    raise SystemExit(0 if result.wasSuccessful() else 1)
