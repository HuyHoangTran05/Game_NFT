export class Tools {
    static randomNumber(min, max) {
        if (!max) {
            max = min;
            min = 0;
        }
        return Math.floor(Math.random() * (max - min + 1) + min);
    }

    static massiveRequire(modules) {
        const files = [];

        for (const key in modules) {
            // modules[key] is either the URL (if eager), or a function that returns a Promise
            const data = modules[key]; // if eager: the module
            files.push({
                key,
                data
            });
        }

        return files;
    }
}
