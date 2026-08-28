from pathlib import Path
import json

root = Path('O-Ne-Tools')

pkg = root / 'project-package-v1.js'
text = pkg.read_text(encoding='utf-8')
if 'ai-json-guide-v1.js?v=100' not in text:
    marker = '\n})(window);'
    pos = text.rfind(marker)
    if pos < 0:
        raise SystemExit('project-package closing marker not found')
    insert = '''\n\n  if (typeof document !== 'undefined' && document.readyState === 'loading' && typeof document.write === 'function') {
    document.write('<script src="./ai-json-guide-v1.js?v=100"></' + 'script>');
  } else if (typeof document !== 'undefined' && document.createElement && document.head) {
    var aiGuideScript = document.createElement('script');
    aiGuideScript.src = './ai-json-guide-v1.js?v=100';
    aiGuideScript.onload = function () { if (global.ONEAIJsonGuide) global.ONEAIJsonGuide.wrapProjectPackage(); };
    document.head.appendChild(aiGuideScript);
  }'''
    text = text[:pos] + insert + text[pos:]
    pkg.write_text(text, encoding='utf-8')

readme = root / 'README.md'
r = readme.read_text(encoding='utf-8')
if '## 給 AI 的 JSON 格式提示' not in r:
    section = '''## 給 AI 的 JSON 格式提示

- 12 個可用工具共用 `ai-json-guide-v1.js` V1.0.0；每張卡在右側預覽下方顯示自己的「給 AI 的 JSON 格式」。
- 格式直接依目前各工具真正的 JSON exporter／importer 整理，不另造第二套 schema。
- 每張卡提供「複製完整 AI 指令」「複製 JSON 範例」「下載 JSON 範例」；完整 AI 指令會要求 AI 回傳 UTF-8 `.json` 檔，若介面不能建立附件則只回 raw JSON，不加 Markdown 程式碼框或解說。
- 說明區會列出固定 component/schema、重要 enum、陣列數量與其他必要限制；移動卡等結構型工具也會提示站點／路段等相依規則。
- 評分卡、焦點卡、縮圖品牌框與片尾結算卡會明確標示：JSON 不包含使用者置入圖片位元；需要連圖片一起交付時使用 O-Ne 專案 ZIP。
- AI 產生的 JSON 仍必須由對應工具「載入 JSON」驗證；格式錯誤或卡種不符時，不得視為正式可用檔。

'''
    marker = '## 全工具視覺硬規則'
    if marker not in r:
        raise SystemExit('README insert marker not found')
    r = r.replace(marker, section + marker)
    readme.write_text(r, encoding='utf-8')

registry_path = root / 'one-tools-registry-v1.json'
registry = json.loads(registry_path.read_text(encoding='utf-8'))
registry['version'] = 'V2.19_20260828'
registry['shared_ai_json_guide'] = {
    'version': 'V1.0.0_20260828',
    'tool_count': 12,
    'placement': 'below_preview_right_column',
    'copy_full_ai_prompt': True,
    'copy_json_example': True,
    'download_example_json': True,
    'raw_json_only_instruction': True,
    'schema_source': 'current_tool_exporter_importer',
    'image_binary_policy': 'json_does_not_embed_uploads; use_project_zip_for_images'
}
for tool in registry.get('tools', []):
    if tool.get('status') == 'ready':
        features = tool.setdefault('features', [])
        if 'ai_json_schema_guide' not in features:
            features.append('ai_json_schema_guide')
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

regression = root / 'tests' / 'edit-backup-regression.cjs'
t = regression.read_text(encoding='utf-8')
t = t.replace("assert.strictEqual(registry.version, 'V2.18_20260828');", "assert.strictEqual(registry.version, 'V2.19_20260828');")
old = "for (const feature of ['local_edit_history_5', 'manual_edit_history_save', 'unsaved_edits_not_persisted', 'restore_latest_on_load', 'json_import_restore']) {"
new = "for (const feature of ['local_edit_history_5', 'manual_edit_history_save', 'unsaved_edits_not_persisted', 'restore_latest_on_load', 'json_import_restore', 'ai_json_schema_guide']) {"
if old in t:
    t = t.replace(old, new)
if "registry.shared_ai_json_guide.tool_count" not in t:
    marker = "assert.strictEqual(registry.shared_batch_render.version, 'V1.0.0_20260828');"
    extra = "assert.strictEqual(registry.shared_ai_json_guide.version, 'V1.0.0_20260828');\nassert.strictEqual(registry.shared_ai_json_guide.tool_count, 12);\nassert.strictEqual(registry.shared_ai_json_guide.raw_json_only_instruction, true);\n"
    if marker not in t:
        raise SystemExit('edit-backup regression insertion marker not found')
    t = t.replace(marker, extra + marker)
regression.write_text(t, encoding='utf-8')
