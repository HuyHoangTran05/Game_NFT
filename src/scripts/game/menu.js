import * as PIXI from "pixi.js";
import { Game } from "./Game";
import { App } from "../system/App";
import { RoomUI } from "./multiplayer";

export class MenuScene {
  constructor() {
    this.container = new PIXI.Container();
    this.layers = [];
    this.tickerFunction = null;  // Store ticker function reference

    // Load background images and UI
    const loader = new PIXI.Loader();
    loader
      .add("1", "src/menu/1.png")
      .add("2", "src/menu/2.png")
      .add("3", "src/menu/3.png")
      .add("4", "src/menu/4.png")
      .add("5", "src/menu/5.png")
      .add("title", "src/menu/title.png")
      .add("play", "src/menu/play.png")
      .load((_, resources) => {
        const keys = ["1", "2", "3", "4", "5"];

        keys.forEach((key, index) => {
          const texture = resources[key].texture;
          const scaleX = window.innerWidth / texture.width;
          const scaleY = window.innerHeight / texture.height;
          const scale = Math.max(scaleX, scaleY);
          const S_scaled = texture.width * scale;

          const numTiles = Math.ceil(window.innerWidth / S_scaled) + 1;
          const layerSprites = [];

          for (let i = 0; i < numTiles; i++) {
            const tileSprite = new PIXI.Sprite(texture);
            tileSprite.scale.set(scale);
            tileSprite.x = i * S_scaled;
            tileSprite.y = 0;
            tileSprite.alpha = 1 - index * 0.1;
            this.container.addChild(tileSprite);
            layerSprites.push(tileSprite);
          }

          this.layers.push({ sprites: layerSprites, S_scaled });
        });

        // Add the title image at the top center
        const titleSprite = new PIXI.Sprite(resources["title"].texture);
        titleSprite.anchor.set(0.5, 0);
        titleSprite.x = window.innerWidth / 2;
        titleSprite.y = 20;
        this.container.addChild(titleSprite);

        // Start the parallax background animation
        this.tickerFunction = () => this.updateImages();
        App.app.ticker.add(this.tickerFunction);

        // Show play button
        this.showPlayButton(resources);
      });
  }

  updateImages() {
    this.layers.forEach((layer, index) => {
      const speed = 0.2 + index * 0.1;

      layer.sprites.forEach(sprite => {
        sprite.x -= speed;
      });

      if (layer.sprites[0].x <= -layer.S_scaled) {
        const firstSprite = layer.sprites.shift();
        const lastSprite = layer.sprites[layer.sprites.length - 1];
        firstSprite.x = lastSprite.x + layer.S_scaled;
        layer.sprites.push(firstSprite);
      }
    });
  }

  showPlayButton(resources) {
    const playSprite = new PIXI.Sprite(resources["play"].texture);
    playSprite.anchor.set(0.5);
  
    // Position horizontally centered
    playSprite.x = window.innerWidth / 2;
  
    // Get the title sprite to calculate Y offset
    const titleSprite = this.container.children.find(
      child => child.texture && child.texture.baseTexture.resource.url.includes("title.png")
    );
  
    // Position vertically below the title
    if (titleSprite) {
      playSprite.y = titleSprite.y + titleSprite.height + 20; // 20px below title
    } else {
      playSprite.y = 160; // Fallback position
    }
  
    playSprite.interactive = true;
    playSprite.buttonMode = true;
    playSprite.on("pointerdown", () => this.showRoomUI());
  
    this.container.addChild(playSprite);
  }

  showRoomUI() {
    // Remove the ticker update function
    if (this.tickerFunction) {
      App.app.ticker.remove(this.tickerFunction);
      this.tickerFunction = null;
    }
    
    // Remove all children and event listeners
    this.container.removeChildren();
    this.container.destroy({ children: true });
    
    // Remove the menu scene from stage
    App.app.stage.removeChild(this.container);
    
    // Create and show the room UI
    const roomUI = new RoomUI();
    App.app.stage.addChild(roomUI.container);
  }
}