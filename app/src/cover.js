/* Palmline cover renderer: draws the multi-panel poster onto any canvas.
   Layouts, colour grades, lettering, grain and vignette are all drawn here,
   so the editor preview and the exported PNG are the same picture. */

'use strict';

/** Panel layouts: each returns the photo rectangles for a canvas of W x H,
    plus the title band (null when the title sits on the background). */
const coverLayouts = {
  'hero-split'(W, H) {
    const g = Math.max(4, W * 0.008);
    const bandH = H * 0.22;
    const contentH = H - bandH;
    const heroW = W * 0.6;
    const sideX = heroW + g;
    const sideW = W - sideX;
    const stripH = (contentH - g * 2) / 3;
    return {
      panels: [
        { x: 0, y: 0, w: heroW, h: contentH, tilt: 0 },
        { x: sideX, y: 0, w: sideW, h: stripH, tilt: 0 },
        { x: sideX, y: stripH + g, w: sideW, h: stripH, tilt: 0 },
        { x: sideX, y: (stripH + g) * 2, w: sideW, h: stripH, tilt: 0 },
      ],
      band: { x: 0, y: contentH, w: W, h: bandH },
    };
  },

  'four-grid'(W, H) {
    const g = Math.max(4, W * 0.008);
    const bandH = H * 0.22;
    const contentH = H - bandH;
    const cellW = (W - g) / 2;
    const cellH = (contentH - g) / 2;
    return {
      panels: [
        { x: 0, y: 0, w: cellW, h: cellH, tilt: 0 },
        { x: cellW + g, y: 0, w: cellW, h: cellH, tilt: 0 },
        { x: 0, y: cellH + g, w: cellW, h: cellH, tilt: 0 },
        { x: cellW + g, y: cellH + g, w: cellW, h: cellH, tilt: 0 },
      ],
      band: { x: 0, y: contentH, w: W, h: bandH },
    };
  },

  'tilted-snap'(W, H) {
    const bandH = H * 0.24;
    const contentH = H - bandH;
    return {
      panels: [
        { x: W * 0.06, y: contentH * 0.04, w: W * 0.56, h: contentH * 0.88, tilt: -0.045 },
        { x: W * 0.66, y: contentH * 0.06, w: W * 0.28, h: contentH * 0.42, tilt: 0.05 },
        { x: W * 0.68, y: contentH * 0.52, w: W * 0.26, h: contentH * 0.4, tilt: -0.03 },
      ],
      band: { x: 0, y: contentH, w: W, h: bandH },
      polaroid: true,
    };
  },

  'full-bleed'(W, H) {
    return {
      panels: [{ x: 0, y: 0, w: W, h: H, tilt: 0 }],
      band: { x: 0, y: H * 0.72, w: W, h: H * 0.28 },
      bandOverlay: true,
    };
  },

  triptych(W, H) {
    const g = Math.max(4, W * 0.008);
    const bandH = H * 0.22;
    const contentH = H - bandH;
    const colW = (W - g * 2) / 3;
    return {
      panels: [
        { x: 0, y: 0, w: colW, h: contentH, tilt: 0 },
        { x: colW + g, y: 0, w: colW, h: contentH, tilt: 0 },
        { x: (colW + g) * 2, y: 0, w: colW, h: contentH, tilt: 0 },
      ],
      band: { x: 0, y: contentH, w: W, h: bandH },
    };
  },
};

/** Colour grades: a sunset or neon wash laid over every photo. */
const coverGrades = {
  'vice-sunset': {
    label: 'Vice Sunset',
    photoFilter: 'saturate(1.3) contrast(1.1)',
    wash: ['#ff5e8a', '#ff9a3d'],
    washAlpha: 0.22,
    tint: '#ff7a59',
    tintAlpha: 0.1,
    band: ['#1b1030', '#3d0f2e'],
  },
  'neon-night': {
    label: 'Neon Night',
    photoFilter: 'saturate(1.45) contrast(1.12) brightness(0.94)',
    wash: ['#00e5ff', '#ff2e88'],
    washAlpha: 0.24,
    tint: '#7b2fff',
    tintAlpha: 0.12,
    band: ['#06121f', '#1c0b33'],
  },
  'palm-gold': {
    label: 'Palm Gold',
    photoFilter: 'saturate(1.2) contrast(1.05) brightness(1.04)',
    wash: ['#ffd166', '#ff7b00'],
    washAlpha: 0.2,
    tint: '#ffb703',
    tintAlpha: 0.08,
    band: ['#241505', '#3d2408'],
  },
  'teal-haze': {
    label: 'Teal Haze',
    photoFilter: 'saturate(1.15) contrast(1.06)',
    wash: ['#2ee6c8', '#2b6fff'],
    washAlpha: 0.22,
    tint: '#1899a2',
    tintAlpha: 0.1,
    band: ['#06222b', '#0b2f3a'],
  },
  'mono-noir': {
    label: 'Mono Noir',
    photoFilter: 'grayscale(1) contrast(1.22) brightness(1.02)',
    wash: ['#ffffff', '#8a8a8a'],
    washAlpha: 0.1,
    tint: '#000000',
    tintAlpha: 0.06,
    band: ['#0a0a0a', '#262626'],
  },
};

/** Seeded random so the grain is stable for one cover. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Shrink an Anton title until it fits the band width. */
function fitTitleFont(ctx, text, maxWidth, startPx) {
  let size = startPx;
  ctx.font = size + 'px Anton, sans-serif';
  while (size > 24 && ctx.measureText(text).width > maxWidth) {
    size -= 2;
    ctx.font = size + 'px Anton, sans-serif';
  }
  return size;
}

/** The sunset sky behind the panels: warm horizon, violet dusk above. */
function drawSunsetBackdrop(ctx, W, H, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, '#2b1055');
  sky.addColorStop(0.45, '#7597de');
  sky.addColorStop(0.72, grade.wash[0]);
  sky.addColorStop(1, grade.wash[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  // A low sun disc glowing on the horizon.
  const sunY = H * 0.66;
  const sun = ctx.createRadialGradient(W * 0.5, sunY, 0, W * 0.5, sunY, W * 0.28);
  sun.addColorStop(0, 'rgba(255, 214, 130, 0.9)');
  sun.addColorStop(0.5, 'rgba(255, 140, 90, 0.35)');
  sun.addColorStop(1, 'rgba(255, 140, 90, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
}

/** One photo panel: photo, grade wash, white gutter edge. */
function drawPhotoPanel(ctx, rect, photo, crop, grade, polaroid) {
  ctx.save();
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  ctx.translate(cx, cy);
  ctx.rotate(rect.tilt || 0);
  ctx.translate(-cx, -cy);
  if (polaroid) {
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 18;
    ctx.shadowOffsetY = 8;
    ctx.fillStyle = '#fdf6ec';
    ctx.fillRect(rect.x - 10, rect.y - 10, rect.w + 20, rect.h + 26);
    ctx.shadowColor = 'transparent';
  }
  const inner = polaroid
    ? { x: rect.x, y: rect.y, w: rect.w, h: rect.h }
    : rect;
  ctx.save();
  ctx.filter = grade.photoFilter;
  const drawn = photoStore.drawCoverFit(ctx, photo, inner, crop);
  ctx.restore();
  if (!drawn) {
    // Empty panel: a dusk gradient with a dashed "add a photo" frame.
    const empty = ctx.createLinearGradient(inner.x, inner.y, inner.x + inner.w, inner.y + inner.h);
    empty.addColorStop(0, '#3b2350');
    empty.addColorStop(1, '#1c1030');
    ctx.fillStyle = empty;
    ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.45)';
    ctx.lineWidth = 2;
    ctx.setLineDash([10, 8]);
    ctx.strokeRect(inner.x + 12, inner.y + 12, inner.w - 24, inner.h - 24);
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = Math.max(14, inner.w * 0.05) + 'px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('+ add a photo', inner.x + inner.w / 2, inner.y + inner.h / 2);
  }
  // Grade wash over the photo.
  const wash = ctx.createLinearGradient(inner.x, inner.y, inner.x + inner.w, inner.y + inner.h);
  wash.addColorStop(0, grade.wash[0]);
  wash.addColorStop(1, grade.wash[1]);
  ctx.globalAlpha = grade.washAlpha;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = wash;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;
  // A soft tint to pull the panel toward the grade.
  ctx.globalAlpha = grade.tintAlpha;
  ctx.fillStyle = grade.tint;
  ctx.fillRect(inner.x, inner.y, inner.w, inner.h);
  ctx.globalAlpha = 1;
  if (!polaroid) {
    ctx.strokeStyle = 'rgba(255,255,255,0.92)';
    ctx.lineWidth = Math.max(2, rect.w * 0.004);
    ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
  }
  ctx.restore();
}

/** The title block: slanted band, big Anton title, Pacifico script, tagline. */
function drawTitleBlock(ctx, band, grade, state, W) {
  const { x, y, w, h } = band;
  if (!state.bandOverlay) {
    const bandGrad = ctx.createLinearGradient(x, y, x + w, y + h);
    bandGrad.addColorStop(0, grade.band[0]);
    bandGrad.addColorStop(1, grade.band[1]);
    ctx.fillStyle = bandGrad;
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.28);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    ctx.fill();
    // Hot pink rule along the slant.
    ctx.strokeStyle = '#ff5e8a';
    ctx.lineWidth = Math.max(3, W * 0.004);
    ctx.beginPath();
    ctx.moveTo(x, y + h * 0.28);
    ctx.lineTo(x + w, y);
    ctx.stroke();
  } else {
    const fade = ctx.createLinearGradient(0, y, 0, y + h);
    fade.addColorStop(0, 'rgba(10,6,18,0)');
    fade.addColorStop(1, 'rgba(10,6,18,0.88)');
    ctx.fillStyle = fade;
    ctx.fillRect(x, y, w, h);
  }
  const pad = w * 0.045;
  const title = (state.title || 'VICE COAST').toUpperCase();
  const titleSize = fitTitleFont(ctx, title, w - pad * 2, h * 0.52);
  const titleY = y + h * 0.52;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(0,0,0,0.85)';
  ctx.lineWidth = Math.max(3, titleSize * 0.09);
  ctx.strokeText(title, pad, titleY);
  ctx.fillStyle = '#ffffff';
  ctx.fillText(title, pad, titleY);
  // Script subtitle tucked under the title's tail, shrunk to fit the band.
  const subText = state.subtitle || '';
  let subSize = Math.max(16, h * 0.19);
  ctx.font = subSize + 'px Pacifico, cursive';
  while (subSize > 14 && ctx.measureText(subText).width > w - pad * 2) {
    subSize -= 2;
    ctx.font = subSize + 'px Pacifico, cursive';
  }
  ctx.fillStyle = '#ff8fb0';
  ctx.shadowColor = '#ff2e88';
  ctx.shadowBlur = Math.max(6, subSize * 0.35);
  ctx.fillText(subText, pad + 4, y + h * 0.82);
  ctx.shadowBlur = 0;
  // Tagline in small tracked caps at the band's top right, clear of the title.
  if (state.tagline) {
    const tagSize = Math.max(11, h * 0.1);
    ctx.font = '700 ' + tagSize + 'px sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.textAlign = 'right';
    ctx.fillText(state.tagline, x + w - pad, y + h * 0.15);
    ctx.textAlign = 'left';
  }
}

/** Small corner ribbon: the studio's own mark, no game logos. */
function drawBadgeRibbon(ctx, W, H) {
  const label = 'PALMLINE · EST. 2026';
  const size = Math.max(13, W * 0.014);
  ctx.save();
  ctx.font = '700 ' + size + 'px sans-serif';
  const tw = ctx.measureText(label).width;
  const bw = tw + size * 1.6;
  const bh = size * 2.1;
  const pad = Math.max(10, W * 0.018);
  ctx.translate(W - bw / 2 - pad, bh / 2 + pad);
  ctx.rotate(0.0);
  ctx.fillStyle = '#ff5e8a';
  ctx.beginPath();
  ctx.moveTo(-bw / 2, -bh / 2);
  ctx.lineTo(bw / 2, -bh / 2);
  ctx.lineTo(bw / 2 - 8, bh / 2);
  ctx.lineTo(-bw / 2 + 8, bh / 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(label, 0, 1);
  ctx.restore();
}

/** Film grain: a seeded noise pattern stamped at low alpha. */
function drawGrain(ctx, W, H) {
  const tile = 140;
  const noise = document.createElement('canvas');
  noise.width = tile;
  noise.height = tile;
  const nctx = noise.getContext('2d');
  const img = nctx.createImageData(tile, tile);
  const rand = mulberry32(20261120);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    img.data[i] = v;
    img.data[i + 1] = v;
    img.data[i + 2] = v;
    img.data[i + 3] = 255;
  }
  nctx.putImageData(img, 0, 0);
  const pattern = ctx.createPattern(noise, 'repeat');
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.fillStyle = pattern;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/** Soft dark corners so the poster feels printed. */
function drawVignette(ctx, W, H) {
  const v = ctx.createRadialGradient(
    W / 2, H / 2, Math.min(W, H) * 0.42,
    W / 2, H / 2, Math.max(W, H) * 0.75,
  );
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(1, 'rgba(0,0,0,0.38)');
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, W, H);
}

/** Draw the whole cover onto ctx at W x H from the editor state. */
function drawCover(ctx, W, H, state) {
  const layout = coverLayouts[state.layout] || coverLayouts['hero-split'];
  const grade = coverGrades[state.grade] || coverGrades['vice-sunset'];
  const plan = layout(W, H);
  ctx.clearRect(0, 0, W, H);
  drawSunsetBackdrop(ctx, W, H, grade);
  plan.panels.forEach((rect, i) => {
    const crop = photoStore.cropFor(i);
    const photo = crop.photoId ? photoStore.byId(crop.photoId) : null;
    drawPhotoPanel(ctx, rect, photo, crop, grade, !!plan.polaroid);
    if (state.highlightSelection && i === state.selectedPanel) {
      ctx.save();
      ctx.strokeStyle = '#2ee6c8';
      ctx.lineWidth = Math.max(4, W * 0.006);
      ctx.setLineDash([14, 8]);
      ctx.strokeRect(rect.x - 3, rect.y - 3, rect.w + 6, rect.h + 6);
      ctx.restore();
    }
  });
  if (plan.band) {
    drawTitleBlock(ctx, plan.band, grade, { ...state, bandOverlay: !!plan.bandOverlay }, W);
  }
  drawBadgeRibbon(ctx, W, H);
  drawGrain(ctx, W, H);
  drawVignette(ctx, W, H);
}

/** Render the cover to a fresh canvas at the export size. */
function renderCoverToCanvas(width, height, state) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, width, height, { ...state, highlightSelection: false });
  return canvas;
}
