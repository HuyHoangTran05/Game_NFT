# NFT Match‑3 Game (Localhost Demo)

Multiplayer Match‑3 built with React + Vite and PIXI.js, using a Node.js Socket.IO server for rooms/avatars and a Hardhat local blockchain for smart contracts. The winner mints a randomly generated NFT avatar, and the house pays the HTX token prize.

Key pieces:
- Frontend: React + Vite + PIXI.js (`src/`)
- Server: Socket.IO, avatar generator, localhost ETH faucet (`src/scripts/server/`)
- Contracts: Hardhat + OpenZeppelin (`contracts/`), addresses written to `src/scripts/game/deployed.json`

## Prerequisites

- Node.js 18+ and npm
- Two browsers or two browser profiles (e.g., Edge + Chrome), each with MetaMask installed
- MetaMask Localhost network (Hardhat):
	- Network Name: Hardhat Localhost
	- New RPC URL: http://127.0.0.1:8545 (note the http://)
	- Chain ID: 31337
	- Currency symbol: ETH

## Install dependencies

```powershell
npm.cmd install
```

## Run locally (4 terminals)

Open four PowerShell terminals in the project directory and run:

1) Hardhat node (local blockchain)
```powershell
npm.cmd run hh:node
```

2) Deploy contracts to localhost (writes addresses to `src/scripts/game/deployed.json`)
```powershell
npm.cmd run hh:deploy:local
```

3) Socket.IO server (rooms, avatar, localhost ETH faucet)
```powershell
npm.cmd run server
```

4) Vite dev server (frontend)
```powershell
npm.cmd run dev
```

Open the printed URL (typically http://localhost:5173) in both browsers/profiles.

## Two‑player quick start

1) In each browser/profile, connect MetaMask to the Hardhat Localhost network (31337) and select different accounts.
2) In the app, Connect Wallet when prompted.
3) Click “Claim 10k HTX” in each browser to get demo tokens.
4) Create a room on one side (e.g., ROOM1) and Join the same room on the other side.
5) Play. When the game ends:
	 - The winner receives a random avatar and is prompted to mint an NFT (auto‑mint can be disabled; see Config below).
	 - The “house” account (by default the deployer, Account #0) gets a button to pay the HTX prize to the winner. If HTX is low, use “Fund House 10k”.

### Import the NFT into MetaMask (localhost)

MetaMask does not auto‑detect NFTs on localhost. After minting, the UI shows:
- Contract address (copyable)
- Token ID (copyable)

In MetaMask: NFTs tab → Import NFT → paste Contract + Token ID.

## Configuration (`src/scripts/game/Config.js`)

- `nftMarketAddress`, `htxTokenAddress`, `expectedChainId`, etc. are loaded from `deployed.json` after deploy.
- `autoMintOnWin` (default true): automatically opens mint for the winner.
- `demoMintEnabled` (default false): hide demo mint button to enforce winner‑only minting.
- `htxEntryFee`: HTX entry fee charged on game start.
- `htxEthTip`: optional ETH tip sent with payout (string for `ethers.parseEther`), set `'0'` to disable.
- `htxHouseAddress`: house wallet (defaults to deployer on localhost).
- `serverUrl`: set this if hosting the Socket.IO server remotely (e.g., for a Vercel‑hosted frontend).

## Package scripts

```json
{
	"hh:node": "hardhat node",
	"hh:deploy:local": "hardhat run scripts/deploy.cjs --network localhost",
	"server": "node src/scripts/server/index.js",
	"dev": "vite",
	"build": "vite build",
	"preview": "vite preview",
	"lint": "eslint ."
}
```

## How it works

- Multiplayer: Socket.IO rooms; when both players submit scores, server determines the winner and generates a PNG avatar (node‑canvas).
- NFT mint: Client mints via `NFTMarket.createNFT(tokenURI)` with metadata as a `data:application/json;base64,...` URI embedding the PNG.
- HTX token: Faucet claim for players, entry fee on start, house payout to winner, optional ETH tip for better UX.

## Troubleshooting

- “RPC must have http/https prefix”: use `http://127.0.0.1:8545` (not just `127.0.0.1:8545`).
- Both tabs use the same account: use two different browsers or two browser profiles; each MetaMask picks its own account.
- Mint shows as “0 ETH” in MetaMask: that’s normal for contract calls. Import the NFT manually (see above).
- NFT not visible in MetaMask: use Import NFT with the contract + token ID shown after mint.
- Payout fails:
	- Not the house wallet: switch to `htxHouseAddress`.
	- House lacks HTX: use “Fund House 10k”.
	- Lacks ETH for gas: keep the Socket server running; the faucet tops up localhost accounts.
- Addresses outdated after restarting node: redeploy (`hh:deploy:local`) to regenerate `deployed.json`.

## Optional: Hosting frontend on Vercel

- Frontend is static and can be deployed to Vercel. By default it targets localhost. To use a remote Socket.IO server, set `VITE_SERVER_URL` at build time and ensure wallets connect to the same chain as your backend.

---

Local demo only: private keys in `Config.js` are the public Hardhat defaults; never use them beyond localhost.
