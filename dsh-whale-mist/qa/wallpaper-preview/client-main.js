window.__ModuleLoader__.load({
  id: 'dsh-whale-wallpaper-probe',
  factory: () => {
    /* FRAME_PROTOCOL */
    return { apply(ctx) {
      ctx.effect(() => {
        const picture = document.createElement('canvas'); picture.id = 'whale-wallpaper-probe-frame';
        picture.setAttribute('aria-hidden', 'true'); picture.hidden = true;
        const drawing = picture.getContext('2d', { alpha: false });
        const css = document.createElement('style');
        css.textContent = `
          /* Whale palette/canvas rules also use !important. Keep this override
             scoped to the active experiment and stronger than those rules. */
          body.wm-wallpaper-probe-live,
          body.wm-wallpaper-probe-live:is(.dsh-whale-mist-active, .dsh-whale-abyss-active)[data-wm-canvas][data-wm-palette] {
            --dsw-alias-bg-base: transparent !important; --dsw-alias-bg-primary: transparent !important;
            --dsw-alias-bg-layer-1: rgb(var(--wm-layer1-rgb, 15 23 38) / .72) !important;
            --dsw-alias-bg-layer-2: rgb(var(--wm-layer2-rgb, 23 34 54) / .82) !important;
            --dsw-alias-bg-layer-3: rgb(var(--wm-layer3-rgb, 28 40 62) / .88) !important;
            --dsw-specific-sidebar-fill: rgb(var(--wm-sidebar-rgb, 15 23 38) / .8) !important;
          }
          body.wm-wallpaper-probe-live #root { position: relative; z-index: 1; }
          body.wm-wallpaper-probe-live #wm-backdrop { display: none; }
          #whale-wallpaper-probe-frame { position: fixed; inset: 0; width: 100vw; height: 100vh; object-fit: cover; opacity: .8; filter: brightness(.8); pointer-events: none; z-index: 0; }
          #whale-wallpaper-probe-stop { position: fixed; left: 16px; bottom: 72px; z-index: 10000; color: #e7ecf4; background: #172236; border: 1px solid #66738a; border-radius: 6px; padding: 6px 10px; font: 12px system-ui; }
        `;
        const button = document.createElement('button'); button.id = 'whale-wallpaper-probe-stop';
        button.textContent = '壁纸实验：连接中'; button.title = '结束本次壁纸实验';
        document.head.append(css); document.body.prepend(picture); document.body.append(button);
        const request = new AbortController();
        const metrics = { received: 0, rendered: 0, dropped: 0, sourceSequence: 0, decodeErrors: 0 };
        const started = performance.now();
        let stopped = false, latest = null, painting = false, lastFrameAt = 0, latencySum = 0, latencyMax = 0;
        let reconnect, frameRequest = 0;
        const hide = () => { picture.hidden = true; document.body.classList.remove('wm-wallpaper-probe-live'); };
        const snapshot = () => ({ ...metrics, seconds: (performance.now() - started) / 1000,
          meanLatencyMs: metrics.rendered ? latencySum / metrics.rendered : 0, maxLatencyMs: latencyMax, hidden: Number(document.hidden) });
        const report = () => fetch('/whale-wallpaper-probe/metrics', { method: 'POST',
          headers: { 'content-type': 'application/json' }, body: JSON.stringify(snapshot()), keepalive: true }).catch(() => {});
        const stop = (stopCapture = false) => {
          if (stopped) return;
          stopped = true; latest = null; request.abort(); clearTimeout(reconnect); clearInterval(timer);
          cancelAnimationFrame(frameRequest); hide(); report();
          button.textContent = '壁纸实验已停止'; button.disabled = true;
          if (stopCapture) fetch('/whale-wallpaper-probe/stop', { method: 'POST' }).catch(() => {});
        };
        async function paint() {
          frameRequest = 0;
          if (stopped || painting || !latest || document.hidden) return;
          painting = true;
          const frame = latest; latest = null;
          try {
            const bitmap = await createImageBitmap(new Blob([frame.jpeg], { type: 'image/jpeg' }));
            if (!stopped && !document.hidden) {
              if (picture.width !== bitmap.width || picture.height !== bitmap.height) { picture.width = bitmap.width; picture.height = bitmap.height; }
              drawing.drawImage(bitmap, 0, 0);
              metrics.rendered++; metrics.sourceSequence = frame.sequence;
              const latency = Math.max(0, Date.now() - frame.capturedAt); latencySum += latency; latencyMax = Math.max(latencyMax, latency);
              picture.dataset.receivedFrames = String(metrics.rendered);
              picture.hidden = false; document.body.classList.add('wm-wallpaper-probe-live');
            }
            bitmap.close();
          } catch { metrics.decodeErrors++; }
          finally { painting = false; if (latest && !stopped && !document.hidden) frameRequest = requestAnimationFrame(paint); }
        }
        const accept = frame => {
          metrics.received++; lastFrameAt = Date.now();
          if (latest) metrics.dropped++;
          latest = { ...frame, jpeg: frame.jpeg.slice() };
          if (!painting && !frameRequest && !document.hidden) frameRequest = requestAnimationFrame(paint);
        };
        const visibility = () => { if (!document.hidden && latest && !frameRequest && !painting) frameRequest = requestAnimationFrame(paint); };
        async function connect() {
          if (stopped) return;
          try {
            const response = await fetch('/whale-wallpaper-probe/stream', { signal: request.signal, cache: 'no-store' });
            if (!response.ok || !response.body) throw new Error('Capture unavailable');
            const decoder = new FrameDecoder(accept), reader = response.body.getReader();
            try {
              while (!stopped) { const { value, done } = await reader.read(); if (done) break; decoder.push(value); }
              if (!stopped) decoder.finish();
            } finally { reader.releaseLock(); }
          } catch { /* Missing source or aborted stream is handled by the freshness check. */ }
          if (!stopped) { hide(); button.textContent = '壁纸实验：等待画面'; reconnect = setTimeout(connect, 1000); }
        }
        let previousRendered = 0, previousTick = performance.now();
        const timer = setInterval(() => {
          const now = performance.now(), rate = (metrics.rendered - previousRendered) * 1000 / (now - previousTick);
          previousRendered = metrics.rendered; previousTick = now;
          if (!lastFrameAt || Date.now() - lastFrameAt > 3000) { hide(); button.textContent = '壁纸实验：等待画面'; }
          else button.textContent = `壁纸实验 · ${rate.toFixed(1)} 帧/秒 · 停止`;
          report();
        }, 1000);
        button.onclick = () => stop(true);
        const escape = event => { if (event.key === 'Escape') stop(true); };
        window.addEventListener('keydown', escape); document.addEventListener('visibilitychange', visibility);
        connect();
        return () => { stop(); window.removeEventListener('keydown', escape); document.removeEventListener('visibilitychange', visibility); picture.remove(); button.remove(); css.remove(); };
      }, 'wallpaper probe: memory stream background');
    } };
  },
});
