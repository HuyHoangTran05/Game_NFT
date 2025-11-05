import * as PIXI from "pixi.js";
import { App } from "../system/App";
import { Board } from "./Board";
import { CombinationManager } from "./CombinationManager";

export class Game {
    constructor(socket, roomId) {
        this.socket = socket;
        this.roomId = roomId;
        this.container = new PIXI.Container();
        this.score = 0;
        this.timeLeft = 20; // game duration in seconds
        this.createBackground();
        this.createScoreDisplay();
        this.createTimerDisplay();
        this.createOpponentScoreDisplay();
        this.startTimer();

        this.board = new Board();
        this.container.addChild(this.board.container);

        this.board.container.on('tile-touch-start', this.onTileClick.bind(this));

        this.combinationManager = new CombinationManager(this.board);
        this.removeStartMatches();

        // Listen for opponent live score updates
        this.opponentScore = 0;
        this.onOpponentScoreUpdate = (payload) => {
            if (payload && typeof payload.score === 'number') {
                this.opponentScore = payload.score;
                this.updateOpponentScoreDisplay();
            }
        };
        this.socket.on('opponent_score_update', this.onOpponentScoreUpdate);
    }

    createBackground() {
        this.bg = App.sprite("bg");
        this.bg.width = window.innerWidth;
        this.bg.height = window.innerHeight;
        this.container.addChild(this.bg);
    }

    createScoreDisplay() {
        this.scoreText = new PIXI.Text(`Score: ${this.score}`, {
            fontFamily: "Arial",
            fontSize: 36,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 4
        });
        this.scoreText.x = 20;
        this.scoreText.y = 20;
        this.container.addChild(this.scoreText);
    }

    createTimerDisplay() {
        this.timerText = new PIXI.Text(`Time: ${this.timeLeft}`, {
            fontFamily: "Arial",
            fontSize: 36,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 4
        });
        this.timerText.x = window.innerWidth - 150;
        this.timerText.y = 20;
        this.container.addChild(this.timerText);
    }

    createOpponentScoreDisplay() {
        this.opponentScoreText = new PIXI.Text(`Opponent: 0`, {
            fontFamily: "Arial",
            fontSize: 28,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 4
        });
        this.opponentScoreText.x = 20;
        this.opponentScoreText.y = 60;
        this.container.addChild(this.opponentScoreText);
    }

    startTimer() {
        this.timerInterval = setInterval(() => {
            this.timeLeft -= 1;
            this.timerText.text = `Time: ${this.timeLeft}`;
            if (this.timeLeft <= 0) {
                clearInterval(this.timerInterval);
                this.endGame();
            }
        }, 1000);
    }

    endGame() {
        this.disabled = true;
        this.socket.emit('submit_score', {
            roomId: this.roomId,
            score: this.score
        });
        this.showWaitingMessage();
    }

    showWaitingMessage() {
        this.waitingText = new PIXI.Text("Waiting for opponent's score...", {
            fontFamily: "Arial",
            fontSize: 48,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 4
        });
        this.waitingText.anchor.set(0.5);
        this.waitingText.x = window.innerWidth / 2;
        this.waitingText.y = window.innerHeight / 2;
        this.container.addChild(this.waitingText);
    }

    restart() {
        this.score = 0;
        this.updateScoreDisplay();
        this.timeLeft = 20; // reset duration
        this.timerText.text = `Time: ${this.timeLeft}`;
        clearInterval(this.timerInterval);
        this.startTimer();

        // Reset opponent score display
        this.opponentScore = 0;
        this.updateOpponentScoreDisplay();
        // Send initial score update so opponent sees 0
        this.socket.emit('score_update', { roomId: this.roomId, score: this.score });

        if (typeof this.board.reset === "function") {
            this.board.reset();
        } else {
            this.board.fields.forEach(field => {
                if (field.tile) {
                    field.tile.remove();
                    field.tile = null;
                }
            });
            this.board.fields.forEach(field => {
                this.board.createTile(field);
            });
        }
        this.removeStartMatches();

        if (this.waitingText) {
            this.container.removeChild(this.waitingText);
            this.waitingText = null;
        }

        if (this.resultText) {
            this.container.removeChild(this.resultText);
            this.resultText = null;
        }

        if (this.rematchButton) {
            this.container.removeChild(this.rematchButton);
            this.rematchButton = null;
        }

        this.clearSelection();
        this.disabled = false;
    }

    removeStartMatches() {
        let matches = this.combinationManager.getMatches();

        while (matches.length) {
            this.removeMatches(matches, false);

            const fields = this.board.fields.filter(field => field.tile === null);

            fields.forEach(field => {
                this.board.createTile(field);
            });

            matches = this.combinationManager.getMatches();
        }
    }

    updateScoreDisplay() {
        this.scoreText.text = `Score: ${this.score}`;
        // Emit live score update to opponent
        if (this.socket && this.roomId) {
            this.socket.emit('score_update', { roomId: this.roomId, score: this.score });
        }
    }

    updateOpponentScoreDisplay() {
        if (this.opponentScoreText) {
            this.opponentScoreText.text = `Opponent: ${this.opponentScore}`;
        }
    }

    onTileClick(tile) {
        if (this.disabled) {
            return;
        }
        if (this.selectedTile) {
            if (!this.selectedTile.isNeighbour(tile)) {
                this.clearSelection();
                this.selectTile(tile);
            } else {
                this.swap(this.selectedTile, tile);
            }
        } else {
            this.selectTile(tile);
        }
    }

    swap(selectedTile, tile, reverse) {
        this.disabled = true;
        selectedTile.sprite.zIndex = 2;

        selectedTile.moveTo(tile.field.position, 0.2);

        this.clearSelection();

        tile.moveTo(selectedTile.field.position, 0.2).then(() => {
            this.board.swap(selectedTile, tile);

            if (!reverse) {
                const matches = this.combinationManager.getMatches();
                if (matches.length) {
                    this.processMatches(matches);
                } else {
                    this.swap(tile, selectedTile, true);
                }
            } else {
                this.disabled = false;
            }
        });
    }

    removeMatches(matches, awardPoints = true) {
        matches.forEach(match => {
            if (awardPoints) {
                this.score += 10;
            }
            match.forEach(tile => {
                tile.remove();
            });
        });
        if (awardPoints) {
            this.updateScoreDisplay();
        }
    }

    processMatches(matches) {
        this.removeMatches(matches);
        this.processFallDown()
            .then(() => this.addTiles())
            .then(() => this.onFallDownOver());
    }

    onFallDownOver() {
        const matches = this.combinationManager.getMatches();

        if (matches.length) {
            this.processMatches(matches);
        } else {
            this.disabled = false;
        }
    }

    addTiles() {
        return new Promise(resolve => {
            const fields = this.board.fields.filter(field => field.tile === null);
            let total = fields.length;
            let completed = 0;

            fields.forEach(field => {
                const tile = this.board.createTile(field);
                tile.sprite.y = -500;
                const delay = Math.random() * 2 / 10 + 0.3 / (field.row + 1);
                tile.fallDownTo(field.position, delay).then(() => {
                    ++completed;
                    if (completed >= total) {
                        resolve();
                    }
                });
            });
        });
    }

    processFallDown() {
        return new Promise(resolve => {
            let completed = 0;
            let started = 0;

            for (let row = this.board.rows - 1; row >= 0; row--) {
                for (let col = this.board.cols - 1; col >= 0; col--) {
                    const field = this.board.getField(row, col);

                    if (!field.tile) {
                        ++started;
                        this.fallDownTo(field).then(() => {
                            ++completed;
                            if (completed >= started) {
                                resolve();
                            }
                        });
                    }
                }
            }
        });
    }

    fallDownTo(emptyField) {
        for (let row = emptyField.row - 1; row >= 0; row--) {
            let fallingField = this.board.getField(row, emptyField.col);

            if (fallingField.tile) {
                const fallingTile = fallingField.tile;
                fallingTile.field = emptyField;
                emptyField.tile = fallingTile;
                fallingField.tile = null;
                return fallingTile.fallDownTo(emptyField.position);
            }
        }

        return Promise.resolve();
    }

    clearSelection() {
        if (this.selectedTile && this.selectedTile.field) {
            this.selectedTile.field.unselect();
            this.selectedTile = null;
        } else {
            this.selectedTile = null;
        }
    }

    selectTile(tile) {
        this.selectedTile = tile;
        this.selectedTile.field.select();
    }

    destroy() {
        try {
            if (this.timerInterval) clearInterval(this.timerInterval);
            if (this.socket && this.onOpponentScoreUpdate) {
                this.socket.off('opponent_score_update', this.onOpponentScoreUpdate);
                this.onOpponentScoreUpdate = null;
            }
        } catch (e) {
            // no-op
        }
    }
}