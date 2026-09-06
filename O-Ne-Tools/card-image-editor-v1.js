/* Non-destructive image crop editor shared by focus and rating cards. */
(function (global) {
  'use strict';
  const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
  const number = (n, fallback) => Number.isFinite(Number(n)) ? Number(n) : fallback;
  function normalize(c = {}) {
    const cropWidth = clamp(number(c.cropWidth, 100), 12, 100), cropHeight = clamp(number(c.cropHeight, 100), 12, 100);
    return { fit: ['free', 'cover'].includes(c.fit) ? c.fit : 'contain', zoom: clamp(number(c.zoom, 100), 100, 300),
      offsetX: clamp(number(c.offsetX, 0), -100, 100), offsetY: clamp(number(c.offsetY, 0), -100, 100),
      cropX: clamp(number(c.cropX, 0), 0, 100 - cropWidth), cropY: clamp(number(c.cropY, 0), 0, 100 - cropHeight), cropWidth, cropHeight };
  }
  function sourceRect(img, crop) {
    const c = normalize(crop), w = img.naturalWidth || img.width, h = img.naturalHeight || img.height;
    if (c.fit === 'free') return { x: w * c.cropX / 100, y: h * c.cropY / 100, w: w * c.cropWidth / 100, h: h * c.cropHeight / 100 };
    if (c.fit === 'cover') {
      const cw = Math.min(w, h * 16 / 9) * 100 / c.zoom, ch = cw * 9 / 16;
      return { x: (w - cw) / 2 * (1 - c.offsetX / 100), y: (h - ch) / 2 * (1 - c.offsetY / 100), w: cw, h: ch };
    }
    return { x: 0, y: 0, w, h };
  }
  function draw(ctx, img, crop, box) {
    const r = sourceRect(img, crop), scale = Math.min(box.w / r.w, box.h / r.h);
    const w = r.w * scale, h = r.h * scale, x = box.x + (box.w - w) / 2, y = box.y + (box.h - h) / 2;
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, r.x, r.y, r.w, r.h, x, y, w, h); ctx.restore(); return { x, y, w, h };
  }
  let active;
  function open(options) {
    if (!options.image || !(options.image.naturalWidth || options.image.width)) return;
    if (active) active.close();
    if (global.ONECardDirectEdit) global.ONECardDirectEdit.finish();
    const opener = document.activeElement, dialog = document.createElement('dialog');
    dialog.className = 'one-image-dialog'; dialog.setAttribute('aria-label', '編輯裁切：' + options.title);
    dialog.innerHTML = '<form method="dialog"><header><div><strong></strong><small>拖曳選取框與邊角，或輸入裁切範圍</small></div><button value="cancel" aria-label="關閉圖片編輯">×</button></header><div class="one-image-dialog-body"><div class="one-image-modes" role="group" aria-label="裁切比例"><button type="button" data-mode="contain">完整圖片</button><button type="button" data-mode="free">自由裁切</button><button type="button" data-ratio="1">1:1</button><button type="button" data-ratio="1.7777777777777777">16:9</button><button type="button" data-ratio="0.75">3:4</button></div><div class="one-image-crop-stage"><canvas tabindex="0" aria-label="裁切選取框，方向鍵移動"></canvas></div><div class="one-image-crop-fields"></div><p>只調整這張圖片；原圖會保留在專案包。</p></div><footer><button type="button" data-reset>重設裁切</button><span></span><button value="cancel">取消</button><button type="button" data-apply>套用裁切</button></footer></form>';
    dialog.querySelector('strong').textContent = options.title;
    const canvas = dialog.querySelector('canvas'), ctx = canvas.getContext('2d'), img = options.image;
    const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
    const scale = Math.min(720 / iw, 440 / ih, 1); canvas.width = Math.max(1, Math.round(iw * scale)); canvas.height = Math.max(1, Math.round(ih * scale));
    let crop = normalize(options.crop), drag = null;
    const fields = [['cropX', '左側'], ['cropY', '上方'], ['cropWidth', '寬度'], ['cropHeight', '高度']];
    fields.forEach(([key, label]) => {
      const node = document.createElement('label'); node.textContent = label + ' %';
      const input = document.createElement('input'); input.type = 'number'; input.min = key.includes('Width') || key.includes('Height') ? 12 : 0; input.max = 100; input.step = .1; input.dataset.cropField = key; input.setAttribute('aria-label', label + '百分比');
      input.addEventListener('input', () => { if (!input.value || !input.validity.valid) return; crop = normalize({ ...crop, fit: 'free', [key]: Number(input.value) }); paint(input); });
      node.append(input); dialog.querySelector('.one-image-crop-fields').append(node);
    });
    function free() {
      if (crop.fit !== 'free') { const r = sourceRect(img, crop); crop = normalize({ ...crop, fit: 'free', cropX: r.x / iw * 100, cropY: r.y / ih * 100, cropWidth: r.w / iw * 100, cropHeight: r.h / ih * 100 }); }
    }
    function paint(except) {
      const r = sourceRect(img, crop), x = r.x / iw * canvas.width, y = r.y / ih * canvas.height, w = r.w / iw * canvas.width, h = r.h / ih * canvas.height;
      ctx.clearRect(0, 0, canvas.width, canvas.height); ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      ctx.fillStyle = 'rgba(4,9,14,.66)'; ctx.fillRect(0,0,canvas.width,y); ctx.fillRect(0,y+h,canvas.width,canvas.height-y-h); ctx.fillRect(0,y,x,h); ctx.fillRect(x+w,y,canvas.width-x-w,h);
      ctx.strokeStyle = '#70DED3'; ctx.lineWidth = 2; ctx.strokeRect(x+1,y+1,Math.max(0,w-2),Math.max(0,h-2));
      ctx.setLineDash([4,4]); ctx.lineWidth = 1; ctx.beginPath(); [1,2].forEach(i=>{ctx.moveTo(x+w*i/3,y);ctx.lineTo(x+w*i/3,y+h);ctx.moveTo(x,y+h*i/3);ctx.lineTo(x+w,y+h*i/3);});ctx.stroke();ctx.setLineDash([]);
      ctx.fillStyle='#FDF3E7'; [[x,y],[x+w/2,y],[x+w,y],[x+w,y+h/2],[x+w,y+h],[x+w/2,y+h],[x,y+h],[x,y+h/2]].forEach(([a,b])=>ctx.fillRect(clamp(a-4,0,canvas.width-8),clamp(b-4,0,canvas.height-8),8,8));
      dialog.querySelectorAll('[data-crop-field]').forEach(input=>{if(input!==except)input.value=Math.round(crop[input.dataset.cropField]*10)/10;});
      dialog.querySelectorAll('[data-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.mode===crop.fit)));
      dialog.querySelectorAll('[data-ratio]').forEach(b=>b.setAttribute('aria-pressed',String(crop.fit==='free'&&Math.abs(r.w/r.h-Number(b.dataset.ratio))<.01)));
    }
    dialog.querySelectorAll('[data-mode]').forEach(b=>b.onclick=()=>{if(b.dataset.mode==='free')free();else crop=normalize();paint();});
    dialog.querySelectorAll('[data-ratio]').forEach(b=>b.onclick=()=>{const ratio=Number(b.dataset.ratio),w=Math.min(iw,ih*ratio),h=w/ratio;crop=normalize({fit:'free',cropWidth:w/iw*100,cropHeight:h/ih*100,cropX:(iw-w)/iw*50,cropY:(ih-h)/ih*50});paint();});
    const point = e => { const b=canvas.getBoundingClientRect(); return {x:(e.clientX-b.left)/b.width*100,y:(e.clientY-b.top)/b.height*100}; };
    canvas.addEventListener('pointerdown', e => {
      free(); const p=point(e), b=canvas.getBoundingClientRect(), dx=9/b.width*100,dy=9/b.height*100, right=crop.cropX+crop.cropWidth,bottom=crop.cropY+crop.cropHeight;
      if(p.x<crop.cropX-dx||p.x>right+dx||p.y<crop.cropY-dy||p.y>bottom+dy)return;
      let mode='';if(Math.abs(p.y-crop.cropY)<dy)mode+='n';else if(Math.abs(p.y-bottom)<dy)mode+='s';if(Math.abs(p.x-crop.cropX)<dx)mode+='w';else if(Math.abs(p.x-right)<dx)mode+='e';
      drag={point:p,crop:{...crop},mode:mode||'move'};canvas.setPointerCapture(e.pointerId);e.preventDefault();
    });
    canvas.addEventListener('pointermove', e=>{
      if(!drag)return;const p=point(e),dx=p.x-drag.point.x,dy=p.y-drag.point.y,c=drag.crop,m=drag.mode;
      let x=c.cropX,y=c.cropY,r=x+c.cropWidth,b=y+c.cropHeight;
      if(m==='move'){x=clamp(x+dx,0,100-c.cropWidth);y=clamp(y+dy,0,100-c.cropHeight);r=x+c.cropWidth;b=y+c.cropHeight;}
      else{if(m.includes('w'))x=clamp(x+dx,0,r-12);if(m.includes('e'))r=clamp(r+dx,x+12,100);if(m.includes('n'))y=clamp(y+dy,0,b-12);if(m.includes('s'))b=clamp(b+dy,y+12,100);}
      crop=normalize({...c,fit:'free',cropX:x,cropY:y,cropWidth:r-x,cropHeight:b-y});paint();
    });
    ['pointerup','pointercancel'].forEach(type=>canvas.addEventListener(type,()=>drag=null));
    canvas.addEventListener('keydown',e=>{const delta={ArrowLeft:[-1,0],ArrowRight:[1,0],ArrowUp:[0,-1],ArrowDown:[0,1]}[e.key];if(!delta)return;e.preventDefault();free();crop=normalize({...crop,cropX:crop.cropX+delta[0]*(e.shiftKey?5:1),cropY:crop.cropY+delta[1]*(e.shiftKey?5:1)});paint();});
    dialog.querySelector('[data-reset]').onclick=()=>{crop=normalize();paint();};
    dialog.querySelector('[data-apply]').onclick=()=>{options.onApply(normalize(crop));dialog.close('apply');};
    dialog.addEventListener('close',()=>{dialog.remove();if(active===dialog)active=null;if(opener?.isConnected)opener.focus({preventScroll:true});});
    document.body.append(dialog);active=dialog;paint();dialog.showModal();
  }
  global.ONECardImageEditor={version:'1.0.0',normalize,sourceRect,draw,open};
})(window);
