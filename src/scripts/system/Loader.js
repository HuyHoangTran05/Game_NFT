export class Loader {
    constructor(loader, config) {
        this.loader = loader;
        this.config = config;
        this.resources = {};
    }

    preload() {
        for (const asset of this.config.loader) {
            // Extract filename (without extension) to use as key
            let key = asset.key.substring(asset.key.lastIndexOf('/') + 1);
            key = key.substring(0, key.lastIndexOf('.'));

            // Only load images (PIXI.Loader is mainly for textures)
            const ext = asset.key.toLowerCase();
            if (ext.endsWith('.png') || ext.endsWith('.jpg') || ext.endsWith('.jpeg')) {
                this.loader.add(key, asset.data.default); // Vite eager module exports default URL
            }
        }

        return new Promise(resolve => {
            this.loader.load((loader, resources) => {
                this.resources = resources;
                resolve();
            });
        });
    }
}
