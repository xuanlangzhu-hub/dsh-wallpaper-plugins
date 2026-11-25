using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.Json;
internal sealed record CaptureRead(bool exited,int? exitCode,bool cancelled,bool overflow,bool consoleClosed,bool childrenExited,string rawBase64);
internal static class Capture
{
 // Only Worker constructs this call after validating its typed live or own-fixture ticket.
 internal static async Task<CaptureRead> Run(string[] args,Func<bool> relayReady,CancellationToken cancel)
 {
  string exe=Environment.ProcessPath!;IntPtr ir=IntPtr.Zero,iw=IntPtr.Zero,or=IntPtr.Zero,ow=IntPtr.Zero,pc=IntPtr.Zero,attrs=IntPtr.Zero,job=N.Job();var child=new N.ProcessInfo();
  using var bytes=new MemoryStream();bool overflow=false,cancelled=false,consoleClosed=false,childrenExited=false;Task? drain=null;int? exit=null;
  try{
   N.Check(N.CreatePipe(out ir,out iw,IntPtr.Zero,0));N.Check(N.CreatePipe(out or,out ow,IntPtr.Zero,0));
   if(N.CreatePseudoConsole(new N.Coord(240,40),ir,ow,0,out pc)!=0)throw new IOException("pseudo-console-create-failed");
   UIntPtr size=UIntPtr.Zero;N.InitializeProcThreadAttributeList(IntPtr.Zero,1,0,ref size);attrs=Marshal.AllocHGlobal(checked((int)size));N.Check(N.InitializeProcThreadAttributeList(attrs,1,0,ref size));N.Check(N.UpdateProcThreadAttribute(attrs,0,new IntPtr(0x20016),pc,(UIntPtr)IntPtr.Size,IntPtr.Zero,IntPtr.Zero));
   var startup=new N.StartupEx{info=new N.Startup{cb=Marshal.SizeOf<N.StartupEx>()},attributes=attrs};
   if(new[]{exe}.Concat(args).Any(x=>x.Contains('"')||x.Contains('\0')))throw new ArgumentException("quoted-ticket-path-refused");
   string line=string.Join(" ",new[]{exe}.Concat(args).Select(x=>'"'+x+'"'));
   N.Check(N.CreateProcess(exe,new StringBuilder(line),IntPtr.Zero,IntPtr.Zero,false,N.Extended|N.Suspended,IntPtr.Zero,null,ref startup,out child));N.Check(N.AssignProcessToJobObject(job,child.process));
   N.CloseHandle(ir);ir=IntPtr.Zero;N.CloseHandle(ow);ow=IntPtr.Zero;
   drain=Task.Run(()=>{byte[] buffer=new byte[2048];while(N.ReadFile(or,buffer,buffer.Length,out int n,IntPtr.Zero)&&n>0){if(bytes.Length+n<=8192)bytes.Write(buffer,0,n);else Volatile.Write(ref overflow,true);}});
   if(N.ResumeThread(child.thread)==uint.MaxValue)throw new IOException("relay-resume-failed");var clock=Stopwatch.StartNew();
   while(N.WaitForSingleObject(child.process,0)==258){
    bool requested=cancel.IsCancellationRequested,ready=relayReady();
    if(requested&&ready||clock.ElapsedMilliseconds>6500||Volatile.Read(ref overflow)){cancelled=requested;N.Check(N.TerminateJobObject(job,125));break;}await Task.Delay(10);
   }
   if(N.WaitForSingleObject(child.process,1500)!=0)throw new IOException("relay-exit-unknown");N.Check(N.GetExitCodeProcess(child.process,out uint code));exit=checked((int)code);
   // Never close twice if teardown times out; the independent parent then fences this worker.
   var closing=pc;pc=IntPtr.Zero;await Task.Run(()=>N.ClosePseudoConsole(closing)).WaitAsync(TimeSpan.FromSeconds(2));consoleClosed=true;
   await drain.WaitAsync(TimeSpan.FromSeconds(2));childrenExited=N.Active(job)==0;
   return new(true,exit,cancelled,overflow,consoleClosed,childrenExited,Convert.ToBase64String(bytes.ToArray()));
  }finally{
   if(child.process!=IntPtr.Zero&&N.WaitForSingleObject(child.process,0)==258)N.TerminateJobObject(job,126);
   if(pc!=IntPtr.Zero){var closing=pc;pc=IntPtr.Zero;await Task.Run(()=>N.ClosePseudoConsole(closing)).WaitAsync(TimeSpan.FromSeconds(2));}
   if(attrs!=IntPtr.Zero){N.DeleteProcThreadAttributeList(attrs);Marshal.FreeHGlobal(attrs);}
   foreach(var handle in new[]{child.process,child.thread,ir,iw,or,ow,job})if(handle!=IntPtr.Zero)N.CloseHandle(handle);
  }
 }
}
