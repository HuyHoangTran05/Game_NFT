import * as PIXI from "pixi.js";

export class JoinRoomUI {
    constructor() {
        this.container = new PIXI.Container();
        
        // Add background
        const background = new PIXI.Graphics();
        background.beginFill(0x333333);
        background.drawRect(0, 0, window.innerWidth, window.innerHeight);
        background.endFill();
        this.container.addChild(background);

        // Add placeholder text
        this.placeholderText = new PIXI.Text("Enter Room ID", {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        this.placeholderText.anchor.set(0.5);
        this.placeholderText.position.set(window.innerWidth / 2, window.innerHeight / 2 - 50);
        this.container.addChild(this.placeholderText);

        // Add placeholder background
        const placeholderBg = new PIXI.Graphics();
        placeholderBg.beginFill(0x555555);
        placeholderBg.drawRect(0, 0, 300, 50);
        placeholderBg.endFill();
        placeholderBg.position.set(
            window.innerWidth / 2 - 150,
            window.innerHeight / 2 - 75
        );
        this.container.addChild(placeholderBg);

        // Add Create Room button
        this.createButton = this.createButton(
            "Create Room",
            window.innerWidth / 2 - 160,
            window.innerHeight / 2 + 20
        );
        this.container.addChild(this.createButton);

        // Add Join Room button
        this.joinButton = this.createButton(
            "Join Room",
            window.innerWidth / 2 + 20,
            window.innerHeight / 2 + 20
        );
        this.container.addChild(this.joinButton);
    }

    createButton(label, x, y) {
        const button = new PIXI.Container();
        
        // Button background
        const bg = new PIXI.Graphics();
        bg.beginFill(0x007bff);
        bg.drawRect(0, 0, 140, 50);
        bg.endFill();
        button.addChild(bg);

        // Button text
        const text = new PIXI.Text(label, {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        text.anchor.set(0.5);
        text.position.set(70, 25);
        button.addChild(text);

        button.position.set(x, y);
        button.interactive = true;
        button.buttonMode = true;

        return button;
    }
} 