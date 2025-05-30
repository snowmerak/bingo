import type { MetaFunction } from "@remix-run/node";
import { Link } from "@remix-run/react";
import { useState } from "react";

export const meta: MetaFunction = () => {
  return [
    { title: "Bingo Game" },
    { name: "description", content: "Play Bingo with your friends online!" },
  ];
};

export default function Index() {
  const [gameCode, setGameCode] = useState("");

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-bold text-gray-800 dark:text-white mb-4">
            🎯 Bingo
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 mb-8">
            Play Bingo with your friends online in real-time!
          </p>
        </div>

        <div className="max-w-md mx-auto space-y-6">
          {/* Create Game Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 text-center">
              Create New Game
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
              Start a new Bingo game and invite your friends
            </p>
            <Link
              to="/create"
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 block text-center"
            >
              Create Game
            </Link>
          </div>

          {/* Join Game Card */}
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-800 dark:text-white mb-4 text-center">
              Join Existing Game
            </h2>
            <p className="text-gray-600 dark:text-gray-300 mb-6 text-center">
              Enter a game code to join your friends
            </p>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Enter game code (e.g., ABC123)"
                value={gameCode}
                onChange={(e) => setGameCode(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                maxLength={6}
              />
              <Link
                to={gameCode ? `/join/${gameCode}` : "#"}
                className={`w-full font-semibold py-3 px-6 rounded-lg transition duration-200 block text-center ${
                  gameCode
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Join Game
              </Link>
            </div>
          </div>
        </div>

        {/* Features Section */}
        <div className="mt-16 max-w-4xl mx-auto">
          <h2 className="text-3xl font-semibold text-center text-gray-800 dark:text-white mb-12">
            Game Features
          </h2>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl mb-4">🎮</div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Real-time Gameplay
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Play with friends in real-time with instant updates
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">📱</div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Mobile Friendly
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Works perfectly on desktop, tablet, and mobile devices
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-2">
                Multiplayer
              </h3>
              <p className="text-gray-600 dark:text-gray-300">
                Play with up to 4 friends in the same game
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
