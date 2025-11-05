import { BrowserProvider } from "ethers";
import { Config } from "../game/Config";

export class Wallet {
    static async connect() {
        try {
            if (!window.ethereum) {
                alert("Please install MetaMask to play this game.");
                return null;
            }

            let provider = new BrowserProvider(window.ethereum);
            // Explicitly request account access to ensure connection in all browsers
            await provider.send("eth_requestAccounts", []);

            // Ensure we're on the expected network (Hardhat localhost or Harmony)
            try {
                const net = await provider.getNetwork();
                const expected = Number(Config?.expectedChainId || 31337);
                if (Number(net.chainId) !== expected) {
                    const hex = '0x' + expected.toString(16);
                    try {
                        await window.ethereum.request({
                            method: 'wallet_switchEthereumChain',
                            params: [{ chainId: hex }]
                        });
                    } catch (switchErr) {
                        // If not added, add localhost chain
                        if (switchErr?.code === 4902) {
                            try {
                                const isHarmony = expected === 1666600000;
                                    const isTestnet = expected === 1666700000;
                                    const rpcUrl = Config?.chainRpcUrl
                                        || (isHarmony ? 'https://rpc.ankr.com/harmony' : (isTestnet ? 'https://rpc.ankr.com/harmony_testnet' : 'http://127.0.0.1:8545'));
                                    await window.ethereum.request({
                                        method: 'wallet_addEthereumChain',
                                        params: [{
                                            chainId: hex,
                                            chainName: isHarmony ? 'Harmony Mainnet' : (isTestnet ? 'Harmony Testnet' : 'Hardhat Localhost'),
                                            nativeCurrency: (isHarmony || isTestnet)
                                                ? { name: 'ONE', symbol: 'ONE', decimals: 18 }
                                                : { name: 'Ether', symbol: 'ETH', decimals: 18 },
                                            rpcUrls: [ rpcUrl ]
                                        }]
                                    });
                            } catch (addErr) {
                                console.error('Add chain failed', addErr);
                                throw addErr;
                            }
                        } else {
                            console.error('Switch chain failed', switchErr);
                            throw switchErr;
                        }
                    }
                    // Recreate provider after switch
                    provider = new BrowserProvider(window.ethereum);
                }
            } catch (netErr) {
                console.warn('Network check/switch skipped or failed:', netErr?.message || netErr);
            }

            const signer = await provider.getSigner();
            const account = await signer.getAddress();

            return { account, provider, signer, dev: false };
        } catch (error) {
            console.error("Wallet connection failed:", error);
            return null;
        }
    }
}
