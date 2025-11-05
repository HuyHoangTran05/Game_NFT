// src/App.jsx
import { useEffect, useRef, useState } from "react";
import { Wallet } from "./scripts/system/wallet";
import { App as PixiApp } from "./scripts/system/App";
import { Config } from "./scripts/game/Config";

export default function App() {
  const [error, setError] = useState("");
  const mountRef = useRef(null);

  useEffect(() => {
    // we wrap your startGame() in here
    async function startGame() {
      try {
        const wallet = await Wallet.connect();
        console.log("Wallet.connect() result:", wallet);

        const url = new URL(window.location.href);
        const devBypass = url.searchParams.get("dev") === "1" || Config?.allowDevWithoutWallet === true;

        if (wallet && wallet.account) {
          console.log("Connected wallet:", wallet.account);
          // Expose wallet for game modules that need on-chain calls (e.g., mint NFT)
          window.gameWallet = wallet;
          window.gameConfig = Config;
          // pass the div ref so PIXI mounts into it
          PixiApp.run(Config, mountRef.current);
        } else if (devBypass) {
          console.warn("Dev bypass enabled: running without wallet.");
          PixiApp.run(Config, mountRef.current);
        } else {
          console.log("Wallet connection required to play.");
          setError("Wallet connection required to play.");
        }
      } catch (err) {
        console.error("MetaMask connection failed:", err);
        setError("MetaMask connection failed. See console.");
      }
    }

    startGame();
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      {/* This is where your PIXI canvas will go */}
      <div ref={mountRef} style={{ width: Config.width, height: Config.height, margin: "0 auto" }} />
      {error && (
        <p style={{ color: "salmon", position: "absolute", top: 10, left: 10 }}>
          {error}
        </p>
      )}
    </div>
  );
}
