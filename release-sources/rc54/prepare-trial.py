"""Prepare a fresh, unauthorized rc54 trial from known tool templates; no live queries."""
from pathlib import Path
import ast
import hashlib
import json
import os
import re
import subprocess
import sys
import time

here = Path(__file__).resolve().parent
root = here.parents[1]
old = root / '.tmp/rc53-gallery-author-short-trial-20261028-a'
candidate = root / '.tmp/rc54-taskbar-first-frame-candidate-20261028-b'
trial = root / '.tmp/rc54-taskbar-first-frame-short-trial-20261028-a'
sha = lambda p: hashlib.sha256(p.read_bytes()).hexdigest().upper()
audit = json.loads((candidate / 'candidate-audit.json').read_bytes())
assert sha(candidate / audit['archive']) == audit['sha256'] == 'D9E28918522C3ABFF974465D53604583BAC520806D388EAE773F84BCDAF2F096'
old_config = json.loads((old / 'trial-config.json').read_bytes())
config = dict(old_config, trialRoot=str(trial), purpose='temporary-rc54-taskbar-first-frame',
              candidateVersion='0.6.0-rc.54', dailyVersion='0.6.0-rc.53', candidateSha256=audit['sha256'],
              dailySha256='8AF3F10FC72923E5B4E11D43D2CBAB8749287C8B7A8CF275A1BDC400FC5229EA',
              candidateArchive=str(candidate / audit['archive']),
              dailyArchive=str(root / '.tmp/rc53-gallery-author-candidate-20261028-a/dsh-whale-mist-0.6.0-rc.53.tgz'),
              backupRoot=str(Path(old_config['backupRoot']).parent / trial.name), profileWritesAuthorized=False)
assert not trial.exists() and not Path(config['backupRoot']).exists()
names = list(json.loads((old / 'source-adaptation.json').read_bytes())['adaptedHashes'])
assert len(names) == 34 and all(Path(n).name == n for n in names)
pins = json.loads((here / 'trial-template-hashes.json').read_bytes())
assert root / pins['sourceRoot'] == old and set(names) == pins['files'].keys()
assert all(sha(old / name) == expected for name,expected in pins['files'].items()), 'trial template drift'
mapping = {str(old):str(trial), str(old).replace('\\','/'):str(trial).replace('\\','/'),
           old_config['backupRoot']:config['backupRoot'], old_config['purpose']:config['purpose'],
           old_config['candidateArchive']:config['candidateArchive'], old_config['dailyArchive']:config['dailyArchive'],
           old_config['candidateSha256']:config['candidateSha256'], old_config['dailySha256']:config['dailySha256'],
           old.name:trial.name, '0.6.0-rc.53':'0.6.0-rc.54', '0.6.0-rc.52':'0.6.0-rc.53',
           'rc.53':'rc.54', 'rc.52':'rc.53', 'rc53':'rc54', 'rc52':'rc53'}
for before, after in list(mapping.items()):
    if '\\' in before:
        mapping[before.replace('\\','\\\\')] = after.replace('\\','\\\\')
pattern = re.compile('|'.join(re.escape(s) for s in sorted(mapping,key=len,reverse=True)))
trial.mkdir()
source_hashes, adapted_hashes = {}, {}
for name in names:
    data = (old / name).read_bytes(); source_hashes[str(old / name)] = sha(old / name)
    text = pattern.sub(lambda match:mapping[match[0]],data.decode('utf-8'))
    assert str(old) not in text and '0.6.0-rc.52' not in text and old_config['dailySha256'] not in text, name
    (trial / name).write_text(text,encoding='utf-8',newline='')
    adapted_hashes[name] = sha(trial / name)
(trial / 'trial-config.json').write_text(json.dumps(config,ensure_ascii=False,indent=2),encoding='utf-8')
protected = json.loads((root / '.tmp/taskbar-postrelease-audit-20261028-a/protected-before.json').read_bytes())
protected = {str(root / name):h for name,h in protected.items()}
(trial / 'protected-before.json').write_text(json.dumps(protected,indent=2),encoding='utf-8')
(trial / 'source-adaptation.json').write_text(json.dumps({'sourceRoot':str(old),'sourceHashes':source_hashes,
    'adaptedHashes':adapted_hashes,'copiedRuntimeEvidence':False,'authorizationCreated':False,
    'productionBackupCreated':False,'replacementScope':'new round/config/archive/version labels only'},indent=2),encoding='utf-8')

# Adapt the already used pure gate checks, with a new root and version expectations.
checks = (root / '.tmp/rc53-gallery-author-candidate-20261028-a/offline-trial-checks.py').read_text(encoding='utf-8')
checks = pattern.sub(lambda match:mapping[match[0]],checks)
assert "'rc54-taskbar-first-frame-short-trial-20261028-a'" in checks
assert "config['dailyVersion']=='0.6.0-rc.53'" in checks and "config['candidateVersion']=='0.6.0-rc.54'" in checks
for p in trial.glob('*.py'):
    ast.parse(p.read_text(encoding='utf-8'),filename=str(p))
(candidate / 'offline-trial-checks.py').write_text(checks,encoding='utf-8')
deadline = time.monotonic() + 80
records = []
for label, command, timeout in [('trial-archives',[sys.executable,'-X','utf8',str(trial/'make-archives.py')],10),
                               ('trial-offline-checks',[sys.executable,'-X','utf8',str(candidate/'offline-trial-checks.py')],55)]:
    child = subprocess.Popen(command,cwd=candidate,stdout=subprocess.PIPE,stderr=subprocess.PIPE,
                             creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
    timed_out = False
    try:
        stdout,stderr = child.communicate(timeout=min(timeout,max(.1,deadline-time.monotonic())))
    except subprocess.TimeoutExpired:
        timed_out = True
        if child.poll() is None:
            subprocess.run(['taskkill.exe','/PID',str(child.pid),'/T','/F'],capture_output=True,timeout=5,creationflags=subprocess.CREATE_NO_WINDOW)
        stdout,stderr = child.communicate(timeout=5)
    (candidate/(label+'.stdout.txt')).write_bytes(stdout);(candidate/(label+'.stderr.txt')).write_bytes(stderr)
    records.append({'label':label,'pid':child.pid,'code':child.returncode,'timedOut':timed_out,'exitConfirmed':child.returncode is not None})
    (candidate/'trial-preparation-commands.json').write_text(json.dumps(records,indent=2),encoding='utf-8')
    assert not timed_out and child.returncode==0,(label,stderr.decode('utf-8',errors='replace'))
for name in ['authorization.json','closed-backup.json','preflight.json','restore-preflight.json','closed-out.json']:
    assert not (trial/name).exists()
assert not Path(config['backupRoot']).exists()
print(json.dumps({'trialRoot':str(trial),'sourceTemplates':34,'offlineChecksPassed':True,
                  'realAuthorizationCreated':False,'productionBackupCreated':False,'liveApplicationOperations':0}))
