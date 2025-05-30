import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { Socket } from "socket.io-client";
import { db } from "~/lib/db.server";
import { checkBingo } from "~/lib/bingo.client";

export const meta = () => {
  return [
    { title: "Bingo Game" },
    { name: "description", content: "Play Bingo with friends" },
  ];
};

export async function loader({ params, request }: LoaderFunctionArgs) {
  const gameCode = params.gameCode;
  const url = new URL(request.url);
  const playerId = url.searchParams.get("playerId");

  if (!gameCode || !playerId) {
    throw new Response("Game code and player ID are required", { status: 400 });
  }

  const game = await db.game.findUnique({
    where: { code: gameCode },
    include: { 
      players: true,
      calledWords: { orderBy: { calledAt: "desc" } }
    },
  });

  if (!game) {
    throw new Response("Game not found", { status: 404 });
  }

  const currentPlayer = game.players.find(p => p.id === playerId);
  if (!currentPlayer) {
    throw new Response("Player not found", { status: 404 });
  }

  return json({ 
    game, 
    currentPlayer,
    board: JSON.parse(currentPlayer.board),
    markedCells: JSON.parse(currentPlayer.markedCells || "[]"),
    words: JSON.parse(game.words)
  });
}

interface GameState {
  calledWords: string[];
  players: Array<{
    id: string;
    name: string;
    isHost: boolean;
    isWinner: boolean;
  }>;
  gameActive: boolean;
  winner?: string;
}

export default function Game() {
  const { game, currentPlayer, board, markedCells: initialMarkedCells, words } = useLoaderData<typeof loader>();
  const [socket, setSocket] = useState<Socket | null>(null);
  const [markedCells, setMarkedCells] = useState<number[][]>(initialMarkedCells);
  const [gameState, setGameState] = useState<GameState>({
    calledWords: game.calledWords.map(cw => cw.word),
    players: game.players.map(p => ({
      id: p.id,
      name: p.name,
      isHost: p.isHost,
      isWinner: p.isWinner
    })),
    gameActive: game.isActive,
  });
  const [newWord, setNewWord] = useState("");
  const [messages, setMessages] = useState<string[]>([]);

  useEffect(() => {
    const socketInstance = io();
    setSocket(socketInstance);
    
    console.log("Socket connected:", socketInstance.id);

    // Join the game room
    socketInstance.emit("join-game", {
      gameCode: game.code,
      playerName: currentPlayer.name
    });

    // Listen for events
    socketInstance.on("word-called", (data: { word: string; calledBy: string; timestamp: string }) => {
      console.log("Word-called event received:", data);
      setGameState(prev => ({
        ...prev,
        calledWords: [...prev.calledWords, data.word]
      }));
      setMessages(prev => [...prev, `Word "${data.word}" was called!`]);
    });

    socketInstance.on("game-won", (data: { winner: string; playerId: string }) => {
      console.log("Game-won event received:", data);
      setGameState(prev => ({
        ...prev,
        gameActive: false,
        winner: data.winner
      }));
      setMessages(prev => [...prev, `🎉 ${data.winner} won the game!`]);
    });

    socketInstance.on("player-joined", (data: { playerName: string }) => {
      console.log("Player-joined event received:", data);
      setMessages(prev => [...prev, `${data.playerName} joined the game`]);
    });

    socketInstance.on("error", (data: { message: string }) => {
      console.log("Error event received:", data);
      setMessages(prev => [...prev, `Error: ${data.message}`]);
    });

    socketInstance.on("connect", () => {
      console.log("Socket.io connected successfully");
    });

    socketInstance.on("disconnect", () => {
      console.log("Socket.io disconnected");
    });

    return () => {
      socketInstance.disconnect();
    };
  }, [game.code, currentPlayer.name]);

  const handleCellClick = (row: number, col: number) => {
    if (!gameState.gameActive || gameState.winner) return;
    
    const cellValue = board[row][col];
    if (cellValue === "FREE") return; // Free space is always marked
    
    // Check if word has been called
    if (!gameState.calledWords.includes(cellValue)) {
      setMessages(prev => [...prev, `"${cellValue}" hasn't been called yet!`]);
      return;
    }

    // Toggle cell marking
    const isMarked = markedCells.some(([r, c]) => r === row && c === col);
    let newMarkedCells;
    
    if (isMarked) {
      newMarkedCells = markedCells.filter(([r, c]) => !(r === row && c === col));
    } else {
      newMarkedCells = [...markedCells, [row, col]];
    }
    
    setMarkedCells(newMarkedCells);
    
    // Check for bingo
    const hasBingo = checkBingo(board, newMarkedCells);
    
    if (socket) {
      socket.emit("mark-cell", {
        gameCode: game.code,
        playerId: currentPlayer.id,
        row,
        col,
        markedCells: newMarkedCells
      });
    }
  };

  const handleCallWord = () => {
    if (!newWord.trim() || !socket || !currentPlayer.isHost) return;
    
    const word = newWord.trim();
    if (gameState.calledWords.includes(word)) {
      setMessages(prev => [...prev, `"${word}" has already been called!`]);
      return;
    }
    
    console.log("Calling word:", word);
    
    socket.emit("call-word", {
      gameCode: game.code,
      word,
      playerId: currentPlayer.id
    });
    
    setNewWord("");
  };

  const isCellMarked = (row: number, col: number) => {
    return markedCells.some(([r, c]) => r === row && c === col) || (row === 2 && col === 2);
  };

  const isCellCallable = (cellValue: string) => {
    return gameState.calledWords.includes(cellValue) || cellValue === "FREE";
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-2">
            {game.name}
          </h1>
          <p className="text-gray-600 dark:text-gray-300">
            Game Code: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{game.code}</span>
          </p>
          <p className="text-gray-600 dark:text-gray-300">
            Playing as: <span className="font-semibold">{currentPlayer.name}</span>
            {currentPlayer.isHost && <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded">Host</span>}
          </p>
        </div>

        {gameState.winner && (
          <div className="mb-8 text-center">
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 text-green-700 dark:text-green-400 px-6 py-4 rounded-lg inline-block">
              <h2 className="text-2xl font-bold mb-2">🎉 Game Over!</h2>
              <p>{gameState.winner} won the game!</p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Bingo Board */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 text-center">
                Your Bingo Board
              </h2>
              <div className="grid grid-cols-5 gap-2 max-w-md mx-auto">
                {board.map((row: string[], rowIndex: number) => 
                  row.map((cell: string, colIndex: number) => (
                    <button
                      key={`${rowIndex}-${colIndex}`}
                      onClick={() => handleCellClick(rowIndex, colIndex)}
                      className={`
                        aspect-square p-2 text-xs font-medium rounded-lg border-2 transition-all duration-200
                        ${isCellMarked(rowIndex, colIndex)
                          ? "bg-blue-500 text-white border-blue-600 shadow-lg"
                          : isCellCallable(cell)
                          ? "bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700 text-green-700 dark:text-green-300 hover:bg-green-100 dark:hover:bg-green-900/30"
                          : "bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300"
                        }
                        ${cell === "FREE" ? "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700" : ""}
                        disabled:cursor-not-allowed
                      `}
                      disabled={!gameState.gameActive || !!gameState.winner}
                    >
                      {cell}
                    </button>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Call Word (Host Only) */}
            {currentPlayer.isHost && gameState.gameActive && !gameState.winner && (
              <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
                <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                  Call Word
                </h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newWord}
                    onChange={(e) => setNewWord(e.target.value)}
                    placeholder="Enter word..."
                    className="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white text-sm"
                    onKeyPress={(e) => e.key === "Enter" && handleCallWord()}
                  />
                  <button
                    onClick={handleCallWord}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition duration-200 text-sm"
                  >
                    Call
                  </button>
                </div>
              </div>
            )}

            {/* Called Words */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Called Words ({gameState.calledWords.length})
              </h3>
              <div className="max-h-40 overflow-y-auto">
                {gameState.calledWords.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {gameState.calledWords.map((word, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 rounded-full text-sm"
                      >
                        {word}
                      </span>
                    ))}
                  </div>
                ) : (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No words called yet
                  </p>
                )}
              </div>
            </div>

            {/* Players */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Players ({gameState.players.length})
              </h3>
              <div className="space-y-2">
                {gameState.players.map((player) => (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      player.isWinner
                        ? "bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700"
                        : "bg-gray-50 dark:bg-gray-700"
                    }`}
                  >
                    <span className="font-medium text-gray-800 dark:text-white">
                      {player.name}
                    </span>
                    <div className="flex gap-2">
                      {player.isHost && (
                        <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded">
                          Host
                        </span>
                      )}
                      {player.isWinner && (
                        <span className="text-xs bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300 px-2 py-1 rounded">
                          Winner
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Messages */}
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6">
              <h3 className="text-lg font-semibold text-gray-800 dark:text-white mb-4">
                Game Messages
              </h3>
              <div className="max-h-40 overflow-y-auto space-y-2">
                {messages.slice(-10).map((message, index) => (
                  <div
                    key={index}
                    className="text-sm text-gray-600 dark:text-gray-300 p-2 bg-gray-50 dark:bg-gray-700 rounded"
                  >
                    {message}
                  </div>
                ))}
                {messages.length === 0 && (
                  <p className="text-gray-500 dark:text-gray-400 text-sm">
                    No messages yet
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
