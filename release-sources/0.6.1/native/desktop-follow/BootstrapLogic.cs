using System.Diagnostics;
using System.Security.Cryptography;
using System.Text.Json;

namespace DesktopQuery;

internal sealed class BootstrapFixture(RuntimeGrant grant,string mode,string path):IQueryRuntime
{
 readonly FixtureRuntime child=new(mode=="wait"?"wait":"success",path);int reads;
 public CommandRead? LastCommand=>child.LastCommand;
 public bool ChildLaunchAttempted=>child.ChildLaunchAttempted;
 public EnvironmentRead Read()
 {
  var identity=new EngineIdentity(mode=="changed"||mode=="unstable"&&reads++>0?19:17,638000000000000001,"Q:\\fixture\\wallpaper64.exe");
  if(mode=="empty")return new(true,[],false);
  if(mode=="multiple")return new(true,[identity,identity with{Pid=18}],false);
  if(mode=="error")return new(false,[],false,"fixture-read-error");
  if(grant.Kind=="query"&&identity!=grant.ExpectedEngine)return new(false,[identity],false,"expected-engine-changed");
  return new(true,[identity],false);
 }
 public Task<CommandRead> Query(int? monitor,CancellationToken token)=>child.Query(monitor,token);
}

internal static partial class Program
{
 static int BootstrapGrantChecks(RuntimeGrant g,DateTimeOffset now)
 {
  int checks=0;
  (g with{Kind="environment",ExpectedEngine=null}).Validate(now);checks++;
  foreach(var bad in new[]{g with{Kind="query",ExpectedEngine=null},g with{Kind="environment"},g with{Kind="other"},g with{Activation=0},g with{Scope="desktop-follow-runtime-worker-v1"}})
  {bool rejected=false;try{bad.Validate(now);}catch(ArgumentException){rejected=true;}if(!rejected)throw new Exception("bootstrap-grant-check");checks++;}
  return checks;
 }
 static async Task<int> BootstrapWorker(bool fixture)
 {
  using var initial=new CancellationTokenSource(TimeSpan.FromSeconds(3));
  var lines=new ProtocolLines(Console.OpenStandardInput());string? line=await lines.Read(initial.Token);
  using var json=JsonDocument.Parse(line??throw new IOException("request-required"));var root=json.RootElement;
  if(root.ValueKind!=JsonValueKind.Object||root.EnumerateObject().Count()!=3||root.GetProperty("protocol").GetInt32()!=1||
   !Guid.TryParseExact(root.GetProperty("nonce").GetString(),"D",out _))throw new IOException("protocol-invalid");
  string nonce=root.GetProperty("nonce").GetString()!;var input=root.GetProperty("input");
  var grant=input.GetProperty("grant").Deserialize<RuntimeGrant>(Json)??throw new IOException("grant-required");grant.Validate(DateTimeOffset.UtcNow);
  string mode="success",path="Q:\\fixture\\scene.pkg";
  if(fixture){mode=input.GetProperty("fixture").GetString()!;if(mode is not("success" or "wait" or "empty" or "multiple" or "error" or "unstable" or "delay" or "changed"))throw new IOException("fixture-mode-invalid");
   if(input.TryGetProperty("path",out var p))path=p.GetString()!;if(path.Length>2048)throw new IOException("fixture-path-limit");}
  OwnJob.Attach();
  using var deadline=new CancellationTokenSource(TimeSpan.FromSeconds(8));var listening=Listen(lines,nonce,deadline);var clock=Stopwatch.StartNew();
  WindowsRuntime? native=null;BootstrapFixture? fake=null;IQueryRuntime runtime;
  if(fixture){fake=new(grant,mode,path);runtime=fake;}else{native=new(grant);runtime=native;}
  QueryReport? report=null;EnvironmentRead? before=null,after=null;string? failure=null;bool ready=false;
  try{
   if(grant.Kind=="environment"){
    // Discovery reads only. There is deliberately no runtime.Query call in this branch.
    if(!fixture&&Convert.ToHexString(SHA256.HashData(File.ReadAllBytes(grant.ImagePath))).ToLowerInvariant()!=grant.ImageSha256.ToLowerInvariant())throw new IOException("image-fingerprint-changed");
    if(fixture&&mode=="delay")await Task.Delay(TimeSpan.FromSeconds(2),deadline.Token);
    deadline.Token.ThrowIfCancellationRequested();before=runtime.Read();after=runtime.Read();
    ready=QueryCore.Ready(before)&&QueryCore.Ready(after)&&before.Engines.SequenceEqual(after.Engines);
   }else report=await QueryCore.Run(runtime,null,deadline.Token);
  }catch(Exception ex){failure=ex.GetType().Name;}
  var command=fixture?fake?.LastCommand:native?.LastCommand;bool attempted=fixture?fake?.ChildLaunchAttempted==true:native?.ChildLaunchAttempted==true;
  bool clean=command is {Exited:true,ExitUnconfirmed:false}||!attempted,cancelled=deadline.IsCancellationRequested,inBudget=clock.Elapsed<TimeSpan.FromSeconds(8);
  object query=grant.Kind=="environment"?new{bootstrapEnvelope=new{before,after,ready,inBudget,failure,syntheticRuntimeOnly=fixture}}:
   new{nativeEnvelope=new{data=new{result=report},inBudget,failure,syntheticRuntimeOnly=fixture}};
  Console.WriteLine(JsonSerializer.Serialize(new{protocol=1,nonce,query,queryChildCleanupConfirmed=clean,queryChildPid=command?.Pid},Json));
  await Console.Out.FlushAsync();deadline.Cancel();await listening.WaitAsync(TimeSpan.FromSeconds(1));return clean?(cancelled?2:0):3;
 }
}
