import * as PIXI from "pixi.js";
import { Game } from "./Game";
import { App } from "../system/App";
import { io } from "socket.io-client";
import { mintPngAsNFT } from "./nft";
import { getHtxBalance, claimHtx, transferHtx, getEthBalance, mintHtxOwner } from "./htx";
import { parseEther } from "ethers";

// Small helper to copy text to clipboard with fallback
async function copyToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
        return true;
    } catch (_) {
        try {
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.position = 'fixed';
            ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            return true;
        } catch (e) {
            console.warn('Copy failed:', e);
            return false;
        }
    }
}

export class RoomUI {
    createButton(label, x, y, callback, width = 200, height = 56, color = 0x4C8BF5) {
        const button = new PIXI.Container();

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawRoundedRect(4, 6, width, height, 12);
        shadow.endFill();
        button.addChild(shadow);

        // Body
        const bg = new PIXI.Graphics();
        bg.beginFill(color);
        bg.drawRoundedRect(0, 0, width, height, 12);
        bg.endFill();
        button.addChild(bg);

        const text = new PIXI.Text(label, {
            fontFamily: "Arial",
            fontSize: 22,
            fill: 0xffffff,
            fontWeight: '700'
        });
        text.anchor.set(0.5);
        text.position.set(width / 2, height / 2);
        button.addChild(text);

        button.position.set(x, y);
        button.interactive = true;
        button.buttonMode = true;
        button.on('pointerover', () => button.scale.set(1.03));
        button.on('pointerout', () => button.scale.set(1));

        if (callback) button.on("pointerdown", callback);
        return button;
    }

    createInputField(placeholderText, x, y, width = 300) {
        const bg = new PIXI.Graphics();
        bg.beginFill(0x555555);
        bg.drawRect(0, 0, width, 50);
        bg.endFill();
        bg.position.set(x, y);

        const text = new PIXI.Text(placeholderText, {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        text.anchor.set(0.5);
        text.position.set(x + width / 2, y + 25);

        text.interactive = true;
        text.buttonMode = true;
        return { bg, text };
    }

    constructor() {
        if (window.roomUISocket) {
            console.warn("RoomUI already initialized, reusing existing socket.");
            this.socket = window.roomUISocket;
        } else {
            const cfg = window.gameConfig || {};
            const serverUrl = cfg.serverUrl || `${window.location.protocol}//${window.location.hostname}:3001`;
            this.socket = io(serverUrl, {
                transports: ["websocket", "polling"],
                reconnection: true,
                reconnectionAttempts: 10,
                reconnectionDelay: 1000
            });
            window.roomUISocket = this.socket;
        }

    this.container = new PIXI.Container();
        this.currentRoomId = null;
        this.activeInput = null;
        this.showWinnerImage = false; // Flag to control image display

        this.socket.on('connect', () => {
            console.log('Client connected with ID:', this.socket.id);
            if (this.waitingText) {
                this.waitingText.text = '';
                this.waitingText.visible = false;
            }
        });

        this.socket.on('connect_error', (err) => {
            console.error('Socket connect_error:', err);
            if (this.waitingText) {
                this.waitingText.text = 'Cannot reach game server (3001). Start server then retry.';
                this.waitingText.visible = true;
            }
        });

        this.socket.on('error', (err) => {
            console.error('Socket error:', err);
        });

        this.socket.on('room_created', (roomId) => {
            this.currentRoomId = roomId;
            this.createPlaceholderText.text = `Room ID: ${roomId}`;
            this.createPlaceholderText.style.fill = 0xffffff;
            this.waitingText.text = 'Waiting for another player...';
            this.waitingText.visible = true;
        });

        this.socket.on('room_joined', (roomId) => {
            this.currentRoomId = roomId;
            this.joinPlaceholderText.text = `Joined Room: ${roomId}`;
            this.joinPlaceholderText.style.fill = 0xffffff;
            this.waitingText.text = 'Waiting for another player...';
            this.waitingText.visible = true;
        });

        this.socket.on('error', (message) => {
            if (this.activeInput === 'create') {
                this.createPlaceholderText.text = message;
                this.createPlaceholderText.style.fill = 0xff0000;
            } else if (this.activeInput === 'join') {
                this.joinPlaceholderText.text = message;
                this.joinPlaceholderText.style.fill = 0xff0000;
            }
        });

        this.socket.on('game_start', () => {
            // Reset winner state at the start of every game
            this.winnerPngBase64 = null;
            this.showWinnerImage = false;
            this.winnerAddress = null;
            this.winnerPrize = 0;
            this.startGame();
        });

        this.socket.on('game_result', (result) => {
            console.log('Game Result:', result);
            if (App.currentGame && App.currentGame.waitingText) {
                App.currentGame.container.removeChild(App.currentGame.waitingText);
                App.currentGame.waitingText = null;
            }
            this.showResult(result);
        });
            this.socket.on('winner_info', (info) => {
                console.log('Winner info:', info);
                this.winnerAddress = info?.winnerAddress || null;
                this.winnerPrize = info?.prize || 0;
                // if current wallet is house, we can display payout button in showResult
            });

        this.socket.on('avatar_received', (message) => {
            console.log('Received signal to display winner avatar');
            this.showWinnerImage = true;
            this.winnerMessage = message;
        });

        this.socket.on('winner_avatar', ({ pngBase64 }) => {
            console.log('Received winner avatar PNG (base64)');
            this.showWinnerImage = true;
            this.winnerPngBase64 = pngBase64;
        });

        this.socket.on('opponent_disconnected', () => {
            this.joinPlaceholderText.text = 'Opponent disconnected';
            this.joinPlaceholderText.style.fill = 0xff0000;
            this.returnToRoomUI();
        });

        this.socket.on('rematch_requested', () => {
            if (App.currentGame && App.currentGame.waitingText) {
                App.currentGame.waitingText.text = "Opponent requested rematch! Click Rematch to continue.";
            }
        });

        this.socket.on('payout_done', () => {
            // Refresh balances on both sides after payout completes
            this.refreshHTXBalance().catch(()=>{});
        });

        // Background: use menu asset if available, otherwise solid color
        try {
            const bg = PIXI.Sprite.from(window.gameConfig?.assets?.sky1 || 'src/menu/1.png');
            bg.width = window.innerWidth; bg.height = window.innerHeight;
            this.container.addChild(bg);
        } catch (_) {
            const background = new PIXI.Graphics();
            background.beginFill(0x101826);
            background.drawRect(0, 0, window.innerWidth, window.innerHeight);
            background.endFill();
            this.container.addChild(background);
        }

        // Top bar
        const topBar = new PIXI.Graphics();
        topBar.beginFill(0x000000, 0.35);
        topBar.drawRect(0, 0, window.innerWidth, 60);
        topBar.endFill();
        this.container.addChild(topBar);

        const title = new PIXI.Text("Match-3 NFT Arena", { fontFamily: 'Arial', fontSize: 28, fill: 0xffffff, fontWeight: '700' });
        title.position.set(20, 16);
        this.container.addChild(title);

    // Center panel for Create/Join
    const panel = new PIXI.Graphics();
    panel.beginFill(0x000000, 0.25);
    panel.drawRoundedRect(0, 0, 680, 220, 16);
    panel.endFill();
    panel.position.set((window.innerWidth - 680) / 2, (window.innerHeight - 220) / 2 - 40);
    this.container.addChild(panel);

    const createPlaceholderBg = new PIXI.Graphics();
    createPlaceholderBg.beginFill(0x2B3A55, 0.8);
    createPlaceholderBg.drawRoundedRect(0, 0, 300, 50, 10);
    createPlaceholderBg.endFill();
    createPlaceholderBg.position.set(panel.position.x + 20, panel.position.y + 20);
    this.container.addChild(createPlaceholderBg);
    this.createBounds = { x: createPlaceholderBg.position.x, y: createPlaceholderBg.position.y, width: 300, height: 50 };

        this.createPlaceholderText = new PIXI.Text("Create Room ID", {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        this.createPlaceholderText.anchor.set(0.5);
    this.createPlaceholderText.position.set(createPlaceholderBg.position.x + 150, createPlaceholderBg.position.y + 25);
        this.container.addChild(this.createPlaceholderText);

        this.createPlaceholderText.interactive = true;
        this.createPlaceholderText.buttonMode = true;
        this.createPlaceholderText.on("pointerdown", () => {
            this.activeInput = 'create';
            this.createPlaceholderText.text = '';
            this.createPlaceholderText.style.fill = 0xffffff;
        });

    const joinPlaceholderBg = new PIXI.Graphics();
    joinPlaceholderBg.beginFill(0x2B3A55, 0.8);
    joinPlaceholderBg.drawRoundedRect(0, 0, 300, 50, 10);
    joinPlaceholderBg.endFill();
    joinPlaceholderBg.position.set(panel.position.x + 360, panel.position.y + 20);
        this.container.addChild(joinPlaceholderBg);
    this.joinBounds = { x: joinPlaceholderBg.position.x, y: joinPlaceholderBg.position.y, width: 300, height: 50 };

        this.joinPlaceholderText = new PIXI.Text("Enter Room ID", {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        this.joinPlaceholderText.anchor.set(0.5);
    this.joinPlaceholderText.position.set(joinPlaceholderBg.position.x + 150, joinPlaceholderBg.position.y + 25);
        this.container.addChild(this.joinPlaceholderText);

        this.joinPlaceholderText.interactive = true;
        this.joinPlaceholderText.buttonMode = true;
        this.joinPlaceholderText.on("pointerdown", () => {
            this.activeInput = 'join';
            this.joinPlaceholderText.text = '';
            this.joinPlaceholderText.style.fill = 0xffffff;
        });

        this.waitingText = new PIXI.Text('', {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        this.waitingText.anchor.set(0.5);
    this.waitingText.position.set(window.innerWidth / 2, panel.position.y + 180);
        this.waitingText.visible = false;
        this.container.addChild(this.waitingText);

        this.createRoomButton = this.createButton(
            "Create Room",
            panel.position.x + 120,
            panel.position.y + 90,
            () => this.onCreateRoom()
        );
        this.container.addChild(this.createRoomButton);

        this.joinRoomButton = this.createButton(
            "Join Room",
            panel.position.x + 360 + 120,
            panel.position.y + 90,
            () => this.onJoinRoom()
        );
        this.container.addChild(this.joinRoomButton);

            // HTX UI: balance + faucet button
            this.htxBalanceText = new PIXI.Text("HTX: -", {
                fontFamily: "Arial",
                fontSize: 20,
                fill: 0xffffff
            });
            this.htxBalanceText.anchor.set(1, 0);
            this.htxBalanceText.position.set(window.innerWidth - 20, 12);
            this.container.addChild(this.htxBalanceText);

        const networkPill = new PIXI.Text((window.gameConfig?.networkName || 'localhost').toUpperCase(), { fontFamily: 'Arial', fontSize: 14, fill: 0xdddddd });
        networkPill.position.set(window.innerWidth - 160, 20);
        this.container.addChild(networkPill);

        this.faucetButton = this.createButton("Claim 10k HTX", window.innerWidth - 220, 80, () => this.onClaimHTX());
            this.container.addChild(this.faucetButton);

        // Demo Mint NFT button (optional; disable in production to enforce winner-only minting)
        if ((window.gameConfig?.demoMintEnabled) === true) {
            this.demoMintButton = this.createButton("Mint Demo NFT", window.innerWidth - 220, 150, () => this.onMintDemoNFT(), 200, 56, 0x00C2A8);
            this.container.addChild(this.demoMintButton);
        }

        // Owner utility: Fund House with 10k HTX (owner-only mint)
        this.fundHouseButton = this.createButton("Fund House 10k", window.innerWidth - 220, 220, () => this.onFundHouse(), 200, 56, 0x8E59FF);
        this.container.addChild(this.fundHouseButton);

            this.refreshHTXBalance().catch(()=>{});

        window.addEventListener('keydown', this.handleKeyDown.bind(this));
        window.addEventListener('click', this.handleClick.bind(this));

        // Share wallet address with server for winner payout
        setTimeout(() => {
            const wallet = window.gameWallet;
            if (wallet?.account) {
                this.socket.emit('set_address', wallet.account);
            }
        }, 0);
    }

    showResult(result) {
        if (!App.currentGame) return;

        const resultContainer = new PIXI.Container();
        resultContainer.zIndex = 100;
        App.currentGame.container.addChild(resultContainer);

        const resultText = new PIXI.Text(
            `Your Score: ${result.yourScore}\nOpponent Score: ${result.opponentScore}\nResult: ${result.result.toUpperCase()}`,
            {
                fontFamily: "Arial",
                fontSize: 36,
                fill: 0xffffff,
                stroke: 0x000000,
                strokeThickness: 4,
                align: 'center'
            }
        );
        resultText.anchor.set(0.5);
        resultText.x = 0;
        resultText.y = 0;
        resultContainer.addChild(resultText);
        App.currentGame.resultText = resultText;

        resultContainer.position.set(window.innerWidth / 2, window.innerHeight / 2 - 180);

        // Rematch button
        const rematchButton = new PIXI.Text("Rematch", {
            fontFamily: "Arial",
            fontSize: 36,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 4
        });
        rematchButton.anchor.set(0.5);
        rematchButton.x = window.innerWidth / 2;
        rematchButton.y = window.innerHeight / 2 - 20;
        rematchButton.zIndex = 100;
        rematchButton.interactive = true;
        rematchButton.buttonMode = true;
        rematchButton.on("pointerdown", () => {
            this.socket.emit('request_rematch', this.currentRoomId);
            rematchButton.interactive = false;
            App.currentGame.waitingText.text = "Waiting for opponent...";
        });
        App.currentGame.container.addChild(rematchButton);
        App.currentGame.rematchButton = rematchButton;

        // Waiting text
        const waitingText = new PIXI.Text("", {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 4,
            align: 'center'
        });
        waitingText.anchor.set(0.5);
        waitingText.x = window.innerWidth / 2;
        waitingText.y = window.innerHeight / 2 + 80;
        waitingText.zIndex = 100;
        App.currentGame.container.addChild(waitingText);
        App.currentGame.waitingText = waitingText;

        // Display avatar if the player is the winner
        if (this.showWinnerImage) {
            this.loadAndDisplayWinnerImage(resultContainer);
            this.showWinnerImage = false; // Reset flag
        }

        // If this client is the winner and we have an avatar, offer mint button (or auto-mint)
        const walletForMint = window.gameWallet;
        const isAddressWinner = this.winnerAddress
            ? (walletForMint?.account && walletForMint.account.toLowerCase() === this.winnerAddress.toLowerCase())
            : true; // if winnerAddress unknown, fall back to avatar presence
        const didWin = result?.result === 'win';
        if (this.winnerPngBase64 && didWin && isAddressWinner) {
            const mintBtn = new PIXI.Text("Mint NFT", {
                fontFamily: "Arial",
                fontSize: 32,
                fill: 0xffffff,
                stroke: 0x000000,
                strokeThickness: 4
            });
            mintBtn.anchor.set(0.5);
            mintBtn.x = window.innerWidth / 2;
            mintBtn.y = window.innerHeight / 2 + 140;
            mintBtn.zIndex = 100;
            mintBtn.interactive = true;
            mintBtn.buttonMode = true;
            mintBtn.on("pointerdown", async () => {
                try {
                    const wallet = window.gameWallet;
                    if (!wallet || !wallet.signer) {
                        alert("Wallet not connected. Open in a browser with MetaMask.");
                        return;
                    }
                    const addr = (window?.gameConfig?.nftMarketAddress) || "";
                    if (!addr) {
                        alert("NFT contract address not set. Please set Config.nftMarketAddress.");
                        return;
                    }
                    // Ensure we have ETH for gas; on localhost, ask faucet if low
                    try {
                        const ethBal = await getEthBalance({ signerOrProvider: wallet.signer, account: wallet.account });
                        if (ethBal < 0.02) {
                            if (App.currentGame?.waitingText) {
                                App.currentGame.waitingText.text = 'Funding ETH for gas...';
                                App.currentGame.waitingText.visible = true;
                            }
                            await new Promise((resolve, reject) => {
                                const timeout = setTimeout(() => reject(new Error('ETH funding timeout')), 15000);
                                this.socket.once('eth_funded', () => { clearTimeout(timeout); resolve(); });
                                this.socket.once('eth_fund_error', (msg) => { clearTimeout(timeout); reject(new Error(msg || 'ETH funding failed')); });
                                this.socket.emit('request_eth', wallet.account);
                            });
                            if (App.currentGame?.waitingText) {
                                App.currentGame.waitingText.visible = false;
                            }
                        }
                    } catch (_) { /* non-fatal */ }
                    mintBtn.interactive = false;
                    mintBtn.text = "Minting...";
                    const { receipt, tokenId } = await mintPngAsNFT({ signer: wallet.signer, contractAddress: addr, pngBase64: this.winnerPngBase64 });
                    const short = receipt?.transactionHash ? receipt.transactionHash.slice(0,10) + '...' : '';
                    mintBtn.text = tokenId ? `Minted! Token #${tokenId}` : `Minted! (${short})`;
                    // Hint for MetaMask NFT tab (localhost doesn't auto-detect NFTs)
                    if (App.currentGame?.waitingText) {
                        App.currentGame.waitingText.text = tokenId
                            ? `Import NFT in MetaMask:\nContract: ${addr}\nToken ID: ${tokenId}`
                            : `Minted. If NFT tab is empty, use Import NFT:\nContract: ${addr}\nToken ID: (last minted)`;
                        App.currentGame.waitingText.visible = true;
                    }

                    // Add Copy buttons for convenience
                    const style = { fontFamily: 'Arial', fontSize: 18, fill: 0xffffff, stroke: 0x000000, strokeThickness: 3 };
                    const makeCopyBtn = (label, text, y) => {
                        const t = new PIXI.Text(label, style);
                        t.anchor.set(0.5);
                        t.x = window.innerWidth / 2;
                        t.y = y;
                        t.interactive = true;
                        t.buttonMode = true;
                        t.on('pointerdown', async () => {
                            const ok = await copyToClipboard(text);
                            const old = t.text;
                            t.text = ok ? 'Copied!' : 'Copy failed';
                            setTimeout(()=>{ t.text = old; }, 1200);
                        });
                        App.currentGame.container.addChild(t);
                        return t;
                    };
                    const yBase = window.innerHeight / 2 + 175;
                    makeCopyBtn('Copy Contract', addr, yBase);
                    if (tokenId) makeCopyBtn('Copy Token ID', String(tokenId), yBase + 30);
                } catch (e) {
                    console.error("Mint failed:", e);
                    mintBtn.text = "Mint failed (see console)";
                    mintBtn.interactive = true;
                }
            });
            App.currentGame.container.addChild(mintBtn);
            App.currentGame.mintBtn = mintBtn;

            // Auto-mint for winner (optional, still prompts MetaMask)
            try {
                const cfg = window.gameConfig || {};
                if (cfg.autoMintOnWin) {
                    mintBtn.emit('pointerdown');
                }
            } catch (_) {}
        }

        // If current wallet is house and winnerAddress exists, offer HTX payout
        const cfg = window.gameConfig;
        const wallet = window.gameWallet;
        const isHouse = cfg && wallet && wallet.account && cfg.htxHouseAddress && wallet.account.toLowerCase() === cfg.htxHouseAddress.toLowerCase();
        if (isHouse && this.winnerAddress && this.winnerPrize > 0) {
            const payBtn = new PIXI.Text(`Pay ${this.winnerPrize} HTX to winner`, {
                fontFamily: "Arial",
                fontSize: 28,
                fill: 0xffffff,
                stroke: 0x000000,
                strokeThickness: 4
            });
            payBtn.anchor.set(0.5);
            payBtn.x = window.innerWidth / 2;
            payBtn.y = window.innerHeight / 2 + 190;
            payBtn.zIndex = 100;
            payBtn.interactive = true;
            payBtn.buttonMode = true;
            payBtn.on("pointerdown", async () => {
                try {
                    payBtn.interactive = false;
                    payBtn.text = "Paying...";
                    // Ensure the house wallet has a little ETH for gas/tip on localhost
                    try {
                        const ethBal = await getEthBalance({ signerOrProvider: wallet.signer, account: wallet.account });
                        if (ethBal < 0.02) {
                            if (App.currentGame?.waitingText) {
                                App.currentGame.waitingText.text = 'Funding ETH for gas...';
                                App.currentGame.waitingText.visible = true;
                            }
                            await new Promise((resolve, reject) => {
                                const timeout = setTimeout(() => reject(new Error('ETH funding timeout')), 15000);
                                this.socket.once('eth_funded', () => { clearTimeout(timeout); resolve(); });
                                this.socket.once('eth_fund_error', (msg) => { clearTimeout(timeout); reject(new Error(msg || 'ETH funding failed')); });
                                this.socket.emit('request_eth', wallet.account);
                            });
                            if (App.currentGame?.waitingText) {
                                App.currentGame.waitingText.visible = false;
                            }
                        }
                    } catch (_) { /* non-fatal */ }
                    await transferHtx({ signer: wallet.signer, tokenAddress: cfg.htxTokenAddress, to: this.winnerAddress, amount: this.winnerPrize });
                    // Optionally also send a small ETH tip so it doesn't look like a 0 ETH tx in MetaMask
                    try {
                        const tip = (cfg && cfg.htxEthTip != null) ? String(cfg.htxEthTip) : '0';
                        if (tip !== '0') {
                            await (await wallet.signer.sendTransaction({ to: this.winnerAddress, value: parseEther(tip) })).wait();
                            payBtn.text = `Paid + ${tip} ETH tip!`;
                        } else {
                            payBtn.text = "Paid!";
                        }
                    } catch (tipErr) {
                        console.warn('ETH tip failed (HTX paid):', tipErr?.message || tipErr);
                        payBtn.text = "Paid HTX (tip failed)";
                    }
                    // Notify room so both clients refresh balances
                    this.socket.emit('payout_done', this.currentRoomId);
                } catch (e) {
                    console.error('Payout failed:', e);
                    // Surface a clearer reason if we can
                    const msg = (e?.message || '').toLowerCase();
                    if (msg.includes('exceeds balance') || msg.includes('insufficient')) {
                        payBtn.text = "Payout failed: house lacks HTX";
                    } else if (msg.includes('user rejected')) {
                        payBtn.text = "Payout cancelled";
                    } else {
                        payBtn.text = "Payout failed";
                    }
                    payBtn.interactive = true;
                }
            });
            App.currentGame.container.addChild(payBtn);
            App.currentGame.payBtn = payBtn;
        } else if (this.winnerAddress && this.winnerPrize > 0) {
            // Show info to non-house players
            const infoText = new PIXI.Text(`Winner: ${this.winnerAddress.slice(0,6)}...\nPrize: ${this.winnerPrize} HTX\nHouse: ${cfg?.htxHouseAddress ? cfg.htxHouseAddress.slice(0,6)+'...' : '-'}`, {
                fontFamily: "Arial",
                fontSize: 20,
                fill: 0xffffff,
                align: 'center'
            });
            infoText.anchor.set(0.5);
            infoText.x = window.innerWidth / 2;
            infoText.y = window.innerHeight / 2 + 190;
            infoText.zIndex = 100;
            App.currentGame.container.addChild(infoText);
            App.currentGame.payoutInfoText = infoText;
        }
    }

    handleKeyDown(event) {
        if (!this.activeInput) return;

        if (event.key === 'Enter') {
            this.activeInput = null;
            return;
        }

        if (event.key === 'Backspace') {
            if (this.activeInput === 'create') {
                this.createPlaceholderText.text = this.createPlaceholderText.text.slice(0, -1);
                if (this.createPlaceholderText.text === '') {
                    this.createPlaceholderText.text = 'Create Room ID';
                }
            } else if (this.activeInput === 'join') {
                this.joinPlaceholderText.text = this.joinPlaceholderText.text.slice(0, -1);
                if (this.joinPlaceholderText.text === '') {
                    this.joinPlaceholderText.text = 'Enter Room ID';
                }
            }
            return;
        }

        if (/^[a-zA-Z0-9]$/.test(event.key)) {
            if (this.activeInput === 'create') {
                if (this.createPlaceholderText.text === 'Create Room ID') {
                    this.createPlaceholderText.text = '';
                }
                this.createPlaceholderText.text += event.key;
            } else if (this.activeInput === 'join') {
                if (this.joinPlaceholderText.text === 'Enter Room ID') {
                    this.joinPlaceholderText.text = '';
                }
                this.joinPlaceholderText.text += event.key;
            }
        }
    }

    handleClick(event) {
        const cb = this.createBounds;
        const jb = this.joinBounds;
        if (!cb || !jb) return;

        const isOutsideCreate = event.clientX < cb.x ||
            event.clientX > cb.x + cb.width ||
            event.clientY < cb.y ||
            event.clientY > cb.y + cb.height;

        const isOutsideJoin = event.clientX < jb.x ||
            event.clientX > jb.x + jb.width ||
            event.clientY < jb.y ||
            event.clientY > jb.y + jb.height;

        if (this.activeInput === 'create' && isOutsideCreate) {
            this.activeInput = null;
            if (this.createPlaceholderText.text === '') {
                this.createPlaceholderText.text = 'Create Room ID';
            }
        } else if (this.activeInput === 'join' && isOutsideJoin) {
            this.activeInput = null;
            if (this.joinPlaceholderText.text === '') {
                this.joinPlaceholderText.text = 'Enter Room ID';
            }
        }
    }

    onCreateRoom() {
        const roomId = this.createPlaceholderText.text;

        if (!this.socket?.connected) {
            if (this.waitingText) {
                this.waitingText.text = 'Not connected to server. Please start server on port 3001.';
                this.waitingText.visible = true;
            }
            return;
        }

        if (!roomId || roomId === "Create Room ID") {
            this.createPlaceholderText.text = "Enter a valid Room ID";
            this.createPlaceholderText.style.fill = 0xff0000;
            return;
        }

        this.socket.emit('create_room', roomId);
    }

    onJoinRoom() {
        const roomId = this.joinPlaceholderText.text;

        if (!this.socket?.connected) {
            if (this.waitingText) {
                this.waitingText.text = 'Not connected to server. Please start server on port 3001.';
                this.waitingText.visible = true;
            }
            return;
        }

        if (!roomId || roomId === "Enter Room ID") {
            this.joinPlaceholderText.text = "Invalid Room ID";
            this.joinPlaceholderText.style.fill = 0xff0000;
            return;
        }

        this.socket.emit('join_room', roomId);
    }

    startGame() {
        if (App.currentGame) {
            // Ensure previous game cleans up listeners/timers
            if (typeof App.currentGame.destroy === 'function') {
                App.currentGame.destroy();
            }
            App.app.stage.removeChild(App.currentGame.container);
            App.currentGame.container.destroy({ children: true });
            App.currentGame = null;
        }

        const gameContainer = new PIXI.Container();
        App.app.stage.removeChild(this.container);
    App.currentGame = new Game(this.socket, this.currentRoomId);
    // Optionally charge an entry fee in HTX when the game starts
    this.tryChargeEntryFee().catch((e)=>console.warn('Charge fee failed:', e));
        gameContainer.addChild(App.currentGame.container);
        App.app.stage.addChild(gameContainer);

        this.container.removeChildren();
        this.container.destroy({ children: true });
        this.container = null;
    }

    returnToRoomUI() {
        if (App.currentGame) {
            if (typeof App.currentGame.destroy === 'function') {
                App.currentGame.destroy();
            }
            App.app.stage.removeChild(App.currentGame.container);
            App.currentGame.container.destroy({ children: true });
            App.currentGame = null;
        }

    this.container = new PIXI.Container();
        App.app.stage.addChild(this.container);

    const background = new PIXI.Graphics();
    background.beginFill(0x101826);
    background.drawRect(0, 0, window.innerWidth, window.innerHeight);
    background.endFill();
    this.container.addChild(background);

    const panel = new PIXI.Graphics();
    panel.beginFill(0x000000, 0.25);
    panel.drawRoundedRect(0, 0, 680, 220, 16);
    panel.endFill();
    panel.position.set((window.innerWidth - 680) / 2, (window.innerHeight - 220) / 2 - 40);
    this.container.addChild(panel);

    const createPlaceholderBg = new PIXI.Graphics();
    createPlaceholderBg.beginFill(0x2B3A55, 0.8);
    createPlaceholderBg.drawRoundedRect(0, 0, 300, 50, 10);
    createPlaceholderBg.endFill();
    createPlaceholderBg.position.set(panel.position.x + 20, panel.position.y + 20);
    this.container.addChild(createPlaceholderBg);
    this.createBounds = { x: createPlaceholderBg.position.x, y: createPlaceholderBg.position.y, width: 300, height: 50 };

        this.createPlaceholderText = new PIXI.Text("Create Room ID", {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        this.createPlaceholderText.anchor.set(0.5);
    this.createPlaceholderText.position.set(createPlaceholderBg.position.x + 150, createPlaceholderBg.position.y + 25);
        this.container.addChild(this.createPlaceholderText);

        this.createPlaceholderText.interactive = true;
        this.createPlaceholderText.buttonMode = true;
        this.createPlaceholderText.on("pointerdown", () => {
            this.activeInput = 'create';
            this.createPlaceholderText.text = '';
            this.createPlaceholderText.style.fill = 0xffffff;
        });

    const joinPlaceholderBg = new PIXI.Graphics();
    joinPlaceholderBg.beginFill(0x2B3A55, 0.8);
    joinPlaceholderBg.drawRoundedRect(0, 0, 300, 50, 10);
    joinPlaceholderBg.endFill();
    joinPlaceholderBg.position.set(panel.position.x + 360, panel.position.y + 20);
        this.container.addChild(joinPlaceholderBg);
    this.joinBounds = { x: joinPlaceholderBg.position.x, y: joinPlaceholderBg.position.y, width: 300, height: 50 };

        this.joinPlaceholderText = new PIXI.Text("Enter Room ID", {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        this.joinPlaceholderText.anchor.set(0.5);
    this.joinPlaceholderText.position.set(joinPlaceholderBg.position.x + 150, joinPlaceholderBg.position.y + 25);
        this.container.addChild(this.joinPlaceholderText);

        this.joinPlaceholderText.interactive = true;
        this.joinPlaceholderText.buttonMode = true;
        this.joinPlaceholderText.on("pointerdown", () => {
            this.activeInput = 'join';
            this.joinPlaceholderText.text = '';
            this.joinPlaceholderText.style.fill = 0xffffff;
        });

        this.waitingText = new PIXI.Text('', {
            fontFamily: "Arial",
            fontSize: 24,
            fill: 0xffffff
        });
        this.waitingText.anchor.set(0.5);
    this.waitingText.position.set(window.innerWidth / 2, panel.position.y + 180);
        this.waitingText.visible = false;
        this.container.addChild(this.waitingText);

        this.createRoomButton = this.createButton(
            "Create Room",
            panel.position.x + 120,
            panel.position.y + 90,
            () => this.onCreateRoom()
        );
        this.container.addChild(this.createRoomButton);

        this.joinRoomButton = this.createButton(
            "Join Room",
            panel.position.x + 360 + 120,
            panel.position.y + 90,
            () => this.onJoinRoom()
        );
        this.container.addChild(this.joinRoomButton);

    this.currentRoomId = null;
    this.refreshHTXBalance().catch(()=>{});
    }

    destroy() {
        this.createRoomButton.removeAllListeners();
        this.joinRoomButton.removeAllListeners();
        if (this.faucetButton) this.faucetButton.removeAllListeners();
        if (this.demoMintButton) this.demoMintButton.removeAllListeners();
        this.socket.disconnect();
        window.removeEventListener('keydown', this.handleKeyDown.bind(this));
        window.removeEventListener('click', this.handleClick.bind(this));
        this.container.destroy({ children: true });
        delete window.roomUISocket;
    }

    async refreshHTXBalance() {
        try {
            const cfg = window.gameConfig;
            const wallet = window.gameWallet;
            if (!cfg?.htxTokenAddress || !wallet?.signer || !wallet?.account) return;
            const bal = await getHtxBalance({ signer: wallet.signer, tokenAddress: cfg.htxTokenAddress, account: wallet.account });
            if (this.htxBalanceText) this.htxBalanceText.text = `HTX: ${Math.floor(bal)}`;
        } catch (e) {
            // ignore
        }
    }

    async onClaimHTX() {
        const cfg = window.gameConfig;
        const wallet = window.gameWallet;
        if (!cfg?.htxTokenAddress || !wallet?.signer) {
            alert('Wallet not connected or token not configured.');
            return;
        }
        try {
            // Ensure some ETH for gas; if low, ask server faucet
            const ethBal = await getEthBalance({ signerOrProvider: wallet.signer, account: wallet.account });
            if (ethBal < 0.02) {
                this.waitingText.text = 'Funding ETH for gas...';
                this.waitingText.visible = true;
                await new Promise((resolve, reject) => {
                    const timeout = setTimeout(() => reject(new Error('ETH funding timeout')), 15000);
                    this.socket.once('eth_funded', () => { clearTimeout(timeout); resolve(); });
                    this.socket.once('eth_fund_error', (msg) => { clearTimeout(timeout); reject(new Error(msg || 'ETH funding failed')); });
                    this.socket.emit('request_eth', wallet.account);
                });
                this.waitingText.visible = false;
            }
            await claimHtx({ signer: wallet.signer, tokenAddress: cfg.htxTokenAddress });
            await this.refreshHTXBalance();
        } catch (e) {
            console.error('Claim HTX failed:', e);
            alert('Claim failed (maybe already claimed).');
        }
    }

    async onFundHouse() {
        const cfg = window.gameConfig;
        const wallet = window.gameWallet;
        try {
            if (!cfg?.htxTokenAddress || !wallet?.signer || !wallet?.account) {
                alert('Wallet/token not ready');
                return;
            }
            const isHouse = cfg?.htxHouseAddress && wallet.account.toLowerCase() === cfg.htxHouseAddress.toLowerCase();
            if (!isHouse) {
                alert('Only the house (token owner) can fund. Switch to the house account.');
                return;
            }
            this.waitingText.text = 'Minting 10k HTX to house...';
            this.waitingText.visible = true;
            await mintHtxOwner({ signer: wallet.signer, tokenAddress: cfg.htxTokenAddress, to: cfg.htxHouseAddress, amount: 10_000 });
            this.waitingText.visible = false;
            await this.refreshHTXBalance();
        } catch (e) {
            console.error('Fund house failed:', e);
            this.waitingText.text = 'Fund house failed';
            setTimeout(() => { if (this.waitingText) this.waitingText.visible = false; }, 2500);
        }
    }

    async tryChargeEntryFee() {
        const cfg = window.gameConfig;
        const wallet = window.gameWallet;
        if (!cfg?.htxTokenAddress || !cfg?.htxHouseAddress || !cfg?.htxEntryFee) return;
        if (!wallet?.signer) return;
        try {
            await transferHtx({ signer: wallet.signer, tokenAddress: cfg.htxTokenAddress, to: cfg.htxHouseAddress, amount: cfg.htxEntryFee });
            await this.refreshHTXBalance();
        } catch (e) {
            console.warn('Entry fee transfer skipped/failed:', e.message || e);
        }
    }

    async onMintDemoNFT() {
        const wallet = window.gameWallet;
        const addr = (window?.gameConfig?.nftMarketAddress) || "";
        if (!wallet?.signer) {
            alert('Wallet not connected. Open in a browser with MetaMask.');
            return;
        }
        if (!addr) {
            alert('NFT contract address not set. Please set Config.nftMarketAddress.');
            return;
        }
        try {
            this.waitingText.text = 'Preparing demo avatar...';
            this.waitingText.visible = true;
            const pngBase64 = await new Promise((resolve, reject) => {
                const to = setTimeout(() => reject(new Error('Timeout')), 10000);
                this.socket.once('demo_avatar', ({ pngBase64 }) => { clearTimeout(to); resolve(pngBase64); });
                this.socket.once('demo_avatar_error', (msg) => { clearTimeout(to); reject(new Error(msg)); });
                this.socket.emit('generate_avatar');
            });
            // Ensure ETH for gas before minting
            try {
                const ethBal = await getEthBalance({ signerOrProvider: wallet.signer, account: wallet.account });
                if (ethBal < 0.02) {
                    this.waitingText.text = 'Funding ETH for gas...';
                    await new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => reject(new Error('ETH funding timeout')), 15000);
                        this.socket.once('eth_funded', () => { clearTimeout(timeout); resolve(); });
                        this.socket.once('eth_fund_error', (msg) => { clearTimeout(timeout); reject(new Error(msg || 'ETH funding failed')); });
                        this.socket.emit('request_eth', wallet.account);
                    });
                }
            } catch (_) { /* ignore */ }
            this.waitingText.text = 'Minting demo NFT...';
            const receipt = await mintPngAsNFT({ signer: wallet.signer, contractAddress: addr, pngBase64 });
            this.waitingText.text = `Minted! ${receipt.transactionHash.slice(0,10)}...`;
            setTimeout(() => { if (this.waitingText) { this.waitingText.visible = false; } }, 3500);
        } catch (e) {
            console.error('Demo mint failed:', e);
            this.waitingText.text = 'Demo mint failed';
            setTimeout(() => { if (this.waitingText) { this.waitingText.visible = false; } }, 2500);
        }
    }

    async loadAndDisplayWinnerImage(resultContainer) {
        // Prefer server-sent base64 if available
        if (this.winnerPngBase64) {
            try {
                const texture = await this.loadImageAsTexture(`data:image/png;base64,${this.winnerPngBase64}`);
                const sprite = new PIXI.Sprite(texture);
                sprite.anchor.set(0.5);
                sprite.x = 0;
                sprite.y = 100;
                sprite.scale.set(3);
                resultContainer.addChild(sprite);
                return;
            } catch (e) {
                console.warn('Failed to load base64 avatar, will try static paths.', e);
            }
        }

        const pathsToTry = [
            'src/scripts/game/avatar_0000.png',
            './src/scripts/game/avatar_0000.png', 
            'avatar_0000.png',
            './avatar_0000.png',
            '/src/scripts/game/avatar_0000.png'
        ];

        for (let i = 0; i < pathsToTry.length; i++) {
            const currentPath = pathsToTry[i];
            try {
                const winnerTexture = await this.loadImageAsTexture(currentPath);
                const winnerSprite = new PIXI.Sprite(winnerTexture);
                winnerSprite.anchor.set(0.5);
                winnerSprite.x = 0;
                winnerSprite.y = 100;
                winnerSprite.scale.set(3);
                resultContainer.addChild(winnerSprite);
                return;
            } catch (error) {
                // continue
            }
        }
        console.error('Failed to load winner image from all attempted paths');
    }

    loadImageAsTexture(imagePath) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.crossOrigin = 'anonymous'; // Handle CORS if needed
            
            img.onload = () => {
                try {
                    // Create PIXI texture from the loaded image
                    const baseTexture = new PIXI.BaseTexture(img);
                    const texture = new PIXI.Texture(baseTexture);
                    resolve(texture);
                } catch (error) {
                    reject(new Error(`Failed to create PIXI texture: ${error.message}`));
                }
            };
            
            img.onerror = () => {
                reject(new Error(`Failed to load image from: ${imagePath}`));
            };
            
            // Start loading the image
            img.src = imagePath;
        });
    }

}