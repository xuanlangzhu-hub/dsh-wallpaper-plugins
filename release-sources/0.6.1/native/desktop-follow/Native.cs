using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
internal static class N
{
 internal const uint Suspended=4,Extended=0x80000;
 [StructLayout(LayoutKind.Sequential)]internal struct Coord{internal short X,Y;internal Coord(short x,short y){X=x;Y=y;}}
 [StructLayout(LayoutKind.Sequential,CharSet=CharSet.Unicode)]internal struct Startup{internal int cb;internal string? reserved,desktop,title;internal uint x,y,xSize,ySize,xCount,yCount,fill,flags;internal ushort show,cbReserved;internal IntPtr reserved2,stdin,stdout,stderr;}
 [StructLayout(LayoutKind.Sequential)]internal struct StartupEx{internal Startup info;internal IntPtr attributes;}
 [StructLayout(LayoutKind.Sequential)]internal struct ProcessInfo{internal IntPtr process,thread;internal uint pid,tid;}
 [StructLayout(LayoutKind.Sequential)]internal struct BasicLimit{internal long perProcess,perJob;internal uint flags;internal UIntPtr min,max;internal uint active;internal UIntPtr affinity;internal uint priority,scheduling;}
 [StructLayout(LayoutKind.Sequential)]internal struct Io{internal ulong a,b,c,d,e,f;}
 [StructLayout(LayoutKind.Sequential)]internal struct Limit{internal BasicLimit basic;internal Io io;internal UIntPtr processMemory,jobMemory,peakProcess,peakJob;}
 [StructLayout(LayoutKind.Sequential)]internal struct Accounting{internal long a,b,c,d;internal uint faults,total,active,terminated;}
 internal static void Check(bool ok){if(!ok)throw new Win32Exception(Marshal.GetLastWin32Error());}
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool CreatePipe(out IntPtr read,out IntPtr write,IntPtr security,uint size);
 [DllImport("kernel32.dll")]internal static extern int CreatePseudoConsole(Coord size,IntPtr input,IntPtr output,uint flags,out IntPtr console);
 [DllImport("kernel32.dll")]internal static extern void ClosePseudoConsole(IntPtr console);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool InitializeProcThreadAttributeList(IntPtr list,int count,int flags,ref UIntPtr size);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool UpdateProcThreadAttribute(IntPtr list,uint flags,IntPtr attribute,IntPtr value,UIntPtr size,IntPtr previous,IntPtr returned);
 [DllImport("kernel32.dll")]internal static extern void DeleteProcThreadAttributeList(IntPtr list);
 [DllImport("kernel32.dll",EntryPoint="CreateProcessW",CharSet=CharSet.Unicode,SetLastError=true)]internal static extern bool CreateProcess(string app,StringBuilder command,IntPtr processSecurity,IntPtr threadSecurity,bool inherit,uint flags,IntPtr environment,string? directory,ref StartupEx startup,out ProcessInfo process);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool ReadFile(IntPtr file,byte[] bytes,int length,out int read,IntPtr overlapped);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool WriteFile(IntPtr file,byte[] bytes,int length,out int written,IntPtr overlapped);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]internal static extern bool WriteConsoleW(IntPtr console,string text,int length,out int written,IntPtr reserved);
 [DllImport("kernel32.dll",EntryPoint="CreateFileW",CharSet=CharSet.Unicode,SetLastError=true)]internal static extern IntPtr CreateFile(string name,uint access,uint share,IntPtr security,uint disposition,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool AttachConsole(uint pid);
 [DllImport("kernel32.dll")]internal static extern IntPtr GetStdHandle(int kind);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool GetConsoleMode(IntPtr handle,out uint mode);
 [DllImport("kernel32.dll")]internal static extern uint GetFileType(IntPtr handle);
 [DllImport("kernel32.dll")]internal static extern uint WaitForSingleObject(IntPtr handle,uint ms);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool GetExitCodeProcess(IntPtr handle,out uint code);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern uint ResumeThread(IntPtr handle);
 [DllImport("kernel32.dll")]internal static extern bool CloseHandle(IntPtr handle);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)]internal static extern IntPtr CreateJobObject(IntPtr security,string? name);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool SetInformationJobObject(IntPtr job,int kind,ref Limit value,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool QueryInformationJobObject(IntPtr job,int kind,out Accounting value,uint size,IntPtr returned);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll",SetLastError=true)]internal static extern bool TerminateJobObject(IntPtr job,uint exitCode);
 [DllImport("kernel32.dll")]internal static extern IntPtr GetCurrentProcess();
 internal static IntPtr Job(){var job=CreateJobObject(IntPtr.Zero,null);Check(job!=IntPtr.Zero);var limit=new Limit{basic=new BasicLimit{flags=0x2000}};Check(SetInformationJobObject(job,9,ref limit,(uint)Marshal.SizeOf<Limit>()));return job;}
 internal static uint Active(IntPtr job){Check(QueryInformationJobObject(job,1,out var a,(uint)Marshal.SizeOf<Accounting>(),IntPtr.Zero));return a.active;}
}
