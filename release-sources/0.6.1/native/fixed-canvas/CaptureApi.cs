using System.Runtime.InteropServices;
using Windows.Graphics.Capture;
using Windows.Graphics.DirectX.Direct3D11;

internal static class CaptureApi
{
 [DllImport("d3d11.dll")]private static extern int D3D11CreateDevice(nint a,int type,nint software,uint flags,nint levels,uint n,uint sdk,out nint device,out int level,out nint context);
 [DllImport("d3d11.dll")]private static extern int CreateDirect3D11DeviceFromDXGIDevice(nint dxgi,out nint device);
 [DllImport("combase.dll",CharSet=CharSet.Unicode)]private static extern int WindowsCreateString(string value,int length,out nint text);
 [DllImport("combase.dll")]private static extern int WindowsDeleteString(nint text);
 [DllImport("combase.dll")]private static extern int RoGetActivationFactory(nint text,ref Guid iid,out nint factory);
 [ComImport,Guid("3628e81b-3cac-4c60-b7f4-23ce0e0c3356"),InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
 private interface Interop{[PreserveSig]int CreateForWindow(nint hwnd,ref Guid iid,out nint item);[PreserveSig]int ReservedMonitorSlot(nint unused,ref Guid iid,out nint item);}
 internal static IDirect3DDevice Device()
 {
  nint d3d=0,context=0,dxgi=0,inspectable=0;
  try
  {
   Marshal.ThrowExceptionForHR(D3D11CreateDevice(0,1,0,0x20,0,0,7,out d3d,out _,out context));
   var iid=new Guid("54ec77fa-1377-44e6-8c32-88fd5f44c84c");Marshal.ThrowExceptionForHR(Marshal.QueryInterface(d3d,in iid,out dxgi));
   Marshal.ThrowExceptionForHR(CreateDirect3D11DeviceFromDXGIDevice(dxgi,out inspectable));return WinRT.MarshalInterface<IDirect3DDevice>.FromAbi(inspectable);
  }
  finally{if(inspectable!=0)Marshal.Release(inspectable);if(dxgi!=0)Marshal.Release(dxgi);if(context!=0)Marshal.Release(context);if(d3d!=0)Marshal.Release(d3d);}
 }
 internal static GraphicsCaptureItem Item(long hwnd)
 {
  const string name="Windows.Graphics.Capture.GraphicsCaptureItem";nint text=0,factory=0,item=0;object? rcw=null;
  try
  {
   Marshal.ThrowExceptionForHR(WindowsCreateString(name,name.Length,out text));var iid=typeof(Interop).GUID;Marshal.ThrowExceptionForHR(RoGetActivationFactory(text,ref iid,out factory));
   rcw=Marshal.GetObjectForIUnknown(factory);var interop=(Interop)rcw;var itemId=new Guid("79c3f95b-31f7-4ec2-a464-632ef5d30760");
   Marshal.ThrowExceptionForHR(interop.CreateForWindow((nint)hwnd,ref itemId,out item));if(item==0)throw new InvalidOperationException("wgc-item-unavailable");
   return WinRT.MarshalInterface<GraphicsCaptureItem>.FromAbi(item);
  }
  finally{if(item!=0)Marshal.Release(item);if(rcw!=null&&Marshal.IsComObject(rcw))Marshal.ReleaseComObject(rcw);if(factory!=0)Marshal.Release(factory);if(text!=0)WindowsDeleteString(text);}
 }
}
