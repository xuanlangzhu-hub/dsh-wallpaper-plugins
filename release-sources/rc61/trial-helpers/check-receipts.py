"""Read the actual receipt expression without executing backup/retention scripts."""
from pathlib import Path
import argparse,ast,json

ap=argparse.ArgumentParser();ap.add_argument('--before',required=True);ap.add_argument('--after',required=True);ap.add_argument('--output',required=True);args=ap.parse_args()
before=Path(args.before).resolve();after=Path(args.after).resolve();out=Path(args.output).resolve();assert not out.exists();out.mkdir()
def count_expression(root):
 tree=ast.parse((root/'retain-before-install.py').read_text(encoding='utf-8'))
 values=[value for node in ast.walk(tree) if isinstance(node,ast.Dict) for key,value in zip(node.keys,node.values) if isinstance(key,ast.Constant) and key.value=='activeInstallFilesMatched']
 assert len(values)==1
 return compile(ast.Expression(values[0]),'receipt-expression','eval')
old=count_expression(before);new=count_expression(after)
for size in [47,3]:
 (out/'archives.json').write_text(json.dumps({'daily':{'files':{str(i):'fixture-hash' for i in range(size)}}}),encoding='utf-8')
 assert eval(new,{'json':json,'OUT':out})==size
assert eval(old,{'json':json,'OUT':out})==43
old_text=(before/'backup-closed.ps1').read_text(encoding='utf-8');new_text=(after/'backup-closed.ps1').read_text(encoding='utf-8')
def canonical(text,root):return text.replace(str(root),'ROOT').replace(root.name,'ROUND')
assert canonical(old_text,before).replace("purpose='rc61-gallery-author-trial'",'purpose=$trialConfig.purpose')==canonical(new_text,after)
result={'passed':True,'checks':3,'legacy43Reproduced':True,'newCountsFollowArchive':[47,3],'backupPurposeOnlyChangeVerified':True,'productionScriptsExecuted':False}
(out/'result.json').write_text(json.dumps(result,indent=2),encoding='utf-8');print(json.dumps(result))
