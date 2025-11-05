// layer.js
import fs from 'fs';
import path from 'path';

class Layer {
  constructor(layerPath) {
    this.path = layerPath;
    this.rarity = 1.0; // default rarity is 100%
  }

  shouldGenerate() {
    return Math.random() < this.rarity;
  }

  getRandomImagePath() {
    const files = fs.readdirSync(this.path);
    const selectedFile = files[Math.floor(Math.random() * files.length)];
    return path.join(this.path, selectedFile);
  }
}

export default Layer;
