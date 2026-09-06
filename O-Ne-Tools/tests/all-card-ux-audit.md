# All card tools: usability acceptance

Coverage: general, trigger, persistent, effect, move, choice, challenge, dialogue,
rating, focus, explanation, thumbnail frame, settlement.

The audit follows opening a tool, editing text/images, previewing, exporting, saving,
and restoring. Live production screens were reviewed before implementation.

## Findings addressed

- Small cards left large empty stages; large cards pushed export actions below the
  desktop viewport. Measure each toolbar/footer and fit the stage to native pixels.
- Project import feedback was left inside the hidden history tab. Surface results
  in the active project panel. Put complete ZIP before JSON and separate reset.
- Reset and clearing manual history could discard work immediately. Confirm those
  actions, preserve content on cancel, and provide Ctrl/Cmd+S for manual save.
- Move's input event was interpreted as a color override, so orange reverted to
  white while editing. Validate overrides and download both PNGs in one ZIP.
- Fold labels included internal hints and failed to reflect manually closed groups.
  Keep concise titles and synchronize the fold-all button.
- Explanation exposed stale pilot labels, output counts and unnamed formatting
  buttons. Keep labels synchronized, limit invalid ordering/deletion actions, and
  collapse unused reminder settings.
- Challenge exposed internal source identifiers; retain only relevant editing
  instructions and announce the selected action/answer.

## Merge gate

1. Run the Chromium workflow against the exact PR commit, with approved artwork
   baseline fc28b288f27e5dd2d365b048433dffc7b1540116.
2. Require desktop and mobile geometry, unchanged renderer pixels, direct editing,
   independent image crops, PNG/JSON/ZIP downloads and project restoration.
3. Include move color + paired export, keyboard save + reload, failed import
   feedback, cancelled reset/history clear, and explanation project round trip.
4. Inspect screenshots from that workflow; tests alone do not grant visual approval.
5. Merge only the inspected commit, then verify Pages and deployed file bytes.
