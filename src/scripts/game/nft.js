import { Contract, Interface } from "ethers";

// Minimal ABI for NFTMarket's createNFT(string tokenURI)
const ABI = [
  {
    "inputs": [
      { "internalType": "string", "name": "tokenURI", "type": "string" }
    ],
    "name": "createNFT",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  // ERC721 Transfer event (to parse minted tokenId)
  {
    "anonymous": false,
    "inputs": [
      { "indexed": true, "internalType": "address", "name": "from", "type": "address" },
      { "indexed": true, "internalType": "address", "name": "to", "type": "address" },
      { "indexed": true, "internalType": "uint256", "name": "tokenId", "type": "uint256" }
    ],
    "name": "Transfer",
    "type": "event"
  }
];

/**
 * Mint a PNG image as an NFT by embedding metadata JSON in a data: URI.
 * @param signer Ethers Signer (from Wallet.connect())
 * @param contractAddress Address of deployed NFTMarket contract
 * @param name Name of NFT
 * @param description Description
 * @param pngBase64 Base64-encoded PNG (no prefix)
 */
export async function mintPngAsNFT({ signer, contractAddress, name = "Winner Avatar", description = "Match-3 Winner Avatar", pngBase64 }) {
  if (!signer) throw new Error("Missing signer");
  if (!contractAddress) throw new Error("Missing NFT contract address");
  if (!pngBase64) throw new Error("Missing PNG base64 data");

  const imageDataUri = `data:image/png;base64,${pngBase64}`;
  const metadata = {
    name,
    description,
    image: imageDataUri,
  };
  const json = JSON.stringify(metadata);
  const b64 = typeof window === 'undefined' ? Buffer.from(json).toString('base64') : btoa(unescape(encodeURIComponent(json)));
  const tokenURI = `data:application/json;base64,${b64}`;

  const contract = new Contract(contractAddress, ABI, signer);
  const tx = await contract.createNFT(tokenURI);
  const receipt = await tx.wait();
  // Try parse minted tokenId from ERC721 Transfer(from=0x0, to=signer)
  let tokenId = null;
  try {
    const iface = new Interface(ABI);
    for (const log of receipt.logs || []) {
      try {
        const parsed = iface.parseLog({ topics: log.topics, data: log.data });
        if (parsed?.name === 'Transfer' && parsed.args && String(parsed.args.from).toLowerCase() === '0x0000000000000000000000000000000000000000') {
          tokenId = parsed.args.tokenId?.toString();
          break;
        }
      } catch (_) { /* skip non-matching logs */ }
    }
  } catch (_) { /* optional */ }
  return { receipt, tokenId };
}
