import { Server as SocketIOServer } from "socket.io";
import type { Server as HTTPServer } from "http";
import { db } from "./db.server.js";

// Server-side checkBingo function
function checkBingo(board: string[][], markedPositions: number[][]): boolean {
  const isMarked = (row: number, col: number) => {
    return markedPositions.some(([r, c]) => r === row && c === col) || (row === 2 && col === 2);
  };

  // Check rows
  for (let row = 0; row < 5; row++) {
    let count = 0;
    for (let col = 0; col < 5; col++) {
      if (isMarked(row, col)) count++;
    }
    if (count === 5) return true;
  }

  // Check columns
  for (let col = 0; col < 5; col++) {
    let count = 0;
    for (let row = 0; row < 5; row++) {
      if (isMarked(row, col)) count++;
    }
    if (count === 5) return true;
  }

  // Check diagonals
  let diag1Count = 0, diag2Count = 0;
  for (let i = 0; i < 5; i++) {
    if (isMarked(i, i)) diag1Count++;
    if (isMarked(i, 4 - i)) diag2Count++;
  }
  
  return diag1Count === 5 || diag2Count === 5;
}

let io: SocketIOServer;

export function initializeSocketIO(server: HTTPServer) {
  io = new SocketIOServer(server, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-game", async (data: { gameCode: string; playerName: string }) => {
      try {
        const game = await db.game.findUnique({
          where: { code: data.gameCode },
          include: { players: true },
        });

        if (!game) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        if (!game.isActive) {
          socket.emit("error", { message: "Game is not active" });
          return;
        }

        if (game.players.length >= game.maxPlayers) {
          socket.emit("error", { message: "Game is full" });
          return;
        }

        // Check if player already exists
        const existingPlayer = game.players.find(p => p.name === data.playerName);
        if (existingPlayer) {
          socket.emit("error", { message: "Player name already taken" });
          return;
        }

        socket.join(data.gameCode);
        socket.emit("joined-game", { game, playerId: socket.id });
        socket.to(data.gameCode).emit("player-joined", { playerName: data.playerName });
      } catch (error) {
        console.error("Error joining game:", error);
        socket.emit("error", { message: "Failed to join game" });
      }
    });

    socket.on("call-word", async (data: { gameCode: string; word: string; playerId: string }) => {
      try {
        const game = await db.game.findUnique({
          where: { code: data.gameCode },
          include: { players: true, calledWords: true },
        });

        if (!game) {
          socket.emit("error", { message: "Game not found" });
          return;
        }

        // Check if word is already called
        const alreadyCalled = game.calledWords.some(cw => cw.word === data.word);
        if (alreadyCalled) {
          socket.emit("error", { message: "Word already called" });
          return;
        }

        // Add word to called words
        await db.calledWord.create({
          data: {
            gameId: game.id,
            word: data.word,
            calledBy: data.playerId,
          },
        });

        // Broadcast to all players in the game
        io.to(data.gameCode).emit("word-called", { 
          word: data.word, 
          calledBy: data.playerId,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.error("Error calling word:", error);
        socket.emit("error", { message: "Failed to call word" });
      }
    });

    socket.on("mark-cell", async (data: { 
      gameCode: string; 
      playerId: string; 
      row: number; 
      col: number;
      markedCells: number[][];
    }) => {
      try {
        const player = await db.player.findFirst({
          where: { 
            gameId: data.gameCode,
            id: data.playerId 
          },
          include: { game: true }
        });

        if (!player) {
          socket.emit("error", { message: "Player not found" });
          return;
        }

        // Update player's marked cells
        await db.player.update({
          where: { id: data.playerId },
          data: { markedCells: JSON.stringify(data.markedCells) },
        });

        const board = JSON.parse(player.board);
        const hasBingo = checkBingo(board, data.markedCells);

        if (hasBingo) {
          // Update player as winner
          await db.player.update({
            where: { id: data.playerId },
            data: { isWinner: true },
          });

          // End the game
          await db.game.update({
            where: { id: player.game.id },
            data: { isActive: false },
          });

          // Broadcast winner to all players
          io.to(data.gameCode).emit("game-won", { 
            winner: player.name,
            playerId: data.playerId 
          });
        } else {
          // Broadcast cell marked to other players
          socket.to(data.gameCode).emit("cell-marked", {
            playerId: data.playerId,
            playerName: player.name,
            row: data.row,
            col: data.col
          });
        }
      } catch (error) {
        console.error("Error marking cell:", error);
        socket.emit("error", { message: "Failed to mark cell" });
      }
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  return io;
}

export function getSocketIO() {
  return io;
}
