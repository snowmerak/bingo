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
