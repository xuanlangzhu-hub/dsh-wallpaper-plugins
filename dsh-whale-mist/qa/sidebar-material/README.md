# Sidebar proportions and material

`material.test.mjs` checks the actual sidebar API, its editor/session gates, errors,
and actual client settings normalization. `fixture.mjs` substitutes React hooks and
DSH services; it does not simulate browser input or native playback.

```sh
node --test --test-timeout=12000 qa/sidebar-material/material.test.mjs
```

`sdk-checks.mjs` exports `assertPixsoControls` for the existing isolated rc.3 SDK
browser harness. It requires a fresh output directory, a mounted actual SDK,
`qa.observation()` / `qa.setAppearance()`, and a real Host API with native IO
substituted. It checks inherited typography, clear/frosted UI changes, persistence,
the unchanged active generation, width adaptation and author slider submissions.

The bounded 2026-10-31 run and input fingerprints are under
`.tmp/pixso-ui-proportion-material-sdk-20261031-b`. Static VNode/CSS measurements
are separately under `.tmp/pixso-ui-proportion-material-20261031-a` and are not
equivalent to SDK or desktop acceptance. See
`docs/PIXSO_UI_PROPORTION_MATERIAL_REPAIR_20261031.md` at the repository root.
