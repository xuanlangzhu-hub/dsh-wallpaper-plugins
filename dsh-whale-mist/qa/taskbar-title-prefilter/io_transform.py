"""QA-only bottom IO substitution. Method bodies and enumeration/verification flow stay real.

Every DllImport is removed: permitted reads use fixture IO; all other native entry points throw.
Process aliases only affect the QA copies. Production source adds no test hooks or abstractions.
"""
import re

def substitute(text, identity=False):
    text='using Process = FixtureProcess;\n'+text
    safe={
      'EnumWindows':'return Fixture.Enum((h,p) => lpEnumFunc(h,p), lParam);',
      'GetWindowText':'return Fixture.Text(hWnd, lpString, nMaxCount);',
      'GetWindowThreadProcessId':'lpdwProcessId = Fixture.Pid(hWnd); return 1;',
      'IsWindow':'return Fixture.Exists(hWnd);',
      'IsWindowVisible':'return Fixture.At(hWnd).Visible;',
      'IsIconic':'return Fixture.At(hWnd).Iconic;',
      'IsZoomed':'return false;',
      'GetForegroundWindow':'return 0;',
      'GetWindowRect':'lpRect = new RECT { Left=4096, Top=0, Right=5376, Bottom=720 }; return true;',
      'DwmGetWindowAttribute':'pvAttribute = Fixture.At(hwnd).Cloaked ? 1 : 0; return 0;',
      'GetWindowLongPtr':'return 0;',
      'GetWindow':'return 0;',
      'GetParent':'return 0;',
    }
    pattern=r'\[DllImport\([^\]]*\)\]\s*((?:public|private) static) extern ([\w?]+) (\w+)\((.*?)\);'
    names=[]
    def repl(m):
        access,ret,name,args=m.groups();names.append(name)
        body=safe.get(name,'throw new InvalidOperationException("OFFLINE forbidden native IO: '+name+'");')
        return f'{access} {ret} {name}({args}) {{ {body} }}'
    text=re.sub(pattern,repl,text,flags=re.S)
    assert not re.search(r'DllImport|\bextern\b',text),'unreplaced native IO'
    assert set(names)==({'GetWindow','GetParent'} if identity else {
        'GetSystemMetrics','SetThreadDpiAwarenessContext','EnumWindows','GetWindowText',
        'GetWindowThreadProcessId','IsWindow','IsWindowVisible','IsIconic','IsZoomed',
        'GetForegroundWindow','WindowFromPoint','GetAncestor','GetWindowRect','ShowWindow',
        'SetWindowPos','GetWindowLongPtr','SetWindowLongPtr','DwmGetWindowAttribute','CreateProcess','CloseHandle'})
    return text,names
