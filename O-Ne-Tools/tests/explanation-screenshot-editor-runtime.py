from pathlib import Path
import runpy,json,os
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];HTML=runpy.run_path(str(ROOT/'tests/explanation-integrated-build.py'))['build']();results=[];errors=[];failure=None
def ck(n,v):
 results.append({'test':n,'pass':bool(v)});print('PASS' if v else 'FAIL',n,flush=True)
 if not v:raise AssertionError(n)
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',args=['--no-sandbox']);page=b.new_page(viewport={'width':1600,'height':1000});page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.set_content(HTML);page.wait_for_function('window.ONEExplanationWorkspace');page.wait_for_timeout(180)
  page.evaluate('ONEExplanationOverlayPilot.open(state.blocks[0].id)');page.keyboard.press('Control+a');page.keyboard.insert_text('原位即時修改');page.locator('#fontSizeVisualButton').click();page.locator('[data-size="48"]').click();ck('integrated toolbar changes on-canvas title',page.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs[0].style.size===48'))
  page.keyboard.press('Control+z');page.wait_for_timeout(100);ck('integrated on-canvas undo',page.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs[0].style.size===56'))
  page.evaluate('ONEExplanationOverlayPilot.finish();state.blocks[2].html=\'<span style="color:#FFBE37;font-weight:800">黃字</span>與白字\';renderEditor();renderCanvas();ONEExplanationOverlayPilot.open(state.blocks[2].id)')
  page.evaluate('(()=>{const e=document.querySelector(".one-overlay-active .rich"),n=e.querySelector("span").firstChild,r=document.createRange();r.setStart(n,0);r.setEnd(n,2);getSelection().removeAllRanges();getSelection().addRange(r);saveSelection()})()');page.locator('#underlineBtn').click();ck('integrated partial rich styles preserved',page.evaluate('(()=>{let r=htmlToParagraphs(state.blocks[2].html,"body")[0].runs;return r[0].style.underline&&!r[1].style.underline})()'))
  page.evaluate('ONEExplanationOverlayPilot.finish();ONEExplanationOverlayPilot.open(state.blocks[0].id)');original=page.evaluate('state.blocks[0].html');page.keyboard.press('Control+a');cdp=page.context.new_cdp_session(page);cdp.send('Input.imeSetComposition',{'text':'ㄓㄨˋ','selectionStart':3,'selectionEnd':3});ck('integrated Chinese composition does not sync unfinished text',page.evaluate('ONEExplanationOverlayPilot.state().composing') and page.evaluate('state.blocks[0].html')==original)
  cdp.send('Input.insertText',{'text':'注音完成'});page.wait_for_timeout(100);ck('integrated Chinese composition commit',page.evaluate('state.blocks[0].html.includes("注音完成")'))
  page.evaluate('ONEExplanationOverlayPilot.finish();ONEExplanationOverlayPilot.showOriginal();');page.wait_for_timeout(100)
  ck('original checkbox and body/action vertical centers aligned',page.evaluate('(()=>{const row=document.querySelector("#wordPage .rich[data-kind=body]").closest(".edit-block"),c=e=>{const r=e.getBoundingClientRect();return r.top+r.height/2};return Math.abs(c(row.querySelector("input[type=checkbox]"))-c(row.querySelector(".rich")))<3&&Math.abs(c(row.querySelector(".block-actions"))-c(row.querySelector(".rich")))<3})()'))
  page.evaluate('const p=projectPayload();p.data.blocks[0].html=\'<span style="font-size:68px">舊專案字級不變</span>\';loadProjectPayload(p)');page.wait_for_timeout(100);ck('imported explicit title size unchanged',page.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs[0].style.size===68'))
  page.locator('#galleryMode').click();page.wait_for_timeout(160)
  for name in ['single','split','triple','hero-right','hero-bottom','grid']:
   data=page.evaluate('(name)=>{state.gallery.layout=name;return renderCanvas(document.createElement("canvas"))}',name);ck('gallery inset '+name,data['galleryX']==28 and abs(data['galleryY']-data['dividerY']-28)<.01)
  ck('no additional browser exceptions',not errors);b.close()
except Exception as e:failure=str(e);print('STOP',str(e),flush=True)
finally:
 out=Path(os.environ.get('SCREENSHOT_QA_DIR',ROOT/'tests/screenshot-qa-output'));out.mkdir(parents=True,exist_ok=True);(out/'extra-report.json').write_text(json.dumps({'results':results,'errors':errors,'failure':failure},ensure_ascii=False,indent=2))
if failure or errors or any(not x['pass'] for x in results):raise SystemExit(1)
