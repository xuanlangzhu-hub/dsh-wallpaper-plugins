using System.Diagnostics;
using System.IO.Pipes;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
namespace DesktopQuery;
internal sealed record RelayRequest(int Protocol,string Nonce,RuntimeGrant Grant,bool Fixture,string? Mode,string? Path);
internal sealed record RelayFrame(string Kind,string Nonce,CommandRead? Command=null,int? Pid=null,string? Birth=null,string? Image=null);
internal sealed record ConsoleQueryRead(CommandRead Command,CaptureRead Capture);
internal static class ConsoleBridge
{
 static void Need(bool ok,string message){if(!ok)throw new IOException(message);}
 static async Task Send(Stream pipe,object value,CancellationToken token){byte[] bytes=Encoding.UTF8.GetBytes(JsonSerializer.Serialize(value,Program.Json)+"\n");Need(bytes.Length<=8192,"relay-frame-limit");await pipe.WriteAsync(bytes,token);await pipe.FlushAsync(token);}
 internal static async Task<ConsoleQueryRead> Query(RuntimeGrant grant,bool fixture,string mode,string path,CancellationToken token,Action<RelayFrame>? started=null){
  grant.Validate(DateTimeOffset.UtcNow);Need(grant.Kind=="query","query-ticket-required");
  string nonce=Guid.NewGuid().ToString("D"),pipeName="whale-follow-"+Guid.NewGuid().ToString("N");
  using var pipe=new NamedPipeServerStream(pipeName,PipeDirection.InOut,1,PipeTransmissionMode.Byte,PipeOptions.Asynchronous|PipeOptions.CurrentUserOnly|PipeOptions.FirstPipeInstance);
  using var deadline=CancellationTokenSource.CreateLinkedTokenSource(token);deadline.CancelAfter(TimeSpan.FromSeconds(9));
  int ready=0;RelayFrame? launch=null,final=null;string? ipcError=null;
  async Task Exchange(){
   await pipe.WaitForConnectionAsync(deadline.Token);Volatile.Write(ref ready,1);
   await Send(pipe,new RelayRequest(1,nonce,grant,fixture,fixture?mode:null,fixture?path:null),deadline.Token);
   var lines=new ProtocolLines(pipe);
   while(true){string? line=await lines.Read(deadline.Token);Need(line is not null,"relay-closed-before-receipt");var frame=JsonSerializer.Deserialize<RelayFrame>(line!,Program.Json)??throw new IOException("relay-frame-invalid");Need(frame.Nonce==nonce,"relay-nonce-mismatch");
    if(frame.Kind=="started"&&launch is null&&final is null){Need(frame.Pid>0&&frame.Birth is not null&&frame.Image is not null,"relay-start-invalid");launch=frame;started?.Invoke(frame);}
    else if(frame.Kind=="complete"&&final is null){Need(frame.Command is not null&&(launch is null||frame.Command.Pid==launch.Pid),"relay-command-invalid");final=frame;return;}
    else throw new IOException("relay-frame-order-invalid");
   }
  }var exchange=Exchange();_ = exchange.ContinueWith(_=>{},TaskContinuationOptions.OnlyOnFaulted);
  CaptureRead captured;
  try{captured=await Capture.Run([fixture?"--console-fixture-relay":"--runtime-console-relay",pipeName,nonce],()=>Volatile.Read(ref ready)==1,token);
   try{await exchange.WaitAsync(TimeSpan.FromSeconds(1));}catch(Exception ex){ipcError=ex.GetType().Name;}
  }finally{deadline.Cancel();pipe.Dispose();try{await exchange.WaitAsync(TimeSpan.FromSeconds(1));}catch{}}
  var command=final?.Command;
  if(command is null)command=new(launch is not null,captured.childrenExited,null,captured.exitCode==125&&!captured.cancelled&&!captured.overflow,captured.exitCode==125,captured.overflow,!captured.childrenExited,launch?.Pid,"","","relay-receipt-missing");
  bool clean=captured.exited&&captured.exitCode==0&&!captured.cancelled&&!captured.overflow&&captured.consoleClosed&&captured.childrenExited&&ipcError is null;
  return new(command with{StdoutBase64=captured.rawBase64,OutputLimit=command.OutputLimit||captured.overflow,ExitUnconfirmed=command.ExitUnconfirmed||!captured.childrenExited,Error=clean?command.Error:command.Error??"console-unconfirmed"},captured);
 }
 internal static async Task<int> Relay(bool fixture,string name,string nonce){
  Need(name.StartsWith("whale-follow-")&&Guid.TryParseExact(name[13..],"N",out _)&&Guid.TryParseExact(nonce,"D",out _),"private-relay-required");
  using var deadline=new CancellationTokenSource(TimeSpan.FromSeconds(8));
  using var pipe=new NamedPipeClientStream(".",name,PipeDirection.InOut,PipeOptions.Asynchronous|PipeOptions.CurrentUserOnly);
  await pipe.ConnectAsync(2500,deadline.Token);var lines=new ProtocolLines(pipe);string? line=await lines.Read(deadline.Token);
  var request=JsonSerializer.Deserialize<RelayRequest>(line??throw new IOException("relay-request-required"),Program.Json)??throw new IOException("relay-request-invalid");
  Need(request.Protocol==1&&request.Nonce==nonce&&request.Fixture==fixture,"relay-request-mismatch");var grant=request.Grant;grant.Validate(DateTimeOffset.UtcNow);Need(grant.Kind=="query","query-kind-required");
  IQueryRuntime reader=fixture?new BootstrapFixture(grant,request.Mode!,request.Path!):new WindowsRuntime(grant);
  if(fixture)Need(request.Mode is "success" or "wait" or "flood" or "noattach" or "changed"&&request.Path?.Length<=2048,"fixture-mode-invalid");
  else{Need(request.Mode is null&&request.Path is null,"live-extra-fields-refused");Need(Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(grant.ImagePath))).Equals(grant.ImageSha256,StringComparison.OrdinalIgnoreCase),"image-fingerprint-changed");}
  var before=reader.Read();Need(QueryCore.Ready(before)&&before.Engines[0]==grant.ExpectedEngine,"expected-engine-changed");deadline.Token.ThrowIfCancellationRequested();
  string exe=fixture?Path.Combine(AppContext.BaseDirectory,"fixture/RuntimeGuiOutput.exe"):grant.ImagePath;
  string[] args=fixture?["--own-runtime-console",nonce,request.Mode=="changed"?"success":request.Mode!,request.Path!]:QueryCore.Arguments(null);
  var start=new ProcessStartInfo(exe){UseShellExecute=false,CreateNoWindow=false};foreach(var a in args)start.ArgumentList.Add(a);
  using var child=Process.Start(start)??throw new IOException("query-start-failed");_=child.SafeHandle;
  await Send(pipe,new RelayFrame("started",nonce,Pid:child.Id,Birth:child.StartTime.ToUniversalTime().Ticks.ToString(),Image:exe),deadline.Token);
  bool forced=false,timedOut=false,exited=false;int? exit=null;string? error=null;
  try{await child.WaitForExitAsync(deadline.Token).WaitAsync(TimeSpan.FromSeconds(4));}
  catch(Exception ex){forced=true;timedOut=ex is TimeoutException;error=ex.GetType().Name;try{if(!child.HasExited)child.Kill();await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(1));}catch(Exception close){error+=";exit:"+close.GetType().Name;}}
  try{exited=child.HasExited;if(exited)exit=child.ExitCode;}catch(Exception ex){error+=";status:"+ex.GetType().Name;}
  var after=reader.Read();if(!QueryCore.Ready(after)||after.Engines[0]!=grant.ExpectedEngine)error="expected-engine-changed-after";
  var result=new CommandRead(true,exited,exit,timedOut,forced,false,!exited,child.Id,"","",error);
  await Send(pipe,new RelayFrame("complete",nonce,result),deadline.Token);return exited&&exit==0&&error is null?0:2;
 }
}
internal sealed class ConsoleRuntime(RuntimeGrant grant,bool fixture,string mode,string path):IQueryRuntime
{
 readonly IQueryRuntime reader=fixture?new BootstrapFixture(grant,mode,path):new WindowsRuntime(grant);
 internal CommandRead? LastCommand;internal CaptureRead? LastCapture;internal bool ChildLaunchAttempted;
 public EnvironmentRead Read()=>reader.Read();
 public async Task<CommandRead> Query(int? monitor,CancellationToken token){ChildLaunchAttempted=true;var result=await ConsoleBridge.Query(grant,fixture,mode,path,token);LastCapture=result.Capture;return LastCommand=result.Command;}
}
internal static partial class Program
{
 static RuntimeGrant ConsoleFixtureGrant(){var now=DateTimeOffset.UtcNow;return new("desktop-follow-runtime-console-v1",1,Guid.NewGuid().ToString("D"),Guid.NewGuid().ToString("D"),true,true,now,now.AddSeconds(15),"Q:\\fixture\\wallpaper64.exe",new string('a',64),new(17,638000000000000001,"Q:\\fixture\\wallpaper64.exe"),null,"query",1);}
 static async Task<int> ConsoleHolder(){OwnJob.Attach();await ConsoleBridge.Query(ConsoleFixtureGrant(),true,"wait","Q:\\fixture\\scene.pkg",CancellationToken.None,f=>{Console.WriteLine(JsonSerializer.Serialize(f,Json));Console.Out.Flush();});return 0;}
 static async Task<int> ConsoleIsolation(){
  OwnJob.Attach();using var holder=new Process{StartInfo=Self("--console-job-holder")};holder.StartInfo.RedirectStandardOutput=true;holder.StartInfo.RedirectStandardError=true;Process? leaf=null;bool verified=false;
  try{holder.Start();_=holder.SafeHandle;string? line=await holder.StandardOutput.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(4));var frame=JsonSerializer.Deserialize<RelayFrame>(line!,Json)!;
   leaf=Process.GetProcessById(frame.Pid!.Value);_=leaf.SafeHandle;verified=leaf.StartTime.ToUniversalTime().Ticks.ToString()==frame.Birth&&StringComparer.OrdinalIgnoreCase.Equals(Path.GetFullPath(leaf.MainModule!.FileName),Path.GetFullPath(Path.Combine(AppContext.BaseDirectory,"fixture/RuntimeGuiOutput.exe")));
   if(!verified)throw new IOException("own-leaf-identity-mismatch");holder.Kill();await holder.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3));await leaf.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3));
   Console.WriteLine(JsonSerializer.Serialize(new{workerExited=holder.HasExited,childExited=leaf.HasExited,verifiedBeforeKill=verified,nativeAppQueries=0}));return 0;
  }finally{if(holder.Id>0&&!holder.HasExited){holder.Kill();await holder.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(2));}if(verified&&leaf is not null&&!leaf.HasExited){leaf.Kill();await leaf.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(2));}leaf?.Dispose();}
 }
 static async Task<int> ConsoleWorker(bool fixture){
  using var first=new CancellationTokenSource(TimeSpan.FromSeconds(3));var lines=new ProtocolLines(Console.OpenStandardInput());string? line=await lines.Read(first.Token);
  using var json=JsonDocument.Parse(line??throw new IOException("request-required"));var root=json.RootElement;
  if(root.ValueKind!=JsonValueKind.Object||root.EnumerateObject().Count()!=3||root.GetProperty("protocol").GetInt32()!=1||!Guid.TryParseExact(root.GetProperty("nonce").GetString(),"D",out _))throw new IOException("protocol-invalid");
  string nonce=root.GetProperty("nonce").GetString()!;var input=root.GetProperty("input");var grant=input.GetProperty("grant").Deserialize<RuntimeGrant>(Json)??throw new IOException("grant-required");grant.Validate(DateTimeOffset.UtcNow);
  string mode="success",path="Q:\\fixture\\scene.pkg";
  if(fixture){mode=input.GetProperty("fixture").GetString()!;if(mode is not("success" or "wait" or "flood" or "noattach" or "empty" or "multiple" or "error" or "unstable" or "delay" or "changed"))throw new IOException("fixture-mode-invalid");if(input.TryGetProperty("path",out var p))path=p.GetString()!;if(path.Length>2048)throw new IOException("fixture-path-limit");}
  OwnJob.Attach();using var deadline=new CancellationTokenSource(TimeSpan.FromSeconds(8));var listening=Listen(lines,nonce,deadline);var clock=Stopwatch.StartNew();var runtime=new ConsoleRuntime(grant,fixture,mode,path);
  QueryReport? report=null;EnvironmentRead? before=null,after=null;bool ready=false;string? failure=null;
  try{
   if(grant.Kind=="environment"){
    if(!fixture&&Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(grant.ImagePath))).ToLowerInvariant()!=grant.ImageSha256.ToLowerInvariant())throw new IOException("image-fingerprint-changed");
    if(fixture&&mode=="delay")await Task.Delay(TimeSpan.FromSeconds(2),deadline.Token);deadline.Token.ThrowIfCancellationRequested();before=runtime.Read();after=runtime.Read();ready=QueryCore.Ready(before)&&QueryCore.Ready(after)&&before.Engines.SequenceEqual(after.Engines);
   }else report=await QueryCore.Run(runtime,null,deadline.Token);
  }catch(Exception ex){failure=ex.GetType().Name;}
  var capture=runtime.LastCapture;var command=runtime.LastCommand;bool clean=(!runtime.ChildLaunchAttempted||capture is{childrenExited:true,consoleClosed:true})&&OwnJob.Active==1,cancelled=deadline.IsCancellationRequested,inBudget=clock.Elapsed<TimeSpan.FromSeconds(8);
  object query=grant.Kind=="environment"?new{bootstrapEnvelope=new{before,after,ready,inBudget,failure,ownJobActive=OwnJob.Active,syntheticRuntimeOnly=fixture}}:
   new{nativeEnvelope=new{data=new{result=report},inBudget,failure,ownJobActive=OwnJob.Active,console=capture is null?null:new{transport="desktop-follow-runtime-conpty-v1",capture.exited,capture.exitCode,capture.cancelled,capture.overflow,capture.consoleClosed,capture.childrenExited,capture.rawBase64},syntheticRuntimeOnly=fixture}};
  Console.WriteLine(JsonSerializer.Serialize(new{protocol=1,nonce,query,queryChildCleanupConfirmed=clean,queryChildPid=command?.Pid},Json));await Console.Out.FlushAsync();deadline.Cancel();await listening.WaitAsync(TimeSpan.FromSeconds(1));return clean?(cancelled?2:0):3;
 }
}
