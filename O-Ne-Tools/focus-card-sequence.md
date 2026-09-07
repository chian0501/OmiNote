# 焦點卡 V0.6.0：累積圖片與完整專案

沿用 `focus-card.html` 的正式卡體、文字引擎、裁切與 `o-ne.project-package.v1` 專案格式。

## 製作

1. 選「項目」或「步驟」，輸入 1–8 項內容，開啟預覽上方的「累積出現」。
2. 選擇單圖、上下／並排雙圖、上 1 下 2、左 1 右 2 或 2×2 四格，逐格置入圖片。
3. 圖片出現方式可選全部固定、逐格累積或單步切換。當幕設定可覆寫各格的自動狀態，另選外框、數字徽章、主圖突出或無標示。
4. 「複製上一幕」複製上一幕的實際顯示結果。「本幕恢復自動」只清除當幕覆寫。
5. 「輸出全部幕 PNG ZIP」輸出依序編號、同尺寸的透明 PNG。「專案檔案 → 下載專案包 ZIP」一次保存全部幕 PNG、所有模式的編輯設定、原圖與裁切。

文字與圖片格位依完整內容量計算；後面的項目未出現時保留位置。開啟累積時，當項為 focus，前項 idle，後項不繪製。關閉累積即恢復原先各列的手動狀態。一般內文不拆幕。

各格的原圖與裁切由所有幕共用；各幕可獨立控制顯示狀態與標示。每幕替換原圖、獨立裁切、箭頭及放大圈留待後續版本。

## AI JSON

`schema = o-ne.focus-card.ready.v0.6.0`。舊 `o-ne.focus-card.ready.*` 可載入；缺少 sequence 的舊卡預設關閉累積。JSON 保存目前模式的所有項目與累積設定，不含原圖。完整專案才保存全部模式及所有原圖。

累積設定放在 `content.sequence`，不另造平行 schema：

```json
{
  "enabled": true,
  "step": 1,
  "imageMode": "accumulate",
  "effect": "frame",
  "frames": [
    {"states": ["focus", "hidden", "auto", "auto"], "effects": ["inherit", "inherit", "inherit", "inherit"]},
    {"states": ["dim", "focus", "auto", "auto"], "effects": ["inherit", "badge", "inherit", "inherit"]}
  ]
}
```

`frames` 數量必須等於 `content.items`；`step` 從 1 開始。每幕的四格陣列依序對應 `images.left`、`images.right`、`images.third`、`images.fourth`。狀態為 auto／hidden／show／focus／dim；標示為 inherit／frame／badge／spotlight／none。

`images.placement` 支援 left／right／both、stack-left／stack-right、pair-left／pair-right、triple-top-left／triple-top-right、triple-side-left／triple-side-right、grid-left／grid-right。寬度 `scale` 為 18–45%。各圖片的 contain／cover／free、縮放、位置及裁切欄位沿用原規格。

## 打包與讀取

- 新專案以 `焦點卡-標題-完整專案.project.zip` 交付。包內 `project.json` 為既有專案 schema；原圖在 assets，全部幕 PNG 在根層。
- 所有已置入原圖都會保存，包括暫時隱藏或位於其他排版的圖片，最多四張；不把原圖烘焙成成品取代。
- 舊焦點卡 ZIP 可讀取；副檔名 `.onecard` 也可用於同一焦點卡 ZIP 結構。其他工具的專案不可混用。
- 載入會先驗證工具、JSON、逐幕狀態、ZIP 校驗碼、原圖與圖片雜湊，全部成功才一次還原。失敗保留原編輯內容。
- 復原／重做保留最多 40 次編輯狀態，包含圖片與裁切；這是當次工作階段的操作記錄。持久保存仍使用手動暫存或專案 ZIP。

## 驗收與回滾

真實 Chromium 驗收：`tests/focus-sequence.browser.spec.cjs`，由既有 Card workspace browser QA 執行；包括可見累積、固定位置、PNG 像素一致、全專案往返、錯誤不覆寫、舊檔、復原與手機介面。

沿用既有 main 為發布前回復點；整個功能以同一 PR 交付。若需回滾，回退該 PR 的完整提交，避免只回退 HTML 或共用打包介面其中一部分。
