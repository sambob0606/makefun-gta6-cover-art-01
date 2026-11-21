/* Palmline photo store: keeps the loaded photos and each panel's crop.
   Photos are read on this machine only (FileReader / local sample files);
   nothing is ever uploaded anywhere. */

'use strict';

const photoStore = {
  /** Loaded photos: { id, name, image, width, height } in load order. */
  photos: [],
  nextId: 1,

  /** Per-panel crop: panelIndex -> { photoId, zoom, panX, panY }. */
  panelCrops: {},

  /** The photo currently picked in the tray (for "fill all" and assignment). */
  pickedId: null,

  addPhoto(name, image) {
    const photo = {
      id: this.nextId++,
      name: name || ('Photo ' + (this.photos.length + 1)),
      image,
      width: image.naturalWidth || image.width,
      height: image.naturalHeight || image.height,
    };
    this.photos.push(photo);
    return photo;
  },

  byId(id) {
    return this.photos.find((p) => p.id === id) || null;
  },

  /** Load a photo from a File object (device upload). */
  loadFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read ' + file.name));
      reader.onload = () => {
        const image = new Image();
        image.onload = () => resolve(this.addPhoto(file.name, image));
        image.onerror = () => reject(new Error('Not an image: ' + file.name));
        image.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  },

  /** Load one of the bundled sample photos (a local file under app/). */
  loadSample(url, name) {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(this.addPhoto(name, image));
      image.onerror = () => reject(new Error('Sample failed to load: ' + url));
      image.src = url;
    });
  },

  cropFor(panelIndex) {
    if (!this.panelCrops[panelIndex]) {
      this.panelCrops[panelIndex] = { photoId: null, zoom: 1.2, panX: 0, panY: 0 };
    }
    return this.panelCrops[panelIndex];
  },

  assignPhoto(panelIndex, photoId) {
    const crop = this.cropFor(panelIndex);
    crop.photoId = photoId;
    this.pickedId = photoId;
  },

  /** Put the same photo in every panel of the given layout. */
  fillAllPanels(panelCount, photoId) {
    for (let i = 0; i < panelCount; i++) {
      this.assignPhoto(i, photoId);
    }
  },

  /** Draw one photo into a rectangle with a cover fit, honouring zoom/pan.
      zoom 1 means the photo just covers the box; pan is a fraction of the box. */
  drawCoverFit(ctx, photo, box, crop) {
    if (!photo || !photo.image) return false;
    const iw = photo.width;
    const ih = photo.height;
    if (!iw || !ih) return false;
    const bw = box.w;
    const bh = box.h;
    const zoom = crop ? crop.zoom : 1.2;
    const panX = crop ? crop.panX : 0;
    const panY = crop ? crop.panY : 0;
    const scale = Math.max(bw / iw, bh / ih) * zoom;
    const dw = iw * scale;
    const dh = ih * scale;
    // Pan shifts the photo inside the box; clamp so no gap ever shows.
    const maxDx = Math.max(0, (dw - bw) / 2);
    const maxDy = Math.max(0, (dh - bh) / 2);
    const dx = box.x + (bw - dw) / 2 - panX * maxDx * 2;
    const dy = box.y + (bh - dh) / 2 - panY * maxDy * 2;
    ctx.save();
    ctx.beginPath();
    ctx.rect(box.x, box.y, bw, bh);
    ctx.clip();
    ctx.drawImage(photo.image, dx, dy, dw, dh);
    ctx.restore();
    return true;
  },
};
