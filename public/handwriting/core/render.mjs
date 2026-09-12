import { strokeRadius } from './document.mjs';
export function paintSegment(ctx, s, a, b) {
  ctx.save();
  ctx.globalCompositeOperation = s.tool === 'eraser' ? 'destination-out' : 'source-over';
  ctx.fillStyle = s.color;
  const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
  const count = Math.max(1, Math.ceil(distance / Math.max(0.4, Math.min(strokeRadius(s, a[2]), strokeRadius(s, b[2])) * 0.5)));
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    ctx.beginPath(); ctx.arc(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, strokeRadius(s, a[2] + (b[2] - a[2]) * t), 0, Math.PI * 2); ctx.fill();
  }
  ctx.restore();
}
export function paintStroke(ctx, stroke) {
  stroke.points.forEach((p, i) => paintSegment(ctx, stroke, stroke.points[Math.max(0, i - 1)], p));
}
// One reusable mask per active stroke. Alpha is applied once, not once per sample.
// Grain is derived from saved point indices, so redraw/export never randomize it.
export class BrushStrokeRenderer {
  constructor(canvas, dimensions, stroke) {
    this.stroke = stroke;
    this.mask = canvas.ownerDocument.createElement('canvas');
    this.mask.width = canvas.width; this.mask.height = canvas.height;
    this.context = this.mask.getContext('2d');
    this.context.setTransform(canvas.width / dimensions.width, 0, 0, canvas.height / dimensions.height, 0, 0);
    this.painted = 0;
    this.travel = 0;
    this.scale = canvas.width / dimensions.width;
    if (stroke.tool === 'crayon' && stroke.brushVersion === 4) {
      const nib = canvas.ownerDocument.createElement('canvas');
      nib.width = nib.height = Math.max(24, Math.ceil(stroke.size*2));
      const n = nib.getContext('2d'), edge = nib.width;
      n.fillStyle = stroke.color;
      let seed = 41793;
      const random = () => { seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296; };
      for(let i=0;i<Math.max(80,Math.round(edge*edge*.22));i++) {
        const x=random()*edge,y=random()*edge;
        const radius=Math.hypot(x-edge/2,y-edge/2)/(edge*.5);
        const patch=.55+.23*Math.sin(x*.31+y*.12)+.18*Math.sin(y*.43-x*.17);
        if(radius>1 || random()>patch*Math.min(1,(1-radius)*7))continue;
        n.globalAlpha=.18+random()*.4;
        n.beginPath();n.ellipse(x,y,.6+random()*1.6,.4+random()*.9,random()*Math.PI,0,Math.PI*2);n.fill();
      }
      this.crayonNib=nib;this.nibRemaining=0;this.nibCount=0;
    }
    if (stroke.brushVersion === 4 && stroke.tool === 'pencil' && stroke.size > 12) {
      const pencil = stroke.tool === 'pencil';
      const tile = canvas.ownerDocument.createElement('canvas');
      tile.width = tile.height = 192;
      const texture = tile.getContext('2d');
      texture.fillStyle = stroke.color;
      texture.globalAlpha = pencil ? .52 : .88;
      texture.fillRect(0, 0, 192, 192);
      let seed = 9173;
      const random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed / 4294967296; };
      // Fixed fine grain and broad gentle density variation, generated once per stroke.
      for (let i = 0; i < 9000; i++) {
        const x = random()*192, y = random()*192;
        const density = pencil ? .94 : .72 + .14*Math.sin(x*Math.PI/48) + .10*Math.sin(y*Math.PI/96);
        if (random() > density) continue;
        texture.globalAlpha = .25 + random()*.25;
        texture.beginPath(); texture.arc(x,y,pencil ? .25+random()*.4 : .3+random()*.65,0,Math.PI*2); texture.fill();
      }
      if (!pencil) {
        // Paper tooth: irregular clear gaps rather than dark dots on a pale base.
        texture.globalCompositeOperation = 'destination-out';
        for (let i = 0; i < 4400; i++) {
          const x = random()*192, y = random()*192;
          const patch = .5 + .25*Math.sin(x*.12+y*.08) + .2*Math.sin(y*.19-x*.07);
          texture.globalAlpha = .35 + random()*.65;
          const r = .25 + random()*(.75 + patch*1.2);
          texture.beginPath(); texture.ellipse(x,y,r,r*(.4+random()*.7),random()*Math.PI,0,Math.PI*2); texture.fill();
        }
        texture.globalCompositeOperation = 'source-over';
      }
      this.crayonTexture = tile;
      this.crayonWash = canvas.ownerDocument.createElement('canvas');
      this.crayonWash.width = canvas.width; this.crayonWash.height = canvas.height;
    }
    if (stroke.tool === 'watercolor' && stroke.brushVersion >= 2) {
      this.wash = canvas.ownerDocument.createElement('canvas');
      this.wash.width = canvas.width; this.wash.height = canvas.height;
      const tile = canvas.ownerDocument.createElement('canvas'); tile.width = tile.height = 192;
      const texture = tile.getContext('2d');
      texture.fillStyle = stroke.color; texture.globalAlpha = .42; texture.fillRect(0,0,192,192);
      let seed = 743;
      const random = () => { seed = (Math.imul(seed,1664525)+1013904223) >>> 0; return seed / 4294967296; };
      for (let i=0;i<45;i++) {
        const x=random()*192,y=random()*192,r=8+random()*30;
        for (const dx of [-192,0,192]) for (const dy of [-192,0,192]) {
          const gradient=texture.createRadialGradient(x+dx,y+dy,0,x+dx,y+dy,r);
          gradient.addColorStop(0,stroke.color); gradient.addColorStop(1,`${stroke.color}00`);
          texture.globalAlpha=.22; texture.fillStyle=gradient; texture.fillRect(x+dx-r,y+dy-r,r*2,r*2);
        }
      }
      this.texture = tile;
    }
  }
  append() {
    const s = this.stroke, ctx = this.context;
    ctx.fillStyle = s.color;
    for (let index = this.painted; index < s.points.length; index++) {
      const b = s.points[index], a = s.points[Math.max(0, index - 1)];
      if (this.crayonNib) {
        const distance=Math.hypot(b[0]-a[0],b[1]-a[1]);
        const spacing=Math.max(.6,s.size*.1);
        const dab=t=>{
          const pressure=a[2]+(b[2]-a[2])*t,r=strokeRadius(s,pressure);
          ctx.save();ctx.translate(a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t);
          ctx.rotate((this.nibCount++ * 2.399963) % (Math.PI*2));
          ctx.drawImage(this.crayonNib,-r,-r,r*2,r*2);ctx.restore();
        };
        if(index===0){dab(0);this.nibRemaining=spacing;}
        else if(distance>0){
          let offset=this.nibRemaining;
          while(offset<=distance){dab(offset/distance);offset+=spacing;}
          this.nibRemaining=offset-distance;
        }
        continue;
      }
      if (this.crayonTexture) {
        if (s.tool === 'pencil') paintSegment(ctx, { ...s, tool: 'pen' }, a, b);
        else {
          const distance = Math.hypot(b[0]-a[0],b[1]-a[1]);
          const steps = Math.max(1,Math.ceil(distance/Math.max(1,s.size*.06)));
          for (let j=0;j<=steps;j++) {
            const t=j/steps, x=a[0]+(b[0]-a[0])*t, y=a[1]+(b[1]-a[1])*t;
            const radius=strokeRadius(s,a[2]+(b[2]-a[2])*t);
            // World-anchored irregular edge stays stable across redraws and direction changes.
            ctx.beginPath();
            for (let k=0;k<64;k++) {
              const angle=k*Math.PI/32, ex=x+Math.cos(angle)*radius, ey=y+Math.sin(angle)*radius;
              const tooth=.5+.22*Math.sin(ex*1.9+ey*.7)+.18*Math.sin(ey*2.7-ex*1.2)+.1*Math.sin(ex*.31+ey*.47);
              const r=radius-Math.min(6,radius*.23)*tooth;
              const px=x+Math.cos(angle)*r,py=y+Math.sin(angle)*r;
              if(k===0)ctx.moveTo(px,py);else ctx.lineTo(px,py);
            }
            ctx.closePath();ctx.fill();
          }
        }
        continue;
      }
      if (s.tool === 'watercolor' && s.brushVersion >= 2) {
        const count = Math.max(1,Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])/Math.max(.4,s.size*.10)));
        for(let j=0;j<=count;j++) {
          const t=j/count,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t;
          const pressure=a[2]+(b[2]-a[2])*t;
          const ripple=1+.045*Math.sin(x*.19+y*.13)+.025*Math.sin(y*.41-x*.23);
          const radius=s.size*.5*(.48+.52*pressure)*ripple;
          ctx.beginPath(); ctx.ellipse(x,y,radius*.68,radius,-.45,0,Math.PI*2);ctx.fill();
        }
        continue;
      }
      if (s.tool === 'pen') { paintSegment(ctx, s, a, b); continue; }
      if (s.tool === 'marker' && s.brushVersion === 2) {
        // Sweep a fixed rectangular nib as one solid polygon (no gaps at speed).
        const halfWidth = s.size * .225, halfHeight = s.size * .5;
        ctx.fillRect(a[0] - halfWidth, a[1] - halfHeight, halfWidth * 2, halfHeight * 2);
        ctx.fillRect(b[0] - halfWidth, b[1] - halfHeight, halfWidth * 2, halfHeight * 2);
        for (const [dx, dy, ex, ey] of [[-halfWidth,-halfHeight,halfWidth,-halfHeight],[halfWidth,-halfHeight,halfWidth,halfHeight],[halfWidth,halfHeight,-halfWidth,halfHeight],[-halfWidth,halfHeight,-halfWidth,-halfHeight]]) {
          ctx.beginPath(); ctx.moveTo(a[0]+dx,a[1]+dy); ctx.lineTo(a[0]+ex,a[1]+ey);
          ctx.lineTo(b[0]+ex,b[1]+ey); ctx.lineTo(b[0]+dx,b[1]+dy); ctx.closePath(); ctx.fill();
        }
        continue;
      }
      if (s.tool === 'marker' || s.tool === 'watercolor') {
        paintSegment(ctx, { ...s, tool: 'pen' }, [...a.slice(0, 2), 1], [...b.slice(0, 2), 1]);
        continue;
      }
      let seed = (index + 1) * 2654435761 >>> 0;
      const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
      const distance = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const count = Math.max(1, Math.ceil(distance / Math.max(.5, s.size * .12)));
      for (let j = 0; j <= count; j++) {
        const t = j / count, pressure = a[2] + (b[2] - a[2]) * t;
        const densePencil = s.tool === 'pencil' && s.brushVersion >= 2;
        const finePencil = s.tool === 'pencil' && s.brushVersion >= 3;
        const texturedCrayon = s.tool === 'crayon' && s.brushVersion >= 2;
        const along = (this.travel + distance * t) / Math.max(8, s.size);
        // Two gentle, unequal wavelengths avoid evenly spaced stripes. No animation.
        const variation = .46 * Math.sin(along * 1.7 + .8) + .22 * Math.sin(along * .63 + 2.1);
        const density = texturedCrayon ? 1 + (s.brushVersion >= 3 && variation < 0 ? variation * .6 : variation) : 1;
        const radius = strokeRadius(s, pressure), grains = s.tool === 'pencil' ? (finePencil ? 44 : densePencil ? 22 : 9) : Math.round(15 * density);
        for (let k = 0; k < grains; k++) {
          const angle = random() * Math.PI * 2, spread = Math.pow(random(), finePencil ? .7 : .5) * radius;
          const x = a[0] + (b[0] - a[0]) * t + Math.cos(angle) * spread;
          const y = a[1] + (b[1] - a[1]) * t + Math.sin(angle) * spread;
          ctx.globalAlpha = (s.tool === 'pencil' ? (densePencil ? .32 : .18) : .35) + pressure * .35;
          const grain = Math.max(.22, s.size * (s.tool === 'pencil' ? (densePencil ? .045 : .035) : .075)) * (.5 + random());
          ctx.fillRect(x, y, grain, grain);
        }
      }
      this.travel += distance;
    }
    ctx.globalAlpha = 1;
    this.painted = s.points.length;
  }
  composite(ctx) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over';
    const tool = this.stroke.tool;
    const opacity = this.stroke.opacity ?? 1;
    if (this.crayonTexture) {
      const wash = this.crayonWash.getContext('2d');
      wash.clearRect(0,0,this.crayonWash.width,this.crayonWash.height);
      wash.drawImage(this.mask,0,0);
      wash.save(); wash.globalCompositeOperation = 'source-in';
      wash.scale(this.scale,this.scale);
      wash.fillStyle = wash.createPattern(this.crayonTexture,'repeat');
      wash.fillRect(0,0,this.crayonWash.width/this.scale,this.crayonWash.height/this.scale);
      wash.restore();
      ctx.globalAlpha = opacity;
      ctx.drawImage(this.crayonWash,0,0); ctx.restore(); return;
    }
    if (this.wash) {
      const wash=this.wash.getContext('2d');
      wash.save(); wash.setTransform(1,0,0,1,0,0);wash.clearRect(0,0,this.wash.width,this.wash.height);
      // Soft pigment rim outside the brush silhouette.
      wash.filter=`blur(${Math.max(.5,this.stroke.size*.055*this.scale)}px)`;
      wash.drawImage(this.mask,0,0); wash.filter='none';
      wash.globalCompositeOperation='destination-out';wash.drawImage(this.mask,0,0);
      wash.globalCompositeOperation='source-over';
      wash.restore();
      const softEdge = this.stroke.brushVersion === 3;
      ctx.globalAlpha=opacity*(softEdge ? .15 : .3);ctx.drawImage(this.wash,0,0);
      wash.clearRect(0,0,this.wash.width,this.wash.height);wash.drawImage(this.mask,0,0);
      wash.save();wash.globalCompositeOperation='source-in';
      wash.scale(this.scale,this.scale);wash.fillStyle=wash.createPattern(this.texture,'repeat');
      wash.fillRect(0,0,this.wash.width/this.scale,this.wash.height/this.scale);wash.restore();
      // Feather only the current wash; no overlap scan, extra canvas or ongoing simulation.
      const feather = softEdge ? Math.max(.35, Math.min(2.5, this.stroke.size * .08)) : .35;
      ctx.globalAlpha=opacity*.62;ctx.filter=`blur(${Math.max(.25,this.scale*feather)}px)`;
      ctx.drawImage(this.wash,0,0);ctx.restore();return;
    }
    ctx.globalAlpha = opacity * (tool === 'marker' ? .42 : tool === 'watercolor' ? .22 : 1);
    if (tool === 'watercolor') {
      ctx.filter = `blur(${Math.max(.5, this.stroke.size * .07 * this.mask.width / 1000)}px)`;
      ctx.drawImage(this.mask, 0, 0);
      ctx.filter = 'none'; ctx.globalAlpha = .12 * opacity;
    }
    ctx.drawImage(this.mask, 0, 0); ctx.restore();
  }
  dispose() { this.mask.width = this.mask.height = 1; if(this.wash)this.wash.width=this.wash.height=1; if(this.texture)this.texture.width=this.texture.height=1; if(this.crayonTexture)this.crayonTexture.width=this.crayonTexture.height=1; if(this.crayonWash)this.crayonWash.width=this.crayonWash.height=1; if(this.crayonNib)this.crayonNib.width=this.crayonNib.height=1; }
}
function renderFlat(canvas, document) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(canvas.width / document.canvas.width, 0, 0, canvas.height / document.canvas.height, 0, 0);
  document.strokes.forEach(s => {
    if ((s.tool === 'pen' && (s.opacity ?? 1) === 1) || s.tool === 'eraser') paintStroke(ctx, s);
    else {
      const brush = new BrushStrokeRenderer(canvas, document.canvas, s);
      brush.append(); brush.composite(ctx); brush.dispose();
    }
  });
}
export function renderLayerBuffers(canvas, document) {
  const layers = document.layers ?? [{id:'base',visible:true,opacity:1,clip:false}];
  return layers.map(layer => {
    const buffer = canvas.ownerDocument.createElement('canvas');
    buffer.width=canvas.width; buffer.height=canvas.height;
    renderFlat(buffer,{...document,strokes:document.strokes.filter(s=>(s.layerId??layers[0].id)===layer.id)});
    return buffer;
  });
}
const compositeScratch = new WeakMap();
export function compositeLayers(canvas, document, buffers) {
  const ctx=canvas.getContext('2d'); ctx.save(); ctx.setTransform(1,0,0,1,0,0);
  ctx.clearRect(0,0,canvas.width,canvas.height);
  const layers=document.layers??[{visible:true,opacity:1,clip:false}];
  let previous=null;
  let scratch=compositeScratch.get(canvas);
  if(!scratch){scratch=[canvas.ownerDocument.createElement('canvas'),canvas.ownerDocument.createElement('canvas')];compositeScratch.set(canvas,scratch);}
  layers.forEach((layer,i)=>{
    const masked=scratch[i%2];
    if(masked.width!==canvas.width || masked.height!==canvas.height){masked.width=canvas.width;masked.height=canvas.height;}
    const c=masked.getContext('2d');
    c.globalCompositeOperation='source-over';c.globalAlpha=1;c.clearRect(0,0,masked.width,masked.height);
    if(layer.visible){
      c.globalAlpha=layer.opacity; c.drawImage(buffers[i],0,0); c.globalAlpha=1;
      if(layer.clip && previous){c.globalCompositeOperation='destination-in';c.drawImage(previous,0,0);}
    }
    ctx.drawImage(masked,0,0);
    previous=masked;
  });
  ctx.restore();
}
export function renderDocument(canvas, document) {
  const buffers=renderLayerBuffers(canvas,document);
  compositeLayers(canvas,document,buffers);
  buffers.forEach(b=>{b.width=b.height=1;});
}
export async function exportPng(document, maxEdge = 2048) {
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = maxEdge; canvas.height = Math.round(maxEdge * document.canvas.height / document.canvas.width);
  renderDocument(canvas, document);
  return new Promise((resolve, reject) => canvas.toBlob(b => { canvas.width = canvas.height = 1; b ? resolve(b) : reject(new Error('PNGを書き出せませんでした。')); }, 'image/png'));
}

function alphaBounds(source, threshold = 0) {
  const context = source.getContext('2d', { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, source.width, source.height).data;
  let left = source.width; let top = source.height; let right = -1; let bottom = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (pixels[(y * source.width + x) * 4 + 3] <= threshold) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  return right < left || bottom < top ? null : { left, top, right, bottom };
}

function fillWhiteStickerSilhouette(artwork, outlineRadius, padding) {
  const offset = outlineRadius + padding;
  const width = artwork.width + offset * 2;
  const height = artwork.height + offset * 2;
  const count = width * height;
  const mask = new Uint8Array(count);
  const sourcePixels = artwork.getContext('2d', { willReadFrequently: true })
    .getImageData(0, 0, artwork.width, artwork.height).data;
  for (let y = 0; y < artwork.height; y += 1) {
    for (let x = 0; x < artwork.width; x += 1) {
      if (sourcePixels[(y * artwork.width + x) * 4 + 3] > 8) mask[(y + offset) * width + x + offset] = 1;
    }
  }

  const distance = new Float32Array(count);
  distance.fill(1e6);
  for (let index = 0; index < count; index += 1) if (mask[index]) distance[index] = 0;
  const diagonal = Math.SQRT2;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = y * width + x;
      let value = distance[index];
      if (x > 0) value = Math.min(value, distance[index - 1] + 1);
      if (y > 0) value = Math.min(value, distance[index - width] + 1);
      if (x > 0 && y > 0) value = Math.min(value, distance[index - width - 1] + diagonal);
      if (x + 1 < width && y > 0) value = Math.min(value, distance[index - width + 1] + diagonal);
      distance[index] = value;
    }
  }
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = width - 1; x >= 0; x -= 1) {
      const index = y * width + x;
      let value = distance[index];
      if (x + 1 < width) value = Math.min(value, distance[index + 1] + 1);
      if (y + 1 < height) value = Math.min(value, distance[index + width] + 1);
      if (x + 1 < width && y + 1 < height) value = Math.min(value, distance[index + width + 1] + diagonal);
      if (x > 0 && y + 1 < height) value = Math.min(value, distance[index + width - 1] + diagonal);
      distance[index] = value;
      mask[index] = value <= outlineRadius ? 1 : 0;
    }
  }

  // White paper fills closed areas behind line art while the outside stays transparent.
  const outside = new Uint8Array(count);
  const queue = new Int32Array(count);
  let head = 0; let tail = 0;
  const enqueue = index => { if (!mask[index] && !outside[index]) { outside[index] = 1; queue[tail++] = index; } };
  for (let x = 0; x < width; x += 1) { enqueue(x); enqueue((height - 1) * width + x); }
  for (let y = 1; y + 1 < height; y += 1) { enqueue(y * width); enqueue(y * width + width - 1); }
  while (head < tail) {
    const index = queue[head++];
    const x = index % width;
    if (x > 0) enqueue(index - 1);
    if (x + 1 < width) enqueue(index + 1);
    if (index >= width) enqueue(index - width);
    if (index + width < count) enqueue(index + width);
  }

  const sticker = artwork.ownerDocument.createElement('canvas');
  sticker.width = width; sticker.height = height;
  const context = sticker.getContext('2d');
  const white = context.createImageData(width, height);
  for (let index = 0; index < count; index += 1) {
    if (!mask[index] && outside[index]) continue;
    const pixel = index * 4;
    white.data[pixel] = 255; white.data[pixel + 1] = 255; white.data[pixel + 2] = 255; white.data[pixel + 3] = 255;
  }
  context.putImageData(white, 0, 0);
  context.drawImage(artwork, offset, offset);
  return sticker;
}

function createStampCanvas(document, maxEdge, options = {}) {
  const source = globalThis.document.createElement('canvas');
  source.width = maxEdge;
  source.height = Math.round(maxEdge * document.canvas.height / document.canvas.width);
  renderDocument(source, document);
  const bounds = alphaBounds(source);
  if (!bounds) throw new Error('スタンプにする手書きがありません。');
  let { left, top, right, bottom } = bounds;
  if (options.whiteOutline) {
    const artwork = globalThis.document.createElement('canvas');
    artwork.width = right - left + 1; artwork.height = bottom - top + 1;
    artwork.getContext('2d').drawImage(source, left, top, artwork.width, artwork.height, 0, 0, artwork.width, artwork.height);
    const radius = Math.max(6, Math.min(64, Math.round(Math.max(artwork.width, artwork.height) * 0.024)));
    const padding = Math.max(4, Math.round(maxEdge * 0.006));
    const sticker = fillWhiteStickerSilhouette(artwork, radius, padding);
    artwork.width = artwork.height = source.width = source.height = 1;
    return sticker;
  }
  const padding = Math.max(8, Math.round(maxEdge * 0.012));
  left = Math.max(0, left - padding); top = Math.max(0, top - padding);
  right = Math.min(source.width - 1, right + padding); bottom = Math.min(source.height - 1, bottom + padding);
  const stamp = globalThis.document.createElement('canvas');
  stamp.width = right - left + 1; stamp.height = bottom - top + 1;
  stamp.getContext('2d').drawImage(source, left, top, stamp.width, stamp.height, 0, 0, stamp.width, stamp.height);
  source.width = source.height = 1;
  return stamp;
}

export function exportStampDataUrl(document, maxEdge = 800, options = {}) {
  const stamp = createStampCanvas(document, maxEdge, options);
  const result = { dataUrl: stamp.toDataURL('image/png'), width: stamp.width, height: stamp.height };
  stamp.width = stamp.height = 1;
  return result;
}

export async function exportStampPng(document, maxEdge = 2048, options = {}) {
  const stamp = createStampCanvas(document, maxEdge, options);
  const width = stamp.width; const height = stamp.height;
  return new Promise((resolve, reject) => stamp.toBlob(blob => {
    stamp.width = stamp.height = 1;
    if (!blob) { reject(new Error('スタンプを保存できませんでした。')); return; }
    Object.defineProperties(blob, {
      drawingWidth: { value: width },
      drawingHeight: { value: height }
    });
    resolve(blob);
  }, 'image/png'));
}
