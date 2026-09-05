# Explanation Card — screenshot repair V2

Status: CANDIDATE / INTERNAL_REVIEW_ONLY. Same PR #68; main and deployment unchanged.
Base pilot: `ded63522708602097fef6e99b5bfe4abfbdbaa72`.
Runtime: `SCREENSHOT_REPAIR_V2_20260905`.

## Original screenshot acceptance map

| Request | Candidate implementation / evidence |
| --- | --- |
| Mode descriptions inline | Heading and description centers checked. |
| Compact template heading | Help moved into the heading and switch confirmation. |
| Four templates in one desktop row | Standard, timeline, ABCD, steps; hidden legacy templates remain readable on import. |
| One formatting row; remove style preset | Existing controls reused; no duplicate format implementation. |
| Default title 56px | New template titles 56px; imported explicit 68px retained. |
| Sequence controls below preview | Current frame, image and PNG controls grouped below the Canvas. |
| Cumulative reminder | Independent final frame OR first appears with a selected body frame. Actual PNG pixels checked. |
| Image dialog side-by-side | Settings left; complete live preview right. |
| Gallery image padding | 28px inset; all six layouts checked. |
| Checkbox/marker/action alignment | Original editor vertical centers checked; compact outline controls aligned. |
| New marker editable | Outline and in-place marker input tested; state lookup by stable block ID. |
| New item visible in preview | Adds advance through real sequence-image API; delayed focus cannot steal a newer selection. |
| Consolidated files | Top project dialog; ZIP, onecard, JSON and reset in the same action host. |

## Reminder semantics

`note.revealMode='after'` creates an independent final frame. With three body rows, frame count is four. Frames 1–3 exclude reminder text AND border. Frame 4 includes them. All frames use final-layout geometry, so card/image dimensions and earlier text positions do not jump.

`note.revealMode='with'` plus `note.revealBlockId` starts the reminder with that body row and keeps it in later frames; no extra frame is created. Independent reminder frames inherit the previous image/crop by default; changing their image disables inheritance. Existing note and block data remain the source; the reminder frame has a stable internal ID, not a fake body row.

New timing fields roundtrip through `.onecard` and full project ZIP in this candidate. Older application versions can read the container but do not implement the new timing semantics.

## Executed locally

- Screenshot/sequence/file integration: **40/40 PASS**.
- Editor, simulated Chinese composition, alignment and six Gallery layouts: **14/14 PASS**.
- Existing repository regression scripts: **13/13 PASS**, unchanged.
- Browser uncaught exceptions: **0** in both candidate suites.
- Four cumulative PNG exports match separately rendered preview PNG bytes; full project ZIP and onecard roundtrips preserve final-frame pixels.

These are local Chromium tests using actual application code assembled offline. They are not GitHub CI or a live-site certification. Simulated composition uses CDP; it is not real Windows input-method testing.

## Reproduce

Requires Python, Playwright, Pillow, Node and Chromium at `/usr/bin/chromium`.

```sh
SCREENSHOT_QA_DIR=/tmp/one-repair python O-Ne-Tools/tests/explanation-screenshot-repair-runtime.py
SCREENSHOT_QA_DIR=/tmp/one-repair python O-Ne-Tools/tests/explanation-screenshot-editor-runtime.py
for test in O-Ne-Tools/tests/*regression.cjs; do node "$test" || exit 1; done
```

`tests/explanation-integrated-build.py` builds the standalone candidate. No fonts, credentials or private user media are embedded. Test images are synthetic fixtures only.

## Candidate assembly and rollback

Ordinary `explanation-card.html` remains untouched. The opt-in `explanation-card-overlay-pilot.html` assembles the existing application with `explanation-card-screenshot-repair-v2.json`: exact source SHA-256, unique replacement, then exact result SHA-256. A changed source fails closed. The standalone builder uses the same manifest. This is an explicit, reviewable candidate source patch, not an unversioned runtime guess.

The first-stage pilot and its 32/35-test results remain in Git history. This checkpoint supersedes its incomplete screenshot-repair scope. No main merge, workflow, credentials, permissions or deployment changes are included. Rollback is opening the ordinary entry or reverting this candidate commit.

## Remaining verification gates

Real Windows Zhuyin/Pinyin candidate window, macOS IME and Firefox/Safari are unverified. HTTP iframe launcher and origin localStorage were not verified: the container browser rejected localhost navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`. Multi-line Rich Text still safely falls back to the original editor; this is not a free-form layout editor. Existing multi-project batch-worker transport was not revalidated. Review the actual interface and approve deployment separately; do not interpret test counts as publication approval.
