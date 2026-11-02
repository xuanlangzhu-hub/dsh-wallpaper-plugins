"""Check an isolated JSDoc candidate; keep all runtime development sources untouched."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import argparse
import os
import shutil
ROOT = Path(__file__).resolve().parents[3]
HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT / "dsh-whale-mist/qa/typescript-check"))
from common import Stages, read, save, sha, verify_compiler, verify_protected
from annotate import annotate

parser = argparse.ArgumentParser()
parser.add_argument("--output", required=True)
parser.add_argument("--compiler-root", required=True)
parser.add_argument("--protected-manifest", required=True)
args = parser.parse_args()
out = Path(args.output).resolve()
assert out.is_relative_to(ROOT / ".tmp") and not out.exists()
out.mkdir()
try:
    protected = read(Path(args.protected_manifest).resolve())
    assert len(protected) == 387
    verify_protected(ROOT, protected)
    source = ROOT / "dsh-whale-mist/src/wallpaper/scenes.js"
    base_hash = "0BBA53EB4E96A6C04E4EAAC7EBBF73B5DAC9D3B2E46CCCBF657FB2CF9D24FA90"
    assert sha(source) == base_hash
    own = {str(f.relative_to(ROOT)).replace("\\", "/"): sha(f) for f in HERE.iterdir() if f.is_file()}
    compiler = Path(args.compiler_root).resolve()
    members = verify_compiler(compiler,read(ROOT / "dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json"))
    frozen = out / "frozen"
    frozen.mkdir()
    for name in own:
        shutil.copyfile(ROOT / name, frozen / Path(name).name)
    baseline = out / "baseline.js"
    baseline.write_bytes(source.read_bytes())
    candidate = out / "scenes.js"
    candidate.write_text(annotate(source.read_text(encoding="utf-8")), encoding="utf-8", newline="\n")
    (out / "package.json").write_text('{"type":"module"}',encoding="utf-8")
    shutil.copyfile(HERE / "positive.ts",out / "positive.ts")
    cases = read(frozen / "cases.json")
    assert len(cases) == 12
    negatives = []
    for case in cases:
        file = out / (case["name"] + ".ts")
        assert file.parent == out
        file.write_text("import {SCENES,isSceneId,sceneSelection,resolveSceneRequest,describeScenes} from './scenes.js';\n" + case["body"],encoding="utf-8")
        negatives.append(dict(name=case["name"],code=case["code"],file=str(file)))
    save(out / "inputs.json",dict(module=str(candidate),baseline=str(baseline),positive=str(out / "positive.ts"),negatives=negatives,compilerModule=str(compiler / "package/lib/typescript.js")))
    config = read(ROOT / "dsh-whale-mist/qa/typescript-frame-protocol/tsconfig.json")
    config["files"] = [str(candidate),str(out / "positive.ts")]
    save(out / "tsconfig.json",config)
    # Reuse the source-only scope tool to extract the existing pure cases afresh.
    audit = out / "audit"
    audit.mkdir()
    shutil.copyfile(ROOT / "dsh-whale-mist/qa/typescript-scenes-scope/audit.mjs",audit / "audit.mjs")
    save(audit / "inputs.json",dict(source=str(source),compilerModule=str(compiler / "package/lib/typescript.js"),
         candidates=[dict(source=str(source),sha256=base_hash,sameAsFixedRc53=True)],
         sessionTest=str(ROOT / "dsh-whale-mist/qa/wallpaper/session.test.mjs"),
         libraryTest=str(ROOT / "dsh-whale-mist/qa/wallpaper/library.test.mjs")))
    stages = Stages(out,total_seconds=65)
    node = shutil.which("node")
    assert node
    stages.run("extract-baseline-cases",[node,audit / "audit.mjs",audit])
    pure = (audit / "pure-scenes.test.mjs").read_text(encoding="utf-8")
    assert pure.count(source.as_uri()) == 1
    (out / "baseline.test.mjs").write_text(pure.replace(source.as_uri(),baseline.as_uri()),encoding="utf-8")
    (out / "candidate.test.mjs").write_text(pure.replace(source.as_uri(),candidate.as_uri()),encoding="utf-8")
    inventory = lambda: {str(p.relative_to(out)) for p in out.rglob("*") if p.is_file()}
    before = inventory()
    stages.run("tsc-noemit",[node,compiler / "package/lib/tsc.js","--project",out / "tsconfig.json","--pretty","false","--listFiles"])
    assert inventory() - before == {"tsc-noemit.stdout.txt","tsc-noemit.stderr.txt"}
    stages.run("type-and-ast",[node,frozen / "verify.mjs",out])
    stages.run("syntax",[node,"--check",candidate])
    tap = stages.run("runtime-equivalence",[node,"--test","--test-isolation=none","--test-reporter=tap","--test-concurrency=1","--test-timeout=3000",out / "baseline.test.mjs",out / "candidate.test.mjs"])
    assert "# tests 16" in tap and "# fail 0" in tap
    verify_protected(ROOT,protected)
    verify_protected(ROOT,own)
    verify_protected(compiler / "package",members)
    assert not any(list(out.rglob(s)) for s in ["*.d.ts","*.map","*.tsbuildinfo"])
    result=dict(passed=True,isolatedOnly=True,baselineSha256=base_hash,candidateSha256=sha(candidate),
         typeResults=read(out / "type-results.json"),runtimeTests=16,originalCases=8,
         qaHashes=own,commands=stages.commands,protectedInputs=387,compilerEmittedFiles=0,
         developmentSourceChanged=False,nativeOrLiveAppsUsed=False,installedOrPackaged=False)
    save(out / "result.json",result)
    print("PASS: isolated scenes types, 12 exact negative contracts, 16 pure runtime tests")
except Exception as error:
    save(out / "result.json",dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out / "commands.json") if (out / "commands.json").exists() else []))
    raise
