from pathlib import Path
import json

root = Path('O-Ne-Tools')

# 1) AI guide: keep every guide in the same right-side column as its preview.
guide_path = root / 'ai-json-guide-v1.js'
guide = guide_path.read_text(encoding='utf-8')
guide = guide.replace('/* O-Ne shared AI JSON format guide — V1.0.0 */', '/* O-Ne shared AI JSON format guide — V1.0.1 */', 1)
guide = guide.replace("var VERSION = '1.0.0';", "var VERSION = '1.0.1';", 1)

guide = guide.replace(
    "'.one-ai-json-guide{grid-column:2;min-width:0;margin-top:0;padding:16px;border:1px solid #354052;border-radius:14px;background:#111923;color:#d8dee7;font-family:\"Noto Sans TC\",\"Microsoft JhengHei\",sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.18)}',",
    "'.one-ai-json-guide{min-width:0;width:100%;margin:0;padding:16px;border:1px solid #354052;border-radius:14px;background:#111923;color:#d8dee7;font-family:\"Noto Sans TC\",\"Microsoft JhengHei\",sans-serif;box-shadow:0 12px 28px rgba(0,0,0,.18)}',"
)
guide = guide.replace(
    "'.one-ai-json-guide-row{display:grid;grid-template-columns:minmax(430px,.95fr) minmax(0,1.05fr);gap:14px;margin-top:14px}.one-ai-json-guide-row .one-ai-json-guide{grid-column:2}',",
    "'.one-ai-json-guide-stack{min-width:0;width:100%;display:flex;flex-direction:column;gap:14px;align-self:start}.one-ai-json-guide-stack>.panel,.one-ai-json-guide-stack>.preview-panel{width:100%}.app-shell.one-ai-json-guide-enabled{height:auto;min-height:100dvh}',"
)
guide = guide.replace(
    "'@media(max-width:1120px){.one-ai-json-guide,.one-ai-json-guide-row .one-ai-json-guide{grid-column:1/-1}.one-ai-json-guide-row{grid-template-columns:1fr}}'",
    "'@media(max-width:680px){.one-ai-json-guide{padding:13px}.one-ai-json-guide__head{align-items:flex-start;flex-direction:column}}'"
)

start = guide.index('  function insertBelowPreview(panel) {')
end = guide.index('\n\n  function mountGuide(id) {', start)
replacement = '''  function directPreviewPanel(host) {
    if (!host || !host.children) return null;
    var children = Array.prototype.slice.call(host.children);
    for (var i = 0; i < children.length; i++) {
      var child = children[i];
      if (!child || !child.querySelector) continue;
      if (child.classList && child.classList.contains('preview-panel')) return child;
      if (child.querySelector('.preview-wrap,.stage,.canvas-stage,canvas')) return child;
    }
    return null;
  }

  function insertBelowPreview(panel) {
    var workspace = document.querySelector('.workspace');
    var grid = document.querySelector('.grid');
    var host = workspace || grid;
    var previewPanel = directPreviewPanel(host);

    // The stack replaces the preview panel at the exact same grid position. This means
    // two-column tools keep it in the right column, while each tool's own responsive
    // breakpoint can naturally collapse the same stack to one column without hardcoding widths.
    if (host && previewPanel && previewPanel.parentNode === host) {
      var stack = document.createElement('div');
      stack.className = 'one-ai-json-guide-stack';
      host.insertBefore(stack, previewPanel);
      stack.appendChild(previewPanel);
      stack.appendChild(panel);
      var shell = host.closest ? host.closest('.app-shell') : null;
      if (shell && shell.classList) shell.classList.add('one-ai-json-guide-enabled');
      return;
    }

    var preview = document.querySelector('.preview-panel') || document.querySelector('.preview-wrap') || document.querySelector('.stage') || document.querySelector('.canvas-stage');
    var container = preview && preview.classList && preview.classList.contains('preview-panel') ? preview : (preview && preview.parentNode);
    if (container && container.parentNode) {
      container.parentNode.insertBefore(panel, container.nextSibling);
      return;
    }
    (document.querySelector('.app') || document.body).appendChild(panel);
  }'''
guide = guide[:start] + replacement + guide[end:]
guide_path.write_text(guide, encoding='utf-8')

# 2) Bust the AI guide child-script cache when the shared project package loads it.
pkg_path = root / 'project-package-v1.js'
pkg = pkg_path.read_text(encoding='utf-8')
if "ai-json-guide-v1.js?v=100" not in pkg:
    raise SystemExit('project-package AI guide loader marker not found')
pkg = pkg.replace('ai-json-guide-v1.js?v=100', 'ai-json-guide-v1.js?v=101')
pkg_path.write_text(pkg, encoding='utf-8')

# 3) Keep README and registry as the system-level source of truth for placement.
readme_path = root / 'README.md'
readme = readme_path.read_text(encoding='utf-8')
readme = readme.replace(
    '- 12 個可用工具共用 `ai-json-guide-v1.js` V1.0.0；每張卡在右側預覽下方顯示自己的「給 AI 的 JSON 格式」。',
    '- 12 個可用工具共用 `ai-json-guide-v1.js` V1.0.1；每張卡的「給 AI 的 JSON 格式」與右側預覽卡放在同一欄，緊接於預覽卡下方；左側編輯／暫存／ZIP／批次區不會被插入此說明。'
)
readme_path.write_text(readme, encoding='utf-8')

registry_path = root / 'one-tools-registry-v1.json'
registry = json.loads(registry_path.read_text(encoding='utf-8'))
registry['version'] = 'V2.20_20260828'
shared = registry.get('shared_ai_json_guide') or {}
shared['version'] = 'V1.0.1_20260828'
shared['placement'] = 'same_right_column_directly_below_preview'
shared['layout_strategy'] = 'wrap_preview_and_guide_in_same_grid_item'
shared['left_controls_untouched'] = True
registry['shared_ai_json_guide'] = shared
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

# 4) Regression expectations.
ai_test_path = root / 'tests' / 'ai-json-guide-regression.cjs'
ai_test = ai_test_path.read_text(encoding='utf-8')
ai_test = ai_test.replace("assert.strictEqual(guide.version, '1.0.0');", "assert.strictEqual(guide.version, '1.0.1');")
ai_test = ai_test.replace("assert(guideSource.includes('grid-column:2'));", "assert(guideSource.includes('one-ai-json-guide-stack'));\nassert(guideSource.includes('stack.appendChild(previewPanel)'), 'preview must remain above the guide in the same stack');\nassert(guideSource.includes('stack.appendChild(panel)'), 'guide must be appended directly below preview');\nassert(guideSource.includes('directPreviewPanel(host)'), 'placement must resolve the actual right-side preview panel');\nassert(!guideSource.includes('one-ai-json-guide-row'), 'guide must not create a separate full-width row outside the preview column');")
ai_test = ai_test.replace("assert(packageSource.includes('ai-json-guide-v1.js?v=100'), 'project package must synchronously load AI JSON guide');", "assert(packageSource.includes('ai-json-guide-v1.js?v=101'), 'project package must synchronously load the cache-busted AI JSON guide');")
ai_test_path.write_text(ai_test, encoding='utf-8')

edit_test_path = root / 'tests' / 'edit-backup-regression.cjs'
edit_test = edit_test_path.read_text(encoding='utf-8')
edit_test = edit_test.replace("assert.strictEqual(registry.version, 'V2.19_20260828');", "assert.strictEqual(registry.version, 'V2.20_20260828');")
edit_test = edit_test.replace("assert.strictEqual(registry.shared_ai_json_guide.version, 'V1.0.0_20260828');", "assert.strictEqual(registry.shared_ai_json_guide.version, 'V1.0.1_20260828');")
marker = "assert.strictEqual(registry.shared_ai_json_guide.raw_json_only_instruction, true);"
extra = "\nassert.strictEqual(registry.shared_ai_json_guide.placement, 'same_right_column_directly_below_preview');\nassert.strictEqual(registry.shared_ai_json_guide.left_controls_untouched, true);"
if extra.strip() not in edit_test:
    if marker not in edit_test:
        raise SystemExit('edit-backup shared AI guide marker not found')
    edit_test = edit_test.replace(marker, marker + extra)
edit_test_path.write_text(edit_test, encoding='utf-8')
