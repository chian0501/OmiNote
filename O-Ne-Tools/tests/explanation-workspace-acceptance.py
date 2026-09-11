"""Reproducible screenshot-requirement acceptance tests for PR68 integrated V2.
Run: WORKSPACE_QA_DIR=/tmp/one-workspace-qa python tests/explanation-workspace-acceptance.py
Requires Playwright, Pillow and Chromium (CHROMIUM_PATH override).
Loads exact repository CSS/JS via offline inlining. Does not validate live Pages,
HTTP iframe launcher, native-origin localStorage or real OS IME candidate windows.
No source artwork, account data or fonts are embedded in the fixture.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json,base64,io,zipfile,traceback,os,sys,importlib.util
from PIL import Image
ROOT=Path(__file__).resolve().parents[1]
OUT=Path(os.environ.get('WORKSPACE_QA_DIR',ROOT/'tests/workspace-qa-output'));OUT.mkdir(parents=True,exist_ok=True)
source=ROOT/'tests/explanation-overlay-full-runtime.py'
spec=importlib.util.spec_from_file_location('overlay_builder',source)
builder=importlib.util.module_from_spec(spec);spec.loader.exec_module(builder)
HTML=builder.build()
marker="window.addEventListener('DOMContentLoaded',()=>setTimeout(()=>{"
assert marker in HTML, 'Missing Overlay init insertion point'
HTML=HTML.replace(marker,marker+(ROOT/'explanation-card-workspace-v2.js').read_text(encoding='utf-8')+'\n',1)
HTML=HTML.replace('</body>','<style>'+(ROOT/'explanation-card-workspace-v2.css').read_text(encoding='utf-8')+'</style></body>')
(OUT/'integrated.html').write_text(HTML,encoding='utf-8')
checks=[];errors=[];failed=False
def ok(name,value,detail=None):
 checks.append({'name':name,'pass':bool(value),'detail':detail});print(('PASS ' if value else 'FAIL ')+name,flush=True)
 if not value:raise AssertionError(name)
def state(p,expr):return p.evaluate(expr)
def new(b,w=1600,h=1000):
 p=b.new_page(viewport={'width':w,'height':h},accept_downloads=True);p.on('pageerror',lambda e:errors.append(str(e)));p.set_content(HTML);p.wait_for_function('window.ONEExplanationWorkspace&&window.ONEExplanationOverlayPilot');p.wait_for_timeout(650);return p
def finish(p):p.evaluate('ONEExplanationOverlayPilot.finish()');p.wait_for_timeout(70)
def png(p):return base64.b64decode(p.evaluate("(()=>{const out=document.createElement('canvas');renderCanvas(out);return out.toDataURL()})()").split(',')[1])
def openb(p,id):p.evaluate('(id)=>ONEExplanationOverlayPilot.open(id)',id);p.wait_for_timeout(80)
def select(p,start,end):
 p.evaluate('''([a,b])=>{const r=document.createRange(),editor=document.querySelector('.one-overlay-active .rich'),w=document.createTreeWalker(editor,NodeFilter.SHOW_TEXT);let n,i=0,s,e;while(n=w.nextNode()){let l=n.textContent.length;if(!s&&a<=i+l)s=[n,a-i];if(b<=i+l){e=[n,b-i];break;}i+=l;}r.setStart(...s);r.setEnd(...e);getSelection().removeAllRanges();getSelection().addRange(r);saveSelection();}''',[start,end])
def seed(p):
 p.evaluate('''async()=>{const payload=projectPayload();payload.data.blocks=[block('title','累積說明測試'),block('subtitle','三項說明＋一項提醒'),block('body','第一項說明'),block('body','第二項說明'),block('body','第三項說明')];payload.data.note={enabled:false,text:'',size:24,color:BRAND.teal};payload.data.sequence={enabled:true,visibleCount:1,frames:[]};payload.assets.sequence_images=payload.data.blocks.slice(2).map((b,i)=>{const c=document.createElement('canvas');c.width=400;c.height=500;const ctx=c.getContext('2d');ctx.fillStyle=['#cc0000','#00aa00','#0000cc'][i];ctx.fillRect(0,0,400,500);const name='synthetic-'+i+'.png';payload.data.sequence.frames.push({blockId:b.id,image:{...payload.data.image,name,fit:'cover'}});return{block_id:b.id,name,mime_type:'image/png',data_url:c.toDataURL()}});await loadProjectPayload(payload);}''');p.wait_for_timeout(180)
try:
 with sync_playwright() as pw:
  b=pw.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),headless=True,args=['--no-sandbox'])
  p=new(b)
  ok('01 模式名稱與描述同一排',p.evaluate("[...document.querySelectorAll('.mode-btn')].every(b=>{const a=b.querySelector('b').getBoundingClientRect(),c=b.querySelector('span').getBoundingClientRect();return Math.abs(a.y+a.height/2-c.y-c.height/2)<4})"))
  ok('02 範本後果提醒與範本標題同列',p.evaluate("document.querySelector('#contentTemplatePicker summary').contains(document.querySelector('#contentTemplatePicker .ui-fold-help'))"))
  p.locator('#contentTemplatePicker summary').click();p.wait_for_timeout(80)
  ok('03 四個範本保留且同列',p.evaluate("(()=>{const a=[...document.querySelectorAll('#templateButtons .template-btn')];return a.length===4&&new Set(a.map(b=>Math.round(b.getBoundingClientRect().y))).size===1})()"))
  p.locator('#contentTemplatePicker summary').click()
  ok('04 移除常用格式選單且工具同列',p.evaluate("(()=>{const a=[...document.querySelectorAll('.one-format-row > *')];return document.getElementById('stylePreset').hidden&&new Set(a.map(b=>Math.round(b.getBoundingClientRect().y+b.getBoundingClientRect().height/2))).size<=2})()"))
  ok('05 新建主標預設56px',p.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs[0].style.size===56'))
  ok('06 幕次與圖片控制位於預覽下方',p.evaluate("document.getElementById('sequenceStrip').parentElement.classList.contains('preview-stack')&&document.getElementById('sequenceStrip').contains(document.getElementById('openImageDrawer'))"))
  ok('13 專案操作集中頂部且底部無重複存檔區',p.evaluate("['exportProject','importProjectBtn','exportJson','resetAll'].every(id=>document.getElementById('oneProjectBar').contains(document.getElementById(id)))&&document.querySelectorAll('#oneProjectFiles [data-action=export-package]').length===1&&[...document.querySelectorAll('.one-after-edit-dock')].every(n=>!n.getBoundingClientRect().height)"))
  p.locator('#oneProjectMenu > summary').click();p.wait_for_timeout(50);p.screenshot(path=str(OUT/'project-menu.png'));p.locator('#oneProjectMenu > summary').click()
  p.locator('#openImageDrawer').click();p.wait_for_timeout(300)
  ok('08 圖片設定與完整預覽左右並排',p.evaluate("(()=>{const a=document.querySelector('.one-image-grid>.drawer-scroll').getBoundingClientRect(),c=document.querySelector('.one-image-result').getBoundingClientRect();return c.x>=a.right&&Math.abs(a.y-c.y)<20})()"))
  p.screenshot(path=str(OUT/'image-dialog.png'));p.locator('#closeImageDrawer').click()
  p.evaluate('__ONE_V040__.setGalleryLayout("triple")');p.wait_for_timeout(150)
  ok('09 純圖片卡四邊內距28px',p.evaluate('lastLayout.galleryX===28&&Math.abs(lastLayout.galleryY-lastLayout.dividerY-28)<1e-6&&lastLayout.height-lastLayout.galleryY-lastLayout.galleryH>=28&&lastLayout.height-lastLayout.galleryY-lastLayout.galleryH<29&&lastLayout.width-lastLayout.galleryX-lastLayout.galleryW===28'))
  p.screenshot(path=str(OUT/'gallery.png'));p.close()
  p=new(b);seed(p)
  p.locator('#oneReminderEnabled').check();p.wait_for_timeout(180);finish(p)
  noteid=p.evaluate('state.note.blockId')
  ok('07 小提醒成為第4個累積項目',p.evaluate('state.blocks.filter(b=>b.kind==="body").length===4&&state.sequence.visibleCount===4&&!!ONEExplanationWorkspace.noteBlock()&&!state.note.enabled'))
  images=[];positions=[]
  for i in range(4):
   p.evaluate('(i)=>__ONE_V049__.activateStep(i)',i);p.wait_for_timeout(50)
   raw=png(p);(OUT/f'step-{i+1}.png').write_bytes(raw);images.append(Image.open(io.BytesIO(raw)).convert('RGBA'))
   positions.append(p.evaluate('({w:canvas.width,h:canvas.height,x:lastLayout.imageX,y:lastLayout.imageY,iw:lastLayout.imageW,ih:lastLayout.imageH,n:lastLayout.inlineNote})'))
  ok('07 前三幕提醒隱藏、第四幕才出現',images[2].crop((724,int(positions[2]['n']['boxY']),1518,int(positions[2]['n']['boxY']+positions[2]['n']['boxH']))).tobytes()!=images[3].crop((724,int(positions[3]['n']['boxY']),1518,int(positions[3]['n']['boxY']+positions[3]['n']['boxH']))).tobytes() and images[0].getpixel((725,int(positions[0]['n']['boxY'])+2))==images[2].getpixel((725,int(positions[2]['n']['boxY'])+2)))
  ok('07 全幕卡片與左圖尺寸固定',len(set((a['w'],a['h'],a['x'],a['y'],a['iw'],a['ih']) for a in positions))==1)
  ok('07 提醒幕自動沿用前一幕圖片',images[2].crop((40,40,600,500)).tobytes()==images[3].crop((40,40,600,500)).tobytes())
  openb(p,noteid);p.keyboard.press('Control+a');p.keyboard.insert_text('小提醒：現在可以逐幕累積');finish(p)
  ok('07 提醒原位編輯同步到唯一block資料',p.evaluate('ONEExplanationWorkspace.noteBlock().html.includes("現在可以逐幕累積")&&state.note.text.includes("現在可以逐幕累積")'))
  # Move the reminder into the middle and ensure it stays visible in later frames.
  row=p.locator(f'.one-structure-row:has([data-overlay-block="{noteid}"])')
  row.locator('button[title="往前移"]').click();p.wait_for_timeout(100)
  ok('07 小提醒可調整出場順序',p.evaluate('state.blocks.filter(b=>b.kind==="body")[2].id===state.note.blockId'))
  p.evaluate('__ONE_V049__.activateStep(2)');p.wait_for_timeout(60);third=png(p)
  p.evaluate('__ONE_V049__.activateStep(3)');p.wait_for_timeout(60);fourth=png(p)
  n=p.evaluate('lastLayout.inlineNote');area=(724,int(n['boxY']),1518,int(n['boxY']+n['boxH']))
  ok('07 出現後後續幕保留同一提醒',Image.open(io.BytesIO(third)).crop(area).tobytes()==Image.open(io.BytesIO(fourth)).crop(area).tobytes())
  # Marker controls: new item and repeated edits, with alignment.
  p.locator('.one-overlay-list > button').filter(has_text='新增').click();p.wait_for_timeout(250);finish(p)
  latest=p.evaluate('state.blocks.filter(b=>b.kind==="body").at(-1).id')
  ok('12 新增項目自動顯示且幕次與圖片一致',p.evaluate('state.sequence.visibleCount===state.blocks.filter(b=>b.kind==="body").length'))
  row=p.locator(f'.one-structure-row:has([data-overlay-block="{latest}"])');row.locator('input[type=checkbox]').check();row.locator('.one-structure-marker').fill('新標記');p.wait_for_timeout(80)
  ok('11 新增項目標記可編輯',p.evaluate('state.blocks.at(-1).marker.text==="新標記"'))
  ok('10 勾選框、標記、正文與按鈕垂直對齊',row.evaluate("n=>{const a=[...n.children].filter(e=>!e.hidden).map(e=>e.getBoundingClientRect()).map(r=>r.y+r.height/2);return Math.max(...a)-Math.min(...a)<3}"))
  p.close()
  p=new(b);seed(p);p.locator('#oneReminderEnabled').check();p.wait_for_timeout(150);finish(p)
  p.evaluate('__ONE_V049__.activateStep(0)');p.wait_for_timeout(60)
  with p.expect_download() as dl:p.locator('#exportSequenceAll').click()
  zdata=Path(dl.value.path()).read_bytes();(OUT/'cumulative.zip').write_bytes(zdata)
  with zipfile.ZipFile(io.BytesIO(zdata)) as z:
   names=z.namelist();ims=[Image.open(io.BytesIO(z.read(n))).convert('RGBA') for n in names]
   ok('累積PNG ZIP包含4幕且尺寸一致',len(names)==4 and len(set(im.size for im in ims))==1)
   n=p.evaluate('lastLayout.inlineNote');box=(724,int(n['boxY']),1518,int(n['boxY']+n['boxH']))
   ok('累積ZIP前三幕無提醒、末幕有提醒',ims[0].crop(box).tobytes()==ims[2].crop(box).tobytes() and ims[2].crop(box).tobytes()!=ims[3].crop(box).tobytes())
  p.evaluate('__ONE_V049__.activateStep(3)');p.wait_for_timeout(60);expected=png(p)
  with p.expect_download() as dl:p.evaluate('document.querySelector("#oneProjectFiles [data-action=export-package]").click()')
  zdata=Path(dl.value.path()).read_bytes();(OUT/'project.zip').write_bytes(zdata)
  with zipfile.ZipFile(io.BytesIO(zdata)) as z:
   js=json.loads(z.read(next(n for n in z.namelist() if n.endswith('.json') and '/' not in n)))
   ok('專案ZIP保留提醒ID與全部4幕圖片',js['data']['note']['blockId']==p.evaluate('state.note.blockId') and len([n for n in z.namelist() if n.startswith('assets/')])==4)
   img=z.read(next(n for n in z.namelist() if n.endswith('.png') and '/' not in n))
   ok('專案ZIP預覽與目前PNG一致',Image.open(io.BytesIO(img)).tobytes()==Image.open(io.BytesIO(expected)).tobytes())
  p.evaluate('state.blocks[0].html="錯的內容";renderEditor();renderCanvas()')
  p.locator('[data-one-project-package-ui] input[accept*=zip]').set_input_files({'name':'saved.zip','mimeType':'application/zip','buffer':zdata})
  p.wait_for_function('state.blocks[0].html.includes("累積說明測試")');p.wait_for_timeout(200)
  ok('專案ZIP重新載入提醒與圖片無遺漏',p.evaluate('!!ONEExplanationWorkspace.noteBlock()&&__ONE_V049__.getSequenceAssets().size===4'))
  ok('專案還原後PNG像素一致',Image.open(io.BytesIO(expected)).tobytes()==Image.open(io.BytesIO(png(p))).tobytes())
  # no downgrade to 56px when importing explicitly sized old content
  p.evaluate('''async()=>{const s=projectPayload();s.data.blocks[0].html='<span style="font-size:68px">舊專案主標</span>';await loadProjectPayload(s);}''')
  ok('舊專案明確68px不被新56px預設覆寫',p.evaluate('htmlToParagraphs(state.blocks[0].html,"title")[0].runs[0].style.size===68'))
  # Legacy reminder is migrated to a real item and text preserved.
  p.evaluate('''async()=>{const s=projectPayload();s.data.blocks=s.data.blocks.filter(b=>b.id!==s.data.note.blockId);s.data.note={enabled:true,text:'舊提醒文字',size:24,color:BRAND.teal};await loadProjectPayload(s);}''')
  ok('舊格式全域提醒遷移且不重複',p.evaluate('ONEExplanationWorkspace.noteBlock().html.includes("舊提醒文字")&&!state.note.enabled&&state.blocks.filter(b=>b.kind==="body").length===4'))
  p.evaluate('''async()=>{const p=projectPayload();p.data.blocks=[block('title','滿額舊卡'),block('subtitle','')];for(let i=0;i<10;i++)p.data.blocks.push(block('body','原項目'+i));p.data.note={enabled:true,text:'額外的舊提醒',size:24,color:BRAND.teal};await loadProjectPayload(p);await loadProjectPayload(projectPayload());}''')
  ok('12段舊卡加提醒存取往返不截斷',p.evaluate('state.blocks.length===13&&state.blocks.some(b=>b.html.includes("原項目9"))&&ONEExplanationWorkspace.noteBlock().html.includes("額外的舊提醒")'))
  p.evaluate('''()=>{const n=ONEExplanationWorkspace.noteBlock();n.html='<span style="color:#FFBE37;text-decoration:underline">黃字</span><br><span style="font-style:italic">第二行</span>';renderEditor();renderCanvas();}''')
  p.locator('#oneReminderDetail details summary').click();p.locator('#noteSize').select_option('28');p.wait_for_timeout(80)
  ok('提醒字級調整保留顏色底線與換行',p.evaluate('(()=>{const a=htmlToParagraphs(ONEExplanationWorkspace.noteBlock().html,"body");return a.length===2&&a[0].runs[0].style.underline&&a[1].runs[0].style.italic&&a.every(p=>p.runs.every(r=>r.style.size===28))})()'))
  p.close()
  p=new(b);id=p.evaluate('state.blocks[2].id');openb(p,id);p.keyboard.press('Control+a');p.keyboard.insert_text('黃字與白字');select(p,0,2);p.locator('#underlineBtn').click();p.locator('.toolbar-swatch').nth(1).click();finish(p)
  ok('原位混合格式與PNG共用同一富文字資料',p.evaluate('(()=>{const r=htmlToParagraphs(state.blocks[2].html,"body")[0].runs;return r[0].style.underline&&!r.at(-1).style.underline})()'))
  openb(p,id);old=p.evaluate('state.blocks[2].html');p.keyboard.press('Control+a');cdp=p.context.new_cdp_session(p);cdp.send('Input.imeSetComposition',{'text':'注音選字中','selectionStart':5,'selectionEnd':5});
  ok('中文組字期間不回蓋舊DOM',p.evaluate('ONEExplanationOverlayPilot.state().composing') and p.evaluate('state.blocks[2].html')==old)
  cdp.send('Input.insertText',{'text':'中文完成'});p.wait_for_timeout(100)
  ok('中文完成組字進入同一資料',p.evaluate('state.blocks[2].html.includes("中文完成")'))
  p.keyboard.press('Control+z');p.wait_for_timeout(100)
  ok('原位中文輸入可復原',p.evaluate('state.blocks[2].html')==old)
  p.close()
  for w,h in [(1366,768),(1280,900),(1024,768),(390,844)]:
   p=new(b,w,h)
   ok(f'{w}px無水平溢出',p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'))
   if w>=1280:ok(f'{w}px文字工具一排',p.evaluate("(()=>{const a=[...document.querySelectorAll('.one-format-row > *')].map(e=>e.getBoundingClientRect()).map(r=>Math.round(r.y+r.height/2));return Math.max(...a)-Math.min(...a)<3})()"))
   p.screenshot(path=str(OUT/f'viewport-{w}.png'));p.close()
  b.close()
  ok('瀏覽器未捕捉錯誤為0',not errors,errors)
except Exception:
 failed=True
 traceback.print_exc()
finally:
 (OUT/'report.json').write_text(json.dumps({'checks':checks,'errors':errors},ensure_ascii=False,indent=2));print('TOTAL',sum(c['pass'] for c in checks),'/',len(checks),'errors',errors)

if failed or len(checks)!=40 or any(not c["pass"] for c in checks) or errors:
 sys.exit(1)
