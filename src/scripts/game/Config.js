import { Game } from "./Game";
import { Tools } from "../system/Tools";
import {MenuScene} from "./menu";
import { RoomUI } from "./multiplayer";
import deployedLocal from "./deployed.json";
import deployedHarmony from "./deployed.harmony.json";
import deployedHarmonyTestnet from "./deployed.harmony-testnet.json";
// Use Vite's import.meta.glob to eagerly import all sprite files
const spriteModules = import.meta.glob('./../../sprites/**/*.{mp3,png,jpg,jpeg}', { eager: true });

const TARGET = (import.meta?.env?.VITE_CHAIN || 'localhost').toLowerCase();
const CHAIN = TARGET === 'harmony'
    ? deployedHarmony
    : TARGET === 'harmony-testnet' || TARGET === 'testnet'
        ? deployedHarmonyTestnet
        : deployedLocal;

export const Config = {
    // Allow running locally without a wallet when true (for dev/testing).
    // You can also pass ?dev=1 in the URL to bypass at runtime.
    allowDevWithoutWallet: false,
    // Dev auto-signer: bypass MetaMask and sign using a local Hardhat account for demos
    // Enable with ?devsig=1 or set devAutoSignerEnabled=true
    devAutoSignerEnabled: false,
    devRpcUrl: 'http://127.0.0.1:8545',
    // Hardhat default Account #0 private key (public on localhost). Use only for local demos.
    devPrivateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    // Addresses from the selected chain artifact; override via env if needed
    nftMarketAddress: CHAIN?.NFTMarket || "",
    htxTokenAddress: CHAIN?.HTXToken || "",
    htxHouseAddress: CHAIN?.deployer || (TARGET === 'harmony' ? "" : "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266"),
    expectedChainId: CHAIN?.chainId || (TARGET === 'harmony' ? 1666600000 : (TARGET === 'harmony-testnet' || TARGET === 'testnet' ? 1666700000 : 31337)),
    networkName: TARGET,
    // Optional custom server URL for Socket.IO (needed in production/Vercel)
    serverUrl: import.meta?.env?.VITE_SERVER_URL || "",
    // RPC URL for adding chain in MetaMask (used when chain is not present)
    chainRpcUrl: import.meta?.env?.VITE_CHAIN_RPC_URL || (TARGET === 'harmony' ? 'https://rpc.ankr.com/harmony' : (TARGET === 'harmony-testnet' || TARGET === 'testnet' ? 'https://rpc.ankr.com/harmony_testnet' : 'http://127.0.0.1:8545')),
    htxEntryFee: 100, // in HTX (whole tokens)
    // Also send a small ETH "tip" with the payout so it doesn't look like a 0 ETH tx in MetaMask
    // Use a string compatible with ethers.parseEther; set to '0' to disable.
    htxEthTip: '0.001',
    // Auto-mint NFT for the winner (will still show a MetaMask prompt). Set false to keep manual button.
    autoMintOnWin: true,
    // Allow a demo mint button (for testing without winning). Set false in production to enforce winner-only minting.
    demoMintEnabled: false,
    loader: Tools.massiveRequire(spriteModules),
    startScene: RoomUI,
    assets: {
        sky1: "src/menu/1.png",
        tree: "src/menu/2.png",
        sky2: "src/menu/3.png",
        tree2: "src/menu/4.png",
        mountain: "src/menu/5.png"
      },
    tilesColors: ['blue', 'green', 'orange', 'red', 'pink', 'yellow'],
    board: {
        rows: 8,
        cols: 8
    },
    combinationRules: [[
        { col: 1, row: 0 }, { col: 2, row: 0 },
    ], [
        { col: 0, row: 1 }, { col: 0, row: 2 },
    ]]
};
