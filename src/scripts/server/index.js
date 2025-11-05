import { Server } from 'socket.io';
import { createServer } from 'http';
import { JsonRpcProvider, Wallet, parseEther } from 'ethers';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import AvatarGenerator from './avatarGenerator.js';

const httpServer = createServer((req, res) => {
  res.writeHead(404);
  res.end();
});

const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const rooms = new Map();
const socketEthAddress = new Map(); // socket.id -> eth address

// Local ETH faucet for Hardhat localhost only (development convenience)
const provider = new JsonRpcProvider('http://127.0.0.1:8545');
// Hardhat default Account #0 private key (public for local dev only)
const FAUCET_PRIVATE_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
const faucetWallet = new Wallet(FAUCET_PRIVATE_KEY, provider);

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('set_address', (address) => {
    if (typeof address === 'string' && address.startsWith('0x')) {
      socketEthAddress.set(socket.id, address);
    }
  });

  socket.on('create_room', (roomId) => {
    if (rooms.has(roomId)) {
      socket.emit('error', 'Room ID already exists');
      return;
    }

    rooms.set(roomId, {
      players: [socket.id],
      scores: {},
      rematchRequests: []
    });
    socket.join(roomId);
    socket.emit('room_created', roomId);
  });

  socket.on('join_room', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (room.players.length >= 2) {
      socket.emit('error', 'Room is full');
      return;
    }

    room.players.push(socket.id);
    socket.join(roomId);
    socket.emit('room_joined', roomId);

    if (room.players.length === 2) {
      io.to(roomId).emit('game_start');
    }
  });

  socket.on('submit_score', async ({ roomId, score }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    room.scores[socket.id] = score;

    if (Object.keys(room.scores).length === 2) {
      const [player1, player2] = room.players;
      const score1 = room.scores[player1];
      const score2 = room.scores[player2];

      let winnerId = null;
      if (score1 > score2) winnerId = player1;
      else if (score2 > score1) winnerId = player2;

      if (winnerId) {
        console.log('Winner found:', winnerId, 'Generating and sending avatar...');

        try {
          const __filename = fileURLToPath(import.meta.url);
          const __dirname = path.dirname(__filename);
          const imagesPath = path.join(__dirname, 'images');
          const outputPath = path.join(__dirname, 'output');
          const generator = new AvatarGenerator(imagesPath, outputPath);
          await generator.generateAvatars(1);
          const avatarPath = path.join(outputPath, 'avatar_0000.png');
          const pngBuffer = fs.readFileSync(avatarPath);
          const base64 = pngBuffer.toString('base64');
          io.to(winnerId).emit('winner_avatar', { pngBase64: base64 });
        } catch (e) {
          console.error('Failed to generate/send avatar:', e);
          // Fallback to previous signal
          io.to(winnerId).emit('avatar_received');
        }

        // Emit winner info (for HTX payout on client side)
        try {
          const winnerAddress = socketEthAddress.get(winnerId) || null;
          const entryFee = 100; // must match client config
          const feeRate = 0.10; // 10% house fee
          const prize = Math.floor(entryFee * 2 * (1 - feeRate)); // 180 HTX
          io.to(roomId).emit('winner_info', { winnerSocketId: winnerId, winnerAddress, prize, entryFee, feeRate });
        } catch (e) {
          console.error('Failed to emit winner_info:', e);
        }
      }

      io.to(player1).emit('game_result', {
        yourScore: score1,
        opponentScore: score2,
        result: score1 > score2 ? 'win' : score1 < score2 ? 'lose' : 'draw'
      });

      io.to(player2).emit('game_result', {
        yourScore: score2,
        opponentScore: score1,
        result: score2 > score1 ? 'win' : score2 < score1 ? 'lose' : 'draw'
      });

      room.scores = {};
    }
  });

  // Live score updates during the match
  socket.on('score_update', ({ roomId, score }) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    room.scores[socket.id] = score;
    const otherPlayer = room.players.find(id => id !== socket.id);
    if (otherPlayer) {
      io.to(otherPlayer).emit('opponent_score_update', { score });
    }
  });

  socket.on('request_rematch', (roomId) => {
    const room = rooms.get(roomId);
    if (!room) {
      socket.emit('error', 'Room not found');
      return;
    }

    if (!room.rematchRequests.includes(socket.id)) {
      room.rematchRequests.push(socket.id);
      const otherPlayer = room.players.find(id => id !== socket.id);
      if (otherPlayer) io.to(otherPlayer).emit('rematch_requested');
    }

    if (room.rematchRequests.length === 2) {
      room.rematchRequests = [];
      room.scores = {};
      io.to(roomId).emit('game_start');
    }
  });

  // Broadcast payout completion so clients refresh HTX balances
  socket.on('payout_done', (roomId) => {
    if (!roomId) return;
    io.to(roomId).emit('payout_done');
  });

  // Generate a demo avatar on demand and send back as base64
  socket.on('generate_avatar', async () => {
    try {
      const __filename = fileURLToPath(import.meta.url);
      const __dirname = path.dirname(__filename);
      const imagesPath = path.join(__dirname, 'images');
      const outputPath = path.join(__dirname, 'output');
      const generator = new AvatarGenerator(imagesPath, outputPath);
      await generator.generateAvatars(1);
      const avatarPath = path.join(outputPath, 'avatar_0000.png');
      const pngBuffer = fs.readFileSync(avatarPath);
      const base64 = pngBuffer.toString('base64');
      socket.emit('demo_avatar', { pngBase64: base64 });
    } catch (e) {
      console.error('generate_avatar failed:', e);
      socket.emit('demo_avatar_error', e.message || 'Failed to generate avatar');
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
    socketEthAddress.delete(socket.id);
    for (const [roomId, room] of rooms.entries()) {
      if (room.players.includes(socket.id)) {
        const otherPlayer = room.players.find(id => id !== socket.id);
        if (otherPlayer) io.to(otherPlayer).emit('opponent_disconnected');
        rooms.delete(roomId);
      }
    }
  });

  // Client can request a small amount of ETH to cover gas on localhost
  socket.on('request_eth', async (toAddress) => {
    try {
      if (typeof toAddress !== 'string' || !toAddress.startsWith('0x')) {
        socket.emit('eth_fund_error', 'Invalid address');
        return;
      }
      const bal = await provider.getBalance(toAddress);
      // Only fund if very low balance
      if (bal > parseEther('0.02')) {
        socket.emit('eth_funded', { txHash: null, note: 'Sufficient balance already' });
        return;
      }
      const tx = await faucetWallet.sendTransaction({ to: toAddress, value: parseEther('0.5') });
      const receipt = await tx.wait();
      socket.emit('eth_funded', { txHash: receipt.hash });
    } catch (e) {
      console.error('ETH faucet failed:', e);
      socket.emit('eth_fund_error', e.message || 'Funding failed');
    }
  });
});

const PORT = 3001;
httpServer.listen(PORT, () => {
  console.log(`Socket.IO server running on port ${PORT}`);
});