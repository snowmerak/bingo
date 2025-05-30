import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useNavigation } from "@remix-run/react";
import { useState } from "react";
import { db } from "~/lib/db.server";
import { generateGameCode, generateBingoBoard, defaultBingoWords } from "~/lib/bingo.server";

export const meta = () => {
  return [
    { title: "Create Bingo Game" },
    { name: "description", content: "Create a new Bingo game" },
  ];
};

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const gameName = formData.get("gameName") as string;
  const hostName = formData.get("hostName") as string;
  const maxPlayers = parseInt(formData.get("maxPlayers") as string) || 4;
  const customWords = formData.get("customWords") as string;

  if (!gameName || !hostName) {
    return json({ error: "Game name and host name are required" }, { status: 400 });
  }

  try {
    // Parse custom words or use default
    let words = defaultBingoWords;
    if (customWords) {
      const parsedWords = customWords.split('\n').map(w => w.trim()).filter(w => w.length > 0);
      if (parsedWords.length >= 24) {
        words = parsedWords;
      }
    }

    // Generate unique game code
    let gameCode;
    let attempts = 0;
    do {
      gameCode = generateGameCode();
      const existing = await db.game.findUnique({ where: { code: gameCode } });
      if (!existing) break;
      attempts++;
    } while (attempts < 10);

    if (attempts >= 10) {
      return json({ error: "Failed to generate unique game code" }, { status: 500 });
    }

    // Create the game
    const game = await db.game.create({
      data: {
        name: gameName,
        hostId: "temp", // Will be updated when host joins
        code: gameCode,
        maxPlayers,
        words: JSON.stringify(words),
      },
    });

    // Generate host's board
    const hostBoard = generateBingoBoard(words);

    // Create host player
    const hostPlayer = await db.player.create({
      data: {
        name: hostName,
        gameId: game.id,
        isHost: true,
        board: JSON.stringify(hostBoard),
      },
    });

    // Update game with host ID
    await db.game.update({
      where: { id: game.id },
      data: { hostId: hostPlayer.id },
    });

    return redirect(`/game/${gameCode}?playerId=${hostPlayer.id}`);
  } catch (error) {
    console.error("Error creating game:", error);
    return json({ error: "Failed to create game" }, { status: 500 });
  }
}

export default function CreateGame() {
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();
  const [showCustomWords, setShowCustomWords] = useState(false);

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-2xl mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
              Create New Bingo Game
            </h1>
            <p className="text-gray-600 dark:text-gray-300">
              Set up your game and invite friends to play
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            <Form method="post" className="space-y-6">
              {/* Game Name */}
              <div>
                <label htmlFor="gameName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Game Name *
                </label>
                <input
                  type="text"
                  id="gameName"
                  name="gameName"
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter game name"
                />
              </div>

              {/* Host Name */}
              <div>
                <label htmlFor="hostName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Your Name *
                </label>
                <input
                  type="text"
                  id="hostName"
                  name="hostName"
                  required
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                  placeholder="Enter your name"
                />
              </div>

              {/* Max Players */}
              <div>
                <label htmlFor="maxPlayers" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Maximum Players
                </label>
                <select
                  id="maxPlayers"
                  name="maxPlayers"
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                >
                  <option value="2">2 Players</option>
                  <option value="3">3 Players</option>
                  <option value="4" selected>4 Players</option>
                  <option value="5">5 Players</option>
                  <option value="6">6 Players</option>
                </select>
              </div>

              {/* Custom Words Toggle */}
              <div>
                <div className="flex items-center mb-4">
                  <input
                    type="checkbox"
                    id="customWordsToggle"
                    checked={showCustomWords}
                    onChange={(e) => setShowCustomWords(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="customWordsToggle" className="ml-2 block text-sm text-gray-700 dark:text-gray-300">
                    Use custom words (optional)
                  </label>
                </div>

                {showCustomWords && (
                  <div>
                    <label htmlFor="customWords" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Custom Words (one per line, minimum 24 words)
                    </label>
                    <textarea
                      id="customWords"
                      name="customWords"
                      rows={8}
                      className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                      placeholder="Enter custom words, one per line..."
                    />
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                      Leave empty to use default words
                    </p>
                  </div>
                )}
              </div>

              {/* Error Message */}
              {actionData?.error && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                  {actionData.error}
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
              >
                {isSubmitting ? "Creating Game..." : "Create Game"}
              </button>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
}
