import { App } from "./system/App";
import { Config } from "./game/Config";
import { Wallet } from "./system/wallet";

async function startGame() {
    try {
        const wallet = await Wallet.connect();
        console.log("Wallet.connect() result:", wallet);

        if (wallet && wallet.account) {
            console.log("Connected wallet:", wallet.account);
            App.run(Config);
        } else {
            console.log("Wallet connection required to play.");
        }
    } catch (error) {
        console.error("MetaMask connection failed:", error);
    }
}




startGame();
