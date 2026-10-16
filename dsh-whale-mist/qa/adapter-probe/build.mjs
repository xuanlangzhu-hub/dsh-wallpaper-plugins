// Generate an isolated probe from accepted source. No in-place editing or accepted binary overwrite.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {spawn} from 'node:child_process';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseArgs} from 'node:util';

const here=dirname(fileURLToPath(import.meta.url));const accepted=resolve(here,'../wallpaper-probe');
const xml=s=>s.replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;');
const hash=async p=>createHash('sha256').update(await readFile(p)).digest('hex').toUpperCase();
function replaceOnce(text,from,to){if(text.split(from).length!==2)throw new Error('Accepted source anchor absent or ambiguous: '+from.slice(0,70));return text.replace(from,to);}
const {values}=parseArgs({options:{output:{type:'string'}}});if(!values.output)throw new Error('Explicit new --output directory required');
const root=resolve(values.output);await mkdir(root);const generated=join(root,'generated');await mkdir(generated);
const source=await readFile(join(accepted,'Program.cs'),'utf8');let program=source.replaceAll('\r\n','\n');
program=replaceOnce(program,'Native.EnsureDefaultDesktop();',`var adapterOptions = AdapterSelection.Extract(args);
args = adapterOptions.Remaining;
if (args.Length == 1 && args[0] == "--qa-list-adapters") { Console.WriteLine(JsonSerializer.Serialize(AdapterSelection.Inventory(), cliJson)); return; }
if (args.Length == 1 && args[0] == "--qa-self-test-options") { AdapterSelection.CheckOptions(); return; }
if (args.Length == 1 && args[0] == "--qa-self-test-devices") { AdapterSelection.CheckDevices(); return; }
Native.EnsureDefaultDesktop();`);
program=replaceOnce(program,'using var device = Native.CreateDevice();','using var device = Native.CreateDevice(adapterOptions.Luid);\nAdapterSelection.VerifyActual(device, adapterOptions.Luid);');
program=replaceOnce(program,`public static IDirect3DDevice CreateDevice()
    {
        Marshal.ThrowExceptionForHR(D3D11CreateDevice(0, 1, 0, 0x20, 0, 0, 7, out var d3d, out _, out var context));`,
`public static IDirect3DDevice CreateDevice(long? requestedLuid = null)
    {
        using var selectedAdapter = AdapterSelection.Resolve(requestedLuid);
        // Explicit pAdapter requires UNKNOWN(0), while the unselected control remains HARDWARE(1).
        Marshal.ThrowExceptionForHR(D3D11CreateDevice(selectedAdapter?.NativePointer ?? 0,
            selectedAdapter is null ? 1 : 0, 0, 0x20, 0, 0, 7, out var d3d, out _, out var context));`);
await writeFile(join(generated,'Program.cs'),program,{flag:'wx'});
const files=['AtomicFile.cs','CaptureArguments.cs','FrameLog.cs','FramePipe.cs','ProbeJournal.cs','SourceWindowHelper.cs','StagingReadback.cs'];
await writeFile(join(generated,'WallpaperProbeAdapterQa.csproj'),`<Project Sdk="Microsoft.NET.Sdk">
  <PropertyGroup><OutputType>Exe</OutputType><TargetFramework>net10.0-windows10.0.19041.0</TargetFramework><ImplicitUsings>enable</ImplicitUsings><Nullable>enable</Nullable><PlatformTarget>x64</PlatformTarget></PropertyGroup>
  <ItemGroup><PackageReference Include="Vortice.Direct3D11" Version="3.8.3" />
${files.map(file=>`    <Compile Include="${xml(join(accepted,file))}" Link="${file}" />`).join('\n')}
    <Compile Include="${xml(join(here,'AdapterSelection.cs'))}" Link="AdapterSelection.cs" />
  </ItemGroup>
</Project>`,{flag:'wx'});
const asset=resolve(here,'../../assets/wallpaper');
const record={generatedAt:new Date().toISOString(),root,
  sources:await Promise.all(['Program.cs',...files].map(async file=>({file:join(accepted,file),sha256:await hash(join(accepted,file))}))),
  adapterSelection:{file:join(here,'AdapterSelection.cs'),sha256:await hash(join(here,'AdapterSelection.cs'))},
  acceptedAssets:await Promise.all(['WallpaperProbe.exe','WallpaperProbe.dll'].map(async file=>({file:join(asset,file),sha256:await hash(join(asset,file))})))};
await writeFile(join(root,'build-inputs.json'),JSON.stringify(record,null,2),{flag:'wx'});
const args=['publish',join(generated,'WallpaperProbeAdapterQa.csproj'),'-c','Release','--self-contained','false','-o',join(root,'native')];
const child=spawn('dotnet',args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';
for(const stream of [child.stdout,child.stderr])stream.on('data',data=>{log+=data;process.stdout.write(data);});
const exit=await new Promise((res,rej)=>{child.once('error',rej);child.once('close',res);});
await writeFile(join(root,'build.log'),log,{flag:'wx'});if(exit!==0)throw new Error('Isolated QA build failed; generated source and log retained');
for(const entry of [...record.sources,record.adapterSelection,...record.acceptedAssets])if(await hash(entry.file)!==entry.sha256)throw new Error('Accepted source/asset changed during QA build');
const outputHashes=await Promise.all(['WallpaperProbeAdapterQa.exe','WallpaperProbeAdapterQa.dll'].map(async file=>({file:join(root,'native',file),sha256:await hash(join(root,'native',file))})));
await writeFile(join(root,'build-result.json'),JSON.stringify({acceptedUnchanged:true,outputHashes},null,2),{flag:'wx'});
console.log(JSON.stringify({built:root,acceptedUnchanged:true,outputHashes}));
