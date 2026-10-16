const SIZE = 4;
const WIN_VALUE = 2048;

const boardElement = document.querySelector("#game-board");
const tileLayer = document.querySelector("#tile-layer");
const scoreElement = document.querySelector("#score");
const bestScoreElement = document.querySelector("#best-score");
const scoreAddElement = document.querySelector("#score-add");
const moveCountElement = document.querySelector("#move-count");
const nextTargetElement = document.querySelector("#next-target");
const progressLabelElement = document.querySelector("#progress-label");
const undoButton = document.querySelector("#undo-button");
const messageElement = document.querySelector("#game-message");
const messageTagElement = document.querySelector("#message-tag");
const messageTitleElement = document.querySelector("#message-title");
const messageCopyElement = document.querySelector("#message-copy");

let board = createEmptyBoard();
let score = 0;
let moves = 0;
let bestScore = Number(localStorage.getItem("classic-2048-best") || 0);
let previousState = null;
let keepPlaying = false;
let touchStart = null;
let mergedCells = new Set();

function createEmptyBoard() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
}

function cloneBoard(source) {
  return source.map((row) => [...row]);
}

function getEmptyCells() {
  const cells = [];
  board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (value === 0) cells.push({ row: rowIndex, column: columnIndex });
    });
  });
  return cells;
}

function addRandomTile() {
  const emptyCells = getEmptyCells();
  if (!emptyCells.length) return;
  const cell = emptyCells[Math.floor(Math.random() * emptyCells.length)];
  board[cell.row][cell.column] = Math.random() < 0.9 ? 2 : 4;
}

function startNewGame() {
  board = createEmptyBoard();
  score = 0;
  moves = 0;
  previousState = null;
  keepPlaying = false;
  mergedCells = new Set();
  addRandomTile();
  addRandomTile();
  hideMessage();
  render();
  boardElement.focus({ preventScroll: true });
}

function compressLine(line) {
  const compact = line.filter(Boolean);
  const result = [];
  let gained = 0;
  const mergedIndexes = [];

  for (let index = 0; index < compact.length; index += 1) {
    if (compact[index] === compact[index + 1]) {
      const mergedValue = compact[index] * 2;
      result.push(mergedValue);
      gained += mergedValue;
      mergedIndexes.push(result.length - 1);
      index += 1;
    } else {
      result.push(compact[index]);
    }
  }

  while (result.length < SIZE) result.push(0);
  return { line: result, gained, mergedIndexes };
}

function getLine(index, direction) {
  if (direction === "left") return [...board[index]];
  if (direction === "right") return [...board[index]].reverse();
  if (direction === "up") return board.map((row) => row[index]);
  return board.map((row) => row[index]).reverse();
}

function setLine(index, direction, line) {
  const values = direction === "right" || direction === "down" ? [...line].reverse() : line;
  if (direction === "left" || direction === "right") {
    board[index] = values;
  } else {
    values.forEach((value, rowIndex) => {
      board[rowIndex][index] = value;
    });
  }
}

function mergedCoordinate(lineIndex, itemIndex, direction) {
  if (direction === "left") return `${lineIndex}-${itemIndex}`;
  if (direction === "right") return `${lineIndex}-${SIZE - 1 - itemIndex}`;
  if (direction === "up") return `${itemIndex}-${lineIndex}`;
  return `${SIZE - 1 - itemIndex}-${lineIndex}`;
}

function boardsAreEqual(first, second) {
  return first.every((row, rowIndex) => row.every((value, columnIndex) => value === second[rowIndex][columnIndex]));
}

function move(direction) {
  if (messageElement.classList.contains("is-visible")) return;

  const before = cloneBoard(board);
  const scoreBefore = score;
  let gainedThisMove = 0;
  mergedCells = new Set();

  for (let index = 0; index < SIZE; index += 1) {
    const { line, gained, mergedIndexes } = compressLine(getLine(index, direction));
    setLine(index, direction, line);
    gainedThisMove += gained;
    mergedIndexes.forEach((itemIndex) => mergedCells.add(mergedCoordinate(index, itemIndex, direction)));
  }

  if (boardsAreEqual(before, board)) return;

  previousState = { board: before, score: scoreBefore, moves };
  score += gainedThisMove;
  moves += 1;
  addRandomTile();
  bestScore = Math.max(bestScore, score);
  localStorage.setItem("classic-2048-best", String(bestScore));
  render(gainedThisMove);
  evaluateGame();
}

function undoMove() {
  if (!previousState) return;
  board = cloneBoard(previousState.board);
  score = previousState.score;
  moves = previousState.moves;
  previousState = null;
  mergedCells = new Set();
  hideMessage();
  render();
  boardElement.focus({ preventScroll: true });
}

function hasAvailableMove() {
  if (getEmptyCells().length) return true;
  for (let row = 0; row < SIZE; row += 1) {
    for (let column = 0; column < SIZE; column += 1) {
      const value = board[row][column];
      if (column < SIZE - 1 && value === board[row][column + 1]) return true;
      if (row < SIZE - 1 && value === board[row + 1][column]) return true;
    }
  }
  return false;
}

function evaluateGame() {
  const won = board.some((row) => row.some((value) => value >= WIN_VALUE));
  if (won && !keepPlaying) {
    showMessage({ type: "win", tag: "목표 달성", title: "2048!", copy: "완벽합니다. 계속해서 더 큰 숫자에 도전할 수도 있어요." });
  } else if (!hasAvailableMove()) {
    showMessage({ type: "over", tag: "게임 종료", title: "한 번 더?", copy: `총 ${moves}번 움직여 ${score.toLocaleString("ko-KR")}점을 기록했습니다.` });
  }
}

function showMessage({ type, tag, title, copy }) {
  messageElement.classList.toggle("is-win", type === "win");
  messageElement.classList.add("is-visible");
  messageTagElement.textContent = tag;
  messageTitleElement.textContent = title;
  messageCopyElement.textContent = copy;
  document.querySelector(type === "win" ? "#continue-button" : "#retry-button").focus();
}

function hideMessage() {
  messageElement.classList.remove("is-visible", "is-win");
}

function continueGame() {
  keepPlaying = true;
  hideMessage();
  boardElement.focus({ preventScroll: true });
}

function getNextTarget() {
  const highest = Math.max(...board.flat());
  if (highest >= WIN_VALUE) {
    progressLabelElement.textContent = "최고 타일";
    return highest;
  }
  progressLabelElement.textContent = "다음 목표";
  return Math.max(128, 2 ** Math.ceil(Math.log2(Math.max(highest + 1, 2))));
}

function render(scoreGain = 0) {
  tileLayer.innerHTML = "";
  board.forEach((row, rowIndex) => {
    row.forEach((value, columnIndex) => {
      if (!value) return;
      const tile = document.createElement("div");
      tile.className = "tile";
      if (mergedCells.has(`${rowIndex}-${columnIndex}`)) tile.classList.add("is-merged");
      tile.dataset.value = String(value);
      if (value > WIN_VALUE) tile.dataset.large = "true";
      tile.style.setProperty("--row", rowIndex);
      tile.style.setProperty("--column", columnIndex);
      tile.textContent = value;
      tile.setAttribute("aria-label", `${rowIndex + 1}행 ${columnIndex + 1}열, ${value}`);
      tileLayer.appendChild(tile);
    });
  });

  scoreElement.textContent = score.toLocaleString("ko-KR");
  bestScoreElement.textContent = bestScore.toLocaleString("ko-KR");
  moveCountElement.textContent = moves.toLocaleString("ko-KR");
  nextTargetElement.textContent = getNextTarget().toLocaleString("ko-KR");
  undoButton.disabled = previousState === null;

  if (scoreGain > 0) {
    scoreAddElement.textContent = `+${scoreGain}`;
    scoreAddElement.classList.remove("pop");
    void scoreAddElement.offsetWidth;
    scoreAddElement.classList.add("pop");
  }
}

function directionFromKey(key) {
  return {
    ArrowLeft: "left", a: "left", A: "left",
    ArrowRight: "right", d: "right", D: "right",
    ArrowUp: "up", w: "up", W: "up",
    ArrowDown: "down", s: "down", S: "down",
  }[key];
}

window.addEventListener("keydown", (event) => {
  const direction = directionFromKey(event.key);
  if (!direction) return;
  event.preventDefault();
  move(direction);
});

boardElement.addEventListener("pointerdown", (event) => {
  touchStart = { x: event.clientX, y: event.clientY };
  boardElement.setPointerCapture(event.pointerId);
});

boardElement.addEventListener("pointerup", (event) => {
  if (!touchStart) return;
  const deltaX = event.clientX - touchStart.x;
  const deltaY = event.clientY - touchStart.y;
  touchStart = null;
  if (Math.max(Math.abs(deltaX), Math.abs(deltaY)) < 28) return;
  if (Math.abs(deltaX) > Math.abs(deltaY)) move(deltaX > 0 ? "right" : "left");
  else move(deltaY > 0 ? "down" : "up");
});

boardElement.addEventListener("pointercancel", () => { touchStart = null; });
document.querySelector("#new-game-button").addEventListener("click", startNewGame);
document.querySelector("#retry-button").addEventListener("click", startNewGame);
document.querySelector("#continue-button").addEventListener("click", continueGame);
undoButton.addEventListener("click", undoMove);

bestScoreElement.textContent = bestScore.toLocaleString("ko-KR");
startNewGame();
