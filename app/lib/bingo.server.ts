export function generateBingoBoard(words: string[]): string[][] {
  // Create a 5x5 bingo board
  const board: string[][] = Array(5).fill(null).map(() => Array(5).fill(""));
  
  // Shuffle words and select 24 (excluding center free space)
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  const selectedWords = shuffled.slice(0, 24);
  
  let wordIndex = 0;
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 5; col++) {
      if (row === 2 && col === 2) {
        board[row][col] = "FREE"; // Center space is free
      } else {
        board[row][col] = selectedWords[wordIndex++] || "";
      }
    }
  }
  
  return board;
}

export function generateGameCode(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 6; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export function checkBingo(board: string[][], markedPositions: number[][]): boolean {
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

export const defaultBingoWords = [
  "Coffee", "Book", "Phone", "Car", "Tree", "House", "Dog", "Cat", "Sun", "Moon",
  "Star", "Rain", "Snow", "Fire", "Water", "Music", "Dance", "Sing", "Run", "Jump",
  "Walk", "Smile", "Laugh", "Cry", "Happy", "Sad", "Love", "Peace", "Hope", "Dream",
  "Friend", "Family", "Home", "Work", "Play", "Learn", "Teach", "Help", "Share", "Care",
  "Food", "Pizza", "Burger", "Apple", "Orange", "Cake", "Ice Cream", "Chocolate", "Tea", "Juice",
  "Game", "Sport", "Ball", "Bike", "Beach", "Mountain", "Ocean", "River", "Forest", "Flower",
  "Bird", "Fish", "Horse", "Butterfly", "Rainbow", "Cloud", "Wind", "Thunder", "Light", "Shadow",
  "Red", "Blue", "Green", "Yellow", "Purple", "Pink", "Orange", "Black", "White", "Silver"
];
