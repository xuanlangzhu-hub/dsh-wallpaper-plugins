"""Shared read-only preflight and bounded child execution for development checks."""
from pathlib import Path, PurePosixPath
import base64
import hashlib
import importlib.util
import io
import json
import os
import subprocess
import tarfile
import time


def read(path):
    return json.loads(path.read_text(encoding="utf-8-sig"))


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def save(path, value):
    path.write_text(json.dumps(value, indent=2), encoding="utf-8")


def load_annotation_recipe(file):
    """Load this verified file freshly; never consult or alter the bare annotate cache."""
    file = Path(file).resolve()
    name = "_whale_annotation_" + hashlib.sha256(str(file).encode("utf-8")).hexdigest()
    spec = importlib.util.spec_from_file_location(name, file)
    assert spec is not None and spec.loader is not None
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    recipe = getattr(module, "annotate", None)
    assert callable(recipe), "Annotation recipe must export callable annotate"
    return recipe


def workspace_file(root, name):
    part = PurePosixPath(name)
    assert not part.is_absolute() and ".." not in part.parts and "\\" not in name and ":" not in name
    path = root / name
    assert path.resolve().is_relative_to(root.resolve())
    return path


def verify_protected(root, manifest):
    changed = [n for n, h in manifest.items() if not workspace_file(root, n).is_file() or sha(root / n) != h]
    assert not changed, {"changedProtectedInputs": changed}


def verify_compiler(directory, lock):
    """The SRI archive is authoritative; a local receipt alone is not trusted."""
    raw = (directory / "typescript-5.9.3.tgz").read_bytes()
    assert "sha512-" + base64.b64encode(hashlib.sha512(raw).digest()).decode() == lock["integrity"]
    assert hashlib.sha1(raw).hexdigest() == lock["shasum"]
    members = {}
    with tarfile.open(fileobj=io.BytesIO(raw), mode="r:gz") as archive:
        for item in archive:
            part = PurePosixPath(item.name)
            assert not part.is_absolute() and part.parts[0] == "package" and ".." not in part.parts
            assert "\\" not in item.name and ":" not in item.name
            if item.isdir():
                continue
            assert item.isfile()
            name = part.relative_to("package").as_posix()
            assert name and name.casefold() not in {x.casefold() for x in members}
            members[name] = hashlib.sha256(archive.extractfile(item).read()).hexdigest().upper()
    verify_protected(directory / "package", members)
    package = read(directory / "package/package.json")
    assert package["name"] == lock["name"] and package["version"] == lock["version"] == "5.9.3"
    return members


class Stages:
    def __init__(self, output, total_seconds=80):
        self.output = output
        self.deadline = time.monotonic() + total_seconds
        self.commands = []

    def run(self, label, argv, env=None, cwd=None, stage_seconds=20):
        assert label.replace("-", "").isalnum() and not (self.output / (label + ".stdout.txt")).exists()
        remaining = self.deadline - time.monotonic()
        assert remaining > 0, "Total check deadline exceeded before launch"
        started = time.monotonic()
        child = subprocess.Popen([str(x) for x in argv], cwd=cwd or self.output,
                                 env=env, stdin=subprocess.DEVNULL, stdout=subprocess.PIPE,
                                 stderr=subprocess.PIPE,
                                 creationflags=0x08000000 if os.name == "nt" else 0)
        timed = False
        cleanup_error = None
        try:
            data, error = child.communicate(timeout=min(20, stage_seconds, remaining))
        except subprocess.TimeoutExpired:
            timed = True
            try:
                child.kill()  # Only this directly owned worker; never a process tree.
            except OSError as failure:
                cleanup_error = type(failure).__name__
            try:
                data, error = child.communicate(timeout=3)
            except subprocess.TimeoutExpired as failure:
                # Never turn unknown pipe/worker termination into confirmed exit.
                cleanup_error = "exit-or-pipes-unconfirmed"
                data, error = failure.output or b"", failure.stderr or b""
                child.poll()
        row = dict(label=label, pid=child.pid, code=child.returncode,
                   exitConfirmed=child.returncode is not None, timedOut=timed,
                   cleanupError=cleanup_error,
                   elapsedSeconds=time.monotonic() - started)
        self.commands.append(row)
        save(self.output / "commands.json", self.commands)
        (self.output / (label + ".stdout.txt")).write_bytes(data)
        (self.output / (label + ".stderr.txt")).write_bytes(error)
        assert not timed and cleanup_error is None and child.returncode == 0, (label, "Inspect retained stage output")
        return data.decode("utf-8")
