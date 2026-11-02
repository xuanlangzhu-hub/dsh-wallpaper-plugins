"""Read-only third-module scope audit, reusing the bounded development QA executor."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import argparse
import shutil
ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "dsh-whale-mist/qa/typescript-check"))
from common import Stages, read, save, sha, verify_compiler, verify_protected

parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True)
parser.add_argument("--compiler-root", required=True)
parser.add_argument("--protected-manifest", required=True, help="Explicit reviewed 385-input continuation snapshot")
args = parser.parse_args()
out = Path(args.output).resolve()
assert out.is_relative_to(ROOT / ".tmp") and not out.exists()
out.mkdir()
try:
    protected = read(Path(args.protected_manifest).resolve())
    assert len(protected) == 385
    verify_protected(ROOT, protected)
    own = {str(f.relative_to(ROOT)).replace("\\", "/"): sha(f) for f in HERE.iterdir() if f.is_file()}
    compiler = Path(args.compiler_root).resolve()
    members = verify_compiler(compiler, read(ROOT / "dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json"))
    source = ROOT / "dsh-whale-mist/src/wallpaper/scenes.js"
    candidates = []
    for name in ["wallpaper/scenes.js", "detachable-contract.js", "wallpaper/author-properties-contract.js", "wallpaper/close-fence.js", "wallpaper/media-bridge-permissions.js"]:
        file = ROOT / "dsh-whale-mist/src" / name
        fixed = ROOT / "release-sources/rc53/package/src" / name
        candidates.append(dict(source=str(file),sha256=sha(file),sameAsFixedRc53=fixed.is_file() and file.read_bytes()==fixed.read_bytes()))
    assert candidates[0]["sameAsFixedRc53"]
    session_test = ROOT / "dsh-whale-mist/qa/wallpaper/session.test.mjs"
    library_test = ROOT / "dsh-whale-mist/qa/wallpaper/library.test.mjs"
    extras = {str(x.relative_to(ROOT)).replace("\\", "/"): sha(x) for x in [session_test, library_test]}
    save(out / "inputs.json", dict(source=str(source),compilerModule=str(compiler / "package/lib/typescript.js"),
         candidates=candidates,sessionTest=str(session_test),libraryTest=str(library_test)))
    (out / "package.json").write_text('{"type":"module"}',encoding="utf-8")
    frozen = out / "frozen"
    frozen.mkdir()
    for name in own:
        shutil.copyfile(ROOT / name, frozen / Path(name).name)
    stages = Stages(out,total_seconds=30)
    node = shutil.which("node")
    assert node
    stages.run("scope-baseline", [node, frozen / "audit.mjs", out], stage_seconds=12)
    tap = stages.run("pure-regressions", [node,"--test","--test-isolation=none","--test-reporter=tap","--test-concurrency=1","--test-timeout=3000",out / "pure-scenes.test.mjs"], stage_seconds=12)
    assert "# tests 8" in tap and "# fail 0" in tap
    verify_protected(ROOT,protected)
    verify_protected(ROOT,own)
    verify_protected(ROOT,extras)
    verify_protected(compiler / "package",members)
    assert not any(list(out.rglob(s)) for s in ["*.d.ts","*.map","*.tsbuildinfo"])
    result = dict(passed=True,scopeOnly=True,selectedModule=str(source),sourceSha256=sha(source),
         typeBaseline=read(out / "scope-types.json"),pureTests=8,protectedInputs=385,
         qaHashes=own,extraTestHashes=extras,commands=stages.commands,
         runtimeSourceChanged=False,sessionOrLibraryExecuted=False,nativeOrLiveAppsUsed=False,
         installedOrPackaged=False)
    save(out / "scope-audit.json",result)
    print("PASS: scenes scope, actual strict baseline and 8 pure cases; no runtime source edits")
except Exception as error:
    save(out / "scope-audit.json",dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out / "commands.json") if (out / "commands.json").exists() else []))
    raise
