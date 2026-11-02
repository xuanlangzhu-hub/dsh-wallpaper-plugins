"""One bounded entry for the three reviewed checkJs modules. No historical round paths."""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import argparse
import os
import re
import shutil
import importlib.util
import hashlib
from common import Stages, read, save, sha, verify_compiler, verify_protected

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
QA = ROOT / "dsh-whale-mist/qa"


def main(out, compiler):
    protected = read(HERE / "protected-baseline-v7.json")
    assert len(protected) == 432
    verify_protected(ROOT, protected)
    own = {str(f.relative_to(ROOT)).replace("\\", "/"): sha(f)
           for f in HERE.iterdir() if f.is_file()}
    lock = read(QA / "typescript-frame-protocol/compiler-lock.json")
    compiler_files = verify_compiler(compiler, lock)
    node = shutil.which("node")
    assert node, "Node is required"
    stages = Stages(out)
    frozen = out / "frozen"
    frozen.mkdir()
    for name in own:
        shutil.copyfile(ROOT / name, frozen / Path(name).name)
    (out / "package.json").write_text('{"type":"module"}', encoding="utf-8")
    cases = read(frozen / "cases.json")
    assert {k: len(v) for k, v in cases.items()} == {"frame": 7, "log": 9}
    shutil.copyfile(QA / "typescript-scenes/cases.json", frozen / "scenes-cases.json")
    cases["scenes"] = read(frozen / "scenes-cases.json")
    assert len(cases["scenes"]) == 12
    configs = []
    infos = {}
    for key, folder, module_name, old_import, verifier in [
        ("frame", "typescript-frame-protocol", "frame-protocol.js", "../../src/wallpaper/frame-protocol.js", "verify-types.mjs"),
        ("log", "typescript-probe-log", "probe-log.js", "./probe-log.js", "verify.mjs"),
        ("scenes", "typescript-scenes", "scenes.js", "./scenes.js", "verify.mjs"),
    ]:
        target = out / key
        target.mkdir()
        module = ROOT / "dsh-whale-mist/src/wallpaper" / module_name
        baseline = ROOT / "release-sources/rc53/package/src/wallpaper" / module_name
        rel = os.path.relpath(module, target).replace("\\", "/")
        positive = target / "positive.ts"
        text = (QA / folder / "positive.ts").read_text(encoding="utf-8")
        assert text.count(old_import) == 1
        positive.write_text(text.replace(old_import, rel), encoding="utf-8")
        negatives = []
        imports = {"frame": "FrameDecoder", "log": "parseLogLine,describeLog,ProbeJournal",
                   "scenes": "SCENES,isSceneId,sceneSelection,resolveSceneRequest,describeScenes"}[key]
        for row in cases[key]:
            dest = target / (row["name"] + ".ts")
            assert dest.parent == target
            dest.write_text("import {" + imports + "} from '" + rel + "';\n" + row["body"], encoding="utf-8")
            negatives.append(dict(name=row["name"], file=str(dest), code=row["code"]))
        for name in [verifier] + (["runtime.test.mjs"] if key != "scenes" else []):
            shutil.copyfile(QA / folder / name, target / name)
        if key == "scenes":
            # Rebuild the approved text from a protected repository recipe, not a historical round.
            recipe_path = QA / "typescript-scenes/annotate.py"
            shutil.copyfile(recipe_path, target / "annotate.py")
            spec = importlib.util.spec_from_file_location("reviewed_scenes_recipe", target / "annotate.py")
            recipe = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(recipe)
            assert module.read_text(encoding="utf-8") == recipe.annotate(baseline.read_text(encoding="utf-8")), "Actual scenes source differs from the reviewed annotation recipe"
        info = dict(module=str(module), baseline=str(baseline), positive=str(positive),
                    negatives=negatives, compilerModule=str(compiler / "package/lib/typescript.js"))
        infos[key] = info
        config = read(QA / "typescript-frame-protocol/tsconfig.json")
        config["files"] = [str(module), str(positive)]
        save(target / "tsconfig.json", config)
        configs.extend(config["files"])
    # The real generator only runs on a copy of today's development client.
    inline = out / "inline"
    (inline / "scripts").mkdir(parents=True)
    (inline / "src/wallpaper").mkdir(parents=True)
    for name in ["scripts/build-wm-protocol.mjs", "src/client.js", "src/wallpaper/frame-protocol.js"]:
        shutil.copyfile(ROOT / "dsh-whale-mist" / name, inline / name)
    original_client = (inline / "src/client.js").read_bytes()
    infos["frame"]["clients"] = [str(ROOT / "dsh-whale-mist/src/client.js"),
                                  str(ROOT / "release-sources/rc53/package/src/client.js"),
                                  str(inline / "src/client.js")]
    for key, info in infos.items():
        save(out / key / "inputs.json", info)
    config = read(QA / "typescript-frame-protocol/tsconfig.json")
    config["files"] = configs
    save(out / "tsconfig.json", config)
    # Extract only the original eight pure log tests, not the native helper test.
    oldtest = (QA / "wallpaper-preview/tests/log-journal.test.mjs").read_text(encoding="utf-8")
    start = oldtest.index("test('a successful [Desktop]")
    end = oldtest.index("test('the native helper reports failures")
    pure = ("import test from 'node:test';\nimport assert from 'node:assert/strict';\n"
            "import {ProbeJournal,parseLogLine,describeLog} from '" + Path(infos["log"]["module"]).as_uri() + "';\n" + oldtest[start:end])
    assert len(re.findall(r"^test\(", pure, re.M)) == 8 and "spawnSync" not in pure and "probeExe" not in pure
    (out / "log/existing-pure.test.mjs").write_text(pure, encoding="utf-8")
    # Generate the original eight pure scene cases from their protected repository sources.
    audit = out / "scene-audit"
    audit.mkdir()
    shutil.copyfile(QA / "typescript-scenes-scope/audit.mjs", audit / "audit.mjs")
    baseline_scene = Path(infos["scenes"]["baseline"])
    save(audit / "inputs.json", dict(source=str(baseline_scene),
         compilerModule=str(compiler / "package/lib/typescript.js"),
         candidates=[dict(source=str(baseline_scene),sha256=sha(baseline_scene),sameAsFixedRc53=True)],
         sessionTest=str(QA / "wallpaper/session.test.mjs"), libraryTest=str(QA / "wallpaper/library.test.mjs")))
    stages.run("scene-extract-baseline", [node, audit / "audit.mjs", audit])
    scene_pure = (audit / "pure-scenes.test.mjs").read_text(encoding="utf-8")
    assert scene_pure.count(baseline_scene.as_uri()) == 1
    shutil.copyfile(audit / "pure-scenes.test.mjs", out / "scenes/baseline.test.mjs")
    (out / "scenes/actual.test.mjs").write_text(scene_pure.replace(baseline_scene.as_uri(), Path(infos["scenes"]["module"]).as_uri()), encoding="utf-8")
    inventory = lambda: {str(p.relative_to(out)) for p in out.rglob("*") if p.is_file()}
    before = inventory()
    listed = stages.run("tsc-noemit", [node, compiler / "package/lib/tsc.js", "--project", out / "tsconfig.json", "--pretty", "false", "--listFiles"])
    assert inventory() - before == {"commands.json", "tsc-noemit.stdout.txt", "tsc-noemit.stderr.txt"} - before
    listed_files = listed.splitlines()
    assert len(listed_files) == 63 and sum(x.endswith(".d.ts") for x in listed_files) == 57
    assert {str(Path(x).resolve()) for x in listed_files if not x.endswith(".d.ts")} == set(configs)
    stages.run("inline-first", [node, inline / "scripts/build-wm-protocol.mjs"])
    first = sha(inline / "src/client.js")
    stages.run("inline-idempotent", [node, inline / "scripts/build-wm-protocol.mjs"])
    assert sha(inline / "src/client.js") == first
    def outside(raw):
        assert raw.count(b"/* WM_FRAME_PROTOCOL */") == raw.count(b"/* WM_FRAME_PROTOCOL_END */") == 1
        return raw.split(b"/* WM_FRAME_PROTOCOL */")[0], raw.split(b"/* WM_FRAME_PROTOCOL_END */")[1]
    assert outside(original_client) == outside((inline / "src/client.js").read_bytes())
    stages.run("inline-syntax", [node, "--check", inline / "src/client.js"])
    # Exercise exactly the decoder bytes emitted by the real generator, plus export aliases only.
    generated = out / "generated"
    generated.mkdir()
    client_bytes = (inline / "src/client.js").read_bytes()
    marker = b"/* WM_FRAME_PROTOCOL */"
    end_marker = b"/* WM_FRAME_PROTOCOL_END */"
    start_byte = client_bytes.index(marker) + len(marker)
    end_byte = client_bytes.index(end_marker)
    assert end_byte > start_byte
    body = client_bytes[start_byte:end_byte]
    suffix = b"\nexport { WM_FRAME_DECODER as FrameDecoder, HEADER_BYTES, MAX_FRAME_BYTES };\n"
    module = generated / "decoder.js"
    module.write_bytes(body + suffix)
    receipt = dict(generatedClientSha256=sha(inline / "src/client.js"),bodyStart=start_byte,bodyEnd=end_byte,
         bodySha256=hashlib.sha256(body).hexdigest().upper(),moduleSha256=sha(module),
         exportSuffixSha256=hashlib.sha256(suffix).hexdigest().upper())
    positive = generated / "positive.ts"
    text = (QA / "typescript-frame-protocol/positive.ts").read_text(encoding="utf-8")
    assert text.count("../../src/wallpaper/frame-protocol.js") == 1
    positive.write_text(text.replace("../../src/wallpaper/frame-protocol.js", "./decoder.js"),encoding="utf-8")
    negatives = []
    for row in cases["frame"]:
        dest = generated / (row["name"] + ".ts")
        assert dest.parent == generated
        dest.write_text("import {FrameDecoder} from './decoder.js';\n" + row["body"],encoding="utf-8")
        negatives.append(dict(name=row["name"],file=str(dest),code=row["code"]))
    shutil.copyfile(QA / "typescript-frame-protocol/runtime.test.mjs",generated / "runtime.test.mjs")
    generated_info = dict(module=str(module),baseline=infos["frame"]["baseline"],positive=str(positive),
         negatives=negatives,compilerModule=str(compiler / "package/lib/typescript.js"),
         generatedClient=str(inline / "src/client.js"),protocolSource=infos["frame"]["module"],extraction=receipt)
    save(generated / "inputs.json",generated_info)
    config = read(QA / "typescript-frame-protocol/tsconfig.json")
    config["files"] = [str(module),str(positive)]
    save(generated / "tsconfig.json",config)
    before_generated = inventory()
    generated_list = stages.run("generated-tsc-noemit",[node,compiler / "package/lib/tsc.js","--project",generated / "tsconfig.json","--pretty","false","--listFiles"])
    assert inventory() - before_generated == {"generated-tsc-noemit.stdout.txt","generated-tsc-noemit.stderr.txt"}
    listed_files = generated_list.splitlines()
    assert len(listed_files) == 59 and sum(x.endswith(".d.ts") for x in listed_files) == 57
    assert {str(Path(x).resolve()) for x in listed_files if not x.endswith(".d.ts")} == set(config["files"])
    stages.run("generated-types",[node,frozen / "verify-generated.mjs",generated])
    tap = stages.run("generated-runtime",[node,"--test","--test-isolation=none","--test-concurrency=1","--test-reporter=tap","--test-timeout=3000",generated / "runtime.test.mjs"],
         env=dict(os.environ,FRAME_TYPE_INPUTS=str(generated / "inputs.json")))
    assert "# tests 12" in tap and "# fail 0" in tap
    for key, verifier, variable, count in [("frame", "verify-types.mjs", "FRAME_TYPE_INPUTS", 12), ("log", "verify.mjs", "PROBE_TYPE_INPUTS", 8)]:
        target = out / key
        stages.run(key + "-syntax", [node, "--check", infos[key]["module"]])
        stages.run(key + "-types", [node, target / verifier, target])
        env = dict(os.environ, **{variable: str(target / "inputs.json")})
        tap = stages.run(key + "-runtime", [node, "--test", "--test-isolation=none", "--test-concurrency=1", "--test-reporter=tap", "--test-timeout=3000", target / "runtime.test.mjs"], env=env)
        assert f"# tests {count}" in tap and "# fail 0" in tap
    tap = stages.run("log-existing-pure", [node, "--test", "--test-isolation=none", "--test-concurrency=1", "--test-reporter=tap", "--test-timeout=3000", out / "log/existing-pure.test.mjs"])
    assert "# tests 8" in tap and "# fail 0" in tap
    stages.run("scenes-syntax", [node, "--check", infos["scenes"]["module"]])
    stages.run("scenes-types", [node, out / "scenes/verify.mjs", out / "scenes"])
    tap = stages.run("scenes-runtime", [node, "--test", "--test-isolation=none", "--test-concurrency=1", "--test-reporter=tap", "--test-timeout=3000", out / "scenes/baseline.test.mjs", out / "scenes/actual.test.mjs"])
    assert "# tests 16" in tap and "# fail 0" in tap
    verify_protected(ROOT, protected)
    verify_protected(ROOT, own)
    verify_protected(compiler / "package", compiler_files)
    assert not any(list(out.rglob(s)) for s in ["*.d.ts", "*.map", "*.tsbuildinfo"])
    save(out / "result.json", dict(passed=True, checkedActualDevelopmentSources=True,
         historicalRoundInputsRequired=False, compilerVersion="5.9.3", strictNoEmit=True,
         actualDevelopmentModules=3,generatedDecoderUnits=1,positiveConsumers=4,
         negativeCases=35,runtimeTests=56,sourceNegativeCases=28,sourceRuntimeTests=44,standardLibraryFiles=57,
         frame=read(out / "frame/type-results.json"), log=read(out / "log/type-results.json"),
         scenes=read(out / "scenes/type-results.json"), scenesMatchesReviewedRecipe=True,
         generatedDecoder=read(generated / "type-results.json"),generatedExtraction=receipt,
         protectedInputs=len(protected), ownInputs=own, commands=stages.commands,
         compilerEmittedFiles=0, inlineIdempotent=True, clientOutsideProtocolBytesUnchanged=True,
         developmentSourcesWritten=False, nativeOrLiveAppsUsed=False, packagedOrInstalled=False))
    print("PASS: 3 actual modules + generated decoder, 35 negative contracts, 56 pure runtime tests; no emit")


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", required=True)
    parser.add_argument("--compiler-root", required=True, help="Verified compiler cache prepared separately")
    args = parser.parse_args()
    output = Path(args.output).resolve()
    assert output.is_relative_to(ROOT / ".tmp") and not output.exists(), "Use a fresh workspace .tmp output directory"
    output.mkdir()
    try:
        main(output, Path(args.compiler_root).resolve())
    except Exception as error:
        save(output / "result.json", dict(passed=False, errorType=type(error).__name__, error=str(error),
             commands=read(output / "commands.json") if (output / "commands.json").exists() else []))
        raise
