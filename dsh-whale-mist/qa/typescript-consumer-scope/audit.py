"""Read consumer/build seams; generate only inside a fresh isolated output directory."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import argparse
import shutil
ROOT=Path(__file__).resolve().parents[3]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(ROOT / "dsh-whale-mist/qa/typescript-check"))
from common import Stages,read,save,sha,verify_compiler,verify_protected
parser=argparse.ArgumentParser()
parser.add_argument("--output",required=True)
parser.add_argument("--compiler-root",required=True)
parser.add_argument("--protected-manifest",required=True)
args=parser.parse_args()
out=Path(args.output).resolve()
assert out.is_relative_to(ROOT / ".tmp") and not out.exists()
out.mkdir()
try:
    protected=read(Path(args.protected_manifest).resolve())
    assert len(protected)==394
    verify_protected(ROOT,protected)
    own={str(f.relative_to(ROOT)).replace("\\","/"):sha(f) for f in HERE.iterdir() if f.is_file()}
    compiler=Path(args.compiler_root).resolve()
    members=verify_compiler(compiler,read(ROOT / "dsh-whale-mist/qa/typescript-frame-protocol/compiler-lock.json"))
    frozen=out / "frozen"
    frozen.mkdir()
    for name in own:
        shutil.copyfile(ROOT/name,frozen/Path(name).name)
    (out / "package.json").write_text('{"type":"module"}',encoding="utf-8")
    inline=out / "inline"
    (inline / "scripts").mkdir(parents=True)
    (inline / "src/wallpaper").mkdir(parents=True)
    for name in ["scripts/build-wm-protocol.mjs","src/client.js","src/wallpaper/frame-protocol.js"]:
        shutil.copyfile(ROOT / "dsh-whale-mist" / name,inline / name)
    names=["src/wallpaper/frame-protocol.js","src/wallpaper/probe-log.js","src/wallpaper/scenes.js",
           "src/wallpaper/frame-hub.js","src/wallpaper/session.js","src/wallpaper/library.js",
           "src/client.js","scripts/build-wm-protocol.mjs"]
    save(out / "inputs.json",dict(files=[str(ROOT/"dsh-whale-mist"/n) for n in names],
         compilerModule=str(compiler/"package/lib/typescript.js"),
         manifest=str(ROOT/"dsh-whale-mist/package.json"),client=str(ROOT/"dsh-whale-mist/src/client.js"),
         generatedClient=str(inline/"src/client.js"),positive=str(ROOT/"dsh-whale-mist/qa/typescript-frame-protocol/positive.ts")))
    stages=Stages(out,total_seconds=35)
    node=shutil.which("node")
    assert node
    stages.run("isolated-generator",[node,inline/"scripts/build-wm-protocol.mjs"],stage_seconds=12)
    stages.run("consumer-build-audit",[node,frozen/"audit.mjs",out],stage_seconds=12)
    verify_protected(ROOT,protected)
    verify_protected(ROOT,own)
    verify_protected(compiler/"package",members)
    assert not any(list(out.rglob(s)) for s in ["*.d.ts","*.map","*.tsbuildinfo"])
    save(out/"result.json",dict(passed=True,scopeOnly=True,protectedInputs=394,qaHashes=own,
         findings=read(out/"consumer-scope.json"),commands=stages.commands,
         runtimeSourceChanged=False,productionGeneratorExecuted=False,isolatedGeneratorExecuted=True,
         compilerEmittedFiles=0,nativeOrLiveAppsUsed=False,installedOrPackaged=False))
    print("PASS: real consumer map and isolated generated decoder type boundary; no runtime source edits")
except Exception as error:
    save(out/"result.json",dict(passed=False,errorType=type(error).__name__,error=str(error),
         commands=read(out/"commands.json") if (out/"commands.json").exists() else []))
    raise
