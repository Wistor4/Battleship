const SIZE = 10;
const SHIPS = [4, 3, 3, 2, 2, 2, 1, 1, 1, 1];

let playerBoard;
let enemyBoard;
let playerShips;
let enemyShips;
let gameOver = false;
let playerMoves = 0;
let aiMoves = 0;

const aiState = {
    shots: new Set(),
    targetQueue: [],
    currentHits: [],
    remainingLengths: [],
    thinking: false,
};

const playerBoardContainer = document.getElementById('player-board');
const enemyBoardContainer = document.getElementById('enemy-board');
const logContainer = document.getElementById('log');
const playerMovesLabel = document.getElementById('player-moves');
const aiMovesLabel = document.getElementById('ai-moves');
const playerShipsLabel = document.getElementById('player-ships');
const enemyShipsLabel = document.getElementById('enemy-ships');
const newGameButton = document.getElementById('new-game');

newGameButton.addEventListener('click', startGame);

startGame();

function startGame() {
    playerBoard = createBoard();
    enemyBoard = createBoard();
    playerShips = placeAllShips(playerBoard);
    enemyShips = placeAllShips(enemyBoard);
    gameOver = false;
    playerMoves = 0;
    aiMoves = 0;
    aiState.shots = new Set();
    aiState.targetQueue = [];
    aiState.currentHits = [];
    aiState.remainingLengths = [...SHIPS];
    aiState.thinking = false;

    updateStats();
    logMessage('Новая игра началась. Сначала ваш ход.');
    renderBoards();
}

function createBoard() {
    return Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => '~'));
}

function placeAllShips(board) {
    const ships = [];
    for (const length of SHIPS) {
        const ship = placeShip(board, length);
        ships.push(ship);
    }
    return ships;
}

function placeShip(board, length) {
    while (true) {
        const orientation = Math.random() < 0.5 ? 'H' : 'V';
        const x = getRandomInt(0, orientation === 'H' ? SIZE - length : SIZE - 1);
        const y = getRandomInt(0, orientation === 'V' ? SIZE - length : SIZE - 1);

        if (!canPlace(board, x, y, length, orientation)) {
            continue;
        }

        const cells = [];
        for (let i = 0; i < length; i++) {
            const cx = x + (orientation === 'H' ? i : 0);
            const cy = y + (orientation === 'V' ? i : 0);
            board[cy][cx] = 'S';
            cells.push({ x: cx, y: cy });
        }

        return { cells, hits: 0, length };
    }
}

function canPlace(board, x, y, length, orientation) {
    for (let i = 0; i < length; i++) {
        const cx = x + (orientation === 'H' ? i : 0);
        const cy = y + (orientation === 'V' ? i : 0);

        if (!isInside(cx, cy) || board[cy][cx] !== '~') {
            return false;
        }

        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                const nx = cx + dx;
                const ny = cy + dy;
                if (isInside(nx, ny) && board[ny][nx] !== '~') {
                    return false;
                }
            }
        }
    }
    return true;
}

function renderBoards() {
    renderBoard(playerBoardContainer, playerBoard, false);
    renderBoard(enemyBoardContainer, enemyBoard, true);
}

function renderBoard(container, board, hideShips) {
    container.innerHTML = '';

    const corner = document.createElement('div');
    corner.className = 'coord-cell corner';
    container.appendChild(corner);

    for (let x = 0; x < SIZE; x++) {
        const header = document.createElement('div');
        header.className = 'coord-cell';
        header.textContent = String.fromCharCode(65 + x);
        container.appendChild(header);
    }

    for (let y = 0; y < SIZE; y++) {
        const rowLabel = document.createElement('div');
        rowLabel.className = 'coord-cell';
        rowLabel.textContent = y + 1;
        container.appendChild(rowLabel);

        for (let x = 0; x < SIZE; x++) {
            const cell = document.createElement('button');
            cell.className = 'cell';
            cell.dataset.x = x;
            cell.dataset.y = y;
            const value = board[y][x];

            if (value === 'S' && !hideShips) {
                cell.classList.add('ship');
            }
            if (value === 'X') {
                cell.classList.add('hit');
                cell.textContent = '✕';
            }
            if (value === 'O') {
                cell.classList.add('miss');
                cell.textContent = '•';
            }
            if (value === 'S' && hideShips) {
                cell.classList.add('hidden');
                cell.textContent = '';
            }
            if (hideShips && (value === '~' || value === 'S')) {
                cell.textContent = '';
            }

            if (hideShips) {
                cell.addEventListener('click', onEnemyCellClick);
                if (value === 'X' || value === 'O') {
                    cell.classList.add('disabled');
                    cell.disabled = true;
                }
            } else {
                cell.disabled = true;
            }

            container.appendChild(cell);
        }
    }
}

function onEnemyCellClick(event) {
    if (gameOver || aiState.thinking) {
        return;
    }

    const x = Number(event.currentTarget.dataset.x);
    const y = Number(event.currentTarget.dataset.y);
    if (enemyBoard[y][x] === 'X' || enemyBoard[y][x] === 'O') {
        return;
    }

    playerMoves += 1;
    const result = receiveShot(enemyBoard, enemyShips, x, y);
    updateStats();
    renderBoards();

    logPlayerResult(x, y, result);

    if (checkAllSunk(enemyShips)) {
        winGame('Вы выиграли! Все корабли противника уничтожены.');
        return;
    }

    scheduleAiMove();
}

function scheduleAiMove() {
    aiState.thinking = true;
    logMessage('ИИ думает...');
    setTimeout(aiMove, 1000);
}

function aiMove() {
    if (gameOver) {
        return;
    }

    const { x, y } = chooseAiShot();
    const result = receiveShot(playerBoard, playerShips, x, y);
    aiMoves += 1;
    aiState.shots.add(key(x, y));

    if (result.result === 'hit') {
        aiState.currentHits.push({ x, y });
        enqueueTargets(x, y);
        logMessage(`ИИ попал в ${coordToName(x, y)}!`);
    } else if (result.result === 'sunk') {
        aiState.currentHits.push({ x, y });
        markSunkShipInAiState(result.ship.length);
        logMessage(`ИИ потопил ваш корабль в ${coordToName(x, y)}!`);
    } else {
        logMessage(`ИИ промахнулся в ${coordToName(x, y)}.`);
    }

    updateStats();
    renderBoards();
    aiState.thinking = false;

    if (checkAllSunk(playerShips)) {
        winGame("ИИ выиграл! Ваши корабли уничтожены. ");
    }
}

function chooseAiShot() {
    while (aiState.targetQueue.length > 0) {
        const target = aiState.targetQueue.shift();
        if (!aiState.shots.has(key(target.x, target.y)) && !isCellShot(playerBoard, target.x, target.y)) {
            return target;
        }
    }

    const heat = computeHeatMap();
    let maxWeight = 0;
    const bestCells = [];

    for (let y = 0; y < SIZE; y++) {
        for (let x = 0; x < SIZE; x++) {
            if (isCellShot(playerBoard, x, y)) {
                continue;
            }

            const weight = heat[y][x] + ((x + y) % 2 === 0 ? 0.05 : 0);
            if (weight > maxWeight) {
                maxWeight = weight;
                bestCells.length = 0;
                bestCells.push({ x, y });
            } else if (weight === maxWeight) {
                bestCells.push({ x, y });
            }
        }
    }

    if (bestCells.length === 0) {
        const emptyCells = [];
        for (let y = 0; y < SIZE; y++) {
            for (let x = 0; x < SIZE; x++) {
                if (!isCellShot(playerBoard, x, y)) {
                    emptyCells.push({ x, y });
                }
            }
        }
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
    }

    return bestCells[Math.floor(Math.random() * bestCells.length)];
}

function computeHeatMap() {
    const heat = Array.from({ length: SIZE }, () => Array.from({ length: SIZE }, () => 0));
    const hasActiveHits = aiState.currentHits.length > 0;

    for (const length of aiState.remainingLengths) {
        for (const orientation of ['H', 'V']) {
            for (let y = 0; y < SIZE; y++) {
                for (let x = 0; x < SIZE; x++) {
                    if (!canPlaceShipInHeatMap(x, y, length, orientation, hasActiveHits)) {
                        continue;
                    }

                    for (let i = 0; i < length; i++) {
                        const cx = x + (orientation === 'H' ? i : 0);
                        const cy = y + (orientation === 'V' ? i : 0);
                        heat[cy][cx] += 1;
                    }
                }
            }
        }
    }

    return heat;
}

function canPlaceShipInHeatMap(x, y, length, orientation, requireHits) {
    const coveredHits = [];
    for (let i = 0; i < length; i++) {
        const cx = x + (orientation === 'H' ? i : 0);
        const cy = y + (orientation === 'V' ? i : 0);

        if (!isInside(cx, cy)) {
            return false;
        }

        if (playerBoard[cy][cx] === 'O') {
            return false;
        }

        if (playerBoard[cy][cx] === 'X') {
            coveredHits.push(key(cx, cy));
        }
    }

    if (!requireHits) {
        return true;
    }

    const activeHitKeys = aiState.currentHits.map(cell => key(cell.x, cell.y));
    return activeHitKeys.every((hitKey) => coveredHits.includes(hitKey));
}

function enqueueTargets(x, y) {
    const directions = [
        { dx: 1, dy: 0 },
        { dx: -1, dy: 0 },
        { dx: 0, dy: 1 },
        { dx: 0, dy: -1 },
    ];

    if (aiState.currentHits.length >= 2) {
        const direction = getHitDirection();
        if (direction) {
            const candidates = getDirectionalTargets(direction.dx, direction.dy);
            for (const candidate of candidates) {
                enqueueTarget(candidate.x, candidate.y, true);
            }
            return;
        }
    }

    for (const { dx, dy } of directions) {
        enqueueTarget(x + dx, y + dy);
    }
}

function getHitDirection() {
    const hits = aiState.currentHits;
    if (hits.length < 2) {
        return null;
    }

    const [first, second] = hits;
    const dx = Math.sign(second.x - first.x);
    const dy = Math.sign(second.y - first.y);
    if (dx !== 0 && dy === 0) {
        return { dx, dy };
    }
    if (dy !== 0 && dx === 0) {
        return { dx, dy };
    }
    return null;
}

function getDirectionalTargets(dx, dy) {
    const hits = [...aiState.currentHits];
    hits.sort((a, b) => (a.x + a.y) - (b.x + b.y));

    const first = hits[0];
    const last = hits[hits.length - 1];

    return [
        { x: first.x - dx, y: first.y - dy },
        { x: last.x + dx, y: last.y + dy },
    ];
}

function enqueueTarget(x, y, front = false) {
    if (!isInside(x, y) || isCellShot(playerBoard, x, y)) {
        return;
    }

    const existed = aiState.targetQueue.some((target) => target.x === x && target.y === y);
    if (existed) {
        return;
    }

    if (front) {
        aiState.targetQueue.unshift({ x, y });
    } else {
        aiState.targetQueue.push({ x, y });
    }
}

function receiveShot(board, ships, x, y) {
    const cell = board[y][x];
    if (cell === 'X' || cell === 'O') {
        return { result: 'already' };
    }

    if (cell === 'S') {
        board[y][x] = 'X';
        const ship = ships.find((shipItem) => shipItem.cells.some((point) => point.x === x && point.y === y));
        ship.hits += 1;
        const sunk = ship.hits >= ship.length;
        if (sunk) {
            ship.cells.forEach((point) => {
                board[point.y][point.x] = 'X';
            });
            return { result: 'sunk', ship };
        }
        return { result: 'hit', ship };
    }

    board[y][x] = 'O';
    return { result: 'miss' };
}

function logPlayerResult(x, y, result) {
    const messages = {
        miss: `Вы промахнулись в ${coordToName(x, y)}.`,
        hit: `Вы попали в ${coordToName(x, y)}!`,
        sunk: `Вы потопили корабль противника в ${coordToName(x, y)}!`,
    };

    if (messages[result.result]) {
        logMessage(messages[result.result]);
    }
}

function markSunkShipInAiState(length) {
    const index = aiState.remainingLengths.indexOf(length);
    if (index >= 0) {
        aiState.remainingLengths.splice(index, 1);
    }
    aiState.targetQueue = [];
    aiState.currentHits = [];
}

function checkAllSunk(ships) {
    return ships.every((ship) => ship.hits >= ship.length);
}

function winGame(message) {
    gameOver = true;
    logMessage(message);
    renderBoards();
    if (message.includes('Вы выиграли')) {
        showVictoryOverlay();
    }
}

function showVictoryOverlay() {
    const overlay = document.getElementById('victory-overlay');
    const text = overlay.querySelector('.victory-text');
    overlay.classList.add('show');
    overlay.setAttribute('aria-hidden', 'false');
    text.classList.remove('animate');
    void text.offsetWidth;
    text.classList.add('animate');
    setTimeout(() => {
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
    }, 2200);
}

function updateStats() {
    playerMovesLabel.textContent = String(playerMoves);
    aiMovesLabel.textContent = String(aiMoves);
    playerShipsLabel.textContent = String(SHIPS.length - playerShips.filter((ship) => ship.hits >= ship.length).length);
    enemyShipsLabel.textContent = String(SHIPS.length - enemyShips.filter((ship) => ship.hits >= ship.length).length);
}

function logMessage(text) {
    const entry = document.createElement('div');
    entry.textContent = text;
    logContainer.prepend(entry);
}

function isInside(x, y) {
    return x >= 0 && x < SIZE && y >= 0 && y < SIZE;
}

function isCellShot(board, x, y) {
    const value = board[y][x];
    return value === 'X' || value === 'O';
}

function coordToName(x, y) {
    return `${String.fromCharCode(65 + x)}${y + 1}`;
}

function key(x, y) {
    return `${x},${y}`;
}

function getRandomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}
