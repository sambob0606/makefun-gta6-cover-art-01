/* Palmline editor: wires the controls, the live preview, panel picking,
   drag-to-pan, export, and the ?shot= screenshot modes. */

'use strict';

const editorState = {
  layout: 'hero-split',
  grade: 'vice-sunset',
  size: 'square',
  title: 'VICE COAST',
  subtitle: 'chasing the sunset',
  tagline: 'A PALMLINE ORIGINAL · SUMMER 2026',
  selectedPanel: 0,
  highlightSelection: true,
};

const EXPORT_SIZES = {
  square: { w: 1080, h: 1080, label: 'Square · 1080 × 1080' },
  portrait: { w: 1080, h: 1350, label: 'Portrait · 1080 × 1350' },
  wide: { w: 1920, h: 1080, label: 'Wide · 1920 × 1080' },
};

const PREVIEW_LONG = 900;

const canvas = document.getElementById('coverCanvas');
const sizeLabel = document.getElementById('sizeLabel');
const tray = document.getElementById('photoTray');
const selectedPanelLabel = document.getElementById('selectedPanelLabel');
const zoomSlider = document.getElementById('panelZoom');
const zoomValue = document.getElementById('zoomValue');
const panXSlider = document.getElementById('panelPanX');
const panYSlider = document.getElementById('panelPanY');

/** Preview canvas resolution for the chosen export size. */
function previewSize() {
  const s = EXPORT_SIZES[editorState.size];
  const scale = PREVIEW_LONG / Math.max(s.w, s.h);
  return { w: Math.round(s.w * scale), h: Math.round(s.h * scale) };
}

/** Draw the live preview from the current state. */
function renderPreview() {
  if (document.body.classList.contains('shot-cover')) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    const ctx = canvas.getContext('2d');
    drawCover(ctx, canvas.width, canvas.height, { ...editorState, highlightSelection: false });
    return;
  }
  const { w, h } = previewSize();
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  drawCover(ctx, w, h, editorState);
  sizeLabel.textContent = EXPORT_SIZES[editorState.size].label;
}

/** The panel rectangles of the live preview, in canvas pixels. */
function previewPanels() {
  const layout = coverLayouts[editorState.layout] || coverLayouts['hero-split'];
  return layout(canvas.width, canvas.height).panels;
}

/** Hit-test a canvas point against the panels, undoing each tilt. */
function panelAtPoint(px, py) {
  const panels = previewPanels();
  for (let i = panels.length - 1; i >= 0; i--) {
    const r = panels[i];
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const cos = Math.cos(-(r.tilt || 0));
    const sin = Math.sin(-(r.tilt || 0));
    const dx = px - cx;
    const dy = py - cy;
    const lx = dx * cos - dy * sin;
    const ly = dx * sin + dy * cos;
    if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
  }
  return -1;
}

function selectPanel(index) {
  editorState.selectedPanel = index;
  const crop = photoStore.cropFor(index);
  zoomSlider.value = crop.zoom;
  zoomValue.textContent = crop.zoom.toFixed(2) + '×';
  panXSlider.value = crop.panX;
  panYSlider.value = crop.panY;
  const photo = crop.photoId ? photoStore.byId(crop.photoId) : null;
  selectedPanelLabel.textContent = 'Panel ' + (index + 1) +
    (photo ? ' — ' + photo.name : ' — empty, pick a photo below.');
  renderPreview();
}

/** Rebuild the photo tray thumbnails. */
function refreshTray() {
  tray.innerHTML = '';
  photoStore.photos.forEach((photo) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'trayThumb';
    btn.title = photo.name + ' — click to put in the selected panel';
    const img = document.createElement('img');
    img.src = photo.image.src;
    img.alt = photo.name;
    btn.appendChild(img);
    btn.addEventListener('click', () => {
      photoStore.assignPhoto(editorState.selectedPanel, photo.id);
      refreshTray();
      selectPanel(editorState.selectedPanel);
    });
    tray.appendChild(btn);
  });
  const assigned = new Set(
    Object.values(photoStore.panelCrops).map((c) => c.photoId),
  );
  Array.from(tray.children).forEach((btn, i) => {
    if (assigned.has(photoStore.photos[i].id)) btn.classList.add('is-assigned');
  });
}

/** Load the three bundled samples and spread them across the panels. */
async function loadDefaultSamples() {
  const samples = [
    ['samples/surfer.jpg', 'Surfer at sunset'],
    ['samples/gasstation.jpg', 'Gas station at dusk'],
    ['samples/skater.jpg', 'Skater at golden hour'],
  ];
  for (const [url, name] of samples) {
    try {
      await photoStore.loadSample(url, name);
    } catch (err) {
      console.warn(err.message);
    }
  }
  const ids = photoStore.photos.map((p) => p.id);
  if (ids.length) {
    photoStore.assignPhoto(0, ids[0]);
    photoStore.assignPhoto(1, ids[1 % ids.length]);
    photoStore.assignPhoto(2, ids[2 % ids.length]);
    photoStore.assignPhoto(3, ids[0]);
  }
  refreshTray();
}

/** Export the cover at the full post size as a PNG download. */
function exportCover() {
  const s = EXPORT_SIZES[editorState.size];
  const out = renderCoverToCanvas(s.w, s.h, editorState);
  out.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'palmline-cover-' + editorState.size + '-' + s.w + 'x' + s.h + '.png';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

/** Pick a random layout + grade for a fresh look. */
function shuffleLook() {
  const layouts = Object.keys(coverLayouts);
  const grades = Object.keys(coverGrades);
  editorState.layout = layouts[Math.floor(Math.random() * layouts.length)];
  editorState.grade = grades[Math.floor(Math.random() * grades.length)];
  syncChoiceButtons();
  renderPreview();
}

/** Keep the choice buttons in step with the state. */
function syncChoiceButtons() {
  document.querySelectorAll('#layoutRow .choiceBtn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.layout === editorState.layout);
  });
  document.querySelectorAll('#gradeRow .choiceBtn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.grade === editorState.grade);
  });
  document.querySelectorAll('#sizeRow .choiceBtn').forEach((b) => {
    b.classList.toggle('is-active', b.dataset.size === editorState.size);
  });
}

function wireControls() {
  document.getElementById('photoInput').addEventListener('change', async (e) => {
    const files = Array.from(e.target.files || []);
    for (const file of files) {
      try {
        await photoStore.loadFromFile(file);
      } catch (err) {
        console.warn(err.message);
      }
    }
    refreshTray();
    renderPreview();
    e.target.value = '';
  });

  document.querySelectorAll('.sampleThumb').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const url = btn.dataset.sample;
      const name = btn.title.replace('Sample: ', '');
      let photo = photoStore.photos.find((p) => p.image.src.endsWith(url));
      if (!photo) {
        try {
          photo = await photoStore.loadSample(url, name);
        } catch (err) {
          console.warn(err.message);
          return;
        }
        refreshTray();
      }
      photoStore.assignPhoto(editorState.selectedPanel, photo.id);
      refreshTray();
      selectPanel(editorState.selectedPanel);
    });
  });

  document.querySelectorAll('#layoutRow .choiceBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorState.layout = btn.dataset.layout;
      syncChoiceButtons();
      renderPreview();
    });
  });

  document.querySelectorAll('#gradeRow .choiceBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorState.grade = btn.dataset.grade;
      syncChoiceButtons();
      renderPreview();
    });
  });

  document.querySelectorAll('#sizeRow .choiceBtn').forEach((btn) => {
    btn.addEventListener('click', () => {
      editorState.size = btn.dataset.size;
      syncChoiceButtons();
      renderPreview();
    });
  });

  document.getElementById('titleInput').addEventListener('input', (e) => {
    editorState.title = e.target.value;
    renderPreview();
  });
  document.getElementById('subtitleInput').addEventListener('input', (e) => {
    editorState.subtitle = e.target.value;
    renderPreview();
  });
  document.getElementById('taglineInput').addEventListener('input', (e) => {
    editorState.tagline = e.target.value;
    renderPreview();
  });

  zoomSlider.addEventListener('input', () => {
    const crop = photoStore.cropFor(editorState.selectedPanel);
    crop.zoom = parseFloat(zoomSlider.value);
    zoomValue.textContent = crop.zoom.toFixed(2) + '×';
    renderPreview();
  });
  panXSlider.addEventListener('input', () => {
    photoStore.cropFor(editorState.selectedPanel).panX = parseFloat(panXSlider.value);
    renderPreview();
  });
  panYSlider.addEventListener('input', () => {
    photoStore.cropFor(editorState.selectedPanel).panY = parseFloat(panYSlider.value);
    renderPreview();
  });

  document.getElementById('fillAllBtn').addEventListener('click', () => {
    const crop = photoStore.cropFor(editorState.selectedPanel);
    const photoId = crop.photoId || (photoStore.photos[0] && photoStore.photos[0].id);
    if (!photoId) return;
    photoStore.fillAllPanels(previewPanels().length, photoId);
    refreshTray();
    renderPreview();
  });

  document.getElementById('exportBtn').addEventListener('click', exportCover);
  document.getElementById('shuffleBtn').addEventListener('click', shuffleLook);

  // In a full-screen cover shot, keep the drawing fitted to the window.
  window.addEventListener('resize', () => {
    if (document.body.classList.contains('shot-cover')) renderPreview();
  });

  // Drag a panel's photo to reposition it; scroll to zoom it.
  let drag = null;
  canvas.addEventListener('pointerdown', (e) => {
    const rect = canvas.getBoundingClientRect();
    const px = (e.clientX - rect.left) * (canvas.width / rect.width);
    const py = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = panelAtPoint(px, py);
    if (hit < 0) return;
    selectPanel(hit);
    drag = { x: e.clientX, y: e.clientY, panel: hit };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const rect = canvas.getBoundingClientRect();
    const panels = previewPanels();
    const panel = panels[drag.panel];
    const crop = photoStore.cropFor(drag.panel);
    const photo = crop.photoId ? photoStore.byId(crop.photoId) : null;
    if (!photo) return;
    const scale = Math.max(panel.w / photo.width, panel.h / photo.height) * crop.zoom;
    const maxDx = Math.max(0, (photo.width * scale - panel.w) / 2);
    const maxDy = Math.max(0, (photo.height * scale - panel.h) / 2);
    const dxPx = (e.clientX - drag.x) * (canvas.width / rect.width);
    const dyPx = (e.clientY - drag.y) * (canvas.height / rect.height);
    if (maxDx > 0) crop.panX = Math.max(-0.5, Math.min(0.5, crop.panX - dxPx / (2 * maxDx)));
    if (maxDy > 0) crop.panY = Math.max(-0.5, Math.min(0.5, crop.panY - dyPx / (2 * maxDy)));
    drag.x = e.clientX;
    drag.y = e.clientY;
    panXSlider.value = crop.panX;
    panYSlider.value = crop.panY;
    renderPreview();
  });
  canvas.addEventListener('pointerup', () => { drag = null; });
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    const crop = photoStore.cropFor(editorState.selectedPanel);
    crop.zoom = Math.max(1, Math.min(2.5, crop.zoom * (1 - e.deltaY * 0.001)));
    zoomSlider.value = crop.zoom;
    zoomValue.textContent = crop.zoom.toFixed(2) + '×';
    renderPreview();
  }, { passive: false });
}

/** Screenshot modes: ?shot=cover&size=wide renders one cover full-screen;
    ?shot=editor shows the editor with the samples loaded. */
function applyShotMode() {
  const params = new URLSearchParams(window.location.search);
  const shot = params.get('shot');
  const size = params.get('size');
  if (shot === 'cover') {
    document.body.classList.add('shot-cover');
    if (size && EXPORT_SIZES[size]) {
      editorState.size = size;
      const layout = params.get('layout');
      if (layout && coverLayouts[layout]) editorState.layout = layout;
      const grade = params.get('grade');
      if (grade && coverGrades[grade]) editorState.grade = grade;
    }
    editorState.highlightSelection = false;
  }
}

async function bootEditor() {
  applyShotMode();
  wireControls();
  syncChoiceButtons();
  try {
    await document.fonts.load('80px Anton');
    await document.fonts.load('40px Pacifico');
  } catch (err) {
    console.warn('Fonts took the fallback path: ' + err.message);
  }
  await loadDefaultSamples();
  selectPanel(0);
  renderPreview();
}

window.addEventListener('DOMContentLoaded', bootEditor);
