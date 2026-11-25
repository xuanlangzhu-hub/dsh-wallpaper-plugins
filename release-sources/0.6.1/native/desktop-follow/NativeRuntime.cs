using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Encodings.Web;
using System.Text.Json.Serialization;
using System.Globalization;

namespace DesktopQuery;

// Windows birth ticks exceed JS's exact integer range; keep all 100 ns digits.
internal sealed class IdentityJson:JsonConverter<EngineIdentity>
{
 public override EngineIdentity Read(ref Utf8JsonReader reader,Type type,JsonSerializerOptions options)
 {
  using var json=JsonDocument.ParseValue(ref reader);var value=json.RootElement;
  if(value.EnumerateObject().Count()!=3||value.GetProperty("BirthUtcTicks").ValueKind!=JsonValueKind.String||
   !long.TryParse(value.GetProperty("BirthUtcTicks").GetString(),NumberStyles.None,CultureInfo.InvariantCulture,out long birth))throw new JsonException("exact-birth-ticks-required");
  return new(value.GetProperty("Pid").GetInt32(),birth,value.GetProperty("ImagePath").GetString()!);
 }
 public override void Write(Utf8JsonWriter writer,EngineIdentity value,JsonSerializerOptions options)
 {writer.WriteStartObject();writer.WriteNumber("Pid",value.Pid);writer.WriteString("BirthUtcTicks",value.BirthUtcTicks.ToString(CultureInfo.InvariantCulture));writer.WriteString("ImagePath",value.ImagePath);writer.WriteEndObject();}
}

internal sealed record RuntimeGrant(string Scope,long OwnerGeneration,string ConnectionId,string TicketId,bool Enabled,bool Wanted,
 DateTimeOffset Created,DateTimeOffset Expires,string ImagePath,string ImageSha256,EngineIdentity? ExpectedEngine,int? Monitor,string Kind="query",long Activation=1)
{
 public void Validate(DateTimeOffset now)
 {
  if(Scope!="desktop-follow-runtime-console-v1"||OwnerGeneration<1||OwnerGeneration>9007199254740991||
   !Guid.TryParseExact(ConnectionId,"D",out _)||!Guid.TryParseExact(TicketId,"D",out _)||!Enabled||!Wanted||
   Created>now||now>=Expires||Expires<=Created||Expires-Created>TimeSpan.FromSeconds(30)||Monitor is not null||
   string.IsNullOrEmpty(ImagePath)||ImagePath.Length>4096||!Path.IsPathFullyQualified(ImagePath)||
   !Path.GetFileName(ImagePath).Equals("wallpaper64.exe",StringComparison.OrdinalIgnoreCase)||
   ImageSha256.Length!=64||ImageSha256.Any(c=>!Uri.IsHexDigit(c))||Kind is not("environment" or "query")||Activation<1||Activation>9007199254740991||
   Kind=="query"&&ExpectedEngine is null||Kind=="environment"&&ExpectedEngine is not null||
   ExpectedEngine is not null&&(ExpectedEngine.Pid<1||ExpectedEngine.BirthUtcTicks<1||!StringComparer.OrdinalIgnoreCase.Equals(ExpectedEngine.ImagePath,ImagePath)))
    throw new ArgumentException("runtime-grant-required");
 }
}

// The worker joins its own kill-on-close job BEFORE it creates any query process.
// This one non-inheritable handle lives until OS process teardown, not scope disposal:
// closing it while this worker is still in the job would terminate the worker itself.
internal static class OwnJob
{
 static IntPtr lifetimeHandle;
 public static uint Active=>N.Active(lifetimeHandle);
 [StructLayout(LayoutKind.Sequential)]struct Basic { public long ProcessTime,JobTime;public uint Flags;public nuint Min,Max;public uint Active;public nuint Affinity;public uint Priority,Schedule; }
 [StructLayout(LayoutKind.Sequential)]struct Counters { public ulong Read,Write,Other,ReadBytes,WriteBytes,OtherBytes; }
 [StructLayout(LayoutKind.Sequential)]struct Extended { public Basic Basic;public Counters Io;public nuint ProcessMemory,JobMemory,PeakProcess,PeakJob; }
 public static void Attach()
 {
  if(lifetimeHandle!=IntPtr.Zero)return;
  var job=CreateJobObject(IntPtr.Zero,null);if(job==IntPtr.Zero)throw new IOException("job-create-failed");
  var info=new Extended();info.Basic.Flags=0x2000;
  if(!SetInformationJobObject(job,9,ref info,(uint)Marshal.SizeOf<Extended>())||!AssignProcessToJobObject(job,GetCurrentProcess()))
  {CloseHandle(job);throw new IOException("job-admission-failed");}
  lifetimeHandle=job;
 }
 [DllImport("kernel32.dll",EntryPoint="CreateJobObjectW",CharSet=CharSet.Unicode,SetLastError=true)]static extern IntPtr CreateJobObject(IntPtr attributes,string? name);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool SetInformationJobObject(IntPtr job,int kind,ref Extended info,uint size);
 [DllImport("kernel32.dll",SetLastError=true)]static extern bool AssignProcessToJobObject(IntPtr job,IntPtr process);
 [DllImport("kernel32.dll")]static extern IntPtr GetCurrentProcess();
 [DllImport("kernel32.dll")]static extern bool CloseHandle(IntPtr handle);
}

internal sealed class ProtocolLines(Stream input)
{
 readonly byte[] bytes=new byte[1024];int start,end;
 public async Task<string?> Read(CancellationToken token)
 {
  using var output=new MemoryStream();
  while(true){if(start==end){end=await input.ReadAsync(bytes,token);start=0;if(end==0)return output.Length==0?null:throw new IOException("truncated-protocol");}
   byte b=bytes[start++];if(b==10)return new UTF8Encoding(false,true).GetString(output.ToArray()).TrimEnd('\r');
   if(output.Length>=8192)throw new IOException("protocol-limit");output.WriteByte(b);
  }
 }
}

internal sealed class FixtureRuntime(string mode,string path):IQueryRuntime
{
 public CommandRead? LastCommand;public bool ChildLaunchAttempted;
 readonly EnvironmentRead environment=new(true,[new(17,638000000000000000,"Q:\\fixture\\wallpaper64.exe")],false);
 public EnvironmentRead Read()=>environment;
 public async Task<CommandRead> Query(int? monitor,CancellationToken token)
 {
  ChildLaunchAttempted=true;
  var start=Program.Self(mode=="wait"?"--fixture-child":"--fixture-query-child");
  if(mode!="wait")start.ArgumentList.Add(path);
  start.RedirectStandardOutput=true;start.RedirectStandardError=true;
  using var child=Process.Start(start)??throw new IOException("fixture-start");_=child.SafeHandle;
  bool forced=false;string output="";
  try{output=await child.StandardOutput.ReadToEndAsync(token);await child.WaitForExitAsync(token);}
  catch(OperationCanceledException){forced=true;child.Kill();await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(1));}
  return LastCommand=new(true,child.HasExited,child.HasExited?child.ExitCode:null,false,forced,false,!child.HasExited,child.Id,
   Convert.ToBase64String(Encoding.UTF8.GetBytes(output)),"",null);
 }
}

internal static partial class Program
{
 internal static readonly JsonSerializerOptions Json=new(){Encoder=JavaScriptEncoder.UnsafeRelaxedJsonEscaping,Converters={new IdentityJson()}};
 public static ProcessStartInfo Self(string arg)
 {var s=new ProcessStartInfo(Environment.ProcessPath!){UseShellExecute=false,CreateNoWindow=true,WindowStyle=ProcessWindowStyle.Hidden};s.ArgumentList.Add(arg);return s;}
 static async Task Listen(ProtocolLines lines,string nonce,CancellationTokenSource cancellation)
 {
  try{while(!cancellation.IsCancellationRequested){string? line=await lines.Read(cancellation.Token);if(line is null){cancellation.Cancel();return;}
    using var json=JsonDocument.Parse(line);var root=json.RootElement;
    if(root.ValueKind!=JsonValueKind.Object||root.EnumerateObject().Count()!=1||!root.TryGetProperty("cancel",out var value)||value.GetString()!=nonce)throw new IOException("cancel-invalid");
    cancellation.Cancel();return;
  }}catch{cancellation.Cancel();}
 }
 static async Task<int> Worker(bool fixture)
 {
  using var first=new CancellationTokenSource(TimeSpan.FromSeconds(3));
  var lines=new ProtocolLines(Console.OpenStandardInput());string? line=await lines.Read(first.Token);if(line is null)throw new IOException("request-required");
  using var json=JsonDocument.Parse(line);var root=json.RootElement;
  if(root.ValueKind!=JsonValueKind.Object||root.EnumerateObject().Count()!=3||root.GetProperty("protocol").GetInt32()!=1||
    !Guid.TryParseExact(root.GetProperty("nonce").GetString(),"D",out _))throw new IOException("protocol-invalid");
  string nonce=root.GetProperty("nonce").GetString()!;var input=root.GetProperty("input");
  RuntimeGrant? grant=null;string mode="success",path="Q:\\fixture\\scene.pkg";
  if(fixture){mode=input.GetProperty("fixture").GetString()!;if(mode is not("success" or "wait"))throw new IOException("fixture-invalid");
   if(input.TryGetProperty("path",out var p))path=p.GetString()!;if(path.Length>2048)throw new IOException("fixture-limit");}
  else {grant=input.GetProperty("grant").Deserialize<RuntimeGrant>(Json)??throw new IOException("grant-required");grant.Validate(DateTimeOffset.UtcNow);}
  OwnJob.Attach(); // Before constructing/starting ANY query child, including fixture children.
  using var deadline=new CancellationTokenSource(TimeSpan.FromSeconds(8));var listening=Listen(lines,nonce,deadline);
  var clock=Stopwatch.StartNew();QueryReport? report=null;CommandRead? command=null;bool attempted=false;string? failure=null;
  WindowsRuntime? native=null;FixtureRuntime? fake=null;
  try{
   if(fixture){fake=new(mode,path);report=await QueryCore.Run(fake,null,deadline.Token);}
   else {native=new(grant!);report=await QueryCore.Run(native,null,deadline.Token);}
  }catch(Exception ex){failure=ex.GetType().Name;}
  finally{command=fixture?fake?.LastCommand:native?.LastCommand;attempted=fixture?fake?.ChildLaunchAttempted==true:native?.ChildLaunchAttempted==true;}
  bool cancelled=deadline.IsCancellationRequested,clean=command is {Exited:true,ExitUnconfirmed:false}||!attempted;
  var envelope=new{data=new{result=report},inBudget=clock.Elapsed<TimeSpan.FromSeconds(8),failure,syntheticRuntimeOnly=fixture};
  Console.WriteLine(JsonSerializer.Serialize(new{protocol=1,nonce,query=new{nativeEnvelope=envelope},queryChildCleanupConfirmed=clean,queryChildPid=command?.Pid},Json));
  await Console.Out.FlushAsync();deadline.Cancel();await listening.WaitAsync(TimeSpan.FromSeconds(1));
  return clean?(cancelled?2:0):3;
 }
 static async Task<object> IsolationTest()
 {
  using var worker=new Process{StartInfo=Self("--fixture-job-holder")};worker.StartInfo.RedirectStandardOutput=true;worker.StartInfo.RedirectStandardError=true;
  Process? child=null;bool verified=false,workerExited=false,childExited=false;
  try{
   worker.Start();_=worker.SafeHandle;
   string? line=await worker.StandardOutput.ReadLineAsync().WaitAsync(TimeSpan.FromSeconds(4));using var info=JsonDocument.Parse(line!);
   child=Process.GetProcessById(info.RootElement.GetProperty("pid").GetInt32());_=child.SafeHandle;
   verified=child.StartTime.ToUniversalTime().Ticks==info.RootElement.GetProperty("birth").GetInt64()&&StringComparer.OrdinalIgnoreCase.Equals(child.MainModule?.FileName,Environment.ProcessPath);
   if(!verified)throw new IOException("own-child-identity-mismatch");
   worker.Kill();await worker.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3));workerExited=worker.HasExited;
   await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(3));childExited=child.HasExited;
   if(!childExited)throw new IOException("job-child-retained");
  }finally{
   if(worker.Id>0&&!worker.HasExited){worker.Kill();await worker.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(2));}
   if(verified&&child is not null&&!child.HasExited){child.Kill();await child.WaitForExitAsync().WaitAsync(TimeSpan.FromSeconds(2));}
   child?.Dispose();
  }
  return new{workerExited,childExited,verifiedBeforeKill=verified,scope="fresh-own-fixture-handles-only"};
 }
 static async Task<int> SelfTest()
 {
  OwnJob.Attach(); // An external test-runner timeout also retires this test's descendants.
  int checks=0;void Check(bool value){if(!value)throw new Exception("runtime-check:"+checks);checks++;}
  var now=DateTimeOffset.UtcNow;var g=new RuntimeGrant("desktop-follow-runtime-console-v1",1,Guid.NewGuid().ToString(),Guid.NewGuid().ToString(),true,true,now,now.AddSeconds(15),"Q:\\fixture\\wallpaper64.exe",new string('a',64),new(17,638000000000000000,"Q:\\fixture\\wallpaper64.exe"),null);
  g.Validate(now);checks++;checks+=BootstrapGrantChecks(g,now);
  var precise=g with{ExpectedEngine=g.ExpectedEngine! with{BirthUtcTicks=638000000000000001}};
  Check(JsonSerializer.Deserialize<RuntimeGrant>(JsonSerializer.Serialize(precise,Json),Json)!.ExpectedEngine!.BirthUtcTicks==638000000000000001);
  bool numericRejected=false;try{JsonSerializer.Deserialize<RuntimeGrant>(JsonSerializer.Serialize(precise,Json).Replace("\"638000000000000001\"","638000000000000001"),Json);}catch(JsonException){numericRejected=true;}Check(numericRejected);
  foreach(var bad in new[]{g with{Scope="desktop-follow-native-v1"},g with{OwnerGeneration=0},g with{Enabled=false},g with{Wanted=false},g with{Expires=now},g with{Expires=now.AddMinutes(5)},g with{Monitor=0},g with{ConnectionId="old"},g with{ExpectedEngine=g.ExpectedEngine! with{ImagePath="Q:\\other.exe"}}})
  {bool rejected=false;try{bad.Validate(now);}catch(ArgumentException){rejected=true;}Check(rejected);}
  var isolation=await IsolationTest();Console.WriteLine(JsonSerializer.Serialize(new{checks,jobIsolation=isolation,nativeAppQueries=0,weCommands=0}));return 0;
 }
 static async Task<int> Main(string[] args)
 {
  try{
   if(args is ["--runtime-console-worker"])return await ConsoleWorker(false);
   if(args is ["--console-bootstrap-fixture-worker"])return await ConsoleWorker(true);
   if(args is ["--runtime-console-relay",var pipe,var nonce])return await ConsoleBridge.Relay(false,pipe,nonce);
   if(args is ["--console-fixture-relay",var pipe2,var nonce2])return await ConsoleBridge.Relay(true,pipe2,nonce2);
   if(args is ["--console-job-holder"])return await ConsoleHolder();
   if(args is ["--console-job-isolation"])return await ConsoleIsolation();
   if(args is ["--runtime-self-test"])return await SelfTest();
   if(args is ["--fixture-child"]){await Task.Delay(Timeout.Infinite);return 0;}
   if(args is ["--fixture-query-child",var path]){Console.Write(path+"\r\n");return 0;}
   if(args is ["--fixture-job-holder"]){OwnJob.Attach();using var child=Process.Start(Self("--fixture-child"))!;_=child.SafeHandle;
    Console.WriteLine(JsonSerializer.Serialize(new{pid=child.Id,birth=child.StartTime.ToUniversalTime().Ticks}));await Console.Out.FlushAsync();await Task.Delay(Timeout.Infinite);return 0;}



   Console.Error.WriteLine("Private runtime grant required; no app reads by default");return 64;
  }catch(Exception ex){Console.Error.WriteLine(ex.GetType().Name+":"+ex.Message);return 1;}
 }
}
