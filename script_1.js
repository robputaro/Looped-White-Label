
// ════════════════════════════════════════════════════════════════════════════
// SHARED UTILITIES
// ════════════════════════════════════════════════════════════════════════════
function sanitize(s, fb) { return (s||'').trim().replace(/[^a-zA-Z0-9_-]+/g,'_') || fb; }

function loadImageFromFile(file) {
  return new Promise((res,rej)=>{ const i=new Image(); i.decoding='async'; i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(file); });
}
function loadImageFromBlob(blob) {
  return new Promise((res,rej)=>{ const i=new Image(); i.decoding='async'; i.onload=()=>res(i); i.onerror=rej; i.src=URL.createObjectURL(blob); });
}
function loadImageFromSrc(src) {
  return new Promise((res,rej)=>{ const i=new Image(); i.onload=()=>res(i); i.onerror=rej; i.src=src; });
}
function canvasToBlob(c) { return new Promise((res,rej)=>{ try { c.toBlob(b=>b?res(b):rej(new Error('Canvas export returned empty blob')),'image/png'); } catch(err) { rej(err); } }); }
function downloadBlob(blob, filename){
  if(!blob) throw new Error('Nothing was generated for download.');
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=filename || 'download';
  a.rel='noopener';
  a.style.position='fixed';
  a.style.left='-9999px';
  document.body.appendChild(a);
  a.dispatchEvent(new MouseEvent('click',{view:window,bubbles:true,cancelable:true}));
  setTimeout(()=>{ a.remove(); URL.revokeObjectURL(url); },10000);
}
function downloadCanvasPng(canvas, filename){
  if(!canvas) throw new Error('The requested asset canvas is not available.');
  const dataUrl=canvas.toDataURL('image/png');
  const a=document.createElement('a');
  a.href=dataUrl;
  a.download=filename || 'asset.png';
  a.rel='noopener';
  a.style.position='fixed';
  a.style.left='-9999px';
  document.body.appendChild(a);
  a.dispatchEvent(new MouseEvent('click',{view:window,bubbles:true,cancelable:true}));
  setTimeout(()=>a.remove(),1000);
}
function rgbToHex(r,g,b){ return '#'+[r,g,b].map(v=>v.toString(16).padStart(2,'0')).join(''); }
function hexToRgb(h){ return{r:parseInt(h.slice(1,3),16),g:parseInt(h.slice(3,5),16),b:parseInt(h.slice(5,7),16)}; }


function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function mixHex(hexA, hexB, t) {
  t = clamp(t, 0, 1);
  const a = hexToRgb(hexA), b = hexToRgb(hexB);
  return rgbToHex(
    Math.round(a.r + (b.r - a.r) * t),
    Math.round(a.g + (b.g - a.g) * t),
    Math.round(a.b + (b.b - a.b) * t)
  );
}
function buildTexturePalette(hex) {
  const src = hex || '#7c6bb5';
  const rgb = hexToRgb(src);
  const brightness = (rgb.r + rgb.g + rgb.b) / 3;
  const baseLift = brightness < 85 ? 0.78 : brightness < 135 ? 0.72 : 0.64;
  const lineHex = mixHex(mixHex(src, '#ffffff', baseLift), '#edf0f7', 0.18);
  const accentHex = mixHex(src, '#ffffff', Math.min(0.92, baseLift - 0.06));
  const shadowHex = mixHex(mixHex(src, '#ffffff', Math.max(0.34, baseLift - 0.30)), '#c5cadb', 0.24);
  return { line: hexToRgb(lineHex), accent: hexToRgb(accentHex), shadow: hexToRgb(shadowHex) };
}

// ── Premium contour / silk-line texture system ─────────────────────────────
// True field-based relief texture. Instead of drawing separate line paths,
// this creates a smooth scalar field, extracts soft contour bands from it,
// and shades them with a subtle embossed highlight/shadow read.
function hashString(str) {
  let h = 2166136261;
  str = String(str || 'looped');
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function makeRand(seed) {
  let s = seed >>> 0;
  return function() {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
function roundedRectPath(ctx, x, y, w, h, r) {
  r = Math.min(r || 0, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}
function rgbaFromRgb(rgb, alpha) {
  return `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, Math.min(1, alpha))})`;
}

const PREMIUM_TEXTURE_PRESETS = {
  silk:        { angle:-9,  bands:19, amp1:0.24, amp2:0.12, amp3:0.06, sigma:0.085, alpha:0.34, hi:0.20, sh:0.18, relief:1.1, wellAmp:0.22 },
  topographic: { angle:-6,  bands:22, amp1:0.26, amp2:0.14, amp3:0.07, sigma:0.082, alpha:0.36, hi:0.22, sh:0.20, relief:1.15, wellAmp:0.26 },
  ambient:     { angle:11,  bands:17, amp1:0.20, amp2:0.10, amp3:0.05, sigma:0.090, alpha:0.28, hi:0.18, sh:0.16, relief:0.95, wellAmp:0.18 },
  relief:      { angle:-4,  bands:15, amp1:0.18, amp2:0.08, amp3:0.04, sigma:0.096, alpha:0.24, hi:0.16, sh:0.14, relief:0.90, wellAmp:0.14 },
  minimal:     { angle:-18, bands:12, amp1:0.12, amp2:0.05, amp3:0.03, sigma:0.108, alpha:0.18, hi:0.12, sh:0.10, relief:0.72, wellAmp:0.10 }
};

function drawPremiumContourTexture(ctx, W, H, opts = {}) {
  const style = opts.style || 'silk';
  const p = PREMIUM_TEXTURE_PRESETS[style] || PREMIUM_TEXTURE_PRESETS.silk;
  const strength = clamp(opts.strength == null ? 1 : opts.strength, 0, 1.5);
  if (strength <= 0.001) return;

  const palette = buildTexturePalette(typeof opts.color === 'string' ? opts.color : '#7c6bb5');
  const seed = hashString(`${opts.seed || ''}|${style}|${W}x${H}|${JSON.stringify(opts.color || '')}`);
  const rand = makeRand(seed);

  const maxPixels = 850000;
  const currentPixels = W * H;
  const texScale = currentPixels > maxPixels ? Math.sqrt(maxPixels / currentPixels) : 1;
  const tw = Math.max(220, Math.round(W * texScale));
  const th = Math.max(140, Math.round(H * texScale));

  const angle = (p.angle + (rand() - 0.5) * 3.5) * Math.PI / 180;
  const cos = Math.cos(angle), sin = Math.sin(angle);
  const phase1 = rand() * Math.PI * 2;
  const phase2 = rand() * Math.PI * 2;
  const phase3 = rand() * Math.PI * 2;
  const phase4 = rand() * Math.PI * 2;
  const phase5 = rand() * Math.PI * 2;

  const wells = Array.from({ length: style === 'topographic' ? 4 : style === 'minimal' ? 1 : 3 }, () => ({
    x: (rand() - 0.5) * 1.5,
    y: (rand() - 0.5) * 1.15,
    rx: 0.22 + rand() * 0.22,
    ry: 0.18 + rand() * 0.18,
    amp: (rand() > 0.5 ? 1 : -1) * (0.10 + rand() * p.wellAmp),
    phase: rand() * Math.PI * 2
  }));

  function scalarField(nx, ny, jitter) {
    const xr = nx * cos - ny * sin;
    const yr = nx * sin + ny * cos;

    let disp = 0;
    disp += p.amp1 * Math.sin((xr * 1.55 + 0.10 * Math.sin(yr * 1.65 + phase2)) * Math.PI + phase1 + jitter);
    disp += p.amp2 * Math.sin((xr * 0.62 - yr * 0.26) * Math.PI + phase3);
    disp += p.amp3 * Math.cos((yr * 0.92 + xr * 0.10) * Math.PI + phase4);
    disp += p.amp2 * 0.35 * Math.sin((xr + yr * 0.55) * Math.PI * 0.55 + phase5);

    for (const w of wells) {
      const dx = (xr - w.x) / w.rx;
      const dy = (yr - w.y) / w.ry;
      const g = Math.exp(-(dx * dx + dy * dy) * 1.7);
      disp += w.amp * g * (0.75 * Math.sin(dx * 2.0 + w.phase) + 0.18 * dy);
    }

    return yr + disp;
  }

  const field = new Float32Array(tw * th);
  const mask = new Float32Array(tw * th);
  for (let y = 0; y < th; y++) {
    const ny = (y / (th - 1) - 0.5) * 2;
    const jitter = Math.sin(y * 0.013 + phase3) * 0.04;
    for (let x = 0; x < tw; x++) {
      const nx = (x / (tw - 1) - 0.5) * 2;
      const h = scalarField(nx, ny, jitter) * p.bands;
      const v = Math.abs(Math.sin(Math.PI * h));
      const m = Math.exp(-(v * v) / (p.sigma * p.sigma));
      const idx = y * tw + x;
      field[idx] = h;
      mask[idx] = m;
    }
  }

  const textureCanvas = document.createElement('canvas');
  textureCanvas.width = tw;
  textureCanvas.height = th;
  const tctx = textureCanvas.getContext('2d');
  const img = tctx.createImageData(tw, th);
  const data = img.data;

  const shDx = 1, shDy = 1, hiDx = -1, hiDy = -1;
  const baseAlpha = p.alpha * strength;
  const hiAlpha = p.hi * strength;
  const shAlpha = p.sh * strength;

  function sample(arr, x, y) {
    x = x < 0 ? 0 : x >= tw ? tw - 1 : x;
    y = y < 0 ? 0 : y >= th ? th - 1 : y;
    return arr[y * tw + x];
  }

  for (let y = 0; y < th; y++) {
    for (let x = 0; x < tw; x++) {
      const idx = y * tw + x;
      const m = mask[idx];
      const mHi = sample(mask, x + hiDx, y + hiDy);
      const mSh = sample(mask, x + shDx, y + shDy);
      const ridge = m * (0.82 + 0.18 * (0.5 + 0.5 * Math.sin(field[idx] * 0.35)));
      const highlight = Math.max(0, mHi - m * 0.30);
      const shadow = Math.max(0, mSh - m * 0.32);

      let aBase = ridge * baseAlpha;
      let aHi = highlight * hiAlpha;
      let aSh = shadow * shAlpha;

      aBase *= 1.04;
      aHi *= 1.05;
      aSh *= 1.10;

      const a = Math.min(1, aBase + aHi + aSh);
      const di = idx * 4;
      if (a <= 0.001) {
        data[di] = data[di + 1] = data[di + 2] = data[di + 3] = 0;
        continue;
      }
      const r = palette.line.r * aBase + 255 * aHi + palette.shadow.r * aSh;
      const g = palette.line.g * aBase + 255 * aHi + palette.shadow.g * aSh;
      const b = palette.line.b * aBase + 255 * aHi + palette.shadow.b * aSh;
      data[di] = Math.max(0, Math.min(255, Math.round(r / a)));
      data[di + 1] = Math.max(0, Math.min(255, Math.round(g / a)));
      data[di + 2] = Math.max(0, Math.min(255, Math.round(b / a)));
      data[di + 3] = Math.max(0, Math.min(255, Math.round(a * 255)));
    }
  }
  tctx.putImageData(img, 0, 0);

  ctx.save();
  if (opts.radius) {
    roundedRectPath(ctx, 0, 0, W, H, opts.radius);
    ctx.clip();
  }

  if (opts.wash !== false) {
    const wash = ctx.createRadialGradient(W * 0.72, H * 0.22, 0, W * 0.72, H * 0.22, Math.max(W, H) * 0.85);
    wash.addColorStop(0, `rgba(255,255,255,${(0.038 * strength).toFixed(3)})`);
    wash.addColorStop(0.50, `rgba(${palette.accent.r},${palette.accent.g},${palette.accent.b},${(0.020 * strength).toFixed(3)})`);
    wash.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);
  }

  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(textureCanvas, 0, 0, W, H);
  ctx.restore();
}


function extractBrandColor(img) {
  // Robust brand-color extraction for PNG/SVG/raster logos.
  // Earlier versions were too strict about alpha/saturation, which made some
  // antialiased or gradient logos fail and leave the default color in place.
  const maxSide = 360;
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * scale));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * scale));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  let data;
  try { data = ctx.getImageData(0, 0, w, h).data; }
  catch (err) { console.warn('Could not sample logo color', err); return null; }

  const buckets = new Map();
  const fallback = new Map();

  function add(map, key, r, g, b, weight) {
    let item = map.get(key);
    if (!item) item = { weight: 0, r: 0, g: 0, b: 0, count: 0 };
    item.weight += weight;
    item.r += r * weight;
    item.g += g * weight;
    item.b += b * weight;
    item.count += 1;
    map.set(key, item);
  }

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 24) continue;

    const r = data[i], g = data[i + 1], b = data[i + 2];
    const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
    const chroma = mx - mn;
    const br = (r + g + b) / 3;
    const sat = mx ? chroma / mx : 0;
    const alphaWeight = a / 255;

    // Ignore obvious transparent/white/black background pixels, but do not be
    // so strict that blue/teal/purple antialiasing gets thrown away.
    if (br > 246 && sat < 0.28) continue;
    if (br < 14) continue;

    const qMain = `${r >> 4},${g >> 4},${b >> 4}`;     // 16-level buckets
    const qFallback = `${r >> 5},${g >> 5},${b >> 5}`; // broader backup buckets

    // Fallback records all non-white visible pixels in case a mostly monochrome
    // logo has low saturation.
    if (br < 238 && br > 18) {
      const neutralPenalty = sat < 0.08 ? 0.35 : 1;
      add(fallback, qFallback, r, g, b, alphaWeight * neutralPenalty);
    }

    // Main records chromatic brand pixels. Weight saturation and mid-dark tones
    // so tiny accents do not beat the actual brand color, while white/gray
    // background/antialias pixels do not dominate.
    if (chroma < 16 || sat < 0.10 || br > 242) continue;
    const midToneBonus = 0.65 + 0.55 * (1 - Math.min(1, Math.abs(br - 112) / 150));
    const satBonus = Math.pow(Math.max(0.01, sat), 1.45);
    const darkLogoBonus = br < 210 ? 1 : 0.65;
    const weight = alphaWeight * satBonus * midToneBonus * darkLogoBonus;
    add(buckets, qMain, r, g, b, weight);
  }

  function pick(map) {
    if (!map.size) return null;
    let best = null;
    for (const item of map.values()) {
      if (!best || item.weight > best.weight) best = item;
    }
    if (!best || best.weight <= 0) return null;
    let r = best.r / best.weight, g = best.g / best.weight, b = best.b / best.weight;
    const br = (r + g + b) / 3;
    // If the extracted color is very pale, deepen it enough to work as the
    // primary text/border/texture color while preserving hue.
    if (br > 190) {
      const factor = 190 / br;
      r *= factor; g *= factor; b *= factor;
    }
    return rgbToHex(Math.round(r), Math.round(g), Math.round(b));
  }

  return pick(buckets) || pick(fallback) || null;
}


function removeSolidBackground(img, tol) {
  const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
  const ctx=c.getContext('2d'); ctx.drawImage(img,0,0);
  const id=ctx.getImageData(0,0,c.width,c.height); const d=id.data;
  const[bgR,bgG,bgB]=[d[0],d[1],d[2]];
  const maxD=Math.sqrt(255*255*3), thresh=(tol/100)*maxD;
  for(let i=0;i<d.length;i+=4){
    const dr=d[i]-bgR,dg=d[i+1]-bgG,db=d[i+2]-bgB;
    if(Math.sqrt(dr*dr+dg*dg+db*db)<=thresh) d[i+3]=0;
  }
  ctx.putImageData(id,0,0); return c;
}

function cropToContent(img) {
  const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
  const ctx=c.getContext('2d'); ctx.drawImage(img,0,0);
  const d=ctx.getImageData(0,0,c.width,c.height).data;
  const w=c.width,h=c.height; let minX=w,minY=h,maxX=-1,maxY=-1;
  for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    if(d[(y*w+x)*4+3]>1){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
  }
  if(maxX<minX||maxY<minY)return c;
  // Never crop flush to visible pixels. Serif descenders and antialiased edges
  // can otherwise look clipped after scaling. Keep a transparent safety pad.
  const rawW=maxX-minX+1, rawH=maxY-minY+1;
  const pad=Math.max(4, Math.ceil(Math.max(rawW,rawH)*0.035));
  const sx=Math.max(0,minX-pad), sy=Math.max(0,minY-pad);
  const ex=Math.min(w-1,maxX+pad), ey=Math.min(h-1,maxY+pad);
  const cw=ex-sx+1,ch=ey-sy+1;
  const out=document.createElement('canvas'); out.width=cw; out.height=ch;
  out.getContext('2d').drawImage(c,sx,sy,cw,ch,0,0,cw,ch); return out;
}

function fitAndPad(img,tw,th){
  const c=document.createElement('canvas'); c.width=tw; c.height=th;
  const ctx=c.getContext('2d'); ctx.clearRect(0,0,tw,th);
  const s=Math.min(tw/img.width,th/img.height);
  const dw=img.width*s,dh=img.height*s;
  ctx.drawImage(img,(tw-dw)/2,(th-dh)/2,dw,dh); return c;
}

function fitAndExtend(img,tw,th){
  const s=Math.min(tw/img.width,th/img.height);
  const dw=Math.round(img.width*s),dh=Math.round(img.height*s);
  const sc=document.createElement('canvas'); sc.width=img.width; sc.height=img.height;
  const sctx=sc.getContext('2d'); sctx.drawImage(img,0,0);
  const px=sctx.getImageData(0,0,1,1).data;
  const c=document.createElement('canvas'); c.width=tw; c.height=th;
  const ctx=c.getContext('2d');
  ctx.fillStyle=`rgb(${px[0]},${px[1]},${px[2]})`; ctx.fillRect(0,0,tw,th);
  ctx.drawImage(img,Math.round((tw-dw)/2),Math.round((th-dh)/2),dw,dh); return c;
}

function drawCanvasToEl(src,el,max){
  const s=Math.min(max/src.width,max/src.height,1);
  el.width=Math.max(1,Math.round(src.width*s)); el.height=Math.max(1,Math.round(src.height*s));
  el.getContext('2d').drawImage(src,0,0,el.width,el.height);
}

function setupUploadSlot(slotEl,fileEl,previewEl,clearEl,onLoad){
  slotEl.addEventListener('click',e=>{if(e.target===clearEl||clearEl.contains(e.target))return;fileEl.click();});
  ['dragenter','dragover'].forEach(ev=>slotEl.addEventListener(ev,e=>{e.preventDefault();slotEl.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>slotEl.addEventListener(ev,e=>{e.preventDefault();slotEl.classList.remove('dragover');}));
  slotEl.addEventListener('drop',e=>{const f=e.dataTransfer.files[0];if(f)handleSlotFile(f,slotEl,previewEl,onLoad);});
  fileEl.addEventListener('change',e=>{if(e.target.files[0])handleSlotFile(e.target.files[0],slotEl,previewEl,onLoad);});
  clearEl.addEventListener('click',e=>{e.stopPropagation();slotEl.classList.remove('has-file');previewEl.src='';fileEl.value='';onLoad(null);});
}
function handleSlotFile(file,slot,preview,onLoad){
  const url=URL.createObjectURL(file); preview.src=url; slot.classList.add('has-file');
  loadImageFromSrc(url).then(img=>onLoad(img,file.name));
}

// Tab switching
document.querySelectorAll('.tab-btn').forEach(btn=>{
  btn.addEventListener('click',()=>{
    document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));
    btn.classList.add('active');
    const requested=btn.dataset.tab;
    const logoMode=requested==='app-logo'||requested==='header';
    const panelId=logoMode?'tab-logo-tools':'tab-'+requested;
    document.getElementById(panelId)?.classList.add('active');
    if(logoMode){
      const output=document.getElementById('r-output');
      const title=document.getElementById('r-modeTitle');
      const sub=document.getElementById('r-modeSub');
      if(output){
        output.value=requested==='app-logo'?'app':'headermark';
        output.dispatchEvent(new Event('change',{bubbles:true}));
      }
      if(title) title.textContent=requested==='app-logo'?'App Logo':'Header';
      if(sub) sub.textContent=requested==='app-logo'
        ? 'Create the 2048×2048 app icon from the clinic logo. Transparent/alpha PNG is recommended; optionally add a solid background color.'
        : 'Build a transparent 800×220 app header from the clinic logo. Toggle header text on or off for a wordmark, logomark, or logo-only layout.';
    }
  });
});

// ════════════════════════════════════════════════════════════════════════════
// TAB 1 — LOGO RESIZER
// ════════════════════════════════════════════════════════════════════════════
(function(){
  const R_SPECS={app:{w:2048,h:2048,s:'app'},headermark:{w:800,h:220,s:'header_mark_800x220',special:'headermark'},hero:{w:3840,h:2160,s:'hero'}};
  let rFiles=[], rPreviewCache=null;
  function rApplyAppBackground(canvas){
    if(rOutput.value!=='app' || !rAppBgEnabled?.checked) return canvas;
    const out=document.createElement('canvas'); out.width=canvas.width; out.height=canvas.height;
    const ctx=out.getContext('2d'); ctx.fillStyle=rAppBgColor.value; ctx.fillRect(0,0,out.width,out.height); ctx.drawImage(canvas,0,0);
    return out;
  }
  function rUpdateAppBgUi(){
    const isApp=rOutput.value==='app';
    rAppBgPanel.style.display=isApp?'':'none';
    rAppBgColorWrap.style.display=isApp&&rAppBgEnabled.checked?'':'none';
    rAppBgColorSwatch.style.background=rAppBgColor.value;
    rAppBgColorHex.textContent=rAppBgColor.value.toUpperCase();
  }

  function prettifyFilename(name=''){
    return (name||'')
      .replace(/\.[^.]+$/,'')
      .replace(/[_-]+/g,' ')
      .replace(/\s+/g,' ')
      .trim();
  }
  function titleCaseWords(str=''){
    return prettifyFilename(str).split(' ').filter(Boolean).map(w=>{
      if(/^[A-Z0-9&]+$/.test(w) && w.length<=4) return w;
      if(/^[A-Z][a-z]+[A-Z]/.test(w)) return w;
      return w.charAt(0).toUpperCase()+w.slice(1).toLowerCase();
    }).join(' ');
  }
  function slugifyHeaderName(str='clinic'){
    return (str||'clinic').toString().trim().toLowerCase()
      .replace(/&/g,'and')
      .replace(/[^a-z0-9]+/g,'-')
      .replace(/^-+|-+$/g,'') || 'clinic';
  }
  function fitHeaderText(ctx,text,maxW,maxH){
    const cleaned=titleCaseWords(text)||'Clinic Name';
    const words=cleaned.split(/\s+/);
    const families='"Cormorant Garamond","DM Serif Display",Georgia,"Times New Roman",serif';
    for(let size=72; size>=28; size-=2){
      ctx.font=`600 ${size}px ${families}`;
      // Serif caps/descenders need more leading. The old tighter line height could
      // make 2-line names visually collide after final scaling.
      const lineHeight=Math.round(size*1.14);
      let lines=[''];
      words.forEach(word=>{
        const test=lines[lines.length-1]?lines[lines.length-1]+' '+word:word;
        if(ctx.measureText(test).width<=maxW){
          lines[lines.length-1]=test;
        } else if(lines.length<2){
          lines.push(word);
        } else {
          lines[lines.length-1]=test;
        }
      });
      // If final line still too long, scale down through loop
      const widest=Math.max(...lines.map(l=>ctx.measureText(l).width));
      const totalH=lines.length*lineHeight;
      if(widest<=maxW && totalH<=maxH) return {size,lineHeight,lines,families};
    }
    const size=28, lineHeight=Math.round(size*1.14);
    ctx.font=`600 ${size}px ${families}`;
    return {size,lineHeight,lines:[cleaned],families};
  }
  function getNonTransparentBounds(img, alphaThreshold=1){
    const c=document.createElement('canvas');
    c.width=img.width; c.height=img.height;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    ctx.drawImage(img,0,0);
    const d=ctx.getImageData(0,0,c.width,c.height).data;
    const w=c.width,h=c.height;
    let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let y=0;y<h;y++) for(let x=0;x<w;x++){
      if(d[(y*w+x)*4+3] > alphaThreshold){
        if(x<minX) minX=x;
        if(y<minY) minY=y;
        if(x>maxX) maxX=x;
        if(y>maxY) maxY=y;
      }
    }
    if(maxX<minX || maxY<minY){
      return {minX:0,minY:0,maxX:w-1,maxY:h-1,width:w,height:h,empty:true};
    }
    return {minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1,empty:false};
  }

  function renderNormalizedHeaderCanvas(img,opts={}){
    const W=800,H=220;
    const LEFT_PAD=40, RIGHT_PAD=40, TOP_BOTTOM_SAFE=30;
    const center=!!opts.center;
    const MAX_VISIBLE_W=W - LEFT_PAD - RIGHT_PAD;   // 720 px
    const MAX_VISIBLE_H=H - TOP_BOTTOM_SAFE*2;      // 160 px geometric safe area
    const TARGET_VISIBLE_H=150;                     // requested max visible height
    const c=document.createElement('canvas');
    c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,W,H);

    const b=getNonTransparentBounds(img,1);
    const visibleW=Math.max(1,b.width);
    const visibleH=Math.max(1,b.height);
    const scale=Math.min(MAX_VISIBLE_W/visibleW, TARGET_VISIBLE_H/visibleH);
    const drawW=Math.max(1, visibleW*scale);
    const drawH=Math.max(1, visibleH*scale);
    const dx=center ? (W-drawW)/2 : LEFT_PAD;
    const dy=(H-drawH)/2;

    ctx.save();
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(img,b.minX,b.minY,visibleW,visibleH,dx,dy,drawW,drawH);
    ctx.restore();
    return c;
  }

  function renderHeaderLogoOnly(img){
    // Logo-only header exports should normalize by the non-transparent artwork
    // bounds, not by the original canvas size, and when text is removed the
    // mark should re-center to maximize spacing instead of reserving a text lane.
    return renderNormalizedHeaderCanvas(img,{center:true});
  }

  function renderHeaderMark(img,label,textColor){
    const W=800,H=220, c=document.createElement('canvas');
    c.width=W; c.height=H;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,W,H);

    const fitModeEl=document.querySelector('input[name="r-headerFitMode"]:checked');
    const fitMode=fitModeEl ? fitModeEl.value : 'appheader';
    const isMaxHeight=fitMode==='maxheight';
    const isAppHeader=fitMode==='appheader';
    const isPillMatch=fitMode==='pillmatch';

    // Build the logo + text lockup first, then scale the whole group so it fills
    // a controlled safe area. The mark height is matched to the text block height,
    // so if the name wraps to 2 or 3 lines the mark grows with it.
    const safePadX=isAppHeader ? 6 : (isPillMatch ? 10 : (isMaxHeight ? 14 : 22));
    const safePadY=isAppHeader ? 2 : (isPillMatch ? 6 : (isMaxHeight ? 4 : 10));
    const targetW=W - safePadX*2;
    const targetH=H - safePadY*2;
    const gap=isAppHeader ? 14 : (isPillMatch ? 16 : (isMaxHeight ? 18 : 22));
    const maxMarkW=Math.min(
      isAppHeader ? 430 : (isPillMatch ? 405 : (isMaxHeight ? 390 : 360)),
      targetW * (isAppHeader ? 0.60 : (isPillMatch ? 0.57 : (isMaxHeight ? 0.56 : 0.52)))
    );
    const probe=document.createElement('canvas').getContext('2d');

    let fit=null, textW=0, textH=0, mw=0, mh=0;
    let markHGuess=Math.min(isPillMatch ? 100 : 108, targetH);

    // Two-pass solve: fit text using a provisional mark size, then resize mark to
    // the resulting text block height and refit once more.
    for(let pass=0; pass<2; pass++){
      const msGuess=markHGuess/Math.max(1,img.height);
      const guessW=Math.max(1,img.width*msGuess);
      const preferredTextCap=isAppHeader ? 390 : (isPillMatch ? 405 : (isMaxHeight ? 420 : 470));
      const textMaxW=Math.max(170, Math.min(preferredTextCap, targetW - Math.min(guessW, maxMarkW) - gap));
      fit=fitHeaderText(probe,label,textMaxW,targetH);
      probe.font=`600 ${fit.size}px ${fit.families}`;
      const passMetrics = fit.lines.map(l=>probe.measureText(l));
      textW=Math.max(...passMetrics.map(m=>{
        const left=Math.abs(m.actualBoundingBoxLeft || 0);
        const right=Math.abs(m.actualBoundingBoxRight || m.width || 0);
        return Math.max(m.width || 0, left + right);
      }));
      const textAsc = Math.max(...passMetrics.map(m=>m.actualBoundingBoxAscent || fit.size * 0.80));
      const textDesc = Math.max(...passMetrics.map(m=>m.actualBoundingBoxDescent || fit.size * 0.32));
      textH = textAsc + textDesc + ((fit.lines.length - 1) * fit.lineHeight);
      markHGuess=Math.min(targetH, textH);
      const widthAtTextHeight=img.width*(markHGuess/Math.max(1,img.height));
      if(widthAtTextHeight>maxMarkW){
        markHGuess=maxMarkW*(img.height/Math.max(1,img.width));
      }
    }

    const ms=markHGuess/Math.max(1,img.height);
    mw=Math.max(1,img.width*ms);
    mh=Math.max(1,img.height*ms);

    const groupW=mw + gap + textW;
    const textPad = isAppHeader ? Math.max(3, Math.ceil(fit.size * 0.08)) : (isPillMatch ? Math.max(3, Math.ceil(fit.size * 0.07)) : (isMaxHeight ? Math.max(2, Math.ceil(fit.size * 0.05)) : Math.max(3, Math.ceil(fit.size * 0.08))));
    const groupH=Math.max(mh, textH + textPad * 2);

    const g=document.createElement('canvas');
    g.width=Math.ceil(groupW);
    g.height=Math.ceil(groupH);
    const gctx=g.getContext('2d');
    gctx.clearRect(0,0,g.width,g.height);
    gctx.imageSmoothingEnabled=true;
    gctx.imageSmoothingQuality='high';

    const markInset = Math.max(0, Math.round(mh * 0.01));
    const markDrawH = Math.max(1, mh - markInset * 2);
    const markScale = markDrawH / Math.max(1, mh);
    const markDrawW = Math.max(1, mw * markScale);
    const markX = (mw - markDrawW) / 2;
    const markY = (groupH - markDrawH) / 2;
    gctx.drawImage(img, markX, markY, markDrawW, markDrawH);
    gctx.save();
    gctx.fillStyle=textColor||'#1A1A1A';
    gctx.textAlign='center';
    gctx.textBaseline='alphabetic';
    gctx.font=`600 ${fit.size}px ${fit.families}`;
    const drawMetrics = fit.lines.map(l=>gctx.measureText(l));
    const textAsc = Math.max(...drawMetrics.map(m=>m.actualBoundingBoxAscent || fit.size * 0.80));
    const textDesc = Math.max(...drawMetrics.map(m=>m.actualBoundingBoxDescent || fit.size * 0.32));
    const textBlockH = textAsc + textDesc + ((fit.lines.length - 1) * fit.lineHeight);
    const textCenterX = mw + gap + (textW / 2);
    const firstBaselineY = ((groupH - textBlockH) / 2) + textAsc;
    fit.lines.forEach((line,i)=>{
      gctx.fillText(line, textCenterX, firstBaselineY + i*fit.lineHeight);
    });
    gctx.restore();

    const scaleControl=document.getElementById('r-headerScale');
    const sliderVal=(scaleControl ? parseInt(scaleControl.value,10) : 100);
    const rawOutputScale=sliderVal / 100;
    const hardInset=isAppHeader ? 2 : (isPillMatch ? 6 : (isMaxHeight ? 4 : 8));
    const maxCanvasScale=Math.min((W-hardInset)/groupW, (H-hardInset)/groupH);
    let scale;
    if(isAppHeader){
      const fillFactor=Math.max(0.72, Math.min(1, 0.78 + ((sliderVal - 90) / 30) * 0.20));
      scale=maxCanvasScale * fillFactor;
    } else if(isPillMatch){
      const fillFactor=Math.max(0.66, Math.min(0.88, 0.72 + ((sliderVal - 90) / 30) * 0.16));
      scale=maxCanvasScale * fillFactor;
    } else {
      const baseScale=isMaxHeight
        ? (targetH / groupH)
        : Math.min(targetW/groupW, targetH/groupH);
      scale=Math.min(baseScale*rawOutputScale, maxCanvasScale);
    }
    const finalW=groupW*scale;
    const finalH=groupH*scale;
    const dx=(W-finalW)/2;
    const dy=(H-finalH)/2;
    ctx.save();
    ctx.imageSmoothingEnabled=true;
    ctx.imageSmoothingQuality='high';
    ctx.drawImage(g,dx,dy,finalW,finalH);
    ctx.restore();
    return c;
  }

  const rDropzone=document.getElementById('r-dropzone');
  const rFileInput=document.getElementById('r-fileInput');
  const rFilelist=document.getElementById('r-filelist');
  const rGenBtn=document.getElementById('r-generate');
  const rGenLogoOnlyBtn=document.getElementById('r-generateLogoOnly');
  const rStatus=document.getElementById('r-status');
  const rGrid=document.getElementById('r-previewGrid');
  const rOutput=document.getElementById('r-output');
  const rClinic=document.getElementById('r-clinic');
  const rCountry=document.getElementById('r-country');
  const rRemoveBg=document.getElementById('r-removeBg');
  const rTolWrap=document.getElementById('r-toleranceWrap');
  const rTolSlider=document.getElementById('r-tolerance');
  const rTolVal=document.getElementById('r-tolVal');
  const rCrop=document.getElementById('r-crop');
  const rCropHint=document.getElementById('r-cropHint');
  const rLiveWrap=document.getElementById('r-liveWrap');
  const rLiveFile=document.getElementById('r-liveFile');
  const rPrevBefore=document.getElementById('r-prevBefore');
  const rPrevAfter=document.getElementById('r-prevAfter');
  const rPrevFinal=document.getElementById('r-prevFinal');
  const rBatchNote=document.getElementById('r-batchNote');
  const rHeaderMarkPanel=document.getElementById('r-headerMarkPanel');
  const rAppBgPanel=document.getElementById('r-appBgPanel');
  const rAppBgEnabled=document.getElementById('r-appBgEnabled');
  const rAppBgColor=document.getElementById('r-appBgColor');
  const rAppBgColorWrap=document.getElementById('r-appBgColorWrap');
  const rAppBgColorSwatch=document.getElementById('r-appBgColorSwatch');
  const rAppBgColorHex=document.getElementById('r-appBgColorHex');
  const rHeaderText=document.getElementById('r-headerText');
  const rHeaderIncludeText=document.getElementById('r-headerIncludeText');
  const rHeaderTextControls=document.getElementById('r-headerTextControls');
  const rHeaderUseFilename=document.getElementById('r-headerUseFilename');
  const rHeaderAutoColor=document.getElementById('r-headerAutoColor');
  const rHeaderTextColor=document.getElementById('r-headerTextColor');
  const rHeaderTextHex=document.getElementById('r-headerTextHex');
  const rHeaderTextSrc=document.getElementById('r-headerTextSrc');
  const rHeaderTextSwatch=document.getElementById('r-headerTextSwatch');
  const rHeaderScale=document.getElementById('r-headerScale');
  const rHeaderScaleVal=document.getElementById('r-headerScaleVal');
  const rHeaderFitInputs=Array.from(document.querySelectorAll('input[name="r-headerFitMode"]'));
  const rEditorPanel=document.getElementById('r-editorPanel');
  const rEditorEmpty=document.getElementById('r-editorEmpty');
  const rEditorWrap=document.getElementById('r-editorWrap');
  const rEditorList=document.getElementById('r-editorList');
  const rEditCanvas=document.getElementById('r-editCanvas');
  const rToolCrop=document.getElementById('r-toolCrop');
  const rToolErase=document.getElementById('r-toolErase');
  const rBrushSize=document.getElementById('r-brushSize');
  const rBrushVal=document.getElementById('r-brushVal');
  const rApplyCrop=document.getElementById('r-applyCrop');
  const rUndoEdit=document.getElementById('r-undoEdit');
  const rResetEdit=document.getElementById('r-resetEdit');
  const rSaveEdit=document.getElementById('r-saveEdit');

  function rRefresh(){
    const isHeaderMark=rOutput.value==='headermark';
    rGenBtn.disabled=rFiles.length===0;
    if(isHeaderMark){
      rGenBtn.textContent=rFiles.length===0?'Add logomark PNGs to generate':`Generate ${rFiles.length} header${rFiles.length>1?'s':''}`;
    }else{
      rGenBtn.textContent=rFiles.length===0?'Add logo PNGs to generate':`Generate ${rFiles.length} app logo${rFiles.length>1?'s':''}`;
    }
    rGenLogoOnlyBtn.style.display=isHeaderMark?'':'none';
    rGenLogoOnlyBtn.disabled=rFiles.length===0;
    rGenLogoOnlyBtn.textContent=rFiles.length<=1?'Export Logo Only 800×220':`Export ${rFiles.length} Logo-Only Header${rFiles.length>1?'s':''}`;
  }

  function rUpdateHeaderMarkPanel(){
    const on=rOutput.value==='headermark';
    rHeaderMarkPanel.style.display=on?'':'none';
    rUpdateAppBgUi();
  }
  function rSyncHeaderTextColor(hex,srcLabel='Auto from uploaded mark'){
    const val=(hex||'#1A1A1A').toUpperCase();
    rHeaderTextColor.value=val;
    rHeaderTextHex.textContent=val;
    rHeaderTextSwatch.style.background=val;
    rHeaderTextSrc.textContent=srcLabel;
  }
  async function rResolveHeaderLabelAndColor(entry,img){
    if(!rHeaderIncludeText.checked){
      let color=rHeaderTextColor.value;
      if(rHeaderAutoColor.checked){ try{ color=extractBrandColor(img); }catch(e){} }
      return {label:'',color,includeText:false};
    }
    const perFile=(entry.headerText||'').trim();
    const manual=(rHeaderText.value||'').trim();
    const clinic=(rClinic.value||'').trim();
    const fromFile=titleCaseWords(entry.file.name);
    const label=perFile || manual || clinic || (rHeaderUseFilename.checked ? fromFile : 'Clinic Name');
    let color=rHeaderTextColor.value;
    if(rHeaderAutoColor.checked){
      try{ color=extractBrandColor(img); }catch(e){}
    }
    return {label,color,includeText:true};
  }


  let rEditEntry=null;
  let rEditMode='crop';
  let rWorkCanvas=null;
  let rCropRect=null;
  let rPointerDown=false;
  let rDragStart=null;
  let rLastPt=null;
  let rUndoStack=[];

  async function rGetSourceImage(entry){
    if(entry && entry.prepDataUrl) return await loadImageFromSrc(entry.prepDataUrl);
    return await loadImageFromFile(entry.file);
  }
  function rCloneCanvas(src){
    const c=document.createElement('canvas'); c.width=src.width; c.height=src.height;
    const cx=c.getContext('2d'); cx.imageSmoothingEnabled=true; cx.imageSmoothingQuality='high'; cx.drawImage(src,0,0);
    return c;
  }
  function rCanvasFromImage(img){
    const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
    const cx=c.getContext('2d'); cx.imageSmoothingEnabled=true; cx.imageSmoothingQuality='high'; cx.drawImage(img,0,0);
    return c;
  }
  function rCanvasToDataUrl(c){ return c.toDataURL('image/png'); }
  function rPushUndo(){
    if(!rWorkCanvas) return;
    rUndoStack.push(rCanvasToDataUrl(rWorkCanvas));
    if(rUndoStack.length>12) rUndoStack.shift();
  }
  async function rRestoreDataUrl(url){
    const img=await loadImageFromSrc(url);
    rWorkCanvas=rCanvasFromImage(img);
    rCropRect=null;
    rDrawEditor();
  }
  function rSetEditMode(mode){
    rEditMode=mode;
    rToolCrop.classList.toggle('active',mode==='crop');
    rToolErase.classList.toggle('active',mode==='erase');
    rEditCanvas.style.cursor=mode==='erase'?'cell':'crosshair';
  }
  function rCanvasPoint(evt){
    const rect=rEditCanvas.getBoundingClientRect();
    return {
      x:Math.max(0,Math.min(rEditCanvas.width,(evt.clientX-rect.left)*rEditCanvas.width/rect.width)),
      y:Math.max(0,Math.min(rEditCanvas.height,(evt.clientY-rect.top)*rEditCanvas.height/rect.height))
    };
  }
  function rDrawEditor(){
    if(!rWorkCanvas) return;
    rEditCanvas.width=rWorkCanvas.width;
    rEditCanvas.height=rWorkCanvas.height;
    const ctx=rEditCanvas.getContext('2d');
    ctx.clearRect(0,0,rEditCanvas.width,rEditCanvas.height);
    ctx.imageSmoothingEnabled=true; ctx.imageSmoothingQuality='high';
    ctx.drawImage(rWorkCanvas,0,0);
    if(rCropRect){
      const {x,y,w,h}=rCropRect;
      ctx.save();
      ctx.fillStyle='rgba(0,0,0,.45)';
      ctx.fillRect(0,0,rEditCanvas.width,rEditCanvas.height);
      ctx.clearRect(x,y,w,h);
      ctx.drawImage(rWorkCanvas,x,y,w,h,x,y,w,h);
      ctx.strokeStyle='rgba(217,79,181,.95)';
      ctx.lineWidth=Math.max(2,Math.round(Math.min(rEditCanvas.width,rEditCanvas.height)*0.006));
      ctx.setLineDash([10,8]);
      ctx.strokeRect(x,y,w,h);
      ctx.restore();
    }
  }
  function rCommitEditedMark(){
    if(!rEditEntry||!rWorkCanvas) return;
    rEditEntry.prepDataUrl=rCanvasToDataUrl(rWorkCanvas);
    rEditEntry.prepUrl=rEditEntry.prepDataUrl;
    rRenderList();
    rRenderEditorList();
    rUpdatePreview();
    rStatus.textContent=`Saved cleaned mark for ${rEditEntry.headerText||rEditEntry.file.name}`;
  }
  async function rSelectForEdit(id){
    const entry=rFiles.find(f=>f.id===id);
    if(!entry) return;
    rEditEntry=entry;
    const img=await rGetSourceImage(entry);
    rWorkCanvas=rCanvasFromImage(img);
    rCropRect=null;
    rUndoStack=[];
    rSetEditMode('crop');
    rDrawEditor();
    rRenderList();
    rRenderEditorList();
  }
  function rRenderEditorList(){
    const on=rOutput.value==='headermark';
    rEditorPanel.style.display=on?'':'none';
    if(!on) return;
    const has=rFiles.length>0;
    rEditorEmpty.style.display=has?'none':'';
    rEditorWrap.style.display=has?'':'none';
    rEditorList.innerHTML='';
    rFiles.forEach(entry=>{
      const row=document.createElement('div'); row.className='mark-editor-row'+(rEditEntry&&rEditEntry.id===entry.id?' active':'');
      const im=document.createElement('img'); im.src=entry.prepDataUrl || URL.createObjectURL(entry.file);
      const nm=document.createElement('div'); nm.className='mark-editor-row-name'; nm.textContent=entry.headerText||titleCaseWords(entry.file.name);
      row.append(im,nm);
      row.addEventListener('click',()=>rSelectForEdit(entry.id));
      rEditorList.appendChild(row);
    });
    if(has && (!rEditEntry || !rFiles.some(f=>f.id===rEditEntry.id))){
      setTimeout(()=>rSelectForEdit(rFiles[0].id),0);
    }
  }
  function rEraseAt(p,from){
    if(!rWorkCanvas) return;
    const ctx=rWorkCanvas.getContext('2d');
    ctx.save();
    ctx.globalCompositeOperation='destination-out';
    ctx.lineCap='round'; ctx.lineJoin='round';
    ctx.lineWidth=parseInt(rBrushSize.value,10)||34;
    ctx.beginPath();
    if(from){ ctx.moveTo(from.x,from.y); ctx.lineTo(p.x,p.y); }
    else { ctx.arc(p.x,p.y,ctx.lineWidth/2,0,Math.PI*2); }
    ctx.stroke();
    if(!from) ctx.fill();
    ctx.restore();
    rDrawEditor();
  }
  rToolCrop.addEventListener('click',()=>rSetEditMode('crop'));
  rToolErase.addEventListener('click',()=>rSetEditMode('erase'));
  rBrushSize.addEventListener('input',()=>{ rBrushVal.textContent=rBrushSize.value; });
  rEditCanvas.addEventListener('pointerdown',evt=>{
    if(!rWorkCanvas) return;
    rEditCanvas.setPointerCapture(evt.pointerId);
    rPointerDown=true;
    const p=rCanvasPoint(evt);
    if(rEditMode==='crop'){
      rDragStart=p; rCropRect={x:p.x,y:p.y,w:1,h:1}; rDrawEditor();
    }else{
      rPushUndo(); rLastPt=p; rEraseAt(p,null);
    }
  });
  rEditCanvas.addEventListener('pointermove',evt=>{
    if(!rPointerDown||!rWorkCanvas) return;
    const p=rCanvasPoint(evt);
    if(rEditMode==='crop'&&rDragStart){
      const x=Math.min(rDragStart.x,p.x), y=Math.min(rDragStart.y,p.y);
      const w=Math.abs(p.x-rDragStart.x), h=Math.abs(p.y-rDragStart.y);
      rCropRect={x,y,w,h}; rDrawEditor();
    }else if(rEditMode==='erase'){
      rEraseAt(p,rLastPt); rLastPt=p;
    }
  });
  function rEndPointer(){
    if(!rPointerDown) return;
    rPointerDown=false; rDragStart=null; rLastPt=null;
    if(rEditMode==='erase') rCommitEditedMark();
  }
  rEditCanvas.addEventListener('pointerup',rEndPointer);
  rEditCanvas.addEventListener('pointercancel',rEndPointer);
  rApplyCrop.addEventListener('click',()=>{
    if(!rWorkCanvas||!rCropRect||rCropRect.w<4||rCropRect.h<4) return;
    rPushUndo();
    const x=Math.round(rCropRect.x), y=Math.round(rCropRect.y), w=Math.round(rCropRect.w), h=Math.round(rCropRect.h);
    // Manual crop should match the visible crop box exactly.
    // Text/descender safety padding is handled later in the header renderer,
    // not by expanding the user's crop selection.
    const sx=Math.max(0,x), sy=Math.max(0,y);
    const ex=Math.min(rWorkCanvas.width,x+w), ey=Math.min(rWorkCanvas.height,y+h);
    const sw=Math.max(1,ex-sx), sh=Math.max(1,ey-sy);
    const cropped=document.createElement('canvas'); cropped.width=sw; cropped.height=sh;
    cropped.getContext('2d').drawImage(rWorkCanvas,sx,sy,sw,sh,0,0,sw,sh);
    rWorkCanvas=cropped; rCropRect=null; rDrawEditor(); rCommitEditedMark();
  });
  rUndoEdit.addEventListener('click',async()=>{
    if(!rUndoStack.length) return;
    const url=rUndoStack.pop();
    await rRestoreDataUrl(url);
    rCommitEditedMark();
  });
  rResetEdit.addEventListener('click',async()=>{
    if(!rEditEntry) return;
    delete rEditEntry.prepDataUrl; delete rEditEntry.prepUrl;
    const img=await loadImageFromFile(rEditEntry.file);
    rWorkCanvas=rCanvasFromImage(img); rCropRect=null; rUndoStack=[]; rDrawEditor();
    rRenderList(); rRenderEditorList(); rUpdatePreview();
  });
  rSaveEdit.addEventListener('click',rCommitEditedMark);

  function rRenderList(){
    rFilelist.innerHTML='';
    const isHeaderMark = rOutput.value === 'headermark';
    rFiles.forEach(entry=>{
      const row=document.createElement('div'); row.className='filerow';
      row.style.alignItems = isHeaderMark ? 'flex-start' : 'center';
      const th=document.createElement('img'); th.className='filerow-thumb'; th.src=entry.prepDataUrl || URL.createObjectURL(entry.file);
      const wrap=document.createElement('div'); wrap.className=isHeaderMark?'header-text-wrap':'filerow-name';
      const nm=document.createElement('div'); nm.className='filerow-name'; nm.textContent=entry.file.name;
      if(isHeaderMark){
        const lab=document.createElement('div'); lab.className='header-text-label'; lab.textContent='Header text for this logo';
        const input=document.createElement('input'); input.className='header-text-input';
        input.value=entry.headerText || titleCaseWords(entry.file.name);
        entry.headerText=input.value;
        input.addEventListener('input',()=>{ entry.headerText=input.value; rUpdatePreview(); });
        wrap.append(nm,lab,input);
      } else {
        wrap.textContent=entry.file.name;
      }
      const edit=document.createElement('button'); edit.className='mark-edit-btn'; edit.textContent=entry.prepDataUrl?'Edit cleaned mark':'Edit mark';
      edit.style.display=isHeaderMark?'':'none';
      edit.onclick=()=>rSelectForEdit(entry.id);
      const rm=document.createElement('button'); rm.className='filerow-remove'; rm.textContent='✕';
      rm.onclick=()=>{ rFiles=rFiles.filter(f=>f.id!==entry.id); if(rEditEntry&&rEditEntry.id===entry.id) rEditEntry=null; rRenderList(); rRenderEditorList(); rRefresh(); rUpdatePreview(); };
      row.classList.toggle('is-active', !!(rEditEntry&&rEditEntry.id===entry.id));
      row.append(th,wrap,edit,rm); rFilelist.appendChild(row);
    });
  }

  function rAddFiles(list){
    const incoming=Array.from(list).filter(f=>f.type==='image/png'||f.name.toLowerCase().endsWith('.png'));
    incoming.forEach(f=>rFiles.push({file:f,id:crypto.randomUUID(),headerText:titleCaseWords(f.name)}));
    if(incoming.length===1 && !rClinic.value.trim() && rOutput.value==='headermark'){
      rClinic.value=titleCaseWords(incoming[0].name);
    }
    rRenderList(); rRenderEditorList(); rRefresh(); rUpdatePreview();
    window.dispatchEvent(new CustomEvent('looped:header-updated'));
  }

  rDropzone.addEventListener('click',()=>rFileInput.click());
  rFileInput.addEventListener('change',e=>rAddFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev=>rDropzone.addEventListener(ev,e=>{e.preventDefault();rDropzone.classList.add('dragover');}));
  ['dragleave','drop'].forEach(ev=>rDropzone.addEventListener(ev,e=>{e.preventDefault();rDropzone.classList.remove('dragover');}));
  rDropzone.addEventListener('drop',e=>{if(e.dataTransfer.files)rAddFiles(e.dataTransfer.files);});

  rRemoveBg.addEventListener('change',()=>{
    rTolWrap.style.display=rRemoveBg.checked?'':'none'; rUpdatePreview();
  });
  rCrop.addEventListener('change',()=>{ rCropHint.style.display=rCrop.checked?'':'none'; rUpdatePreview(); });
  rOutput.addEventListener('change',()=>{ rUpdateHeaderMarkPanel(); rRenderList(); rRenderEditorList(); rRefresh(); rUpdatePreview(); });
  rAppBgEnabled.addEventListener('change',()=>{rUpdateAppBgUi();rUpdatePreview();const d=document.getElementById('d-appBgEnabled');if(d&&d.checked!==rAppBgEnabled.checked){d.checked=rAppBgEnabled.checked;d.dispatchEvent(new Event('change',{bubbles:true}));}});
  rAppBgColor.addEventListener('input',()=>{rUpdateAppBgUi();rUpdatePreview();const d=document.getElementById('d-appBgColor');if(d&&d.value.toLowerCase()!==rAppBgColor.value.toLowerCase()){d.value=rAppBgColor.value;d.dispatchEvent(new Event('input',{bubbles:true}));}});
  function rUpdateHeaderTextToggleUi(){
    const on=rHeaderIncludeText.checked;
    if(rHeaderTextControls) rHeaderTextControls.style.display=on?'':'none';
    rHeaderUseFilename.closest('.toggle-row').style.display=on?'':'none';
    rHeaderAutoColor.closest('.toggle-row').style.display=on?'':'none';
  }
  [rHeaderText,rClinic].forEach(el=>el.addEventListener('input',rUpdatePreview));
  [rHeaderUseFilename,rHeaderAutoColor].forEach(el=>el.addEventListener('change',rUpdatePreview));
  rHeaderIncludeText.addEventListener('change',()=>{
    rUpdateHeaderTextToggleUi();
    const d=document.getElementById('d-headerText');
    if(d && d.checked!==rHeaderIncludeText.checked){d.checked=rHeaderIncludeText.checked;d.dispatchEvent(new Event('change',{bubbles:true}));}
    rUpdatePreview();
    setTimeout(rNotifyMockup,0);
  });
  rUpdateHeaderTextToggleUi();
  rHeaderTextColor.addEventListener('input',()=>{ rSyncHeaderTextColor(rHeaderTextColor.value,'Manual override'); rUpdatePreview(); });
  rHeaderScale.addEventListener('input',()=>{ rHeaderScaleVal.textContent=`${rHeaderScale.value}%`; rUpdatePreview(); });
  rHeaderFitInputs.forEach(el=>el.addEventListener('change',rUpdatePreview));
  let rTolTimer=null;
  rTolSlider.addEventListener('input',()=>{ rTolVal.textContent=rTolSlider.value; clearTimeout(rTolTimer); rTolTimer=setTimeout(rUpdatePreview,60); });

  async function rUpdatePreview(){
    const special=rOutput.value==='headermark';
    const anyOn=special||rRemoveBg.checked||rCrop.checked||(rOutput.value==='app'&&rAppBgEnabled.checked);
    if(!anyOn||rFiles.length===0){ rLiveWrap.style.display='none'; return; }
    rLiveWrap.style.display=''; rBatchNote.style.display=rFiles.length>1?'':'none';
    const entry=rFiles[0]; rLiveFile.textContent=entry.file.name;
    if(!rPreviewCache||rPreviewCache.id!==entry.id||rPreviewCache.prep!==(entry.prepDataUrl||'')){
      const img=await rGetSourceImage(entry); rPreviewCache={id:entry.id,prep:entry.prepDataUrl||'',img};
      rPrevBefore.src=img.src;
    }
    let proc=rPreviewCache.img;
    if(rRemoveBg.checked) proc=removeSolidBackground(proc,parseInt(rTolSlider.value));
    if(rCrop.checked){
      const ai=proc instanceof HTMLCanvasElement?await loadImageFromBlob(await canvasToBlob(proc)):proc;
      proc=cropToContent(ai);
    }
    const asC=proc instanceof HTMLCanvasElement?proc:(()=>{const c=document.createElement('canvas');c.width=proc.width;c.height=proc.height;c.getContext('2d').drawImage(proc,0,0);return c;})();
    drawCanvasToEl(asC,rPrevAfter,180);
    const spec=R_SPECS[rOutput.value];
    const ai2=proc instanceof HTMLCanvasElement?await loadImageFromBlob(await canvasToBlob(proc)):proc;
    let fc;
    if(spec.special==='headermark'){
      const resolved=await rResolveHeaderLabelAndColor(entry,ai2);
      if(rHeaderAutoColor.checked) rSyncHeaderTextColor(resolved.color,'Auto from uploaded mark');
      fc=resolved.includeText===false?renderHeaderLogoOnly(ai2):renderHeaderMark(ai2,resolved.label,resolved.color);
    } else if(spec.special==='normalizedheader'){
      fc=renderNormalizedHeaderCanvas(ai2);
    } else {
      fc=fitAndPad(ai2,spec.w,spec.h);
    }
    fc=rApplyAppBackground(fc);
    drawCanvasToEl(fc,rPrevFinal,180);
  }

  async function rExportHeaderLogoOnly(){
    if(!rFiles.length)return;
    rGenLogoOnlyBtn.disabled=true; rGenBtn.disabled=true; rStatus.textContent='Exporting logo-only headers…'; rGrid.innerHTML='';
    const clinic=sanitize(rClinic.value,'Clinic');
    const zip=new JSZip(), results=[];
    for(const entry of rFiles){
      try{
        let img=await rGetSourceImage(entry), src=img;
        if(rRemoveBg.checked){ const bc=removeSolidBackground(img,parseInt(rTolSlider.value)); src=await loadImageFromBlob(await canvasToBlob(bc)); }
        if(rCrop.checked){ const cc=cropToContent(src); src=await loadImageFromBlob(await canvasToBlob(cc)); }
        let c=renderHeaderLogoOnly(src);
        c=rApplyAppBackground(c);
        const blob=await canvasToBlob(c);
        const base=entry.file.name.replace(/\.png$/i,'');
        const labelSource = (entry.headerText || rHeaderText.value || rClinic.value || base || 'clinic');
        const fn = `${slugifyHeaderName(titleCaseWords(labelSource))}-logoonly.png`;
        zip.file(fn,blob); results.push({filename:fn,blob});
      }catch(e){console.error(e);}
    }
    results.forEach(r=>{
      const card=document.createElement('div'); card.className='preview-card';
      const im=document.createElement('img'); im.src=URL.createObjectURL(r.blob);
      const nm=document.createElement('div'); nm.className='preview-card-name'; nm.textContent=r.filename;
      card.append(im,nm); rGrid.appendChild(card);
    });
    if(results.length===1){
      downloadBlob(results[0].blob,results[0].filename);
      rStatus.textContent=`Downloaded ${results[0].filename}`;
    } else {
      const content=await zip.generateAsync({type:'blob'});
      downloadBlob(content,'logoonly_headers_batch.zip');
      rStatus.textContent=`Downloaded ${results.length} logo-only headers as zip`;
    }
    rRefresh();
  }

  rGenLogoOnlyBtn.addEventListener('click',rExportHeaderLogoOnly);

  rGenBtn.addEventListener('click',async()=>{
    if(!rFiles.length)return;
    rGenBtn.disabled=true; rStatus.textContent='Processing…'; rGrid.innerHTML='';
    const spec=R_SPECS[rOutput.value];
    const clinic=sanitize(rClinic.value,'Clinic'), country=sanitize(rCountry.value,'XX');
    const zip=new JSZip(), results=[];
    for(const entry of rFiles){
      try{
        let img=spec.special==='headermark'?await rGetSourceImage(entry):await loadImageFromFile(entry.file), src=img;
        if(rRemoveBg.checked){ const bc=removeSolidBackground(img,parseInt(rTolSlider.value)); src=await loadImageFromBlob(await canvasToBlob(bc)); }
        if(rCrop.checked){ const cc=cropToContent(src); src=await loadImageFromBlob(await canvasToBlob(cc)); }
        let c;
        if(spec.special==='headermark'){
          const resolved=await rResolveHeaderLabelAndColor(entry,src);
          c=resolved.includeText===false?renderHeaderLogoOnly(src):renderHeaderMark(src,resolved.label,resolved.color);
        } else if(spec.special==='normalizedheader'){
          c=renderNormalizedHeaderCanvas(src);
        } else {
          c=fitAndPad(src,spec.w,spec.h);
        }
        c=rApplyAppBackground(c);
        const blob=await canvasToBlob(c);
        const base=entry.file.name.replace(/\.png$/i,'');
        let fn;
        if(spec.special==='headermark'){
          const labelSource = (entry.headerText || rHeaderText.value || rClinic.value || base || 'clinic');
          fn = `${slugifyHeaderName(titleCaseWords(labelSource))}-logomark.png`;
        } else {
          const hasNamingFields=!!rClinic.value.trim() || !!rCountry.value.trim();
          if(spec.s==='app' && !hasNamingFields){
            // Quick App Logo workflow: keep the uploaded filename exactly so
            // teams can export and move on without renaming Clinic_app_XX.png.
            fn=entry.file.name.toLowerCase().endsWith('.png') ? entry.file.name : `${base}.png`;
          } else {
            fn=rFiles.length>1?`${clinic}_${spec.s}_${country}_${sanitize(base,'logo')}.png`:`${clinic}_${spec.s}_${country}.png`;
          }
        }
        zip.file(fn,blob); results.push({filename:fn,blob});
      }catch(e){console.error(e);}
    }
    results.forEach(r=>{
      const card=document.createElement('div'); card.className='preview-card';
      const im=document.createElement('img'); im.src=URL.createObjectURL(r.blob);
      const nm=document.createElement('div'); nm.className='preview-card-name'; nm.textContent=r.filename;
      card.append(im,nm); rGrid.appendChild(card);
    });
    if(results.length===1){
      downloadBlob(results[0].blob,results[0].filename);
      rStatus.textContent=`Downloaded ${results[0].filename}`;
    } else {
      const content=await zip.generateAsync({type:'blob'});
      downloadBlob(content,spec.special==='headermark'?`logomarks_batch.zip`:`${clinic}_${spec.s}_${country}_batch.zip`);
      rStatus.textContent=`Downloaded ${results.length} files as zip`;
    }
    rRefresh();
  });
  rRefresh();
  rRenderEditorList();
  rUpdateHeaderMarkPanel();
  rSyncHeaderTextColor('#1A1A1A','Auto from uploaded mark');


  window.LoopedWL = window.LoopedWL || {};
  window.LoopedWL.setDashboardLogoFile = async function(file,headerLabel=''){
    if(!file) return;
    rFiles=[{
      file,
      id:`dashboard-logo-${Date.now()}`,
      headerText:(headerLabel||rClinic.value||titleCaseWords(file.name)).trim(),
      dashboardManaged:true
    }];
    rPreviewCache=null;
    rEditEntry=null;
    rWorkCanvas=null;
    rCropRect=null;
    rUndoStack=[];
    if(rFileInput) rFileInput.value='';
    rRenderList();
    rRenderEditorList();
    rRefresh();
    await rUpdatePreview();
    window.dispatchEvent(new CustomEvent('looped:header-updated'));
  };
  window.LoopedWL.getCurrentHeaderMarkCanvas = async function(){
    if(!rFiles.length) return null;
    const entry=rFiles[0];
    let proc=await rGetSourceImage(entry);
    if(rRemoveBg.checked){
      const bgRemoved=removeSolidBackground(proc,parseInt(rTolSlider.value,10));
      proc=await loadImageFromBlob(await canvasToBlob(bgRemoved));
    }
    if(rCrop.checked){
      proc=cropToContent(proc);
      if(proc instanceof HTMLCanvasElement) proc=await loadImageFromBlob(await canvasToBlob(proc));
    }
    const resolved=await rResolveHeaderLabelAndColor(entry,proc);
    return resolved.includeText===false?renderHeaderLogoOnly(proc):renderHeaderMark(proc,resolved.label,resolved.color);
  };
  window.LoopedWL.getCurrentHeaderBrandColor = async function(){
    if(!rFiles.length) return null;
    const entry=rFiles[0];
    const img=await rGetSourceImage(entry);
    try{return extractBrandColor(img);}catch(err){return null;}
  };
  const rNotifyMockup=()=>window.dispatchEvent(new CustomEvent('looped:header-updated'));
  rFileInput.addEventListener('change',()=>setTimeout(rNotifyMockup,80));
  [rHeaderText,rClinic,rHeaderTextColor,rHeaderScale].forEach(el=>el.addEventListener('input',()=>setTimeout(rNotifyMockup,0)));
  [rOutput,rHeaderUseFilename,rHeaderAutoColor,rHeaderIncludeText].forEach(el=>el.addEventListener('change',()=>setTimeout(rNotifyMockup,0)));
})();

// ════════════════════════════════════════════════════════════════════════════
// TAB 2 — BULK BACKGROUND GENERATOR
// ════════════════════════════════════════════════════════════════════════════
(() => {
  const STYLES=['atmospheric','top-bottom','bottom-top','diagonal','sandwich','left-right'];
  const SAMPLE='#13bfb5';
  let entries=[];
  const $=id=>document.getElementById(id);
  const mixBlack=(hex,t)=>{const c=hexToRgb(hex);return rgbToHex(Math.round(c.r*(1-t)),Math.round(c.g*(1-t)),Math.round(c.b*(1-t)));};
  function paint(canvas,brand,style){
    const ctx=canvas.getContext('2d'),W=canvas.width,H=canvas.height;ctx.clearRect(0,0,W,H);
    if(style==='atmospheric'){
      const bc=hexToRgb(brand),im=ctx.createImageData(W,H),d=im.data,aspect=H/W;
      for(let y=0;y<H;y++){const ty=y/(H-1),dy=(ty-.5)/aspect;for(let x=0;x<W;x++){const tx=x/(W-1),dx=tx-1,dist=Math.sqrt(dx*dx+dy*dy),v=Math.max(0,1-dist),i=(y*W+x)*4;d[i]=Math.round(bc.r*v);d[i+1]=Math.round(bc.g*v);d[i+2]=Math.round(bc.b*v);d[i+3]=255;}}
      ctx.putImageData(im,0,0);return;
    }
    const dark=mixBlack(brand,.88);let g;
    if(style==='top-bottom'){g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,dark);g.addColorStop(1,brand);}
    else if(style==='bottom-top'){g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,brand);g.addColorStop(1,dark);}
    else if(style==='diagonal'){g=ctx.createLinearGradient(0,H,W,0);g.addColorStop(0,dark);g.addColorStop(1,brand);}
    else if(style==='left-right'){g=ctx.createLinearGradient(0,0,W,0);g.addColorStop(0,dark);g.addColorStop(1,brand);}
    else {g=ctx.createLinearGradient(0,0,0,H);g.addColorStop(0,dark);g.addColorStop(.35,brand);g.addColorStop(.65,brand);g.addColorStop(1,dark);}
    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);
  }
  const style=()=>document.querySelector('input[name="bb-gradStyle"]:checked')?.value||'atmospheric';
  function renderStylePreviews(){STYLES.forEach(st=>{const c=$('bb-prev-'+st);c.width=160;c.height=56;paint(c,SAMPLE,st);});}
  function refresh(){entries.forEach(e=>{e.preview.width=54;e.preview.height=32;paint(e.preview,e.brand,style());});}
  function extract(img){
    const c=document.createElement('canvas');c.width=img.width;c.height=img.height;const x=c.getContext('2d');x.drawImage(img,0,0);const d=x.getImageData(0,0,c.width,c.height).data,counts=new Map();
    for(let i=0;i<d.length;i+=4){const r=d[i],g=d[i+1],b=d[i+2],a=d[i+3],br=(r+g+b)/3;if(a<=200||br>=235||br<=20)continue;const mx=Math.max(r,g,b),mn=Math.min(r,g,b);if(mx>0&&(mx-mn)/mx<=.15)continue;const k=`${r>>2},${g>>2},${b>>2}`;counts.set(k,(counts.get(k)||0)+1);}
    if(!counts.size)return SAMPLE;let best,bn=-1;for(const [k,n] of counts)if(n>bn){best=k;bn=n;}const [r,g,b]=best.split(',').map(Number);return rgbToHex(r<<2,g<<2,b<<2);
  }
  const load=url=>new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=rej;i.src=url;});
  const safe=(v,fb)=>(v||'').trim().replace(/[^a-zA-Z0-9_-]+/g,'_')||fb;
  function fileName(n){const skip=new Set(['logo','icon','png','image','img','final','new','transparent','alpha','bg','nobg','white','black','color','light','dark','clinic','resized','export','copy','updated']);const w=n.replace(/\.(png|jpg|jpeg)$/i,'').split(/[\s_\-.]+/).filter(v=>v&&!skip.has(v.toLowerCase()));return w.slice(0,2).map(v=>v[0].toUpperCase()+v.slice(1).toLowerCase()).join(' ')||'Clinic';}
  function update(){const n=entries.length;$('bb-tablePanel').style.display=n?'':'none';$('bb-countLabel').textContent=`(${n})`;$('bb-exportBtn').disabled=!n;$('bb-exportBtn').textContent=n?`Export ${n} background${n>1?'s':''} as ZIP`:'Export All as ZIP';}
  async function add(files){for(const file of [...files].filter(f=>/\.png$/i.test(f.name))){const url=URL.createObjectURL(file),img=await load(url),brand=extract(img),id=crypto.randomUUID(),entry={id,file,img,brand};const row=document.createElement('div');row.className='bulk-bg-row';const thumb=document.createElement('img');thumb.className='bulk-bg-thumb';thumb.src=url;const name=document.createElement('input');name.className='bulk-bg-input';name.value=fileName(file.name);const country=document.createElement('input');country.className='bulk-bg-input';country.value=$('bb-defaultCountry').value||'US';const cw=document.createElement('div');cw.className='bulk-bg-color';const dot=document.createElement('div');dot.className='bulk-bg-dot';dot.style.background=brand;const cp=document.createElement('input');cp.type='color';cp.value=brand;dot.appendChild(cp);const hx=document.createElement('span');hx.className='bulk-bg-hex';hx.textContent=brand.toUpperCase();cw.append(dot,hx);const prev=document.createElement('canvas');prev.className='bulk-bg-preview';prev.width=54;prev.height=32;paint(prev,brand,style());const stat=document.createElement('span');stat.style.fontSize='11px';stat.style.color='var(--text-dim)';stat.textContent='Ready';const rm=document.createElement('button');rm.className='bulk-bg-remove';rm.textContent='✕';rm.onclick=()=>{entries=entries.filter(e=>e.id!==id);row.remove();update();};cp.oninput=()=>{entry.brand=cp.value;dot.style.background=cp.value;hx.textContent=cp.value.toUpperCase();paint(prev,entry.brand,style());window.dispatchEvent(new CustomEvent('looped:background-updated'));};row.append(thumb,name,country,cw,prev,stat,rm);$('bb-rowContainer').appendChild(row);Object.assign(entry,{name,country,preview:prev,status:stat});entries.push(entry);}update();}
  renderStylePreviews();
  document.querySelectorAll('input[name="bb-gradStyle"]').forEach(r=>r.addEventListener('change',()=>{STYLES.forEach(st=>$('bb-opt-'+st).classList.toggle('active',$('bb-opt-'+st).querySelector('input').checked));refresh();window.dispatchEvent(new CustomEvent('looped:background-updated'));}));
  const drop=$('bb-drop'),input=$('bb-fileInput');drop.onclick=()=>input.click();input.onchange=e=>e.target.files.length&&add(e.target.files);['dragenter','dragover'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('over');}));['dragleave','drop'].forEach(ev=>drop.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('over');}));drop.addEventListener('drop',e=>e.dataTransfer.files.length&&add(e.dataTransfer.files));
  $('bb-exportBtn').onclick=async()=>{if(!entries.length)return;const btn=$('bb-exportBtn');btn.disabled=true;$('bb-progressWrap').style.display='block';$('bb-status').textContent='Generating backgrounds…';const zip=new JSZip(),st=style();for(let i=0;i<entries.length;i++){const e=entries[i];try{e.status.textContent='…';const c=document.createElement('canvas');c.width=2160;c.height=3840;paint(c,e.brand,st);const blob=await canvasToBlob(c);zip.file(`${safe(e.name.value,'Clinic')}_background_${safe(e.country.value,'XX')}.png`,blob);e.status.textContent='✓';e.status.style.color='#4fd18b';}catch(err){console.error(err);e.status.textContent='Error';e.status.style.color='#ef6a6a';}$('bb-progressBar').style.width=`${(i+1)/entries.length*100}%`;}
    const content=await zip.generateAsync({type:'blob'}),a=document.createElement('a');a.href=URL.createObjectURL(content);a.download=`backgrounds_bulk_${Date.now()}.zip`;a.click();$('bb-status').textContent=`✓ Downloaded ${entries.length} background${entries.length>1?'s':''} at 2160×3840`;btn.disabled=false;};
})();

// TAB 3 — HERO CARD COMPOSER (premium layout)
// ════════════════════════════════════════════════════════════════════════════
(function(){
  let hLogo=null, hAccent='#7c6bb5', hColor2='#a99dd4', hHeadlineColor='#7c6bb5', hSubtextColor='#7c6bb5', hSecondaryAuto=true;
  let hHeadlineColorLocked=false, hSubtextColorLocked=false;
  let hLogoScale=1;
  let hBgImage=null, hBgPresetKey='bg1', hBgTintStrength=0.35, hBgTintColor='#7c6bb5';
  let hBgTintAutoSync=true;
  let hBgScale=1, hBgPanX=0.5, hBgPanY=0.5;
  let hBulkFiles=[];
  let hBulkItems=[];
  let hBulkSelectedIndex=-1;
  let hBulkApplyingState=false;
  const CARD_W=560, CARD_H=320, XSCALE=2;

  // DOM refs
  const hClinic      = document.getElementById('h-clinic');
  const hDescriptor  = document.getElementById('h-descriptor');
  const hCountry     = document.getElementById('h-country');
  const hLogoSlot    = document.getElementById('h-logoSlot');
  const hLogoFile    = document.getElementById('h-logoFile');
  const hLogoPreview = document.getElementById('h-logoPreview');
  const hLogoClear   = document.getElementById('h-logoClear');
  const hLogoSize    = document.getElementById('h-logoSize');
  const hLogoSizeVal = document.getElementById('h-logoSizeVal');
  const hBgPreset    = document.getElementById('h-bgPreset');
  const hBgSlot      = document.getElementById('h-bgSlot');
  const hBgFile      = document.getElementById('h-bgFile');
  const hBgPreview   = document.getElementById('h-bgPreview');
  const hBgClear     = document.getElementById('h-bgClear');
  const hBgSrc       = document.getElementById('h-bgSrc');
  const hBgTint      = document.getElementById('h-bgTint');
  const hBgTintVal   = document.getElementById('h-bgTintVal');
  const hBgTintSwatch = document.getElementById('h-bgTintSwatch');
  const hBgTintPicker = document.getElementById('h-bgTintPicker');
  const hBgTintHex    = document.getElementById('h-bgTintHex');
  const hBgTintSrc    = document.getElementById('h-bgTintSrc');
  const hBgTintAutoSyncEl = document.getElementById('h-bgTintAutoSync');
  const hBgScaleEl    = document.getElementById('h-bgScale');
  const hBgScaleVal   = document.getElementById('h-bgScaleVal');
  const hBgPanXEl     = document.getElementById('h-bgPanX');
  const hBgPanYEl     = document.getElementById('h-bgPanY');
  const hAccentSwatch  = document.getElementById('h-accentSwatch');
  const hAccentPicker  = document.getElementById('h-accentPicker');
  const hAccentHex     = document.getElementById('h-accentHex');
  const hAccentSrc     = document.getElementById('h-accentSrc');
  const hColor2Swatch  = document.getElementById('h-color2Swatch');
  const hColor2Picker  = document.getElementById('h-color2Picker');
  const hColor2Hex     = document.getElementById('h-color2Hex');
  const hColor2Src     = document.getElementById('h-color2Src');
  const hHeadlineColorSwatch = document.getElementById('h-headlineColorSwatch');
  const hHeadlineColorPicker = document.getElementById('h-headlineColorPicker');
  const hHeadlineColorHex = document.getElementById('h-headlineColorHex');
  const hHeadlineColorSrc = document.getElementById('h-headlineColorSrc');
  const hSubtextColorSwatch = document.getElementById('h-subtextColorSwatch');
  const hSubtextColorPicker = document.getElementById('h-subtextColorPicker');
  const hSubtextColorHex = document.getElementById('h-subtextColorHex');
  const hSubtextColorSrc = document.getElementById('h-subtextColorSrc');
  const hHeadline    = document.getElementById('h-headline');
  const hSubtext     = document.getElementById('h-subtext');
  const hTexStyle    = document.getElementById('h-texStyle');
  const hTexStrength = document.getElementById('h-texStrength');
  const hTexStrengthVal = document.getElementById('h-texStrengthVal');
  const hCanvas      = document.getElementById('h-canvas');
  const hExport      = document.getElementById('h-export');
  const hStatus      = document.getElementById('h-status');
  const hBulkLogoSlot = document.getElementById('h-bulkLogoSlot');
  const hBulkLogoFiles = document.getElementById('h-bulkLogoFiles');
  const hBulkCount   = document.getElementById('h-bulkCount');
  const hBulkEditorWrap = document.getElementById('h-bulkEditorWrap');
  const hBulkEditorList = document.getElementById('h-bulkEditorList');
  const hBulkEditorStatus = document.getElementById('h-bulkEditorStatus');
  const hBulkSaveCurrent = document.getElementById('h-bulkSaveCurrent');
  const hBulkUseFilename = document.getElementById('h-bulkUseFilename');
  const hBulkExport  = document.getElementById('h-bulkExport');
  const hBulkStatus  = document.getElementById('h-bulkStatus');

  // Helpers
  function lighten(hex, amount) {
    const c=hexToRgb(hex);
    return rgbToHex(Math.round(c.r+(255-c.r)*amount),Math.round(c.g+(255-c.g)*amount),Math.round(c.b+(255-c.b)*amount));
  }
  function clamp01(v){ return Math.max(0, Math.min(1, v)); }
  function rgbToHsl(r,g,b){
    r/=255; g/=255; b/=255;
    const max=Math.max(r,g,b), min=Math.min(r,g,b);
    let h,s,l=(max+min)/2;
    if(max===min){ h=s=0; }
    else {
      const d=max-min;
      s=l>0.5 ? d/(2-max-min) : d/(max+min);
      switch(max){
        case r: h=(g-b)/d + (g<b ? 6 : 0); break;
        case g: h=(b-r)/d + 2; break;
        default: h=(r-g)/d + 4; break;
      }
      h/=6;
    }
    return {h,s,l};
  }
  function hslToRgb(h,s,l){
    let r,g,b;
    if(s===0){ r=g=b=l; }
    else {
      const hue2rgb = (p,q,t)=>{
        if(t<0) t+=1; if(t>1) t-=1;
        if(t<1/6) return p+(q-p)*6*t;
        if(t<1/2) return q;
        if(t<2/3) return p+(q-p)*(2/3-t)*6;
        return p;
      };
      const q = l < 0.5 ? l*(1+s) : l+s-l*s;
      const p = 2*l-q;
      r = hue2rgb(p,q,h+1/3);
      g = hue2rgb(p,q,h);
      b = hue2rgb(p,q,h-1/3);
    }
    return { r:Math.round(r*255), g:Math.round(g*255), b:Math.round(b*255) };
  }
  function hNormalizeBrandColor(hex, mode='text'){
    const c = hexToRgb(hex);
    const hsl = rgbToHsl(c.r, c.g, c.b);
    let h=hsl.h, s=hsl.s, l=hsl.l;
    if(mode === 'text'){
      s = Math.min(Math.max(s * 0.88, 0.34), 0.72);
      l = Math.min(Math.max(l * 0.88, 0.34), 0.46);
    } else if(mode === 'tint'){
      s = Math.min(Math.max(s * 0.52, 0.16), 0.40);
      l = Math.min(Math.max(0.60 + (l - 0.5) * 0.16, 0.54), 0.67);
    }
    const rgb = hslToRgb(h, clamp01(s), clamp01(l));
    return rgbToHex(rgb.r, rgb.g, rgb.b);
  }
  function hSetPrimary(hex,src){ hAccent=hex; hAccentPicker.value=hex; hAccentSwatch.style.background=hex; hAccentHex.textContent=hex.toUpperCase(); hAccentSrc.textContent=src; hRender(); }
  function hSetSecondary(hex,src){ hColor2=hex; hColor2Picker.value=hex; hColor2Swatch.style.background=hex; hColor2Hex.textContent=hex.toUpperCase(); hColor2Src.textContent=src; hRender(); }
  function hSetHeadlineColor(hex,src,locked=false){ hHeadlineColor=hex; if(locked) hHeadlineColorLocked=true; hHeadlineColorPicker.value=hex; hHeadlineColorSwatch.style.background=hex; hHeadlineColorHex.textContent=hex.toUpperCase(); hHeadlineColorSrc.textContent=src; hRender(); }
  function hSetSubtextColor(hex,src,locked=false){ hSubtextColor=hex; if(locked) hSubtextColorLocked=true; hSubtextColorPicker.value=hex; hSubtextColorSwatch.style.background=hex; hSubtextColorHex.textContent=hex.toUpperCase(); hSubtextColorSrc.textContent=src; hRender(); }
  function hSetBgTintColor(hex,src){ hBgTintColor=hex; hBgTintPicker.value=hex; hBgTintSwatch.style.background=hex; hBgTintHex.textContent=hex.toUpperCase(); hBgTintSrc.textContent=src; hRender(); }
  function hApplyBrandColor(hex,src){
    const normalizedTextHex = hNormalizeBrandColor(hex, 'text');
    const normalizedTintHex = hNormalizeBrandColor(hex, 'tint');
    hSetPrimary(normalizedTextHex, src + ' · standardized for headline depth');
    if(!hHeadlineColorLocked) hSetHeadlineColor(normalizedTextHex, 'Auto-matched to primary');
    if(!hSubtextColorLocked) hSetSubtextColor(normalizedTextHex, 'Auto-matched to primary');
    if(hBgTintAutoSync) hSetBgTintColor(normalizedTintHex, src.replace('Auto-extracted','Background tint auto-extracted') + ' · standardized');
    if(hSecondaryAuto) hSetSecondary(lighten(normalizedTextHex,0.35),'Auto-derived from primary');
  }
  function hApplyManualBrandColor(hex){
    // Manual picker values should be respected exactly. Earlier versions routed
    // manual picks through the auto-normalizer, which prevented true black from
    // sticking as a hero card brand color.
    const exact=(hex||'#000000').toUpperCase();
    hSetPrimary(exact,'Manually selected');
    // Text colors are intentionally independent controls. Do not reset them when
    // the primary brand color changes; this was causing manual text colors to revert.
    if(hBgTintAutoSync) hSetBgTintColor(exact,'Background tint synced to manually selected brand color');
    if(hSecondaryAuto) hSetSecondary(lighten(exact,0.35),'Auto-derived from primary');
  }

  const H_BG_PRESETS = {
    bg1: { src: 'assets/hero-bg-1-soft-sage-edge-flow.png', label: 'Soft Sage Edge Flow' },
    bg2: { src: 'assets/hero-bg-2-sage-split-flow.png', label: 'Sage Split Flow' },
    bg3: { src: 'assets/hero-bg-3-warm-cream-side-flow.png', label: 'Warm Cream Side Flow' },
    bg4: { src: 'assets/hero-bg-4-blush-stone-side-flow.png', label: 'Blush Stone Side Flow' },
    bg5: { src: 'assets/hero-bg-5-ivory-corner-flow.png', label: 'Ivory Corner Flow' }
  };

  function hHasCardBackground(){ return !!hBgImage; }

  function hDrawCoverImage(ctx, img, x, y, w, h){
    const iw = img.naturalWidth || img.width || 1;
    const ih = img.naturalHeight || img.height || 1;
    const baseScale = Math.max(w / iw, h / ih);
    const s = baseScale * hBgScale;
    const dw = iw * s, dh = ih * s;
    const extraX = Math.max(0, dw - w);
    const extraY = Math.max(0, dh - h);
    const drawX = x - extraX * hBgPanX;
    const drawY = y - extraY * hBgPanY;
    ctx.drawImage(img, drawX, drawY, dw, dh);
  }

  function hUpdateBulkCount(){
    hBulkCount.textContent = hBulkFiles.length ? `${hBulkFiles.length} logo${hBulkFiles.length===1?'':'s'} ready for batch export` : 'No bulk logos selected';
    hBulkEditorWrap.style.display = hBulkFiles.length ? '' : 'none';
  }

  function hBaseName(name){ return (name||'').replace(/\.[^.]+$/, ''); }
  function hCreateBulkItem(file){
    const base=hBaseName(file.name);
    return {
      file,
      clinic: hBulkUseFilename.checked ? base : (hClinic.value || base),
      descriptor: hDescriptor.value || '',
      country: hCountry.value || '',
      headline: hHeadline.value || 'Welcome,',
      subtext: hSubtext.value || '',
      logoScale: hLogoScale,
      accent: null,
      color2: null,
      headlineColor: null,
      subtextColor: null,
      headlineColorLocked: false,
      subtextColorLocked: false,
      bgTintColor: null,
      bgTintAutoSync: true,
      accentSrc: '',
      color2Src: '',
      headlineColorSrc: '',
      subtextColorSrc: '',
      bgTintSrc: '',
      previewSrc: URL.createObjectURL(file),
      prepared: false,
      croppedLogo: null,
      originalImage: null
    };
  }
  async function hPrepareBulkItem(item){
    if(item.prepared && item.croppedLogo) return item;
    const img = await loadImageFromFile(item.file);
    item.originalImage = img;
    item.croppedLogo = hCropToContent(img);
    const ex = extractBrandColor(img) || hAccent;
    item.autoAccent = hNormalizeBrandColor(ex, 'text');
    item.autoBgTintColor = hNormalizeBrandColor(ex, 'tint');
    item.autoColor2 = lighten(item.autoAccent, 0.35);
    if(!item.accent){ item.accent = item.autoAccent; item.accentSrc = `Auto-extracted from ${item.file.name} · standardized for headline depth`; }
    if(!item.color2){ item.color2 = item.autoColor2; item.color2Src = 'Auto-derived from primary'; }
    if(!item.headlineColor){ item.headlineColor = item.autoAccent; item.headlineColorSrc = 'Auto-matched to primary'; }
    if(!item.subtextColor){ item.subtextColor = item.autoAccent; item.subtextColorSrc = 'Auto-matched to primary'; }
    if(!item.bgTintColor){ item.bgTintColor = item.autoBgTintColor; item.bgTintSrc = `Background tint auto-extracted from ${item.file.name} · standardized`; }
    if(typeof item.bgTintAutoSync !== 'boolean') item.bgTintAutoSync = true;
    item.prepared = true;
    return item;
  }
  function hSnapshotEditorState(){
    return {
      clinic: hClinic.value,
      descriptor: hDescriptor.value,
      country: hCountry.value,
      headline: hHeadline.value,
      subtext: hSubtext.value,
      logo: hLogo,
      logoScale: hLogoScale,
      previewSrc: hLogoPreview.src || '',
      hasLogo: hLogoSlot.classList.contains('has-file'),
      accent: hAccent,
      color2: hColor2,
      headlineColor: hHeadlineColor,
      subtextColor: hSubtextColor,
      headlineColorLocked: hHeadlineColorLocked,
      subtextColorLocked: hSubtextColorLocked,
      bgTintColor: hBgTintColor,
      bgTintAutoSync: hBgTintAutoSync,
      accentSrc: hAccentSrc.textContent,
      color2Src: hColor2Src.textContent,
      headlineColorSrc: hHeadlineColorSrc.textContent,
      subtextColorSrc: hSubtextColorSrc.textContent,
      bgTintSrc: hBgTintSrc.textContent
    };
  }
  function hApplyColorState(accent, color2, bgTintColor, bgTintAutoSync, accentSrc, color2Src, bgTintSrc, headlineColor, subtextColor, headlineColorSrc, subtextColorSrc, headlineColorLocked=false, subtextColorLocked=false){
    hAccent = accent || hAccent;
    hColor2 = color2 || hColor2;
    hHeadlineColor = headlineColor || hHeadlineColor || hAccent;
    hSubtextColor = subtextColor || hSubtextColor || hAccent;
    hHeadlineColorLocked = !!headlineColorLocked;
    hSubtextColorLocked = !!subtextColorLocked;
    hBgTintColor = bgTintColor || hBgTintColor;
    hBgTintAutoSync = !!bgTintAutoSync;
    hBgTintAutoSyncEl.checked = hBgTintAutoSync;
    hAccentPicker.value = hAccent; hAccentSwatch.style.background = hAccent; hAccentHex.textContent = hAccent.toUpperCase(); hAccentSrc.textContent = accentSrc || 'Per-card override';
    hColor2Picker.value = hColor2; hColor2Swatch.style.background = hColor2; hColor2Hex.textContent = hColor2.toUpperCase(); hColor2Src.textContent = color2Src || 'Per-card override';
    hHeadlineColorPicker.value = hHeadlineColor; hHeadlineColorSwatch.style.background = hHeadlineColor; hHeadlineColorHex.textContent = hHeadlineColor.toUpperCase(); hHeadlineColorSrc.textContent = headlineColorSrc || 'Per-card text color';
    hSubtextColorPicker.value = hSubtextColor; hSubtextColorSwatch.style.background = hSubtextColor; hSubtextColorHex.textContent = hSubtextColor.toUpperCase(); hSubtextColorSrc.textContent = subtextColorSrc || 'Per-card text color';
    hBgTintPicker.value = hBgTintColor; hBgTintSwatch.style.background = hBgTintColor; hBgTintHex.textContent = hBgTintColor.toUpperCase(); hBgTintSrc.textContent = bgTintSrc || 'Per-card override';
  }
  function hRestoreEditorState(state){
    hBulkApplyingState = true;
    hClinic.value = state.clinic || '';
    hDescriptor.value = state.descriptor || '';
    hCountry.value = state.country || '';
    hHeadline.value = state.headline || 'Welcome,';
    hSubtext.value = state.subtext || '';
    hLogo = state.logo || null;
    hLogoScale = state.logoScale || 1;
    hLogoSize.value = Math.round(hLogoScale*100);
    hLogoSizeVal.textContent = Math.round(hLogoScale*100);
    if(state.previewSrc){ hLogoPreview.src = state.previewSrc; hLogoSlot.classList.add('has-file'); }
    else { hLogoPreview.src=''; hLogoSlot.classList.remove('has-file'); }
    hApplyColorState(state.accent, state.color2, state.bgTintColor, state.bgTintAutoSync, state.accentSrc, state.color2Src, state.bgTintSrc, state.headlineColor, state.subtextColor, state.headlineColorSrc, state.subtextColorSrc, state.headlineColorLocked, state.subtextColorLocked);
    hBulkApplyingState = false;
    hRender();
  }
  function hSyncEditorToSelectedItem(){
    if(hBulkApplyingState || hBulkSelectedIndex < 0 || !hBulkItems[hBulkSelectedIndex]) return;
    const item = hBulkItems[hBulkSelectedIndex];
    item.clinic = hClinic.value || hBaseName(item.file.name);
    item.descriptor = hDescriptor.value || '';
    item.country = hCountry.value || '';
    item.headline = hHeadline.value || 'Welcome,';
    item.subtext = hSubtext.value || '';
    item.logoScale = hLogoScale || 1;
    item.accent = hAccent;
    item.color2 = hColor2;
    item.headlineColor = hHeadlineColor;
    item.subtextColor = hSubtextColor;
    item.headlineColorLocked = hHeadlineColorLocked;
    item.subtextColorLocked = hSubtextColorLocked;
    item.bgTintColor = hBgTintColor;
    item.bgTintAutoSync = hBgTintAutoSync;
    item.accentSrc = hAccentSrc.textContent;
    item.color2Src = hColor2Src.textContent;
    item.headlineColorSrc = hHeadlineColorSrc.textContent;
    item.subtextColorSrc = hSubtextColorSrc.textContent;
    item.bgTintSrc = hBgTintSrc.textContent;
    if(hLogo) item.croppedLogo = hLogo;
    if(hLogoPreview.src) item.previewSrc = hLogoPreview.src;
    hRenderBulkEditorList();
  }
  function hRenderBulkEditorList(){
    if(!hBulkEditorList) return;
    if(!hBulkItems.length){ hBulkEditorList.innerHTML=''; return; }
    hBulkEditorList.innerHTML = hBulkItems.map((item, idx)=>{
      const selected = idx === hBulkSelectedIndex;
      const clinicLabel = (item.clinic || hBaseName(item.file.name) || 'Clinic').replace(/"/g,'&quot;');
      const fileLabel = item.file.name.replace(/"/g,'&quot;');
      const badge = selected ? 'Editing now' : 'Edit';
      return `<div class="h-bulk-row" data-idx="${idx}" style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:9px;border:1px solid ${selected ? 'rgba(156,136,255,.55)' : 'rgba(255,255,255,.08)'};background:${selected ? 'rgba(124,107,181,.14)' : 'rgba(255,255,255,.02)'};margin-bottom:6px;cursor:pointer;">
        <img src="${item.previewSrc}" style="width:42px;height:42px;object-fit:contain;border-radius:8px;background:rgba(255,255,255,.9);padding:4px;border:1px solid rgba(0,0,0,.06);flex:0 0 auto;">
        <div style="flex:1;min-width:0;">
          <input class="h-bulk-row-clinic" data-idx="${idx}" value="${clinicLabel}" style="width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.10);border-radius:7px;padding:6px 8px;color:var(--text);font-size:12px;" />
          <div style="font-size:10px;color:var(--text-dim);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:4px;">${fileLabel}</div>
        </div>
        <button type="button" class="h-bulk-row-edit" data-idx="${idx}" style="background:${selected ? 'var(--accent)' : 'rgba(255,255,255,.06)'};color:${selected ? '#fff' : 'var(--text)'};border:1px solid ${selected ? 'transparent' : 'var(--border)'};border-radius:8px;padding:8px 10px;font-size:11px;font-weight:700;cursor:pointer;white-space:nowrap;">${badge}</button>
      </div>`;
    }).join('');
    hBulkEditorList.querySelectorAll('.h-bulk-row').forEach(row=>row.addEventListener('click', async (e)=>{
      const idx = parseInt(row.dataset.idx,10);
      if(e.target.classList.contains('h-bulk-row-clinic')) return;
      await hSelectBulkItem(idx);
    }));
    hBulkEditorList.querySelectorAll('.h-bulk-row-edit').forEach(btn=>btn.addEventListener('click', async (e)=>{
      e.stopPropagation();
      await hSelectBulkItem(parseInt(btn.dataset.idx,10));
    }));
    hBulkEditorList.querySelectorAll('.h-bulk-row-clinic').forEach(inp=>inp.addEventListener('input', (e)=>{
      const idx = parseInt(inp.dataset.idx,10);
      if(!hBulkItems[idx]) return;
      hBulkItems[idx].clinic = inp.value;
      if(idx === hBulkSelectedIndex && !hBulkApplyingState){ hClinic.value = inp.value; hRender(); }
    }));
  }
  async function hSelectBulkItem(index){
    if(index < 0 || index >= hBulkItems.length) return;
    if(hBulkSelectedIndex !== index) hSyncEditorToSelectedItem();
    hBulkSelectedIndex = index;
    hBulkEditorStatus.textContent = `Loading ${index+1}/${hBulkItems.length}…`;
    const item = await hPrepareBulkItem(hBulkItems[index]);
    hBulkApplyingState = true;
    hClinic.value = item.clinic || hBaseName(item.file.name);
    hDescriptor.value = item.descriptor || '';
    hCountry.value = item.country || '';
    hHeadline.value = item.headline || 'Welcome,';
    hSubtext.value = item.subtext || '';
    hLogo = item.croppedLogo || null;
    hLogoScale = item.logoScale || 1;
    hLogoSize.value = Math.round(hLogoScale*100);
    hLogoSizeVal.textContent = Math.round(hLogoScale*100);
    if(item.previewSrc){ hLogoPreview.src = item.previewSrc; hLogoSlot.classList.add('has-file'); }
    hApplyColorState(item.accent || item.autoAccent, item.color2 || item.autoColor2, item.bgTintColor || item.autoBgTintColor, item.bgTintAutoSync, item.accentSrc, item.color2Src, item.bgTintSrc, item.headlineColor || item.autoAccent, item.subtextColor || item.autoAccent, item.headlineColorSrc, item.subtextColorSrc, item.headlineColorLocked, item.subtextColorLocked);
    hBulkApplyingState = false;
    hRender();
    hRenderBulkEditorList();
    hBulkEditorStatus.textContent = `Editing ${index+1}/${hBulkItems.length}: ${item.clinic || hBaseName(item.file.name)}`;
  }
  async function hRebuildBulkItems(){
    hBulkItems = hBulkFiles.map(file => hCreateBulkItem(file));
    hUpdateBulkCount();
    hRenderBulkEditorList();
    if(hBulkItems.length) await hSelectBulkItem(0);
    else hBulkSelectedIndex = -1;
  }

  // Minimal ZIP writer (stored/no compression) so bulk export works offline.
  let hCrcTable = null;
  function hMakeCrcTable(){
    const table = new Uint32Array(256);
    for(let n=0;n<256;n++){
      let c=n;
      for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      table[n]=c>>>0;
    }
    return table;
  }
  function hCrc32(uint8){
    if(!hCrcTable) hCrcTable = hMakeCrcTable();
    let crc = 0 ^ (-1);
    for(let i=0;i<uint8.length;i++) crc = (crc >>> 8) ^ hCrcTable[(crc ^ uint8[i]) & 0xFF];
    return (crc ^ (-1)) >>> 0;
  }
  function hDosDateTime(date){
    const year = Math.max(1980, date.getFullYear());
    const dosTime = ((date.getHours() & 31) << 11) | ((date.getMinutes() & 63) << 5) | ((Math.floor(date.getSeconds()/2)) & 31);
    const dosDate = (((year - 1980) & 127) << 9) | (((date.getMonth()+1) & 15) << 5) | (date.getDate() & 31);
    return { dosTime, dosDate };
  }
  function hU16(n){ const a=new Uint8Array(2); a[0]=n&255; a[1]=(n>>>8)&255; return a; }
  function hU32(n){ const a=new Uint8Array(4); a[0]=n&255; a[1]=(n>>>8)&255; a[2]=(n>>>16)&255; a[3]=(n>>>24)&255; return a; }
  async function hCreateZipBlob(entries){
    const parts=[]; const central=[]; let offset=0; const enc = new TextEncoder();
    for(const entry of entries){
      const nameBytes = enc.encode(entry.name);
      const data = new Uint8Array(await entry.blob.arrayBuffer());
      const crc = hCrc32(data);
      const { dosTime, dosDate } = hDosDateTime(new Date());
      const local = new Uint8Array(30 + nameBytes.length);
      local.set([0x50,0x4b,0x03,0x04],0);
      local.set(hU16(20),4);           // version needed
      local.set(hU16(0),6);            // flags
      local.set(hU16(0),8);            // method 0 = stored
      local.set(hU16(dosTime),10);
      local.set(hU16(dosDate),12);
      local.set(hU32(crc),14);
      local.set(hU32(data.length),18);
      local.set(hU32(data.length),22);
      local.set(hU16(nameBytes.length),26);
      local.set(hU16(0),28);
      local.set(nameBytes,30);
      parts.push(local, data);

      const cen = new Uint8Array(46 + nameBytes.length);
      cen.set([0x50,0x4b,0x01,0x02],0);
      cen.set(hU16(20),4);            // version made by
      cen.set(hU16(20),6);            // version needed
      cen.set(hU16(0),8);
      cen.set(hU16(0),10);
      cen.set(hU16(dosTime),12);
      cen.set(hU16(dosDate),14);
      cen.set(hU32(crc),16);
      cen.set(hU32(data.length),20);
      cen.set(hU32(data.length),24);
      cen.set(hU16(nameBytes.length),28);
      cen.set(hU16(0),30); cen.set(hU16(0),32); cen.set(hU16(0),34); cen.set(hU16(0),36);
      cen.set(hU32(0),38);
      cen.set(hU32(offset),42);
      cen.set(nameBytes,46);
      central.push(cen);

      offset += local.length + data.length;
    }
    let centralSize = 0; for(const c of central) centralSize += c.length;
    const end = new Uint8Array(22);
    end.set([0x50,0x4b,0x05,0x06],0);
    end.set(hU16(0),4); end.set(hU16(0),6);
    end.set(hU16(entries.length),8); end.set(hU16(entries.length),10);
    end.set(hU32(centralSize),12); end.set(hU32(offset),16); end.set(hU16(0),20);
    return new Blob([...parts, ...central, end], { type:'application/zip' });
  }

  function hApplyBgTint(ctx, W, H){
    if (!hBgTintStrength || hBgTintStrength <= 0.001) return;
    const strength = Math.max(0, Math.min(1, hBgTintStrength));
    const softTint = mixHex(hBgTintColor, '#ffffff', 0.72);
    const glowTint = mixHex(hBgTintColor, '#ffffff', 0.84);
    ctx.save();

    // Pass 1: establish a clearly visible overall brand cast on every creamy sample.
    // source-atop keeps the tint inside the card/background artwork only.
    ctx.globalCompositeOperation = 'source-atop';
    ctx.globalAlpha = 0.16 + (0.24 * strength);
    ctx.fillStyle = softTint;
    ctx.fillRect(0, 0, W, H);

    // Pass 2: deepen the low / mid tones so the tint reads consistently,
    // even on warmer or more contrasty preset backgrounds.
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.14 + (0.20 * strength);
    ctx.fillStyle = softTint;
    ctx.fillRect(0, 0, W, H);

    // Pass 3: reintroduce chroma and luxury glow without flattening the texture.
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = 0.18 + (0.28 * strength);
    ctx.fillStyle = hBgTintColor;
    ctx.fillRect(0, 0, W, H);

    // Pass 4: a gentle center glow so the tint feels integrated into the card,
    // not just laid on top of the sample background.
    const wash = ctx.createRadialGradient(W*0.52, H*0.46, 0, W*0.52, H*0.46, Math.max(W,H)*0.78);
    wash.addColorStop(0, `rgba(255,255,255,${0.20 * strength})`);
    wash.addColorStop(0.45, `rgba(255,255,255,${0.08 * strength})`);
    wash.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.globalCompositeOperation = 'screen';
    ctx.globalAlpha = 1;
    ctx.fillStyle = wash;
    ctx.fillRect(0, 0, W, H);

    // Final soft color veil so ALL default sample PNGs visibly pick up the tint.
    ctx.globalCompositeOperation = 'overlay';
    ctx.globalAlpha = 0.08 + (0.12 * strength);
    ctx.fillStyle = glowTint;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  async function hLoadBgPreset(key){
    hBgPresetKey = key || '';
    if(!key){
      hBgImage = null;
      hBgSrc.textContent = 'No preset selected — using generated texture';
      hBgPreview.src = '';
      hBgSlot.classList.remove('has-file');
      hRender();
      return;
    }
    const preset = H_BG_PRESETS[key];
    if(!preset) return;
    hBgImage = await loadImageFromSrc(preset.src);
    hBgPreview.src = preset.src;
    hBgSlot.classList.add('has-file');
    hBgSrc.textContent = `Default sample — ${preset.label}`;
    hRender();
  }

  function hCropToContent(img){
    const c=document.createElement('canvas'); c.width=img.width; c.height=img.height;
    const ctx=c.getContext('2d', { willReadFrequently:true });
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img,0,0);
    const d=ctx.getImageData(0,0,c.width,c.height).data;
    const w=c.width,h=c.height; let minX=w,minY=h,maxX=-1,maxY=-1;
    for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(d[(y*w+x)*4+3]>8){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}
    if(maxX<minX||maxY<minY)return c;
    const cw=maxX-minX+1,ch=maxY-minY+1;
    const pad=Math.max(6, Math.round(Math.max(cw,ch)*0.04));
    const longest=Math.max(cw,ch);
    const targetLongest=Math.max(longest, 1600);
    const scale=Math.min(4, Math.max(1, targetLongest / longest));
    const out=document.createElement('canvas');
    out.width=Math.max(1, Math.round((cw + pad*2) * scale));
    out.height=Math.max(1, Math.round((ch + pad*2) * scale));
    const octx=out.getContext('2d');
    octx.clearRect(0,0,out.width,out.height);
    octx.imageSmoothingEnabled = true;
    octx.imageSmoothingQuality = 'high';
    // Slight contrast boost helps tiny wordmarks stay legible after downscaling.
    octx.filter = 'contrast(1.05) saturate(1.02)';
    octx.drawImage(c, Math.max(0,minX-pad), Math.max(0,minY-pad), Math.min(w - Math.max(0,minX-pad), cw + pad*2), Math.min(h - Math.max(0,minY-pad), ch + pad*2), 0, 0, out.width, out.height);
    octx.filter = 'none';
    return out;
  }

  function hDrawLogo(ctx, logo, x, y, w, h){
    ctx.save();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    // mild crispness boost for small raster logos
    ctx.filter = 'contrast(1.04) saturate(1.02)';
    ctx.drawImage(logo, x, y, w, h);
    ctx.filter = 'none';
    ctx.restore();
  }

  // Logo upload
  setupUploadSlot(hLogoSlot,hLogoFile,hLogoPreview,hLogoClear,async(img,name)=>{
    if(img){
      const ex=extractBrandColor(img);
      if(ex){ hSecondaryAuto=true; hApplyBrandColor(ex,`Auto-extracted from ${name}`); }
      hLogo=hCropToContent(img);
    } else { hLogo=null; }
    hRender();
    hSyncEditorToSelectedItem();
  });
  hLogoSize.addEventListener('input',()=>{ hLogoScale=parseInt(hLogoSize.value,10)/100; hLogoSizeVal.textContent=hLogoSize.value; hRender(); hSyncEditorToSelectedItem(); });

  // Background upload / preset selection
  setupUploadSlot(hBgSlot,hBgFile,hBgPreview,hBgClear,(img,name)=>{
    hBgPreset.value = '';
    hBgPresetKey = '';
    hBgImage = img;
    hBgSrc.textContent = img ? `Custom background — ${name}` : 'No preset selected — using generated texture';
    hRender();
  });
  hBgPreset.addEventListener('change',()=>{ hLoadBgPreset(hBgPreset.value); });
  hBgTint.addEventListener('input',()=>{ hBgTintStrength=parseInt(hBgTint.value,10)/100; hBgTintVal.textContent=hBgTint.value; hRender(); });
  hBgTintPicker.addEventListener('input',()=>{ hBgTintAutoSync=false; hBgTintAutoSyncEl.checked=false; hSetBgTintColor(hBgTintPicker.value,'Manually selected — background only'); hSyncEditorToSelectedItem(); });
  hBgTintAutoSyncEl.addEventListener('change',()=>{ hBgTintAutoSync = hBgTintAutoSyncEl.checked; if(hBgTintAutoSync && hAccent){ hSetBgTintColor(hAccent, 'Background tint synced to current clinic brand color'); } hSyncEditorToSelectedItem(); });
  hBgScaleEl.addEventListener('input',()=>{ hBgScale=parseInt(hBgScaleEl.value,10)/100; hBgScaleVal.textContent=hBgScaleEl.value+'%'; hRender(); });
  hBgPanXEl.addEventListener('input',()=>{ hBgPanX=parseInt(hBgPanXEl.value,10)/100; hRender(); });
  hBgPanYEl.addEventListener('input',()=>{ hBgPanY=parseInt(hBgPanYEl.value,10)/100; hRender(); });

  // Bulk multi-logo upload
  hBulkLogoFiles.addEventListener('change', async ()=>{ hBulkFiles=Array.from(hBulkLogoFiles.files||[]); await hRebuildBulkItems(); });
  hBulkLogoSlot.addEventListener('click',e=>{ if(e.target===hBulkLogoSlot || e.target.classList.contains('slot-label')) hBulkLogoFiles.click(); });
  ;['dragenter','dragover'].forEach(evt=>hBulkLogoSlot.addEventListener(evt,e=>{ e.preventDefault(); hBulkLogoSlot.classList.add('drag'); }));
  ;['dragleave','drop'].forEach(evt=>hBulkLogoSlot.addEventListener(evt,e=>{ e.preventDefault(); hBulkLogoSlot.classList.remove('drag'); }));
  hBulkLogoSlot.addEventListener('drop', async e=>{ const files=Array.from(e.dataTransfer?.files||[]).filter(f=>f.type.startsWith('image/')); hBulkFiles=files; const dt=new DataTransfer(); files.forEach(f=>dt.items.add(f)); hBulkLogoFiles.files=dt.files; await hRebuildBulkItems(); });

  // Color pickers
  hAccentPicker.addEventListener('input',()=>{ hApplyManualBrandColor(hAccentPicker.value); hSyncEditorToSelectedItem(); });
  hColor2Picker.addEventListener('input',()=>{ hSecondaryAuto=false; hSetSecondary(hColor2Picker.value,'Manually selected'); hSyncEditorToSelectedItem(); });
  hHeadlineColorPicker.addEventListener('input',()=>{ hSetHeadlineColor(hHeadlineColorPicker.value,'Manually selected text color',true); hSyncEditorToSelectedItem(); });
  hSubtextColorPicker.addEventListener('input',()=>{ hSetSubtextColor(hSubtextColorPicker.value,'Manually selected text color',true); hSyncEditorToSelectedItem(); });
  [hHeadline,hSubtext,hClinic,hDescriptor,hCountry].forEach(el=>el.addEventListener('input',()=>{ hRender(); hSyncEditorToSelectedItem(); }));
  hTexStyle.addEventListener('change', hRender);
  hTexStrength.addEventListener('input',()=>{ hTexStrengthVal.textContent=hTexStrength.value; hRender(); });
  hBulkSaveCurrent.addEventListener('click',()=>{
    hSyncEditorToSelectedItem();
    if(hBulkSelectedIndex >= 0 && hBulkItems[hBulkSelectedIndex]){
      hBulkEditorStatus.textContent = `Saved card ${hBulkSelectedIndex+1}/${hBulkItems.length}: ${hBulkItems[hBulkSelectedIndex].clinic || hBaseName(hBulkItems[hBulkSelectedIndex].file.name)}`;
    } else {
      hBulkEditorStatus.textContent = 'No bulk clinic selected yet.';
    }
  });

  // ── Drawing helpers ──────────────────────────────────────────────────────────
  function hRoundRect(ctx,x,y,w,h,r){
    ctx.beginPath(); ctx.moveTo(x+r,y); ctx.lineTo(x+w-r,y); ctx.arcTo(x+w,y,x+w,y+r,r);
    ctx.lineTo(x+w,y+h-r); ctx.arcTo(x+w,y+h,x+w-r,y+h,r);
    ctx.lineTo(x+r,y+h); ctx.arcTo(x,y+h,x,y+h-r,r);
    ctx.lineTo(x,y+r); ctx.arcTo(x,y,x+r,y,r); ctx.closePath();
  }

  // Centered text helper — returns array of lines, draws centered at cx
  function hMeasureWrap(ctx, text, maxW) {
    const words = text.split(' '); const lines = []; let line = '';
    words.forEach(w => {
      const test = line + (line ? ' ' : '') + w;
      if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w; }
      else line = test;
    });
    if (line) lines.push(line);
    return lines;
  }
  function hDrawCenteredText(ctx, lines, cx, startY, lineH) {
    lines.forEach((line, i) => {
      const w = ctx.measureText(line).width;
      ctx.fillText(line, cx - w/2, startY + i * lineH);
    });
  }



  function hIsCreamStyle(){ return /^cream[123]$/.test(hTexStyle.value); }

  function hMixRgb(c1, c2, t){
    return {
      r: Math.round(c1.r + (c2.r - c1.r) * t),
      g: Math.round(c1.g + (c2.g - c1.g) * t),
      b: Math.round(c1.b + (c2.b - c1.b) * t)
    };
  }
  function hRgba(rgb, a){ return `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0,Math.min(1,a))})`; }

  function hSeedRand(seedStr){
    let h = 2166136261;
    seedStr = String(seedStr || 'cream');
    for (let i=0;i<seedStr.length;i++){ h ^= seedStr.charCodeAt(i); h = Math.imul(h,16777619); }
    let s = h >>> 0;
    return function(){ s = (Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; };
  }

  function hDrawCreamySurface(ctx, W, H, cr, scale, variant){
    const strength = parseInt(hTexStrength.value,10) / 100;
    if (strength <= 0.001) return;
    const brand = hexToRgb(hAccent);
    const white = {r:255,g:255,b:255};
    const warm = {r:248,g:243,b:226};
    const cool = hMixRgb(brand, white, 0.76);
    const base = hMixRgb(warm, cool, 0.34);
    const softBrand = hMixRgb(brand, white, 0.58);
    const gold = {r:196,g:160,b:82};
    const shadow = hMixRgb(brand, {r:72,g:78,b:72}, 0.30);

    ctx.save();
    hRoundRect(ctx,0,0,W,H,cr); ctx.clip();

    // Creamy tinted plaster base.
    const bg = ctx.createLinearGradient(0,0,W,H);
    bg.addColorStop(0, hRgba(hMixRgb(base, white, 0.28), 1));
    bg.addColorStop(0.44, hRgba(hMixRgb(base, softBrand, 0.10), 1));
    bg.addColorStop(1, hRgba(hMixRgb(base, brand, 0.10), 1));
    ctx.fillStyle = bg;
    ctx.fillRect(0,0,W,H);

    // Subtle center light, like the reference card.
    const centerGlow = ctx.createRadialGradient(W*0.50,H*0.48,0,W*0.50,H*0.48,W*0.72);
    centerGlow.addColorStop(0, `rgba(255,255,255,${0.30*strength})`);
    centerGlow.addColorStop(0.58, `rgba(255,255,255,${0.12*strength})`);
    centerGlow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle=centerGlow; ctx.fillRect(0,0,W,H);

    // Fine plaster grain / creamy paper texture.
    const rand = hSeedRand(`${hClinic.value}|${hAccent}|${variant}|cream-noise`);
    const grain = document.createElement('canvas');
    const gw = Math.max(240, Math.round(W/2.2)), gh = Math.max(140, Math.round(H/2.2));
    grain.width=gw; grain.height=gh;
    const gctx=grain.getContext('2d');
    const img=gctx.createImageData(gw,gh);
    for(let i=0;i<img.data.length;i+=4){
      const n = rand();
      const m = Math.floor(210 + n*45);
      img.data[i]=m; img.data[i+1]=m; img.data[i+2]=m;
      img.data[i+3]=Math.floor((n<0.50 ? 7 : 15) * strength);
    }
    gctx.putImageData(img,0,0);
    ctx.globalCompositeOperation='multiply';
    ctx.drawImage(grain,0,0,W,H);
    ctx.globalCompositeOperation='source-over';

    // Low relief plaster swirls: not obvious lines, just surface movement.
    ctx.save();
    ctx.globalAlpha = 0.20 * strength;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 0.55*scale;
    for(let i=0;i<34;i++){
      const y = (i/33)*H + Math.sin(i*1.7)*9*scale;
      ctx.beginPath();
      ctx.moveTo(-20*scale, y);
      ctx.bezierCurveTo(W*0.22, y-18*scale, W*0.40, y+14*scale, W*0.62, y-3*scale);
      ctx.bezierCurveTo(W*0.80, y-18*scale, W*1.03, y+12*scale, W+20*scale, y-8*scale);
      ctx.stroke();
    }
    ctx.restore();

    function curvePath(points){
      ctx.beginPath();
      ctx.moveTo(points[0][0]*W, points[0][1]*H);
      for(let i=1;i<points.length;i+=3){
        ctx.bezierCurveTo(points[i][0]*W,points[i][1]*H,points[i+1][0]*W,points[i+1][1]*H,points[i+2][0]*W,points[i+2][1]*H);
      }
    }
    function drawRibbon(points, width, goldOffset=0){
      // broad carved shadow
      ctx.save();
      ctx.lineCap='round'; ctx.lineJoin='round';
      curvePath(points);
      ctx.strokeStyle = hRgba(shadow, 0.10 * strength);
      ctx.lineWidth = width*1.55;
      ctx.shadowColor = hRgba(shadow, 0.18*strength);
      ctx.shadowBlur = 5*scale;
      ctx.shadowOffsetX = 2.4*scale; ctx.shadowOffsetY = 3.2*scale;
      ctx.stroke();
      ctx.restore();

      // raised creamy ridge
      ctx.save();
      ctx.lineCap='round'; ctx.lineJoin='round';
      curvePath(points);
      ctx.strokeStyle = `rgba(255,255,255,${0.44*strength})`;
      ctx.lineWidth = width;
      ctx.stroke();
      ctx.restore();

      // inner bevel / recessed edge
      ctx.save();
      ctx.lineCap='round'; ctx.lineJoin='round';
      curvePath(points);
      ctx.strokeStyle = hRgba(softBrand, 0.16*strength);
      ctx.lineWidth = Math.max(1*scale, width*0.48);
      ctx.stroke();
      ctx.restore();

      // crisp white edge
      ctx.save();
      ctx.lineCap='round'; ctx.lineJoin='round';
      curvePath(points);
      ctx.strokeStyle = `rgba(255,255,255,${0.78*strength})`;
      ctx.lineWidth = 1.15*scale;
      ctx.stroke();
      ctx.restore();

      // delicate gold broken accent, like the reference.
      ctx.save();
      ctx.lineCap='round'; ctx.lineJoin='round';
      curvePath(points);
      ctx.setLineDash([2.4*scale, 5.8*scale]);
      ctx.lineDashOffset = goldOffset*scale;
      ctx.strokeStyle = hRgba(gold, 0.64*strength);
      ctx.lineWidth = 0.82*scale;
      ctx.stroke();
      ctx.restore();
    }

    const wBig = 13*scale, wMed = 8*scale, wSmall = 5*scale;
    if(variant === 'cream1'){
      drawRibbon([[-0.07,-0.12],[0.08,0.12],[0.02,0.38],[0.13,0.72],[0.19,0.90],[0.05,1.10],[-0.03,1.20]], wBig, 0);
      drawRibbon([[-0.02,-0.05],[0.14,0.18],[0.06,0.41],[0.18,0.76],[0.23,0.93],[0.13,1.11],[0.05,1.18]], wSmall, 8);
      drawRibbon([[1.07,-0.05],[0.92,0.22],[1.02,0.45],[0.88,0.77],[0.84,0.94],[0.97,1.09],[1.04,1.16]], wMed, 3);
      drawRibbon([[1.00,-0.13],[0.86,0.17],[0.95,0.37],[0.83,0.68],[0.79,0.86],[0.88,1.04],[0.96,1.14]], wSmall, 10);
    } else if(variant === 'cream2'){
      drawRibbon([[-0.06,-0.16],[0.10,0.10],[0.04,0.28],[0.12,0.52],[0.20,0.72],[0.02,0.96],[-0.02,1.18]], wMed, 0);
      drawRibbon([[0.06,-0.08],[0.22,0.12],[0.10,0.34],[0.23,0.58],[0.33,0.78],[0.17,1.02],[0.12,1.14]], wSmall, 5);
      drawRibbon([[1.08,-0.08],[0.88,0.16],[0.98,0.34],[0.84,0.58],[0.76,0.72],[0.94,0.96],[1.03,1.13]], wBig, 9);
      drawRibbon([[0.96,-0.15],[0.78,0.07],[0.88,0.31],[0.76,0.55],[0.70,0.72],[0.80,0.96],[0.91,1.16]], wSmall, 15);
    } else {
      drawRibbon([[-0.04,-0.14],[0.18,0.05],[0.06,0.22],[0.17,0.44],[0.27,0.63],[0.05,0.82],[-0.05,1.10]], wBig, 4);
      drawRibbon([[0.09,-0.12],[0.25,0.08],[0.16,0.25],[0.26,0.47],[0.36,0.65],[0.19,0.82],[0.10,1.04]], wSmall, 13);
      drawRibbon([[1.07,0.00],[0.89,0.23],[1.01,0.44],[0.84,0.65],[0.74,0.82],[0.89,0.98],[1.02,1.12]], wMed, 1);
      drawRibbon([[0.99,0.10],[0.82,0.30],[0.93,0.47],[0.78,0.66],[0.69,0.84],[0.81,1.00],[0.92,1.10]], wSmall, 8);
    }

    // Slight vignette to keep attention in the center.
    const vign = ctx.createRadialGradient(W*0.50,H*0.50,W*0.28,W*0.50,H*0.50,W*0.72);
    vign.addColorStop(0,'rgba(255,255,255,0)');
    vign.addColorStop(1, hRgba(brand,0.055*strength));
    ctx.fillStyle = vign;
    ctx.fillRect(0,0,W,H);

    ctx.restore();
  }

  // ── Premium card texture wrapper ───────────────────────────────────────────
  function hDrawTexture(ctx, W, H, cr, scale) {
    if (hHasCardBackground() || hTexStyle.value === 'none') return;
    if (hIsCreamStyle()) {
      hDrawCreamySurface(ctx, W, H, cr, scale, hTexStyle.value);
      return;
    }
    drawPremiumContourTexture(ctx, W, H, {
      style: hTexStyle.value,
      strength: parseInt(hTexStrength.value, 10) / 100,
      color: hAccent,
      scale,
      radius: cr,
      seed: `${hClinic.value || 'clinic'}-${hAccent}-${hColor2}`,
      wash: true
    });
  }

  // ── Main card draw ───────────────────────────────────────────────────────────
  function hDraw(canvas, scale) {
    const W = CARD_W * scale, H = CARD_H * scale;
    canvas.width = W; canvas.height = H;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, W, H);

    const ac = hexToRgb(hAccent);
    const a  = op => `rgba(${ac.r},${ac.g},${ac.b},${op})`;
    const hc = hexToRgb(hHeadlineColor || hAccent);
    const sc = hexToRgb(hSubtextColor || hAccent);
    const headlineA = op => `rgba(${hc.r},${hc.g},${hc.b},${op})`;
    const subtextA = op => `rgba(${sc.r},${sc.g},${sc.b},${op})`;
    const cr = 20 * scale;

    // ── LAYER 1: Drop shadow — makes the card pop off the background ────────────
    // Outer large diffuse shadow (main lift)
    ctx.save();
    ctx.shadowColor    = `rgba(${ac.r},${ac.g},${ac.b},0.22)`;
    ctx.shadowBlur     = 36 * scale;
    ctx.shadowOffsetX  = 0;
    ctx.shadowOffsetY  = 14 * scale;
    hRoundRect(ctx, 3*scale, 0, W - 6*scale, H, cr);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // Inner tighter shadow — adds crispness to the lift
    ctx.save();
    ctx.shadowColor    = `rgba(0,0,0,0.14)`;
    ctx.shadowBlur     = 12 * scale;
    ctx.shadowOffsetX  = 0;
    ctx.shadowOffsetY  = 6 * scale;
    hRoundRect(ctx, 3*scale, 0, W - 6*scale, H, cr);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.restore();

    // ── LAYER 2: Card face — either uploaded/sample background or generated tint ──
    if (hHasCardBackground()) {
      ctx.save();
      hRoundRect(ctx, 0, 0, W, H, cr);
      ctx.clip();
      hDrawCoverImage(ctx, hBgImage, 0, 0, W, H);
      hApplyBgTint(ctx, W, H);
      ctx.restore();
    } else {
      hRoundRect(ctx, 0, 0, W, H, cr);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      hRoundRect(ctx, 0, 0, W, H, cr);
      ctx.fillStyle = a(0.07);
      ctx.fill();

      // ── LAYER 3: Arc texture across full card ───────────────────────────────────
      hDrawTexture(ctx, W, H, cr, scale);
    }

    // ── LAYER 4: Edge strokes for depth / 3D press feel ────────────────────────
    // Outer border — gradient from bright top to deep brand-dark bottom
    // This replicates the Lumina card's visible dark bottom stroke
    ctx.save();
    hRoundRect(ctx, 0.75*scale, 0.75*scale, W - 1.5*scale, H - 1.5*scale, cr);
    const borderGrad = ctx.createLinearGradient(0, 0, 0, H);
    borderGrad.addColorStop(0,    `rgba(255,255,255,0.90)`);  // bright highlight top
    borderGrad.addColorStop(0.05, `rgba(255,255,255,0.40)`);
    borderGrad.addColorStop(0.45, a(0.12));
    borderGrad.addColorStop(0.88, a(0.55));                   // deep brand color bottom
    borderGrad.addColorStop(1,    a(0.80));                   // darkest at very bottom
    ctx.strokeStyle = borderGrad;
    ctx.lineWidth   = 1.5 * scale;
    ctx.stroke();
    ctx.restore();

    // Inner top-edge highlight — light catching the raised rim
    ctx.save();
    hRoundRect(ctx, 2*scale, 2*scale, W - 4*scale, H - 4*scale, cr - 2*scale);
    const rimHi = ctx.createLinearGradient(0, 0, 0, H * 0.14);
    rimHi.addColorStop(0, `rgba(255,255,255,0.70)`);
    rimHi.addColorStop(1, `rgba(255,255,255,0)`);
    ctx.strokeStyle = rimHi;
    ctx.lineWidth   = 0.8 * scale;
    ctx.stroke();
    ctx.restore();

    // ── Clip all content layers to card bounds ───────────────────────────────────
    ctx.save();
    hRoundRect(ctx, 0, 0, W, H, cr); ctx.clip();

    // ── LAYER 5: Content layout ────────────────────────────────────────────────
    if (hHasCardBackground()) {
      // For uploaded/sample creamy backgrounds, make Welcome the hero and the clinic
      // logo supportive beneath the copy.
      const hlText = hHeadline.value || 'Welcome,';
      const hfz = 88 * scale;
      const sfz = 23 * scale, slh = 29 * scale;
      const subtextMaxW = W * 0.54;
      const headlineY = H * 0.395;

      // Headline
      ctx.save();
      ctx.font = `650 ${hfz}px "Cormorant Garamond","DM Serif Display",Georgia,"Times New Roman",serif`;
      ctx.globalAlpha = 0.94;
      ctx.fillStyle = headlineA(0.94);
      const hlW = ctx.measureText(hlText).width;
      ctx.fillText(hlText, (W - hlW) / 2, headlineY);
      ctx.restore();

      // Subtext with a bit more breathing room below the headline
      ctx.save();
      ctx.font = `500 ${sfz}px "Cormorant Garamond","DM Serif Display",Georgia,"Times New Roman",serif`;
      ctx.fillStyle = subtextA(0.82);
      const subLines = hMeasureWrap(ctx, hSubtext.value || '', subtextMaxW);
      const subStartY = headlineY + 46 * scale;
      hDrawCenteredText(ctx, subLines, W/2, subStartY, slh);
      ctx.restore();

      // Supportive clinic logo below the subtext
      // Reverted to the earlier placement/scale that felt more balanced.
      const logoZoneY = H * 0.14;
      const logoZoneH = H * 0.11;
      const logoMaxW = W * 0.24;
      const logoTargetW = logoMaxW * Math.min(hLogoScale, 2.2);
      const logoTargetH = logoZoneH * Math.min(hLogoScale, 2.2);
      const subBlockH = subLines.length * slh;
      const logoY = subStartY + subBlockH + 24 * scale;

      if (hLogo) {
        const ls = Math.min(logoTargetW / hLogo.width, logoTargetH / hLogo.height);
        const lw = hLogo.width * ls, lh = hLogo.height * ls;
        // Add a touch more bottom breathing room so the supportive logo does not
        // feel like it is sitting on the bottom edge of the hero card.
        const heroLogoBottomPad = 18 * scale;
        const adjustedLogoY = Math.min(logoY, H - lh - heroLogoBottomPad);
        hDrawLogo(ctx, hLogo, (W - lw) / 2, adjustedLogoY, lw, lh);
      } else {
        ctx.save();
        ctx.font = `700 ${11*scale}px -apple-system,sans-serif`;
        ctx.fillStyle = hAccent;
        ctx.textAlign = 'center';
        const heroLogoBottomPad = 18 * scale;
        const fallbackTextY = Math.min(logoY + 12*scale, H - heroLogoBottomPad);
        ctx.fillText(hClinic.value || 'CLINIC NAME', W/2, fallbackTextY);
        ctx.textAlign = 'start';
        ctx.restore();
      }
    } else {
      // Legacy/default hero layout
      const logoZoneY  = H * 0.095;
      const logoZoneH  = H * 0.105;
      const logoMaxW   = W * 0.26;
      const logoTargetW = logoMaxW * hLogoScale;
      const logoTargetH = logoZoneH * hLogoScale;

      if (hLogo) {
        const ls = Math.min(logoTargetW / hLogo.width, logoTargetH / hLogo.height);
        const lw = hLogo.width * ls, lh = hLogo.height * ls;
        hDrawLogo(ctx, hLogo, (W - lw) / 2, logoZoneY + (logoZoneH - lh) / 2, lw, lh);
      } else {
        ctx.save();
        ctx.font = `700 ${12*scale}px -apple-system,sans-serif`;
        ctx.fillStyle = hAccent;
        ctx.textAlign = 'center';
        ctx.fillText(hClinic.value || 'CLINIC NAME', W/2, logoZoneY + logoZoneH * 0.65);
        ctx.textAlign = 'start';
        ctx.restore();
      }

      if (hDescriptor.value) {
        ctx.save();
        ctx.font = `500 ${6.5*scale}px -apple-system,sans-serif`;
        ctx.fillStyle = a(0.42);
        ctx.textAlign = 'center';
        ctx.fillText(hDescriptor.value.toUpperCase(), W/2, logoZoneY + logoZoneH + 8*scale);
        ctx.textAlign = 'start';
        ctx.restore();
      }

      const textBlockTop = H * (hIsCreamStyle() ? 0.355 : 0.355);
      const hfz = (hIsCreamStyle() ? 78 : 44) * scale;
      ctx.save();
      ctx.font = `${hIsCreamStyle() ? 650 : 700} ${hfz}px "Cormorant Garamond","DM Serif Display",Georgia,"Times New Roman",serif`;
      ctx.fillStyle = headlineA(0.94);
      const hlText = hHeadline.value || 'Welcome,';
      const hlW = ctx.measureText(hlText).width;
      const hlY = textBlockTop + hfz;
      ctx.fillText(hlText, (W - hlW) / 2, hlY);
      ctx.restore();

      const sfz = (hIsCreamStyle() ? 24 : 15) * scale, slh = (hIsCreamStyle() ? 31 : 23) * scale;
      const subtextMaxW = W * (hIsCreamStyle() ? 0.56 : 0.65);
      ctx.save();
      ctx.font = hIsCreamStyle()
        ? `500 ${sfz}px "Cormorant Garamond","DM Serif Display",Georgia,"Times New Roman",serif`
        : `400 ${sfz}px -apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif`;
      ctx.fillStyle = hIsCreamStyle() ? subtextA(0.88) : subtextA(0.58);
      const subLines = hMeasureWrap(ctx, hSubtext.value || '', subtextMaxW);
      const subY = hlY + (hIsCreamStyle() ? 30 : 20)*scale;
      hDrawCenteredText(ctx, subLines, W/2, subY, slh);
      ctx.restore();
    }

    ctx.restore(); // end clip
  }

  function hRender(){
    hCanvas.style.height = '';  // let CSS handle sizing via width:100%
    hDraw(hCanvas,1);
  }

  hExport.addEventListener('click',async()=>{
    const clinic=sanitize(hClinic.value,'Clinic'), country=sanitize(hCountry.value,'XX');
    const fn=`${clinic}_hero_card_${country}.png`;
    try {
      const ec=document.createElement('canvas'); hDraw(ec,XSCALE);
      const blob=await canvasToBlob(ec);
      const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=fn; a.click();
      hStatus.textContent=`Downloaded ${fn} at ${CARD_W*XSCALE}×${CARD_H*XSCALE}px`;
    } catch(err) {
      console.error(err);
      hStatus.textContent='Export failed. Try re-uploading the background/logo, or use this build with embedded default backgrounds.';
    }
  });

  hBulkExport.addEventListener('click', async()=>{
    if(!hBulkFiles.length){ hBulkStatus.textContent='Add logo PNG files first.'; return; }
    hSyncEditorToSelectedItem();
    const editorSnapshot = hSnapshotEditorState();
    const previousSelectedIndex = hBulkSelectedIndex;
    const countryDefault=sanitize(hCountry.value,'XX');
    const zipEntries = [];
    hBulkStatus.textContent=`Preparing ${hBulkFiles.length} files…`;
    hBulkExport.disabled = true;
    try {
      const items = hBulkItems.length ? hBulkItems : hBulkFiles.map(file => hCreateBulkItem(file));
      for(let i=0;i<items.length;i++){
        const item=items[i];
        await hPrepareBulkItem(item);
        hBulkSelectedIndex = i;
        hBulkApplyingState = true;
        hClinic.value = item.clinic || hBaseName(item.file.name);
        hDescriptor.value = item.descriptor || '';
        hCountry.value = item.country || editorSnapshot.country || '';
        hHeadline.value = item.headline || editorSnapshot.headline || 'Welcome,';
        hSubtext.value = item.subtext || editorSnapshot.subtext || '';
        hLogo = item.croppedLogo || null;
        hLogoScale = item.logoScale || 1;
        hLogoSize.value = Math.round(hLogoScale*100);
        hLogoSizeVal.textContent = Math.round(hLogoScale*100);
        if(item.previewSrc){ hLogoPreview.src = item.previewSrc; hLogoSlot.classList.add('has-file'); }
        hApplyColorState(item.accent || item.autoAccent, item.color2 || item.autoColor2, item.bgTintColor || item.autoBgTintColor, item.bgTintAutoSync, item.accentSrc, item.color2Src, item.bgTintSrc, item.headlineColor || item.autoAccent, item.subtextColor || item.autoAccent, item.headlineColorSrc, item.subtextColorSrc, item.headlineColorLocked, item.subtextColorLocked);
        hBulkApplyingState = false;
        hRender();
        const ec=document.createElement('canvas'); hDraw(ec,XSCALE);
        const blob=await canvasToBlob(ec);
        const country=sanitize(item.country || countryDefault,'XX');
        const clinicBase = sanitize(item.clinic || hBaseName(item.file.name), 'Clinic');
        const outName=`${clinicBase}_hero_card_${country}.png`;
        zipEntries.push({ name: outName, blob });
        hBulkStatus.textContent=`Rendering ${i+1}/${items.length}: ${outName}`;
        await new Promise(r=>setTimeout(r,20));
      }
      hBulkStatus.textContent=`Packaging ${zipEntries.length} PNGs into ZIP…`;
      const zipBlob = await hCreateZipBlob(zipEntries);
      const zipName = `hero_cards_batch_${countryDefault}.zip`;
      const a=document.createElement('a');
      const url=URL.createObjectURL(zipBlob);
      a.href=url;
      a.download=zipName;
      a.click();
      setTimeout(()=>URL.revokeObjectURL(url), 4000);
      hBulkStatus.textContent=`Downloaded ${zipName} with ${zipEntries.length} hero cards.`;
    } catch(err) {
      console.error(err);
      hBulkStatus.textContent='Bulk ZIP export failed. Try a smaller batch or re-upload the logos.';
    } finally {
      hRestoreEditorState(editorSnapshot);
      hBulkSelectedIndex = previousSelectedIndex;
      hRenderBulkEditorList();
      hBulkExport.disabled = false;
      if(previousSelectedIndex >= 0 && hBulkItems[previousSelectedIndex]){
        hBulkEditorStatus.textContent = `Editing ${previousSelectedIndex+1}/${hBulkItems.length}: ${hBulkItems[previousSelectedIndex].clinic || hBaseName(hBulkItems[previousSelectedIndex].file.name)}`;
      }
    }
  });


  hAccentSwatch.style.background=hAccent;
  hColor2Swatch.style.background=hColor2;
  hHeadlineColorSwatch.style.background=hHeadlineColor;
  hSubtextColorSwatch.style.background=hSubtextColor;
  hBgTintAutoSyncEl.checked = hBgTintAutoSync;
  hBgTintSwatch.style.background=hBgTintColor;
  hBgTintHex.textContent=hBgTintColor.toUpperCase();
  hBgTintVal.textContent = Math.round(hBgTintStrength * 100);
  hBgScaleVal.textContent = Math.round(hBgScale * 100) + '%';
  hUpdateBulkCount();
  hLoadBgPreset(hBgPreset.value).catch(()=>hRender());

  window.LoopedWL = window.LoopedWL || {};
  window.LoopedWL.getCurrentHeroCardCanvas = function(){
    const c=document.createElement('canvas');
    hDraw(c, XSCALE);
    return c;
  };
  window.LoopedWL.getCurrentHeroBrandColor = function(){
    return hAccent || hBgTintColor || '#b79f97';
  };
  const hNotifyMockup=()=>window.dispatchEvent(new CustomEvent('looped:hero-updated'));
  ['input','change'].forEach(evt=>document.getElementById('tab-hero').addEventListener(evt,()=>setTimeout(hNotifyMockup,0)));

  window.LoopedWL.getCurrentHeroLogoCanvas = function(){
    if(!hLogo) return null;
    const source=hCropToContent(hLogo);
    const c=document.createElement('canvas');
    c.width=800; c.height=220;
    const ctx=c.getContext('2d');
    ctx.clearRect(0,0,c.width,c.height);
    const maxW=720, maxH=150;
    const scale=Math.min(maxW/source.width,maxH/source.height);
    const dw=source.width*scale, dh=source.height*scale;
    ctx.drawImage(source,40,(220-dh)/2,dw,dh);
    return c;
  };
})();


// ════════════════════════════════════════════════════════════════════════════
// TAB 4 — FINAL MOCKUP
// ════════════════════════════════════════════════════════════════════════════
(function(){
  const M_DEFAULT_SRC='assets/final-mockup-alpha-overlay.png';
  const M_TINT_MASK_SRC='assets/mockup-background-tint-mask.png';
  const mCanvas=document.getElementById('m-canvas');
  const mCtx=mCanvas.getContext('2d');
  const mStatus=document.getElementById('m-status');
  const mBasePreview=document.getElementById('m-basePreview');
  const mBaseFile=document.getElementById('m-baseFile');
  const mUseDefault=document.getElementById('m-useDefault');
  const mUseCurrentHeader=document.getElementById('m-useCurrentHeader');
  const mHeaderFile=document.getElementById('m-headerFile');
  const mUseCurrentHero=document.getElementById('m-useCurrentHero');
  const mHeroFile=document.getElementById('m-heroFile');
  const mHeaderThumb=document.getElementById('m-headerThumb');
  const mHeroThumb=document.getElementById('m-heroThumb');
  const mTintColor=document.getElementById('m-tintColor');
  const mTintHex=document.getElementById('m-tintHex');
  const mTintSwatch=document.getElementById('m-tintSwatch');
  const mTintSrc=document.getElementById('m-tintSrc');
  const mTintStrength=document.getElementById('m-tintStrength');
  const mGradientDir=document.getElementById('m-gradientDir');
  const mTintStrengthVal=document.getElementById('m-tintStrengthVal');
  const mHeaderScale=document.getElementById('m-headerScale');
  const mHeaderScaleVal=document.getElementById('m-headerScaleVal');
  const mHeroScale=document.getElementById('m-heroScale');
  const mHeroScaleVal=document.getElementById('m-heroScaleVal');
  const mHeaderX=document.getElementById('m-headerX');
  const mHeaderY=document.getElementById('m-headerY');
  const mHeroX=document.getElementById('m-heroX');
  const mHeroY=document.getElementById('m-heroY');
  const mHeaderXVal=document.getElementById('m-headerXVal');
  const mHeaderYVal=document.getElementById('m-headerYVal');
  const mHeroXVal=document.getElementById('m-heroXVal');
  const mHeroYVal=document.getElementById('m-heroYVal');
  const mExport=document.getElementById('m-export');

  let mBaseImg=null;
  let mHeaderImg=null;
  let mHeroImg=null;
  let mTintMaskImg=null;

  let mSyncing=false;
  async function mSyncCurrentAssets(options={}){
    if(mSyncing) return;
    mSyncing=true;
    try{
      let synced=false;
      let headerCanvas=null;
      if(window.LoopedWL && window.LoopedWL.getCurrentHeaderMarkCanvas){
        headerCanvas=await window.LoopedWL.getCurrentHeaderMarkCanvas();
      }
      if(!headerCanvas && window.LoopedWL && window.LoopedWL.getCurrentHeroLogoCanvas){
        headerCanvas=window.LoopedWL.getCurrentHeroLogoCanvas();
      }
      if(headerCanvas){
        await mSetHeaderFromImageSource(headerCanvas);
        synced=true;
        let color=null;
        if(window.LoopedWL.getCurrentHeaderBrandColor) color=await window.LoopedWL.getCurrentHeaderBrandColor();
        if(!color && window.LoopedWL.getCurrentHeroBrandColor) color=window.LoopedWL.getCurrentHeroBrandColor();
        if(color){
          mTintColor.value=color;
          mTintHex.textContent=color.toUpperCase();
          mTintSwatch.style.background=color;
          mTintSrc.textContent='Synced from uploaded logo';
        }
      }
      if(window.LoopedWL && window.LoopedWL.getCurrentHeroCardCanvas){
        const heroCanvas=window.LoopedWL.getCurrentHeroCardCanvas();
        if(heroCanvas){ await mSetHeroFromImageSource(heroCanvas); synced=true; }
      }
      if(synced && !options.silent) mStatus.textContent='Current header logo and hero card synced automatically.';
      mRender();
    }catch(err){
      console.error('Final mockup sync failed',err);
      if(!options.silent) mStatus.textContent='Could not sync the current assets yet.';
    }finally{ mSyncing=false; }
  }

  const ZONES={
    header:{x:54,y:66,w:308,h:70},
    hero:{x:60,y:647,w:894,h:504,r:52}
  };

  function mRoundRect(ctx,x,y,w,h,r){
    const rr=Math.min(r,w/2,h/2);
    ctx.beginPath();
    ctx.moveTo(x+rr,y);
    ctx.arcTo(x+w,y,x+w,y+h,rr);
    ctx.arcTo(x+w,y+h,x,y+h,rr);
    ctx.arcTo(x,y+h,x,y,rr);
    ctx.arcTo(x,y,x+w,y,rr);
    ctx.closePath();
  }
  function mResetThumb(canvas){
    const c=canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    c.fillStyle='rgba(255,255,255,.03)';
    c.fillRect(0,0,canvas.width,canvas.height);
  }
  function mDrawThumb(canvas,img){
    const c=canvas.getContext('2d');
    c.clearRect(0,0,canvas.width,canvas.height);
    if(!img){ mResetThumb(canvas); return; }
    const scale=Math.min(canvas.width/img.width, canvas.height/img.height);
    const dw=img.width*scale, dh=img.height*scale;
    const dx=(canvas.width-dw)/2, dy=(canvas.height-dh)/2;
    c.drawImage(img,dx,dy,dw,dh);
  }
  async function mSetBaseFromSrc(src){
    mBaseImg=await loadImageFromSrc(src);
    mBasePreview.src=src;
    mRender();
  }
  async function mLoadTintMask(){
    mTintMaskImg=await loadImageFromSrc(M_TINT_MASK_SRC);
    mRender();
  }
  async function mSetHeaderFromImageSource(srcOrCanvas){
    if(!srcOrCanvas) return;
    mHeaderImg = srcOrCanvas instanceof HTMLCanvasElement ? await loadImageFromBlob(await canvasToBlob(srcOrCanvas)) : await loadImageFromSrc(srcOrCanvas);
    mDrawThumb(mHeaderThumb, mHeaderImg);
    mRender();
  }
  async function mSetHeroFromImageSource(srcOrCanvas){
    if(!srcOrCanvas) return;
    mHeroImg = srcOrCanvas instanceof HTMLCanvasElement ? await loadImageFromBlob(await canvasToBlob(srcOrCanvas)) : await loadImageFromSrc(srcOrCanvas);
    mDrawThumb(mHeroThumb, mHeroImg);
    mRender();
  }
  function mFitRect(img, boxW, boxH){
    const s=Math.min(boxW/img.width, boxH/img.height);
    return {w:img.width*s, h:img.height*s};
  }
  function mVisibleBounds(img){
    const c=document.createElement('canvas');
    c.width=img.width; c.height=img.height;
    const cx=c.getContext('2d');
    cx.drawImage(img,0,0);
    const data=cx.getImageData(0,0,c.width,c.height).data;
    let minX=c.width,minY=c.height,maxX=-1,maxY=-1;
    for(let y=0;y<c.height;y++) for(let x=0;x<c.width;x++){
      if(data[(y*c.width+x)*4+3]>8){
        if(x<minX)minX=x;if(y<minY)minY=y;if(x>maxX)maxX=x;if(y>maxY)maxY=y;
      }
    }
    if(maxX<minX||maxY<minY) return {x:0,y:0,w:img.width,h:img.height};
    return {x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  }
  function mActiveBackgroundSettings(){
    const editorStyle=document.querySelector('input[name="bb-gradStyle"]:checked')?.value||null;
    const editorColor=document.querySelector('#bb-rowContainer .bulk-bg-dot input[type="color"]')?.value||null;
    return {style:editorStyle,color:editorColor};
  }
  function mGradientPoints(W,H){
    const editorStyle=mActiveBackgroundSettings().style;
    if(editorStyle==='top-bottom') return {x0:0,y0:0,x1:0,y1:H};
    if(editorStyle==='bottom-top') return {x0:0,y0:H,x1:0,y1:0};
    if(editorStyle==='diagonal') return {x0:0,y0:H,x1:W,y1:0};
    if(editorStyle==='left-right') return {x0:0,y0:0,x1:W,y1:0};
    const dir=(mGradientDir && mGradientDir.value) ? mGradientDir.value : 'ltr';
    let x0=0,y0=0,x1=W,y1=0;
    if(dir==='rtl'){ x0=W; y0=0; x1=0; y1=0; }
    else if(dir==='ttb'){ x0=0; y0=0; x1=0; y1=H; }
    else if(dir==='btt'){ x0=0; y0=H; x1=0; y1=0; }
    return {x0,y0,x1,y1};
  }
  function mBackgroundGradient(ctx,W,H,color,strength){
    const active=mActiveBackgroundSettings();
    color=active.color||color;
    const rgb=hexToRgb(color);
    const style=active.style;
    if(style==='atmospheric'){
      const g=ctx.createRadialGradient(W,H*.5,0,W,H*.5,Math.max(W,H));
      g.addColorStop(0,`rgba(${rgb.r},${rgb.g},${rgb.b},${strength})`);
      g.addColorStop(1,`rgba(0,0,0,${Math.max(.4,strength)})`);
      return g;
    }
    const {x0,y0,x1,y1}=mGradientPoints(W,H);
    const g=ctx.createLinearGradient(x0,y0,x1,y1);
    if(style==='sandwich'){
      g.addColorStop(0,`rgba(0,0,0,${Math.max(.5,strength)})`);
      g.addColorStop(.35,`rgba(${rgb.r},${rgb.g},${rgb.b},${strength})`);
      g.addColorStop(.65,`rgba(${rgb.r},${rgb.g},${rgb.b},${strength})`);
      g.addColorStop(1,`rgba(0,0,0,${Math.max(.5,strength)})`);
    }else{
      g.addColorStop(0, `rgba(0,0,0,${Math.max(0, strength*0.34)})`);
      g.addColorStop(0.28, `rgba(${rgb.r},${rgb.g},${rgb.b},${Math.max(0, strength*0.10)})`);
      g.addColorStop(1, `rgba(${rgb.r},${rgb.g},${rgb.b},${strength})`);
    }
    return g;
  }
  function mOpaqueBackgroundGradient(ctx,W,H,color,strength){
    const active=mActiveBackgroundSettings();
    color=active.color||color;
    const style=active.style;
    const rgb=hexToRgb(color);
    const dark={r:Math.round(rgb.r*.12),g:Math.round(rgb.g*.12),b:Math.round(rgb.b*.12)};
    if(style==='atmospheric'){
      const g=ctx.createRadialGradient(W,H*.5,0,W,H*.5,Math.max(W,H));
      g.addColorStop(0,color);
      g.addColorStop(1,'rgb(0,0,0)');
      return g;
    }
    const {x0,y0,x1,y1}=mGradientPoints(W,H);
    const g=ctx.createLinearGradient(x0,y0,x1,y1);
    if(style==='sandwich'){
      g.addColorStop(0,`rgb(${dark.r},${dark.g},${dark.b})`);
      g.addColorStop(.35,color);
      g.addColorStop(.65,color);
      g.addColorStop(1,`rgb(${dark.r},${dark.g},${dark.b})`);
      return g;
    }
    if(style){
      g.addColorStop(0,`rgb(${dark.r},${dark.g},${dark.b})`);
      g.addColorStop(1,color);
      return g;
    }
    const mix=(a,b,t)=>Math.round(a+(b-a)*t);
    const left={r:11,g:9,b:13};
    const middle={
      r:mix(45,rgb.r,0.18+strength*0.16),
      g:mix(36,rgb.g,0.18+strength*0.16),
      b:mix(40,rgb.b,0.18+strength*0.16)
    };
    const right={
      r:mix(180,rgb.r,0.50+strength*0.28),
      g:mix(162,rgb.g,0.50+strength*0.28),
      b:mix(157,rgb.b,0.50+strength*0.28)
    };
    g.addColorStop(0,`rgb(${left.r},${left.g},${left.b})`);
    g.addColorStop(0.42,`rgb(${middle.r},${middle.g},${middle.b})`);
    g.addColorStop(1,`rgb(${right.r},${right.g},${right.b})`);
    return g;
  }
  function mCoverWithBackground(ctx,W,H,color,strength,x,y,w,h,r=0){
    ctx.save();
    if(r>0){ mRoundRect(ctx,x,y,w,h,r); ctx.clip(); }
    ctx.fillStyle=mOpaqueBackgroundGradient(ctx,W,H,color,strength);
    ctx.fillRect(0,0,W,H);
    ctx.restore();
  }
  function mDrawGlassPanel(ctx,x,y,w,h,r,opts={}){
    const fillAlpha=opts.fillAlpha ?? 0.16;
    const edgeAlpha=opts.edgeAlpha ?? 0.20;
    const shadowAlpha=opts.shadowAlpha ?? 0.16;
    ctx.save();
    ctx.shadowColor=`rgba(0,0,0,${shadowAlpha})`;
    ctx.shadowBlur=24;
    ctx.shadowOffsetY=10;
    mRoundRect(ctx,x,y,w,h,r);
    ctx.fillStyle=`rgba(255,255,255,${fillAlpha})`;
    ctx.fill();
    ctx.restore();
    ctx.save();
    mRoundRect(ctx,x,y,w,h,r); ctx.clip();
    const gloss=ctx.createLinearGradient(x,y,x,y+h);
    gloss.addColorStop(0,'rgba(255,255,255,0.16)');
    gloss.addColorStop(0.38,'rgba(255,255,255,0.05)');
    gloss.addColorStop(1,'rgba(255,255,255,0.02)');
    ctx.fillStyle=gloss;
    ctx.fillRect(x,y,w,h);
    ctx.strokeStyle=`rgba(255,255,255,${edgeAlpha})`;
    ctx.lineWidth=1.5;
    mRoundRect(ctx,x+0.75,y+0.75,w-1.5,h-1.5,r-0.75);
    ctx.stroke();
    ctx.restore();
  }
  function mSetText(ctx,font,fill='rgba(255,255,255,0.96)',align='left'){
    ctx.font=font; ctx.fillStyle=fill; ctx.textAlign=align; ctx.textBaseline='middle';
  }
  function mStrokeIconBase(ctx,color='rgba(255,255,255,0.92)',lineWidth=4,cap='round',join='round'){
    ctx.strokeStyle=color; ctx.fillStyle=color; ctx.lineWidth=lineWidth; ctx.lineCap=cap; ctx.lineJoin=join;
  }
  function mDrawRibbonIcon(ctx,cx,cy,s,color='rgba(255,255,255,0.92)'){
    ctx.save(); mStrokeIconBase(ctx,color,3.8);
    ctx.beginPath();
    ctx.arc(cx, cy-3*s, 10*s, 0, Math.PI*2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx-5*s, cy+7*s); ctx.lineTo(cx-9*s, cy+18*s); ctx.lineTo(cx-2*s, cy+15*s);
    ctx.moveTo(cx+5*s, cy+7*s); ctx.lineTo(cx+9*s, cy+18*s); ctx.lineTo(cx+2*s, cy+15*s);
    ctx.stroke();
    ctx.restore();
  }
  function mDrawBellIcon(ctx,cx,cy,s,color='rgba(255,255,255,0.92)'){
    ctx.save(); mStrokeIconBase(ctx,color,3.6);
    ctx.beginPath();
    ctx.moveTo(cx-11*s, cy+7*s);
    ctx.quadraticCurveTo(cx-10*s, cy-6*s, cx, cy-12*s);
    ctx.quadraticCurveTo(cx+10*s, cy-6*s, cx+11*s, cy+7*s);
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-14*s, cy+8*s); ctx.lineTo(cx+14*s, cy+8*s); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy+13*s, 2.6*s, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function mDrawProgressRing(ctx,cx,cy,r,color='rgba(38,38,45,0.82)',track='rgba(255,255,255,0.78)'){
    ctx.save(); ctx.lineWidth=6;
    ctx.strokeStyle=track; ctx.beginPath(); ctx.arc(cx,cy,r,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle=color; ctx.beginPath(); ctx.arc(cx,cy,r,-Math.PI*0.2,Math.PI*1.45); ctx.stroke();
    ctx.restore();
  }
  function mDrawHouseIcon(ctx,cx,cy,s,active=false){
    const color=active?'rgba(255,255,255,0.98)':'rgba(255,255,255,0.56)';
    ctx.save(); mStrokeIconBase(ctx,color,4);
    ctx.beginPath(); ctx.moveTo(cx-17*s, cy+3*s); ctx.lineTo(cx, cy-12*s); ctx.lineTo(cx+17*s, cy+3*s); ctx.stroke();
    ctx.beginPath(); ctx.rect(cx-12*s, cy+1*s, 24*s, 18*s); ctx.stroke();
    ctx.beginPath(); ctx.rect(cx-4*s, cy+8*s, 8*s, 11*s); ctx.stroke();
    ctx.restore();
  }
  function mDrawPlayIcon(ctx,cx,cy,s,color='rgba(255,255,255,0.56)'){
    ctx.save(); ctx.fillStyle=color; ctx.beginPath(); ctx.moveTo(cx-7*s, cy-12*s); ctx.lineTo(cx+12*s, cy); ctx.lineTo(cx-7*s, cy+12*s); ctx.closePath(); ctx.fill(); ctx.restore();
  }
  function mDrawBagIcon(ctx,cx,cy,s,color='rgba(255,255,255,0.56)'){
    ctx.save(); mStrokeIconBase(ctx,color,4);
    ctx.beginPath(); ctx.rect(cx-13*s, cy-3*s, 26*s, 20*s); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-7*s, cy-3*s); ctx.quadraticCurveTo(cx, cy-14*s, cx+7*s, cy-3*s); ctx.stroke();
    ctx.restore();
  }
  function mDrawUserIcon(ctx,cx,cy,s,color='rgba(255,255,255,0.56)'){
    ctx.save(); mStrokeIconBase(ctx,color,4);
    ctx.beginPath(); ctx.arc(cx, cy-7*s, 8*s, 0, Math.PI*2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx-17*s, cy+18*s); ctx.quadraticCurveTo(cx, cy+3*s, cx+17*s, cy+18*s); ctx.stroke();
    ctx.restore();
  }
  function mEraseGlassUiRegions(ctx,W,H,color,strength){
    // Fully cover the baked controls before redrawing them. Rectangular erase
    // regions intentionally extend beyond the original shadows and status dot.
    ctx.save();
    ctx.fillStyle=mOpaqueBackgroundGradient(ctx,W,H,color,strength);
    ctx.fillRect(466,34,370,145);
    ctx.fillRect(38,1242,938,216);
    ctx.restore();
  }
  function mDrawTopGlassUi(ctx,W,H,color,strength){
    // Exact baseline positions: medal pill + notification circle.
    mDrawGlassPanel(ctx,485,53,190,106,53,{fillAlpha:0.16,edgeAlpha:0.22,shadowAlpha:0.10});
    mDrawRibbonIcon(ctx,545,104,1.0);
    mSetText(ctx,'700 29px Inter, Arial, sans-serif','rgba(255,255,255,0.94)','center');
    ctx.fillText('25', 612, 104);

    mDrawGlassPanel(ctx,707,53,106,106,53,{fillAlpha:0.16,edgeAlpha:0.22,shadowAlpha:0.10});
    mDrawBellIcon(ctx,760,103,1.0);
    ctx.save();
    ctx.fillStyle='rgba(202,176,171,0.95)';
    ctx.beginPath(); ctx.arc(800,145,10,0,Math.PI*2); ctx.fill();
    ctx.restore();
  }
  function mDrawStatsGlassUi(ctx,W,H,color,strength){
    // Exact baseline card bounds.
    const x=52,y=1256,w=912,h=188,r=48;
    mDrawGlassPanel(ctx,x,y,w,h,r,{fillAlpha:0.16,edgeAlpha:0.18,shadowAlpha:0.10});
    const items=[
      {num:'1',label:'Journeys',x:160},
      {num:'1',label:'Milestones',x:343},
      {num:'25',label:'Points',x:526}
    ];
    items.forEach(it=>{
      mSetText(ctx,'700 33px Inter, Arial, sans-serif','rgba(255,255,255,0.96)','center');
      ctx.fillText(it.num,it.x,y+62);
      mSetText(ctx,'700 22px Inter, Arial, sans-serif','rgba(255,255,255,0.96)','center');
      ctx.fillText(it.label,it.x,y+118);
    });
    mDrawProgressRing(ctx,700,y+61,16);
    mSetText(ctx,'700 22px Inter, Arial, sans-serif','rgba(255,255,255,0.96)','center');
    ctx.fillText('225 to Silver',700,y+118);
  }
  function mDrawBottomNavGlassUi(ctx,W,H,color,strength){
    const x=79,y=1795,w=849,h=161,r=80;
    mCoverWithBackground(ctx,W,H,color,strength,x,y,w,h,r);
    mDrawGlassPanel(ctx,x,y,w,h,r,{fillAlpha:0.14,edgeAlpha:0.16,shadowAlpha:0.12});
    // active home circle
    ctx.save();
    ctx.fillStyle='rgba(225,215,205,0.95)';
    ctx.beginPath(); ctx.arc(129,1874,54,0,Math.PI*2); ctx.fill();
    ctx.restore();
    mDrawHouseIcon(ctx,129,1876,1,true);
    mDrawPlayIcon(ctx,401,1876,1.15);
    mDrawBagIcon(ctx,607,1876,1.0);
    mDrawUserIcon(ctx,830,1878,1.0);
  }
  function mDrawRebuiltGlassUi(ctx,W,H,color,strength){
    mEraseGlassUiRegions(ctx,W,H,color,strength);
    mDrawTopGlassUi(ctx,W,H,color,strength);
    mDrawStatsGlassUi(ctx,W,H,color,strength);
  }
  function mApplyTint(ctx,W,H,color,strength){
    const layer=document.createElement('canvas');
    layer.width=W; layer.height=H;
    const lx=layer.getContext('2d');
    lx.fillStyle=mBackgroundGradient(lx,W,H,color,strength);
    lx.fillRect(0,0,W,H);
    if(mTintMaskImg){
      lx.globalCompositeOperation='destination-in';
      lx.drawImage(mTintMaskImg,0,0,W,H);
      lx.globalCompositeOperation='source-over';
    }
    ctx.save();
    ctx.drawImage(layer,0,0);
    ctx.restore();
  }
  function mDrawStaticUiText(ctx){
    ctx.save();
    mSetText(ctx,'700 39px Inter, Arial, sans-serif','rgba(255,255,255,0.98)','left');
    ctx.fillText('Welcome, Charmi', 53, 246);
    mSetText(ctx,'400 31px Inter, Arial, sans-serif','rgba(255,255,255,0.96)','left');
    ctx.fillText('You have one milestone to review.', 53, 318);
    mSetText(ctx,'400 31px Inter, Arial, sans-serif','rgba(255,255,255,0.96)','center');
    ctx.fillText('Welcome to', 153, 646);
    ctx.fillText('Looped', 153, 688);
    ctx.restore();
  }

  function mRender(){
    if(!mBaseImg) return;
    const W=mBaseImg.width, H=mBaseImg.height;
    if(mCanvas.width!==W || mCanvas.height!==H){ mCanvas.width=W; mCanvas.height=H; }
    mCtx.clearRect(0,0,W,H);
    const tint=Math.max(0,Math.min(0.8, parseInt(mTintStrength.value,10)/100));
    mCtx.fillStyle=mOpaqueBackgroundGradient(mCtx,W,H,mTintColor.value,tint);
    mCtx.fillRect(0,0,W,H);
    mCtx.drawImage(mBaseImg,0,0,W,H);
    mDrawStaticUiText(mCtx);
    if(mHeroImg){
      const z=ZONES.hero;
      const zoneX=z.x + parseInt(mHeroX.value,10);
      const zoneY=z.y + parseInt(mHeroY.value,10);
      const s=parseInt(mHeroScale.value,10)/100;
      const b=mVisibleBounds(mHeroImg);
      const fit=Math.min((z.w*s)/b.w,(z.h*s)/b.h);
      const dw=b.w*fit, dh=b.h*fit;
      const dx=zoneX + (z.w-dw)/2;
      const dy=zoneY + (z.h-dh)/2;
      mCtx.save();
      mRoundRect(mCtx,zoneX,zoneY,z.w,z.h,z.r);
      mCtx.clip();
      mCtx.drawImage(mHeroImg,b.x,b.y,b.w,b.h,dx,dy,dw,dh);
      mCtx.restore();
    }
    if(mHeaderImg){
      const z=ZONES.header;
      const s=parseInt(mHeaderScale.value,10)/100;
      const b=mVisibleBounds(mHeaderImg);
      const scale=Math.min((z.w*s)/b.w,(z.h*s)/b.h);
      const dw=b.w*scale, dh=b.h*scale;
      const dx=z.x + (z.w-dw)/2 + parseInt(mHeaderX.value,10);
      const dy=z.y + (z.h-dh)/2 + parseInt(mHeaderY.value,10);
      mCtx.drawImage(mHeaderImg,b.x,b.y,b.w,b.h,dx,dy,dw,dh);
    }
  }


  document.querySelectorAll('.tab-btn[data-tab="final"]').forEach(btn=>{
    btn.addEventListener('click',()=>setTimeout(()=>mSyncCurrentAssets(),0));
  });
  window.addEventListener('looped:header-updated',()=>mSyncCurrentAssets({silent:true}));
  window.addEventListener('looped:hero-updated',()=>mSyncCurrentAssets({silent:true}));
  window.addEventListener('looped:background-updated',()=>{
    const active=mActiveBackgroundSettings();
    if(active.color){
      mTintColor.value=active.color;
      mTintHex.textContent=active.color.toUpperCase();
      mTintSwatch.style.background=active.color;
      mTintSrc.textContent='From Background editor';
    }
    mRender();
  });

  mUseDefault.addEventListener('click',()=>mSetBaseFromSrc(M_DEFAULT_SRC));
  mBaseFile.addEventListener('change',async e=>{
    const file=e.target.files && e.target.files[0]; if(!file) return;
    const url=URL.createObjectURL(file);
    mStatus.textContent=`Loaded overlay: ${file.name}`;
    await mSetBaseFromSrc(url);
  });
  mHeaderFile.addEventListener('change',async e=>{
    const file=e.target.files && e.target.files[0]; if(!file) return;
    const img=await loadImageFromFile(file);
    mStatus.textContent=`Loaded header mark: ${file.name}`;
    await mSetHeaderFromImageSource(img.src);
  });
  mHeroFile.addEventListener('change',async e=>{
    const file=e.target.files && e.target.files[0]; if(!file) return;
    const img=await loadImageFromFile(file);
    mStatus.textContent=`Loaded hero card: ${file.name}`;
    await mSetHeroFromImageSource(img.src);
  });
  mUseCurrentHeader.addEventListener('click',async ()=>{
    try{
      if(!window.LoopedWL || !window.LoopedWL.getCurrentHeaderMarkCanvas) throw new Error('Header mark builder not available');
      const c=await window.LoopedWL.getCurrentHeaderMarkCanvas();
      if(!c) throw new Error('No header mark is loaded in Header');
      await mSetHeaderFromImageSource(c);
      if(window.LoopedWL.getCurrentHeaderBrandColor){
        const color=await window.LoopedWL.getCurrentHeaderBrandColor();
        if(color){ mTintColor.value=color; mTintHex.textContent=color.toUpperCase(); mTintSwatch.style.background=color; mTintSrc.textContent='From current header mark'; }
      }
      mStatus.textContent='Using current header mark from Header.';
    }catch(err){
      console.error(err);
      mStatus.textContent='Could not load current header mark. Add a logo in Header first.';
    }
    mRender();
  });
  mUseCurrentHero.addEventListener('click',async ()=>{
    try{
      if(!window.LoopedWL || !window.LoopedWL.getCurrentHeroCardCanvas) throw new Error('Hero composer not available');
      const c=window.LoopedWL.getCurrentHeroCardCanvas();
      if(!c) throw new Error('No hero card available');
      await mSetHeroFromImageSource(c);
      if(window.LoopedWL.getCurrentHeroBrandColor){
        const color=window.LoopedWL.getCurrentHeroBrandColor();
        if(color){ mTintColor.value=color; mTintHex.textContent=color.toUpperCase(); mTintSwatch.style.background=color; mTintSrc.textContent='From current hero card'; }
      }
      mStatus.textContent='Using current hero card from Hero Card Composer.';
    }catch(err){
      console.error(err);
      mStatus.textContent='Could not load current hero card. Build one in Hero Card Composer first.';
    }
    mRender();
  });

  [[mTintColor,mTintHex,mTintSwatch,mTintSrc]].forEach(()=>{});
  mTintColor.addEventListener('input',()=>{ mTintHex.textContent=mTintColor.value.toUpperCase(); mTintSwatch.style.background=mTintColor.value; mTintSrc.textContent='Manual'; mRender(); });
  [mTintStrength,mHeaderScale,mHeroScale,mHeaderX,mHeaderY,mHeroX,mHeroY].forEach(el=>el.addEventListener('input',()=>{
    mTintStrengthVal.textContent=`${mTintStrength.value}%`;
    mHeaderScaleVal.textContent=`${mHeaderScale.value}%`;
    mHeroScaleVal.textContent=`${mHeroScale.value}%`;
    mHeaderXVal.textContent=mHeaderX.value;
    mHeaderYVal.textContent=mHeaderY.value;
    mHeroXVal.textContent=mHeroX.value;
    mHeroYVal.textContent=mHeroY.value;
    mRender();
  }));
  mGradientDir.addEventListener('change',()=>mRender());
  mExport.addEventListener('click', async ()=>{
    try{
      if(!mBaseImg) throw new Error('Load a baseline first');
      mRender();
      const blob=await canvasToBlob(mCanvas);
      const a=document.createElement('a');
      const url=URL.createObjectURL(blob);
      a.href=url;
      a.download=`final_mockup_${Date.now()}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(()=>URL.revokeObjectURL(url),4000);
      mStatus.textContent='Downloaded final mockup PNG.';
    }catch(err){
      console.error(err);
      mStatus.textContent=`Export failed: ${err && err.message ? err.message : 'unknown error'}`;
    }
  });

  mTintHex.textContent=mTintColor.value.toUpperCase();
  mTintSwatch.style.background=mTintColor.value;
  mTintStrengthVal.textContent=`${mTintStrength.value}%`;
  mHeaderScaleVal.textContent=`${mHeaderScale.value}%`;
  mHeroScaleVal.textContent=`${mHeroScale.value}%`;
  mHeaderXVal.textContent=mHeaderX.value;
  mHeaderYVal.textContent=mHeaderY.value;
  mHeroXVal.textContent=mHeroX.value;
  mHeroYVal.textContent=mHeroY.value;
  mResetThumb(mHeaderThumb);
  mResetThumb(mHeroThumb);
  mSetBaseFromSrc(M_DEFAULT_SRC).catch(err=>{ console.error(err); mStatus.textContent='Could not load the included overlay.'; });
})();


// ════════════════════════════════════════════════════════════════════════════
// INTERNAL CLINIC DASHBOARD
// ════════════════════════════════════════════════════════════════════════════
(() => {
  const $=id=>document.getElementById(id);
  const clinic=$('d-clinic'), logoInput=$('d-logoFile'), logoDrop=$('d-logoDrop'), logoPreview=$('d-logoPreview');
  const includeHeader=$('d-headerText'), brand=$('d-brandColor'), status=$('d-status');
  const appBgEnabled=$('d-appBgEnabled'), appBgColor=$('d-appBgColor');
  const appC=$('d-appCanvas'), headerC=$('d-headerCanvas'), heroC=$('d-heroCanvas'), bgC=$('d-bgCanvas'), finalC=$('d-finalCanvas');
  let dashboardImg=null, dashboardFile=null, refreshTimer=null;
  let dashboardLogoRevision=0, lastSyncedLogoRevision=-1;
  const safeName=()=>sanitize(clinic.value||'Clinic','Clinic');
  function fitVisible(img){
    const c=document.createElement('canvas'); c.width=img.width;c.height=img.height; const x=c.getContext('2d');x.drawImage(img,0,0);
    const d=x.getImageData(0,0,c.width,c.height).data;let minX=c.width,minY=c.height,maxX=-1,maxY=-1;
    for(let y=0;y<c.height;y+=1)for(let xx=0;xx<c.width;xx+=1)if(d[(y*c.width+xx)*4+3]>8){minX=Math.min(minX,xx);minY=Math.min(minY,y);maxX=Math.max(maxX,xx);maxY=Math.max(maxY,y);}
    return maxX<0?{x:0,y:0,w:img.width,h:img.height}:{x:minX,y:minY,w:maxX-minX+1,h:maxY-minY+1};
  }
  function drawContained(ctx,canvas,img,pad=80,bgColor=''){ctx.clearRect(0,0,canvas.width,canvas.height);if(bgColor){ctx.fillStyle=bgColor;ctx.fillRect(0,0,canvas.width,canvas.height);}if(!img)return;const b=fitVisible(img);const s=Math.min((canvas.width-pad*2)/b.w,(canvas.height-pad*2)/b.h);const w=b.w*s,h=b.h*s;ctx.drawImage(img,b.x,b.y,b.w,b.h,(canvas.width-w)/2,(canvas.height-h)/2,w,h);}
  function copyCanvas(src,dst){if(!src)return;const x=dst.getContext('2d');x.clearRect(0,0,dst.width,dst.height);const s=Math.min(dst.width/src.width,dst.height/src.height);const w=src.width*s,h=src.height*s;x.drawImage(src,(dst.width-w)/2,(dst.height-h)/2,w,h);}
  function setFiles(input,file){
    if(!input||!file)return;
    const dt=new DataTransfer();
    dt.items.add(file);
    input.files=dt.files;
    input.dispatchEvent(new Event('change',{bubbles:true}));
  }
  async function normalizedDashboardLogoFile(){
    if(!dashboardImg)return null;
    const maxSide=2048;
    const scale=Math.min(1,maxSide/Math.max(dashboardImg.width,dashboardImg.height));
    const c=document.createElement('canvas');
    c.width=Math.max(1,Math.round(dashboardImg.width*scale));
    c.height=Math.max(1,Math.round(dashboardImg.height*scale));
    c.getContext('2d').drawImage(dashboardImg,0,0,c.width,c.height);
    const blob=await canvasToBlob(c);
    return new File([blob],dashboardFile?.name||`${safeName()}_logo.png`,{type:'image/png'});
  }
  async function syncDashboardLogoToEditors(){
    if(!dashboardImg)return;
    const needsImageSync=lastSyncedLogoRevision!==dashboardLogoRevision;
    let normalized=null;
    if(needsImageSync){
      normalized=await normalizedDashboardLogoFile();
      if(!normalized)return;
      const h=$('h-logoFile'),bb=$('bb-fileInput');
      if(window.LoopedWL?.setDashboardLogoFile){
        await window.LoopedWL.setDashboardLogoFile(normalized,includeHeader.checked?clinic.value:'');
      }else{
        const r=$('r-fileInput');
        if(r)setFiles(r,normalized);
      }
      if(h)setFiles(h,normalized);
      if(bb && !document.querySelector('#bb-rowContainer .bulk-bg-row')) setFiles(bb,normalized);
      lastSyncedLogoRevision=dashboardLogoRevision;
    }
    $('r-clinic').value=clinic.value;
    if($('r-headerIncludeText')) $('r-headerIncludeText').checked=includeHeader.checked;
    $('r-headerText').value=includeHeader.checked?clinic.value:'';
    $('h-clinic').value=clinic.value;
    ['r-clinic','r-headerText','h-clinic'].forEach(id=>$(id)?.dispatchEvent(new Event('input',{bubbles:true})));
    await new Promise(resolve=>setTimeout(resolve,180));
  }
  async function dashboardHeaderCanvas(){
    if(!dashboardImg)return null;
    if(includeHeader.checked && window.LoopedWL?.getCurrentHeaderMarkCanvas){return await window.LoopedWL.getCurrentHeaderMarkCanvas();}
    const c=document.createElement('canvas');c.width=800;c.height=220;drawContained(c.getContext('2d'),c,dashboardImg,40);return c;
  }
  function dashboardBackgroundSettings(){
    const editorColor=document.querySelector('#bb-rowContainer .bulk-bg-dot input[type="color"]')?.value;
    const editorStyle=document.querySelector('input[name="bb-gradStyle"]:checked')?.value;
    return {color:editorColor||brand.value,style:editorStyle||'left-right'};
  }
  function drawBackground(){
    const x=bgC.getContext('2d'),W=bgC.width,H=bgC.height;
    const {color,style}=dashboardBackgroundSettings();
    const rgb=hexToRgb(color);
    const dark=`rgb(${Math.round(rgb.r*.12)},${Math.round(rgb.g*.12)},${Math.round(rgb.b*.12)})`;
    x.clearRect(0,0,W,H);
    let g;
    if(style==='atmospheric'){
      g=x.createRadialGradient(W,H*.5,0,W,H*.5,Math.max(W,H));g.addColorStop(0,color);g.addColorStop(1,'rgb(0,0,0)');
    }else if(style==='top-bottom'){
      g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,dark);g.addColorStop(1,color);
    }else if(style==='bottom-top'){
      g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,color);g.addColorStop(1,dark);
    }else if(style==='diagonal'){
      g=x.createLinearGradient(0,H,W,0);g.addColorStop(0,dark);g.addColorStop(1,color);
    }else if(style==='sandwich'){
      g=x.createLinearGradient(0,0,0,H);g.addColorStop(0,dark);g.addColorStop(.35,color);g.addColorStop(.65,color);g.addColorStop(1,dark);
    }else{
      g=x.createLinearGradient(0,0,W,0);g.addColorStop(0,dark);g.addColorStop(1,color);
    }
    x.fillStyle=g;x.fillRect(0,0,W,H);
  }
  async function refreshDashboard(){
    $('d-summaryName').textContent=clinic.value.trim()||'New Clinic';
    if(dashboardImg)drawContained(appC.getContext('2d'),appC,dashboardImg,180,appBgEnabled.checked?appBgColor.value:''); else appC.getContext('2d').clearRect(0,0,appC.width,appC.height);
    const hc=await dashboardHeaderCanvas();if(hc)copyCanvas(hc,headerC); else headerC.getContext('2d').clearRect(0,0,headerC.width,headerC.height);
    const hsrc=$('h-canvas');if(hsrc)copyCanvas(hsrc,heroC);
    drawBackground();
    const msrc=$('m-canvas');if(msrc)copyCanvas(msrc,finalC);
  }
  async function loadLogo(file){
    dashboardFile=file;
    dashboardLogoRevision+=1;
    dashboardImg=await loadImageFromFile(file);
    logoPreview.src=URL.createObjectURL(file);
    logoDrop.classList.add('has-logo');
    status.textContent='Logo loaded. Syncing connected editors…';
    await syncDashboardLogoToEditors();
    setTimeout(async()=>{
      try{
        const c=await window.LoopedWL?.getCurrentHeaderBrandColor?.();
        if(c){
          brand.value=c;
          if(!appBgEnabled.checked && /^#([0-9a-f]{6})$/i.test(appBgColor.value) && (appBgColor.value.toLowerCase()==='#b79f97' || appBgColor.value.toLowerCase()===brand.defaultValue.toLowerCase())){
            appBgColor.value=c;
          }
          updateDashboardBrandUi();
          $('m-tintColor').value=c;
          $('m-tintColor').dispatchEvent(new Event('input',{bubbles:true}));
        }
      }catch{}
      await refreshDashboard();
      status.textContent='Assets generated and synced to the advanced editors.';
    },300);
  }
  logoInput.addEventListener('change',e=>{const f=e.target.files?.[0];if(f)loadLogo(f);});
  clinic.addEventListener('input',()=>{const v=clinic.value;$('r-clinic').value=v;$('h-clinic').value=v;if(includeHeader.checked)$('r-headerText').value=v;['r-clinic','r-headerText','h-clinic'].forEach(id=>$(id)?.dispatchEvent(new Event('input',{bubbles:true})));refreshDashboard();});
  includeHeader.addEventListener('change',()=>{
    if($('r-headerIncludeText') && $('r-headerIncludeText').checked!==includeHeader.checked){
      $('r-headerIncludeText').checked=includeHeader.checked;
      $('r-headerIncludeText').dispatchEvent(new Event('change',{bubbles:true}));
    }
    $('r-headerText').value=includeHeader.checked?clinic.value:'';
    $('r-headerText').dispatchEvent(new Event('input',{bubbles:true}));
    refreshDashboard();
  });
  function updateDashboardBrandUi(){
    const swatch=$('d-brandColorSwatch'), hex=$('d-brandColorHex');
    const appSwatch=$('d-appBgColorSwatch'), appHex=$('d-appBgColorHex');
    if(swatch) swatch.style.background=brand.value;
    if(hex) hex.textContent=brand.value.toUpperCase();
    if(appSwatch) appSwatch.style.background=appBgColor.value;
    if(appHex) appHex.textContent=appBgColor.value.toUpperCase();
  }
  brand.addEventListener('input',()=>{updateDashboardBrandUi();$('m-tintColor').value=brand.value;$('m-tintColor').dispatchEvent(new Event('input',{bubbles:true}));drawBackground();setTimeout(refreshDashboard,30);});
  window.addEventListener('looped:background-updated',()=>{drawBackground();refreshDashboard();});
  appBgEnabled.addEventListener('change',()=>{updateDashboardBrandUi();const r=$('r-appBgEnabled');if(r&&r.checked!==appBgEnabled.checked){r.checked=appBgEnabled.checked;r.dispatchEvent(new Event('change',{bubbles:true}));}refreshDashboard();});
  appBgColor.addEventListener('input',()=>{updateDashboardBrandUi();const r=$('r-appBgColor');if(r&&r.value.toLowerCase()!==appBgColor.value.toLowerCase()){r.value=appBgColor.value;r.dispatchEvent(new Event('input',{bubbles:true}));}refreshDashboard();});
  async function openAdvanced(tab){
    document.querySelectorAll('.internal-advanced-tab').forEach(b=>b.classList.remove('advanced-hidden'));
    if(dashboardImg){
      status.textContent='Opening editor with the current clinic logo…';
      await syncDashboardLogoToEditors();
    }
    document.querySelector(`.tab-btn[data-tab="${tab}"]`)?.click();
    $('d-toggleAdvanced').textContent='Hide Advanced Tools';
    status.textContent=dashboardImg?'Advanced editor opened with the current logo synced.':'Advanced editor opened.';
  }
  document.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>openAdvanced(b.dataset.open)));
  $('d-toggleAdvanced').addEventListener('click',()=>{const tabs=[...document.querySelectorAll('.internal-advanced-tab')];const hidden=tabs[0]?.classList.contains('advanced-hidden');tabs.forEach(t=>t.classList.toggle('advanced-hidden',!hidden));$('d-toggleAdvanced').textContent=hidden?'Hide Advanced Tools':'Show Advanced Tools';});
  async function blobFrom(c){return await canvasToBlob(c);}
  document.querySelectorAll('[data-dl]').forEach(b=>b.addEventListener('click',()=>{
    try{
      const n=safeName(), type=b.dataset.dl;
      if(type==='app') downloadCanvasPng(appC,`${n}_App_Logo.png`);
      else if(type==='header') downloadCanvasPng(headerC,`${n}_Header_Mark.png`);
      else if(type==='hero') downloadCanvasPng($('h-canvas'),`${n}_Hero_Card.png`);
      else if(type==='background') downloadCanvasPng(bgC,`${n}_App_Background.png`);
      else if(type==='final') downloadCanvasPng($('m-canvas'),`${n}_Final_Mockup.png`);
      else throw new Error('Unknown asset type.');
      status.textContent=`${type.charAt(0).toUpperCase()+type.slice(1)} asset downloaded.`;
    }catch(err){
      console.error(err);
      status.textContent=`Download failed: ${err.message}`;
    }
  }));
  $('d-downloadAll').addEventListener('click',async()=>{
    const btn=$('d-downloadAll');
    try{
      if(!dashboardImg){status.textContent='Upload a clinic logo first.';return;}
      btn.disabled=true;
      await refreshDashboard();
      status.textContent='Building ZIP…';
      if(typeof JSZip==='undefined') throw new Error('ZIP support did not load.');
      const zip=new JSZip(),n=safeName();
      zip.file(`${n}_App_Logo.png`,await blobFrom(appC));
      zip.file(`${n}_Header_Mark.png`,await blobFrom(headerC));
      zip.file(`${n}_Hero_Card.png`,await blobFrom($('h-canvas')));
      zip.file(`${n}_App_Background.png`,await blobFrom(bgC));
      zip.file(`${n}_Final_Mockup.png`,await blobFrom($('m-canvas')));
      downloadBlob(await zip.generateAsync({type:'blob'}),`${n}_Looped_Assets.zip`);
      status.textContent='Asset ZIP downloaded.';
    }catch(err){
      console.error(err);
      status.textContent=`ZIP download failed: ${err.message}`;
    }finally{btn.disabled=false;}
  });
  refreshTimer=setInterval(()=>{if(document.getElementById('tab-dashboard')?.classList.contains('active'))refreshDashboard();},900);
  if($('r-appBgEnabled')) $('r-appBgEnabled').checked=appBgEnabled.checked;
  if($('r-appBgColor')) $('r-appBgColor').value=appBgColor.value;
  updateDashboardBrandUi();drawBackground();refreshDashboard();
})();


