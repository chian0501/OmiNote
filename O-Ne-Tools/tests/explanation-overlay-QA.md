# Explanation Card Overlay Pilot — QA checkpoint

Status: SAMPLE / PILOT. Not a release or deployment approval.
Base: `d3ad18e30075bb5cfd23584a80e0fcfd1f9f234d`.
Branch: `codex/explanation-card-overlay-pilot-v1`.

## Implemented

- Actual existing `#wordPage .rich` DOM is temporarily moved over the Canvas, not copied into a second text store.
- Single rendered-line title, subtitle and body edits reuse FORMAT_CORE_V3 commands, canonical data and undo/redo.
- Composition-aware input; Enter used to confirm an IME candidate does not close the editor. Native OS candidate-window placement is still a manual gate.
- Collapsible content outline selects existing blocks, including later cumulative steps, through the real V0.4.9 per-step image API. Adding an item calls the original structure command.
- Clicking the card image opens the current step's original image settings.
- Multi-line content, overflow and Gallery fall back to the original editor without deleting text.
- Actual PNG, `.onecard`, project ZIP export/import and cumulative PNG ZIP use existing serializers/renderers.
- Detached export canvases receive the document language so Traditional Chinese glyph selection matches the visible Canvas.
- The ordinary `explanation-card.html` entry and all production CSS are unchanged. The opt-in launcher is `explanation-card-overlay-pilot.html`.

## Code boundary

The existing format core only adds `beginExternalInput()`, a history checkpoint that does not rebuild editable DOM during composition, and exposes it on its existing API. No new formatting engine, persistent data schema, freeform layout engine or dependency was introduced.

## Executed locally

1. **Full runtime smoke: 32/32 PASS**, no uncaught browser errors. Uses actual production HTML/CSS and the deployed V0.4.9, Gallery, shared backup/package and FORMAT_CORE_V3 scripts. Script transport alone is inlined to run offline. Three synthetic colored images verify per-step asset order, fixed dimensions, `.onecard` and full project ZIP roundtrips.
2. **Isolated editor interaction: 35/35 PASS**, no uncaught browser errors. Covers partial formats, painter, same-node editing, input after undo, composition Enter, same-ID import replacement, add/undo, multi-line fallback and coordinate mapping at 1600/1366/1024/768/390 px. Title glyph bounds agree within two displayed pixels in the tested fixture. This fixture is not a full responsive-layout certification.
3. **Existing repository regressions: all 13 `tests/*regression.cjs` scripts PASS.** No existing test was weakened or modified.

Full runtime test:

```sh
CHROMIUM_PATH=/usr/bin/chromium \
OVERLAY_QA_DIR=/tmp/explanation-overlay-qa \
python O-Ne-Tools/tests/explanation-overlay-full-runtime.py
```

Requires Python with Playwright and Pillow, plus Chromium. The test writes a standalone HTML sample, screenshots, exports and a machine-readable report to the specified directory. No network requests, credential changes or workflow activation are needed.

Existing regression scripts:

```sh
for test in O-Ne-Tools/tests/*regression.cjs; do node "$test" || exit 1; done
```

The isolated harness, its fixture and detailed result JSON are retained in the delivered QA archive. The checked-in full-runtime test provides independent coverage of the actual full application.

## Bugs found and fixed during the pilot

- Opening an editor must not create a no-op undo transaction; otherwise undoing an added row gets stuck.
- Same-ID project import must not be overwritten by stale overlay DOM during blur/canonicalization.
- Composition snapshots must not rebuild active contenteditable nodes while the browser is composing text.
- Main Canvas and detached export Canvas can choose different localized Han glyphs when language is only inherited; set an explicit document language on export targets.

## Still unverified / not implemented

- Real Windows Zhuyin/Pinyin candidate popup and selection behavior; macOS IME; Safari/Firefox.
- Native-origin localStorage persistence and the network-served iframe launcher.
- Exact multi-line DOM/Canvas parity. Multi-line content deliberately returns to the old editor.
- Direct editing of paragraph markers and reminder text; reminder sequence timing policy.
- Full 13-item UI redesign: project management at top, condensed toolbar/templates, default title 56px, image modal split layout, Gallery padding and remaining alignment work.

No claim that all UI requests are complete. Keep the PR draft and do not merge/deploy until the remaining pilot review and explicit publication gate are satisfied.
