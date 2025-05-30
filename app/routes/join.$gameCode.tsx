import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useActionData, useLoaderData, useNavigation } from "@remix-run/react";
import { db } from "~/lib/db.server";
import { generateBingoBoard } from "~/lib/bingo.server";

export const meta = () => {
  return [
    { title: "Join Bingo Game" },
    { name: "description", content: "Join an existing Bingo game" },
  ];
};

export async function loader({ params }: LoaderFunctionArgs) {
  const gameCode = params.gameCode;
  
  if (!gameCode) {
    throw new Response("Game code is required", { status: 400 });
  }

  const game = await db.game.findUnique({
    where: { code: gameCode },
    include: { players: true },
  });

  if (!game) {
    throw new Response("Game not found", { status: 404 });
  }

  return json({ game });
}

export async function action({ request, params }: ActionFunctionArgs) {
  const gameCode = params.gameCode;
  const formData = await request.formData();
  const playerName = formData.get("playerName") as string;

  if (!gameCode || !playerName) {
    return json({ error: "Game code and player name are required" }, { status: 400 });
  }

  try {
    const game = await db.game.findUnique({
      where: { code: gameCode },
      include: { players: true },
    });

    if (!game) {
      return json({ error: "Game not found" }, { status: 404 });
    }

    if (!game.isActive) {
      return json({ error: "Game is not active" }, { status: 400 });
    }

    if (game.players.length >= game.maxPlayers) {
      return json({ error: "Game is full" }, { status: 400 });
    }

    // Check if player name is already taken
    const existingPlayer = game.players.find(p => p.name === playerName);
    if (existingPlayer) {
      return json({ error: "Player name is already taken" }, { status: 400 });
    }

    // Parse words from game
    const words = JSON.parse(game.words);
    
    // Generate player's board
    const playerBoard = generateBingoBoard(words);

    // Create player
    const player = await db.player.create({
      data: {
        name: playerName,
        gameId: game.id,
        board: JSON.stringify(playerBoard),
      },
    });

    return redirect(`/game/${gameCode}?playerId=${player.id}`);
  } catch (error) {
    console.error("Error joining game:", error);
    return json({ error: "Failed to join game" }, { status: 500 });
  }
}

export default function JoinGame() {
  const { game } = useLoaderData<typeof loader>();
  const actionData = useActionData<typeof action>();
  const navigation = useNavigation();

  const isSubmitting = navigation.state === "submitting";

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto px-4 py-16">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-bold text-gray-800 dark:text-white mb-4">
              Join Game
            </h1>
            <p className="text-gray-600 dark:text-gray-300 mb-2">
              Game Code: <span className="font-mono font-bold text-blue-600 dark:text-blue-400">{game.code}</span>
            </p>
            <p className="text-gray-600 dark:text-gray-300">
              {game.name}
            </p>
          </div>

          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg p-8">
            {/* Game Info */}
            <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-2">Game Information</h3>
              <div className="text-sm text-blue-600 dark:text-blue-400 space-y-1">
                <p>Players: {game.players.length}/{game.maxPlayers}</p>
                <p>Status: {game.isActive ? "Active" : "Inactive"}</p>
                {game.players.length > 0 && (
                  <div>
                    <p className="font-medium">Current players:</p>
                    <ul className="list-disc list-inside ml-4">
                      {game.players.map((player) => (
                        <li key={player.id} className="flex items-center">
                          {player.name}
                          {player.isHost && (
                            <span className="ml-2 text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300 px-2 py-1 rounded">
                              Host
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {game.isActive && game.players.length < game.maxPlayers ? (
              <Form method="post" className="space-y-6">
                <div>
                  <label htmlFor="playerName" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Your Name *
                  </label>
                  <input
                    type="text"
                    id="playerName"
                    name="playerName"
                    required
                    className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent dark:bg-gray-700 dark:text-white"
                    placeholder="Enter your name"
                  />
                </div>

                {actionData?.error && (
                  <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 px-4 py-3 rounded-lg">
                    {actionData.error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white font-semibold py-3 px-6 rounded-lg transition duration-200"
                >
                  {isSubmitting ? "Joining..." : "Join Game"}
                </button>
              </Form>
            ) : (
              <div className="text-center">
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 text-yellow-700 dark:text-yellow-400 px-4 py-3 rounded-lg">
                  {!game.isActive ? "This game is no longer active." : "This game is full."}
                </div>
              </div>
            )}
          </div>

          <div className="text-center mt-6">
            <a
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              ← Back to Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
