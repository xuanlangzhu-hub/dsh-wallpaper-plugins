# Third-party notices — Whale Appearance 0.6.0-rc.53

Copyright (c) 2026 dsh-wallpaper-plugins contributors.

Project-authored code is provided under [MIT](LICENSE). This does not relicense
third-party binaries, artwork, trademarks, Wallpaper Engine or DeepSeek Harness.
This is a community plugin, not an official DeepSeek or Microsoft release.

## Native wallpaper helper dependencies

The following files are included under `assets/wallpaper/` in the plugin archive.
The release inventory records the exact DLL hashes, NuGet packages and entry paths.

| Files / package | Version | License and attribution |
| --- | --- | --- |
| Vortice.Direct3D11.dll, Vortice.DXGI.dll, Vortice.DirectX.dll | 3.8.3 | MIT; Copyright (c) Amer Koleci and Contributors. [Full text](licenses/Vortice.Windows-MIT.txt) |
| Vortice.Mathematics.dll | 2.1.0 | MIT; Copyright (c) Amer Koleci and Contributors. [Full text](licenses/Vortice.Mathematics-MIT.txt) |
| SharpGen.Runtime.dll, SharpGen.Runtime.COM.dll | 2.4.2-beta | MIT; NuGet attribution: Copyright (c) 2010-2017 Alexandre Mutel, 2017-2023 Jeremy Koritzinsky, 2023-2024 Amer Koleci. [Upstream full text](licenses/SharpGenTools-MIT.txt), including its original copyright notice, is preserved separately. |
| Microsoft.Windows.SDK.NET.dll, WinRT.Runtime.dll | Microsoft.Windows.SDK.NET.Ref 10.0.19041.57, lib/net8.0 | Microsoft Windows SDK terms; © Microsoft Corporation. All rights reserved. [Original license](licenses/Windows-SDK-license.rtf) and [component terms](licenses/Microsoft-components-terms.md). These files are not relicensed under the project's MIT license. |

Microsoft's [Windows SDK REDIST list](https://learn.microsoft.com/en-us/legal/windows-sdk/redist)
explicitly lists both `lib/net8.0` DLLs under Microsoft.Windows.SDK.NET.Ref for
unmodified redistribution with a program enabling WinRT API calls. They are shipped
unmodified with this plugin's native capture helper, for Windows only. The complete
SDK terms, including distribution requirements and restrictions, still apply.
The .NET runtime itself is not included.

## DeepSeek identification and icon

The whale icon is adapted from the DeepSeek whale mark: recolored white, with
transparent cut-outs in the eye and belly. DeepSeek and DeepSeek Harness names
and the mark identify the supported application. This community plugin is not
affiliated with or endorsed by DeepSeek; no trademark rights are granted by the
project's MIT license. The upstream DeepSeek Harness [MIT text](licenses/DeepSeek-Harness-MIT.txt)
is included separately. The adapted icon is not claimed as an original project logo.

## Materials not included

Wallpaper Engine, wallpaper projects/previews, the official DeepSeek Harness
installer, user profiles, account data and desktop screenshots are not bundled.
They retain their respective owners' terms. Build tools and host-provided modules
are not redistributed as part of the plugin payload.
