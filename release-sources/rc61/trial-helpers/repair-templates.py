"""Pure transformations of pinned trial text; never edit a historical trial."""
import re


def split_entries(text):
    # The pinned initializer contains strings, calls and arrays; no templates/regex.
    parts, start, depth, quote, escaped = [], 0, 0, None, False
    for i, ch in enumerate(text):
        if quote:
            if escaped:
                escaped = False
            elif ch == '\\':
                escaped = True
            elif ch == quote:
                quote = None
        elif ch in "'\"":
            quote = ch
        elif ch in '([{':
            depth += 1
        elif ch in ')]}':
            depth -= 1
            assert depth >= 0
        elif ch == ',' and depth == 0:
            parts.append(text[start:i]); start = i + 1
    assert quote is None and depth == 0
    parts.append(text[start:])
    return parts


def repair(name, text):
    if name in ('discover-default.ps1', 'discover-restored.ps1', 'discover-live.ps1'):
        anchor = 'Assert-TrialAuthorization\n'
        assert text.count(anchor) == 1
        text = text.replace(anchor, anchor + ". (Join-Path $PSScriptRoot 'host-status-json.ps1')\n", 1)
        old = '$entry.status=Invoke-RestMethod -Uri "http://127.0.0.1:$($listener.LocalPort)/whale-wallpaper/status" -Method Get -TimeoutSec 2 -NoProxy'
        new = '$response=Invoke-WebRequest -Uri "http://127.0.0.1:$($listener.LocalPort)/whale-wallpaper/status" -Method Get -TimeoutSec 2 -NoProxy; $entry.rawStatus=$response.Content; $entry.status=ConvertFrom-WhaleHostStatus $response.Content'
        assert text.count(old) == 1
        text = text.replace(old, new)
    if name in ('snapshot-default.ps1', 'snapshot-live.ps1', 'snapshot-restored.ps1',
                'verify-live-cleanup-current.ps1', 'verify-live-cleanup-rc61.ps1'):
        # Only the discovery file can contain native Width/width names together.
        lines = text.splitlines(True); changed = 0
        for i, line in enumerate(lines):
            if "-endpoint-discovery.json'" in line:
                assert line.rstrip().endswith('|ConvertFrom-Json')
                lines[i] = line.replace('|ConvertFrom-Json', '|ConvertFrom-Json -AsHashtable -DateKind String')
                changed += 1
        assert changed == 1, name
        text = ''.join(lines)
    if name == 'backup-closed.ps1':
        old = "purpose='rc61-gallery-author-trial'"
        assert text.count(old) == 1
        text = text.replace(old, 'purpose=$trialConfig.purpose')
    if name == 'retain-before-install.py':
        old = "'activeInstallFilesMatched':43"
        assert text.count(old) == 1
        text = text.replace(old, "'activeInstallFilesMatched':len(json.loads((OUT/'archives.json').read_text(encoding='utf-8'))['daily']['files'])")
    if name == 'run-step.cjs':
        start = text.index('const steps={'); end = text.index('};', start)
        entries = []
        for entry in split_entries(text[start+len('const steps={'):end]):
            match = re.fullmatch(r'\s*([A-Za-z][A-Za-z0-9]*)\s*:(.*)', entry, re.S)
            assert match, entry
            entries.append("['" + match[1] + "'," + match[2] + ']')
        replacement = "const {defineSteps}=require('./step-map.cjs');const steps=defineSteps([" + ','.join(entries) + ']);'
        text = text[:start] + replacement + text[end+2:]
    return text
