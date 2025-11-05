// avatarGenerator.js
import fs from 'fs';
import path from 'path';
import { createCanvas, loadImage } from 'canvas';
import Layer from './layer.js';

class AvatarGenerator {
  constructor(imagesPath, outputPath = './output') {
    this.imagesPath = imagesPath;
    this.outputPath = outputPath;
    this.backgroundColor = '#7896b4';
    this.rareBackgroundColor = '#ffe196';
    this.rareBackgroundChance = 0.05;
    this.layers = this.loadImageLayers();

    if (!fs.existsSync(this.outputPath)) {
      fs.mkdirSync(this.outputPath, { recursive: true });
    }
  }

  loadImageLayers() {
    const subDirs = fs.readdirSync(this.imagesPath).sort();
    const layers = subDirs.map((dir) => new Layer(path.join(this.imagesPath, dir)));

    if (layers[2]) layers[2].rarity = 0.8;
    if (layers[3]) layers[3].rarity = 0.15;

    return layers;
  }

  selectLayerImages() {
    return this.layers
      .filter((layer) => layer.shouldGenerate())
      .map((layer) => layer.getRandomImagePath());
  }

  getBackgroundColor() {
    return Math.random() < this.rareBackgroundChance ? this.rareBackgroundColor : this.backgroundColor;
  }

  async renderImage(imagePaths) {
    const canvas = createCanvas(24, 24);
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = this.getBackgroundColor();
    ctx.fillRect(0, 0, 24, 24);

    for (const imagePath of imagePaths) {
      const img = await loadImage(imagePath);
      ctx.drawImage(img, 0, 0, 24, 24);
    }

    return canvas;
  }

  async saveImage(canvas, index) {
    const buffer = canvas.toBuffer('image/png');
    const filename = `avatar_${String(index).padStart(4, '0')}.png`;
    fs.writeFileSync(path.join(this.outputPath, filename), buffer);
  }

  async generateAvatars(count = 1) {
    console.log('AvatarGenerator: Generating avatars...');
    for (let i = 0; i < count; i++) {
      const imagePaths = this.selectLayerImages();
      const canvas = await this.renderImage(imagePaths);
      await this.saveImage(canvas, i);
    }
  }
}

export default AvatarGenerator;
