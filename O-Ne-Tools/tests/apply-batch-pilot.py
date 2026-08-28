from pathlib import Path
import json

pkg = Path('O-Ne-Tools/project-package-v1.js')
text = pkg.read_text(encoding='utf-8')
if 'batch-render-v1.js?v=100' not in text:
    marker = "  wrapEditBackup();\n})(window);"
    insert = (
        "  wrapEditBackup();\n\n"
        "  if (typeof document !== 'undefined' && document.readyState === 'loading' && typeof document.write === 'function') {\n"
        "    document.write('<script src=\"./batch-render-v1.js?v=100\"></' + 'script>');\n"
        "  } else if (typeof document !== 'undefined' && document.createElement && document.head) {\n"
        "    var batchScript = document.createElement('script');\n"
        "    batchScript.src = './batch-render-v1.js?v=100';\n"
        "    document.head.appendChild(batchScript);\n"
        "  }\n"
        "})(window);"
    )
    if marker not in text:
        raise SystemExit('project-package loader marker not found')
    pkg.write_text(text.replace(marker, insert), encoding='utf-8')

readme = Path('O-Ne-Tools/README.md')
r = readme.read_text(encoding='utf-8')
if '## 同卡種批次出圖' not in r:
    section = (
        "## 同卡種批次出圖\n\n"
        "- 12 個可用工具共用 `batch-render-v1.js` V1.0.0，會在「完整專案包」下方顯示「批次出圖」。\n"
        "- 同一次批次只接受目前工具的檔案，最多 20 份、總量 200 MB；可混選 `.json` 與 `.zip`。\n"
        "- 純文字工具可直接批次讀取原本 JSON；評分卡、焦點卡、縮圖品牌框、片尾結算卡等圖片型工具，批次模式要求使用 ZIP 專案包，避免輸出缺少置入圖片的殘缺 PNG。\n"
        "- ZIP 若含專案包內建 PNG，批次會直接取用該 PNG；沒有 PNG 時才開啟隱藏同頁工作器重新套用設定並渲染，不會覆蓋目前正在編輯的畫面。\n"
        "- 批次前會逐份驗證卡種與格式，顯示「可輸出／請改 ZIP／格式錯誤／卡種不符」；錯誤檔不會混入輸出。\n"
        "- 完成後只下載一個 `O-Ne_字卡名稱_批次輸出_YYYYMMDD.zip`，裡面是依「字卡名稱＋卡片標題」命名的 PNG；同名檔自動加 `_02`、`_03`。\n"
        "- 可按「停止」中止後續處理；已完成的 PNG 仍會打包下載。\n\n"
    )
    marker = '## 全工具視覺硬規則'
    if marker not in r:
        raise SystemExit('README insert marker not found')
    readme.write_text(r.replace(marker, section + marker), encoding='utf-8')

registry_path = Path('O-Ne-Tools/one-tools-registry-v1.json')
registry = json.loads(registry_path.read_text(encoding='utf-8'))
registry['version'] = 'V2.18_20260828'
registry['shared_batch_render'] = {
    'version': 'V1.0.0_20260828',
    'mode': 'same_tool_json_zip_to_png_zip',
    'max_files': 20,
    'max_total_bytes': 209715200,
    'mixed_json_zip_input': True,
    'image_tool_json_policy': 'zip_project_package_required',
    'zip_embedded_png_fast_path': True,
    'isolated_worker_render_fallback': True,
    'output': 'single_png_zip',
    'stop_supported': True
}
for tool in registry.get('tools', []):
    if tool.get('status') == 'ready':
        features = tool.setdefault('features', [])
        if 'same_tool_batch_render' not in features:
            features.append('same_tool_batch_render')
registry_path.write_text(json.dumps(registry, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')

regression = Path('O-Ne-Tools/tests/edit-backup-regression.cjs')
t = regression.read_text(encoding='utf-8')
t = t.replace("assert.strictEqual(registry.version, 'V2.17_20260827');", "assert.strictEqual(registry.version, 'V2.18_20260828');")
if 'registry.shared_batch_render.max_files' not in t:
    marker = "assert.strictEqual(registry.shared_edit_backup.history_limit, 5);"
    extra = (
        "assert.strictEqual(registry.shared_batch_render.version, 'V1.0.0_20260828');\n"
        "assert.strictEqual(registry.shared_batch_render.max_files, 20);\n"
        "assert.strictEqual(registry.shared_batch_render.image_tool_json_policy, 'zip_project_package_required');\n"
    )
    if marker not in t:
        raise SystemExit('edit-backup regression marker not found')
    t = t.replace(marker, extra + marker)
regression.write_text(t, encoding='utf-8')
