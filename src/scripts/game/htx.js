import { Contract, parseUnits, formatUnits } from "ethers";

// Minimal ABI: ERC20 balanceOf/decimals/transfer/approve/allowance + claim()
export const ERC20_ABI = [
  { "inputs": [], "name": "decimals", "outputs": [{"internalType":"uint8","name":"","type":"uint8"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType":"address","name":"account","type":"address"}], "name": "balanceOf", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability": "view", "type": "function" },
  { "inputs": [{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}], "name": "transfer", "outputs": [{"internalType":"bool","name":"","type":"bool"}], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"value","type":"uint256"}], "name": "approve", "outputs": [{"internalType":"bool","name":"","type":"bool"}], "stateMutability": "nonpayable", "type": "function" },
  { "inputs": [{"internalType":"address","name":"owner","type":"address"},{"internalType":"address","name":"spender","type":"address"}], "name": "allowance", "outputs": [{"internalType":"uint256","name":"","type":"uint256"}], "stateMutability": "view", "type": "function" },
  // Faucet claim()
  { "inputs": [], "name": "claim", "outputs": [], "stateMutability": "nonpayable", "type": "function" },
  // Owner-only mint(to, amount)
  { "inputs": [{"internalType":"address","name":"to","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}], "name": "mint", "outputs": [], "stateMutability": "nonpayable", "type": "function" }
];

export function getToken(signer, tokenAddress) {
  return new Contract(tokenAddress, ERC20_ABI, signer);
}

export async function getHtxBalance({ signer, tokenAddress, account }) {
  const token = getToken(signer, tokenAddress);
  const [dec, bal] = await Promise.all([
    token.decimals(),
    token.balanceOf(account)
  ]);
  return Number(formatUnits(bal, dec));
}

export async function claimHtx({ signer, tokenAddress }) {
  const token = getToken(signer, tokenAddress);
  const tx = await token.claim();
  return await tx.wait();
}

export async function transferHtx({ signer, tokenAddress, to, amount }) {
  const token = getToken(signer, tokenAddress);
  const dec = await token.decimals();
  const tx = await token.transfer(to, parseUnits(String(amount), dec));
  return await tx.wait();
}

export async function getEthBalance({ signerOrProvider, account }) {
  const provider = signerOrProvider.provider || signerOrProvider;
  const addr = account || (signerOrProvider.getAddress ? await signerOrProvider.getAddress() : null);
  if (!provider || !addr) return 0;
  const wei = await provider.getBalance(addr);
  return Number(formatUnits(wei, 18));
}

export async function mintHtxOwner({ signer, tokenAddress, to, amount }) {
  const token = getToken(signer, tokenAddress);
  const dec = await token.decimals();
  const tx = await token.mint(to, parseUnits(String(amount), dec));
  return await tx.wait();
}
