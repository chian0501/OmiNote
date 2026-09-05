from pathlib import Path
import json,base64,zipfile,io,runpy,time,os
from PIL import Image
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1];OUT=Path(os.environ.get('SCREENSHOT_QA_DIR',ROOT/'tests/screenshot-qa-output'));OUT.mkdir(parents=True,exist_ok=True)
HTML=runpy.run_path(str(ROOT/'tests/explanation-integrated-build.py'))['build']();(OUT/'integrated.html').write_text(HTML)
results=[];errors=[];failure=None
def check(label,condition):
 results.append({'test':label,'pass':bool(condition)});print(('PASS ' if condition else 'FAIL ')+label,flush=True)
 if not condition:raise AssertionError(label)
def png(page):return base64.b64decode(page.evaluate('(()=>{let c=document.createElement("canvas");renderCanvas(c);return c.toDataURL()})()').split(',')[1])
def load(page):
 page.evaluate('''async()=>{const p=projectPayload();p.data.blocks=[block('title','<span style="font-size:56px;font-weight:800">累積提醒修正測試</span>'),block('subtitle','每一幕保留前面資訊'),block('body','第一項說明'),block('body','第二項說明'),block('body','第三項說明')];p.data.note={enabled:true,text:'小提醒：這段在最後一幕才出現。',size:24,color:'#29A6A7',revealMode:'after',usePreviousImage:true};p.data.sequence={enabled:true,visibleCount:1,frames:[]};p.assets.sequence_images=p.data.blocks.slice(2).map((b,i)=>{const c=document.createElement('canvas');c.width=400;c.height=450;const x=c.getContext('2d');x.fillStyle=['#C63831','#348C58','#3464C6'][i];x.fillRect(0,0,400,450);const name='frame-'+(i+1)+'.png';p.data.sequence.frames.push({blockId:b.id,image:{...p.data.image,name,fit:'cover'}});return{block_id:b.id,name,mime_type:'image/png',data_url:c.toDataURL()}});await loadProjectPayload(p);}''');page.wait_for_timeout(160)
def fresh(browser,w=1600,h=1000):
 page=browser.new_page(viewport={'width':w,'height':h},accept_downloads=True);page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept());page.set_content(HTML);page.wait_for_function('window.ONEExplanationWorkspace');page.wait_for_timeout(180);return page
try:
 with sync_playwright() as p:
  b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
  page=fresh(b)
  check('default title is 56px',page.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs[0].style.size===56'))
  check('mode heading and description inline',page.locator('#contentMode').evaluate('(e)=>Math.abs(e.querySelector("b").getBoundingClientRect().top+e.querySelector("b").offsetHeight/2-e.querySelector("span").getBoundingClientRect().top-e.querySelector("span").offsetHeight/2)<3'))
  page.locator('#contentTemplatePicker summary').click();page.wait_for_timeout(60)
  check('exactly 4 visible templates',page.locator('#templateButtons button:visible').count()==4)
  check('four templates one row',page.locator('#templateButtons button:visible').evaluate_all('(els)=>new Set(els.map(e=>Math.round(e.getBoundingClientRect().top))).size===1'))
  check('template warning merged in heading / no extra paragraph',not page.locator('#contentTemplatePicker .ui-fold-help').is_visible())
  page.locator('#contentTemplatePicker summary').click()
  check('style preset removed from UI',not page.locator('#stylePreset').is_visible())
  check('font and color controls same row',page.evaluate('Math.abs(document.getElementById("boldBtn").getBoundingClientRect().top-document.getElementById("fontSizeVisualButton").getBoundingClientRect().top)<4&&Math.abs(document.getElementById("boldBtn").getBoundingClientRect().top-document.querySelector(".toolbar-swatch").getBoundingClientRect().top)<4'))
  check('sequence controls under canvas',page.locator('#sequenceStrip').evaluate('(e)=>!!e.closest(".preview-panel")&&e.getBoundingClientRect().top>=document.getElementById("previewCanvas").getBoundingClientRect().bottom'))
  check('export dock visible without page scroll',page.locator('.export-bar').evaluate('(e)=>e.getBoundingClientRect().bottom<=innerHeight'))
  check('no repeated px option labels',page.evaluate('[...document.getElementById("fontSizeSelect").options].every(o=>!o.textContent.includes("px px"))'))
  # Mixed format + note and frame serialization.
  load(page)
  check('three body items + independent reminder = four frames',page.evaluate('state.sequence.frames.length===4'))
  check('reminder frame inherits previous image',page.evaluate('state.sequence.frames[3].image.name==="frame-3.png"&&__ONE_V049__.getSequenceAssets().size===4'))
  dims=[];images=[]
  for i in range(4):
   page.locator('#sequenceVisibleCount').select_option(str(i+1));page.wait_for_timeout(90)
   check('note visibility at frame '+str(i+1),page.evaluate('ONEExplanationSequenceModel.noteVisible(state)')==(i==3))
   data=png(page);im=Image.open(io.BytesIO(data));dims.append(im.size);images.append(data);(OUT/f'frame-{i+1}.png').write_bytes(data)
   if i in [0,3]:page.screenshot(path=str(OUT/f'workspace-frame-{i+1}.png'),full_page=True)
  check('all four PNG dimensions identical',len(set(dims))==1)
  # Note region should be identical across first 3 frames and differ on final.
  region=page.evaluate('(()=>{let l=layoutCard(canvas.getContext("2d"));return [l.textX,l.noteY,l.textRight,l.noteY+l.noteH]})()');region=tuple(map(round,region))
  check('reminder truly absent in early PNG pixels',Image.open(io.BytesIO(images[0])).crop(region).tobytes()==Image.open(io.BytesIO(images[2])).crop(region).tobytes()!=Image.open(io.BytesIO(images[3])).crop(region).tobytes())
  page.locator('#oneNoteReveal').select_option(page.evaluate('state.blocks[3].id'));page.wait_for_timeout(90)
  check('with-step reminder keeps three frames',page.evaluate('state.sequence.frames.length===3'))
  page.locator('#sequenceVisibleCount').select_option('1');check('with second step not visible in first',not page.evaluate('ONEExplanationSequenceModel.noteVisible(state)'))
  page.locator('#sequenceVisibleCount').select_option('2');check('with second step visible in second',page.evaluate('ONEExplanationSequenceModel.noteVisible(state)'))
  page.locator('#oneNoteReveal').select_option('after');page.locator('#sequenceVisibleCount').select_option('4');page.wait_for_timeout(60)
  # Inline reminder really edits canonical note.
  page.evaluate('ONEExplanationWorkspace.openField("note")');page.locator('#oneInlineField textarea').fill('小提醒：現在可以累積，也可以原位修改。');page.keyboard.press('Enter');page.wait_for_timeout(60)
  check('note in-place editing updates state',page.evaluate('state.note.text.includes("原位修改")'))
  # Add then edit new marker through visible structure controls.
  page.locator('#oneOverlayOutline .one-overlay-list > button').click();page.wait_for_timeout(180)
  check('new body becomes current frame immediately',page.evaluate('state.sequence.visibleCount===4&&state.blocks.filter(b=>b.kind==="body").length===4'))
  page.locator('#oneOverlayDone').click();newid=page.evaluate('state.blocks.at(-1).id')
  row=page.locator(f'.one-outline-row[data-id="{newid}"]');row.locator('input[type=checkbox]').check();page.wait_for_timeout(90)
  row.locator('.one-outline-marker').fill('NEW');check('new marker editable',page.evaluate('state.blocks.at(-1).marker.text==="NEW"'))
  page.evaluate('(id)=>ONEExplanationWorkspace.openField("marker",id)',newid);page.locator('#oneInlineField input').fill('004');page.keyboard.press('Enter');page.wait_for_timeout(60)
  check('new marker in-place editable',page.evaluate('state.blocks.at(-1).marker.text==="004"'))
  # Image modal side by side.
  page.locator('#openImageDrawer').click();page.wait_for_timeout(150)
  check('image controls and complete preview side by side',page.locator('.one-drawer-preview').evaluate('(e)=>e.getBoundingClientRect().left>=document.querySelector(".one-drawer-controls").getBoundingClientRect().right'))
  page.screenshot(path=str(OUT/'image-settings.png'));page.locator('#closeImageDrawer').click()
  # Files in one place.
  page.get_by_role('button',name='專案檔案',exact=True).click();page.wait_for_timeout(60)
  check('ZIP / onecard / JSON / reset in one row host',page.evaluate('["exportProject","importProjectBtn","exportJson","resetAll"].every(id=>document.getElementById(id).closest(".one-project-package__row"))'))
  page.screenshot(path=str(OUT/'project-menu.png'));page.locator('#oneProjectDialog header button').click()
  # Restore simple demo before export. The missing new image must not block deliberate tests.
  load(page);page.locator('#sequenceVisibleCount').select_option('4');page.wait_for_timeout(60)
  with page.expect_download() as dl:page.locator('#exportSequenceAll').click()
  archive=zipfile.ZipFile(dl.value.path());names=[n for n in archive.namelist() if n.endswith('.png')]
  check('all-frame export contains reminder fourth PNG',len(names)==4)
  check('exported PNG sequence matches preview renderer',[archive.read(n) for n in names]==[png_data for png_data in [images[0],images[1],images[2],images[3]]])
  with page.expect_download() as dl:page.evaluate('document.getElementById("exportProject").click()')
  payload=json.loads(Path(dl.value.path()).read_text());check('onecard serializes note mode and 4 images',payload['data']['note']['revealMode']=='after' and len(payload['assets']['sequence_images'])==4)
  before=png(page);page.evaluate('(p)=>loadProjectPayload(p)',payload);page.wait_for_timeout(160)
  check('onecard roundtrip preserves current reminder frame pixels',before==png(page))
  with page.expect_download() as dl:page.evaluate('document.querySelector("[data-action=export-package]").click()')
  zip_path=dl.value.path();z=zipfile.ZipFile(zip_path);check('project ZIP includes configuration and image files',len(z.namelist())>=6)
  page.locator('#oneProjectDialog').evaluate('(e)=>e.showModal()');page.locator('[data-one-project-package-ui] input[accept*=zip]').set_input_files(zip_path);page.wait_for_function('document.querySelector("[data-one-project-package-ui] .one-project-package__status").textContent.includes("專案包載入成功")')
  check('project ZIP reload preserves note and step count',page.evaluate('state.note.enabled&&state.note.revealMode==="after"&&state.sequence.frames.length===4'))
  page.locator('#oneProjectDialog header button').click();page.wait_for_timeout(100)
  check('project ZIP reload restores full reminder frame pixels',before==png(page))
  # Gallery inset and new title default without changing imported explicit style.
  page.locator('#galleryMode').click();page.wait_for_timeout(200)
  g=page.evaluate("renderCanvas(document.createElement('canvas'))")
  check('gallery has top / side / bottom inset',g.get('galleryX')==28 and abs(g['galleryY']-g['dividerY']-28)<.01 and 28<=g['height']-g['galleryY']-g['galleryH']<29)
  page.screenshot(path=str(OUT/'gallery-inset.png'))
  page.close()
  for w,h in [(1920,1080),(1366,768),(1024,768),(390,844)]:
   page=fresh(b,w,h);check(f'no page horizontal overflow {w}',page.evaluate('document.documentElement.scrollWidth<=innerWidth+1'));page.close()
  check('no uncaught browser errors',not errors)
  b.close()
except Exception as e:
 failure=str(e);print('STOP',type(e).__name__,str(e),flush=True)
finally:
 report={'results':results,'passed':sum(r['pass'] for r in results),'total':len(results),'errors':errors,'failure':failure};(OUT/'report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2));print(json.dumps(report,ensure_ascii=False),flush=True)

if failure or errors or any(not x["pass"] for x in results):raise SystemExit(1)
