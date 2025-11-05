import path from 'path';
import { fileURLToPath } from 'url';
import AvatarGenerator from './avatarGenerator.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function generateAvatar() {
  const imagesPath = path.join(__dirname, './images'); // resolve ./images relative to generate.js
  const generator = new AvatarGenerator(imagesPath);
  await generator.generateAvatars(1);
}

export default generateAvatar;
