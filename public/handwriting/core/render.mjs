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
        const finePencil = s.tool === 'pencil' && s.brushVersion === 3;
        const texturedCrayon = s.tool === 'crayon' && s.brushVersion >= 2;
        const along = (this.travel + distance * t) / Math.max(8, s.size);
        // Two gentle, unequal wavelengths avoid evenly spaced stripes. No animation.
        const variation = .46 * Math.sin(along * 1.7 + .8) + .22 * Math.sin(along * .63 + 2.1);
        const density = texturedCrayon ? 1 + (s.brushVersion === 3 && variation < 0 ? variation * .6 : variation) : 1;
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
  dispose() { this.mask.width = this.mask.height = 1; if(this.wash)this.wash.width=this.wash.height=1; if(this.texture)this.texture.width=this.texture.height=1; }
}
export function renderDocument(canvas, document) {
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
export async function exportPng(document, maxEdge = 2048) {
  const canvas = globalThis.document.createElement('canvas');
  canvas.width = maxEdge; canvas.height = Math.round(maxEdge * document.canvas.height / document.canvas.width);
  renderDocument(canvas, document);
  return new Promise((resolve, reject) => canvas.toBlob(b => { canvas.width = canvas.height = 1; b ? resolve(b) : reject(new Error('PNGを書き出せませんでした。')); }, 'image/png'));
}

function createStampCanvas(document, maxEdge) {
  const source = globalThis.document.createElement('canvas');
  source.width = maxEdge;
  source.height = Math.round(maxEdge * document.canvas.height / document.canvas.width);
  renderDocument(source, document);
  const context = source.getContext('2d', { willReadFrequently: true });
  const pixels = context.getImageData(0, 0, source.width, source.height).data;
  let left = source.width; let top = source.height; let right = -1; let bottom = -1;
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      if (pixels[(y * source.width + x) * 4 + 3] === 0) continue;
      left = Math.min(left, x); right = Math.max(right, x); top = Math.min(top, y); bottom = Math.max(bottom, y);
    }
  }
  if (right < left || bottom < top) throw new Error('スタンプにする手書きがありません。');
  const padding = Math.max(8, Math.round(maxEdge * 0.012));
  left = Math.max(0, left - padding); top = Math.max(0, top - padding);
  right = Math.min(source.width - 1, right + padding); bottom = Math.min(source.height - 1, bottom + padding);
  const stamp = globalThis.document.createElement('canvas');
  stamp.width = right - left + 1; stamp.height = bottom - top + 1;
  stamp.getContext('2d').drawImage(source, left, top, stamp.width, stamp.height, 0, 0, stamp.width, stamp.height);
  source.width = source.height = 1;
  return stamp;
}

export function exportStampDataUrl(document, maxEdge = 800) {
  const stamp = createStampCanvas(document, maxEdge);
  const result = { dataUrl: stamp.toDataURL('image/png'), width: stamp.width, height: stamp.height };
  stamp.width = stamp.height = 1;
  return result;
}

export async function exportStampPng(document, maxEdge = 2048) {
  const stamp = createStampCanvas(document, maxEdge);
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
