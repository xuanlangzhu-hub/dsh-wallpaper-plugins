internal static class SelfTests
{
    internal static int Run()
    {
        int checks = 0;
        var client = new Box(320, 68, 2239, 1300);
        var root = new Node(100, 0, 50, "Chrome_WidgetWin_1", client, true, 144);
        var host = new Node(101, 100, 50, "Chrome_WidgetWin_0", client, true, 144);
        var widget = new Node(102, 101, 50, Locator.ChatRenderer, client, true, 144);
        var chat = new Snapshot(root, client, [host, widget], 0);

        void Expect(string target, Snapshot sample, string status, Node? node = null, Snapshot? next = null)
        {
            var actual = Locator.Compare(target, sample, next ?? sample);
            Locator.Require(actual == new Selection(status, node), "surface-self-test-" + status);
            checks++;
        }

        Expect("dsh", chat, "surface-candidate", widget, chat with { Children = [widget, host] });
        Expect("dsh", chat with { Children = [host, widget with { Visible = false }] }, "surface-candidate-unavailable");
        Expect("dsh", chat with { Children = [host, widget with { Dpi = 96 }] }, "surface-candidate-unavailable");
        Expect("dsh", chat with { Children = [host, widget with { Client = client with { Left = 319 } }] },
            "surface-candidate-unavailable");
        var rounded = widget with { Client = client with { Right = 2240, Bottom = 1301 } };
        var largerFrame = new Box(318, 68, 2241, 1302);
        Expect("dsh", chat with { Frame = largerFrame, Children = [host, rounded] }, "surface-candidate", rounded);
        Expect("dsh", chat with { Children = [host, rounded] }, "surface-candidate-unavailable");
        Expect("dsh", chat with { Frame = largerFrame, Children = [host, rounded with { Client = rounded.Client with { Right = 2241 } }] },
            "surface-candidate-unavailable");
        Expect("dsh", chat with { Children = [widget], OtherProcessWindows = 1 }, "surface-candidate-unavailable");
        Expect("dsh", chat with { Children = [host with { Parent = widget.Hwnd }, widget] }, "surface-candidate-unavailable");
        Expect("dsh", chat with { Children = [host, widget, widget with { Hwnd = 103 }] }, "surface-candidate-ambiguous");
        Expect("dsh", chat with { Children = [host, widget, widget] }, "invalid-surface-topology");
        Expect("dsh", chat with { OtherProcessWindows = 64 }, "invalid-surface-topology");
        Expect("dsh", chat, "surface-topology-changed", next: chat with { Children = [host, widget with { Thread = 44 }] });
        Expect("dsh", chat, "surface-topology-changed", next: chat with { Root = root with { Dpi = 96 } });
        Expect("dsh", chat, "surface-topology-changed", next: chat with { Frame = client with { Top = 67 } });
        var sceneClient = new Box(4096, 0, 6656, 1440);
        var sceneRoot = root with { ClassName = Locator.SceneRoot, Client = sceneClient };
        var sceneRenderer = host with { ClassName = Locator.SceneRenderer, Client = sceneClient };
        var scene = new Snapshot(sceneRoot, sceneClient, [sceneRenderer], 0);
        Expect("we-scene", scene, "surface-candidate", sceneRenderer);
        Expect("we-scene", scene with { Children = [sceneRenderer with { Client = sceneClient with { Right = 6657 } }] },
            "surface-candidate-unavailable");
        Expect("we-scene", scene with { Children = [sceneRenderer with { Parent = 40 }] }, "surface-candidate-unavailable");
        Expect("we-scene", scene with { Root = sceneRoot with { ClassName = "WorkerW" } }, "unsupported-surface-topology");
        Expect("we-scene", scene with { Children = [] }, "surface-candidate-unavailable");
        Expect("we-web", scene, "unsupported-surface-topology");

        var now = new DateTimeOffset(2026, 11, 20, 0, 0, 0, TimeSpan.Zero);
        var plan = new ReadPlan("fixed-canvas-surface-locator-v1", Guid.Parse("11111111-2222-3333-4444-555555555555"),
            true, now, now.AddMinutes(1), "we-scene", 12, 165, "9001",
            @"C:\Test\wallpaper64.exe", "WhaleWallpaperProbe-20261120-fixture");
        Locator.Validate(plan, now);
        checks++;
        foreach (var invalid in new[]
        {
            plan with { UserConvenient = false }, plan with { ExpiresUtc = now }, plan with { Hwnd = 65535 },
            plan with { Location = "original-desktop" }, plan with { ImagePath = @"C:\Test\Other.exe" },
            plan with { Target = "dsh" }, plan with { Scope = "unknown" },
        })
        {
            try { Locator.Validate(invalid, now); }
            catch (InvalidOperationException) { checks++; continue; }
            throw new InvalidOperationException("surface-self-test-plan");
        }
        return checks;
    }
}
