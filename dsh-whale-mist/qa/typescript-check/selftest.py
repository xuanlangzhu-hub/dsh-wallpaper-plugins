"""Exercise the shared deadline and refusal boundaries without native applications."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import argparse
import shutil
import unittest
import subprocess
from unittest.mock import Mock, patch
from common import Stages, read, save, sha, verify_compiler, verify_protected, workspace_file


class Boundaries(unittest.TestCase):
    def folder(self, name):
        path = OUTPUT / name
        path.mkdir()
        return path

    def test_success_is_confirmed(self):
        out = self.folder("success")
        stages = Stages(out)
        self.assertIn("ok", stages.run("success", [sys.executable, "-c", "print('ok')"]))
        self.assertTrue(stages.commands[0]["exitConfirmed"])
        self.assertFalse(stages.commands[0]["timedOut"])

    def test_nonzero_is_retained(self):
        out = self.folder("nonzero")
        with self.assertRaises(AssertionError):
            Stages(out).run("failure", [sys.executable, "-c", "raise SystemExit(7)"])
        self.assertEqual(read(out / "commands.json")[0]["code"], 7)

    def test_busy_worker_is_killed_and_confirmed(self):
        out = self.folder("timeout")
        stages = Stages(out)
        with self.assertRaises(AssertionError):
            stages.run("busy", [sys.executable, "-c", "while True: pass"], stage_seconds=.25)
        self.assertTrue(stages.commands[0]["timedOut"])
        self.assertTrue(stages.commands[0]["exitConfirmed"])
        self.assertIsNotNone(stages.commands[0]["code"])

    def test_expired_total_does_not_launch(self):
        out = self.folder("expired")
        stages = Stages(out, total_seconds=-1)
        with self.assertRaises(AssertionError):
            stages.run("never", [sys.executable, "-c", "raise SystemExit(99)"])
        self.assertEqual(stages.commands, [])

    def test_unconfirmed_exit_receipt_is_retained_with_io_double(self):
        out = self.folder("unknown-exit")
        child = Mock(pid=12345, returncode=None)
        child.communicate.side_effect = [subprocess.TimeoutExpired("synthetic-worker", .25),
                                        subprocess.TimeoutExpired("synthetic-worker", 3, output=b"partial")]
        with patch("common.subprocess.Popen", return_value=child):
            with self.assertRaises(AssertionError):
                Stages(out).run("unknown", ["synthetic-worker"])
        row = read(out / "commands.json")[0]
        self.assertFalse(row["exitConfirmed"])
        self.assertEqual(row["cleanupError"], "exit-or-pipes-unconfirmed")
        self.assertEqual((out / "unknown.stdout.txt").read_bytes(), b"partial")

    def test_protected_drift_is_refused(self):
        out = self.folder("drift")
        file = out / "input.txt"
        file.write_text("before")
        manifest = {"input.txt": sha(file)}
        verify_protected(out, manifest)
        file.write_text("after")
        with self.assertRaises(AssertionError):
            verify_protected(out, manifest)

    def test_paths_cannot_escape(self):
        for name in ["../outside", "/absolute", "C:/absolute", "a\\b"]:
            with self.assertRaises(AssertionError):
                workspace_file(OUTPUT, name)

    def test_untrusted_compiler_archive_is_refused(self):
        out = self.folder("compiler")
        (out / "typescript-5.9.3.tgz").write_bytes(b"not-the-pinned-archive")
        with self.assertRaises(AssertionError):
            verify_compiler(out, dict(integrity="sha512-invalid", shasum="invalid"))


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    OUTPUT = Path(args.output).resolve()
    root = Path(__file__).resolve().parents[3]
    assert OUTPUT.is_relative_to(root / ".tmp") and not OUTPUT.exists()
    OUTPUT.mkdir()
    result = unittest.TextTestRunner(verbosity=2).run(unittest.defaultTestLoader.loadTestsFromTestCase(Boundaries))
    save(OUTPUT / "result.json", dict(passed=result.wasSuccessful(), tests=result.testsRun,
         failures=len(result.failures), errors=len(result.errors), nativeOrLiveAppsUsed=False))
    raise SystemExit(0 if result.wasSuccessful() else 1)
