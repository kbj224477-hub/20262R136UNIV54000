const canvas = document.querySelector("#game");
const ctx = canvas.getContext("2d");

const scoreElement = document.querySelector("#score");
const bestElement = document.querySelector("#best-score");
const overlay = document.querySelector("#overlay");
const statusLabel = document.querySelector("#status-label");
const statusTitle = document.querySelector("#status-title");
const statusCopy = document.querySelector("#status-copy");
const buttonLabel = document.querySelector("#button-label");
const startButton = document.querySelector("#start-button");
const pauseBadge = document.querySelector("#pause-badge");

const WIDTH = canvas.width;
const HEIGHT = canvas.height;
const keys = { left: false, right: false };
const state = {
  running: false,
  paused: false,
  score: 0,
  best: Number(localStorage.getItem("neon-drift-best") || 0),
  elapsed: 0,
  lastTime: 0,
  spawnTimer: 0,
  coreTimer: 0,
  shake: 0,
};

const player = {
  x: WIDTH / 2,
  y: HEIGHT - 75,
  width: 38,
  height: 48,
  speed: 410,
};

let obstacles = [];
let cores = [];
let particles = [];
let stars = [];

function createStars() {
  stars = Array.from({ length: 95 }, () => ({
    x: Math.random() * WIDTH,
    y: Math.random() * HEIGHT,
    size: Math.random() * 1.8 + 0.25,
    speed: Math.random() * 48 + 18,
    alpha: Math.random() * 0.7 + 0.2,
  }));
}

function resetGame() {
  player.x = WIDTH / 2;
  obstacles = [];
  cores = [];
  particles = [];
  state.score = 0;
  state.elapsed = 0;
  state.spawnTimer = 0;
  state.coreTimer = 0;
  state.shake = 0;
  updateScore();
}

function startGame() {
  resetGame();
  state.running = true;
  state.paused = false;
  state.lastTime = performance.now();
  overlay.classList.remove("is-visible");
  pauseBadge.classList.remove("is-visible");
  requestAnimationFrame(gameLoop);
}

function endGame() {
  state.running = false;
  state.best = Math.max(state.best, Math.floor(state.score));
  localStorage.setItem("neon-drift-best", state.best);
  updateScore();
  statusLabel.textContent = "비행 종료";
  statusTitle.innerHTML = `${String(Math.floor(state.score)).padStart(4, "0")}점 기록`; 
  statusCopy.textContent = "충돌했습니다. 항로를 다시 계산하고 최고 기록에 도전하세요.";
  buttonLabel.textContent = "다시 도전";
  overlay.classList.add("is-visible");
}

function togglePause() {
  if (!state.running) return;
  state.paused = !state.paused;
  pauseBadge.classList.toggle("is-visible", state.paused);
  if (!state.paused) {
    state.lastTime = performance.now();
    requestAnimationFrame(gameLoop);
  }
}

function spawnObstacle() {
  const radius = Math.random() * 18 + 14;
  obstacles.push({
    x: Math.random() * (WIDTH - radius * 2) + radius,
    y: -radius - 12,
    radius,
    speed: 190 + state.elapsed * 4.5 + Math.random() * 75,
    rotation: Math.random() * Math.PI,
    spin: (Math.random() - 0.5) * 2,
    points: Array.from({ length: 8 }, () => 0.78 + Math.random() * 0.28),
  });
}

function spawnCore() {
  cores.push({
    x: Math.random() * (WIDTH - 80) + 40,
    y: -20,
    radius: 10,
    speed: 175 + Math.random() * 35,
    pulse: Math.random() * Math.PI * 2,
  });
}

function burst(x, y, color, amount = 12) {
  for (let index = 0; index < amount; index += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = Math.random() * 130 + 35;
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      size: Math.random() * 3 + 1,
      color,
    });
  }
}

function update(delta) {
  state.elapsed += delta;
  state.score += delta * 10;
  state.spawnTimer -= delta;
  state.coreTimer -= delta;
  state.shake = Math.max(0, state.shake - delta * 25);

  if (state.spawnTimer <= 0) {
    spawnObstacle();
    state.spawnTimer = Math.max(0.28, 0.82 - state.elapsed * 0.009) * (0.75 + Math.random() * 0.45);
  }

  if (state.coreTimer <= 0) {
    spawnCore();
    state.coreTimer = 2.4 + Math.random() * 2.2;
  }

  const direction = Number(keys.right) - Number(keys.left);
  player.x += direction * player.speed * delta;
  player.x = Math.max(player.width / 2 + 8, Math.min(WIDTH - player.width / 2 - 8, player.x));

  stars.forEach((star) => {
    star.y += star.speed * delta * (1 + Math.min(state.elapsed / 50, 1.4));
    if (star.y > HEIGHT) {
      star.y = -4;
      star.x = Math.random() * WIDTH;
    }
  });

  obstacles.forEach((obstacle) => {
    obstacle.y += obstacle.speed * delta;
    obstacle.rotation += obstacle.spin * delta;
  });

  cores.forEach((core) => {
    core.y += core.speed * delta;
    core.pulse += delta * 5;
  });

  particles.forEach((particle) => {
    particle.x += particle.vx * delta;
    particle.y += particle.vy * delta;
    particle.vx *= 0.985;
    particle.vy *= 0.985;
    particle.life -= delta * 1.7;
  });

  particles = particles.filter((particle) => particle.life > 0);
  obstacles = obstacles.filter((obstacle) => obstacle.y < HEIGHT + obstacle.radius + 20);
  cores = cores.filter((core) => core.y < HEIGHT + 30);

  const playerHitbox = {
    x: player.x - player.width * 0.28,
    y: player.y - player.height * 0.32,
    width: player.width * 0.56,
    height: player.height * 0.65,
  };

  for (const obstacle of obstacles) {
    const closestX = Math.max(playerHitbox.x, Math.min(obstacle.x, playerHitbox.x + playerHitbox.width));
    const closestY = Math.max(playerHitbox.y, Math.min(obstacle.y, playerHitbox.y + playerHitbox.height));
    const dx = obstacle.x - closestX;
    const dy = obstacle.y - closestY;
    if (dx * dx + dy * dy < obstacle.radius * obstacle.radius * 0.72) {
      burst(player.x, player.y, "#ff5eaa", 34);
      state.shake = 12;
      endGame();
      return;
    }
  }

  cores = cores.filter((core) => {
    const dx = core.x - player.x;
    const dy = core.y - player.y;
    if (Math.hypot(dx, dy) < core.radius + player.width * 0.45) {
      state.score += 100;
      burst(core.x, core.y, "#71f6e8", 16);
      return false;
    }
    return true;
  });

  updateScore();
}

function updateScore() {
  scoreElement.textContent = String(Math.floor(state.score)).padStart(4, "0");
  bestElement.textContent = String(Math.floor(state.best)).padStart(4, "0");
}

function drawBackground() {
  const gradient = ctx.createLinearGradient(0, 0, 0, HEIGHT);
  gradient.addColorStop(0, "#0d102a");
  gradient.addColorStop(1, "#070918");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  ctx.save();
  ctx.strokeStyle = "rgba(113, 246, 232, 0.06)";
  ctx.lineWidth = 1;
  const horizon = HEIGHT * 0.3;
  for (let y = horizon; y < HEIGHT; y += 38) {
    const perspective = (y - horizon) / (HEIGHT - horizon);
    ctx.globalAlpha = perspective * 0.9;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(WIDTH, y);
    ctx.stroke();
  }
  for (let x = -WIDTH; x < WIDTH * 2; x += 110) {
    ctx.globalAlpha = 0.45;
    ctx.beginPath();
    ctx.moveTo(WIDTH / 2, horizon);
    ctx.lineTo(x, HEIGHT);
    ctx.stroke();
  }
  ctx.restore();

  stars.forEach((star) => {
    ctx.globalAlpha = star.alpha;
    ctx.fillStyle = "#d9fefa";
    ctx.fillRect(star.x, star.y, star.size, star.size * 2.3);
  });
  ctx.globalAlpha = 1;
}

function drawPlayer() {
  ctx.save();
  ctx.translate(player.x, player.y);

  const flameLength = 14 + Math.random() * 10;
  const flame = ctx.createLinearGradient(0, 16, 0, 16 + flameLength);
  flame.addColorStop(0, "#ffffff");
  flame.addColorStop(0.25, "#71f6e8");
  flame.addColorStop(1, "rgba(139, 124, 255, 0)");
  ctx.fillStyle = flame;
  ctx.beginPath();
  ctx.moveTo(-7, 15);
  ctx.lineTo(0, 16 + flameLength);
  ctx.lineTo(7, 15);
  ctx.closePath();
  ctx.fill();

  ctx.shadowColor = "#71f6e8";
  ctx.shadowBlur = 22;
  ctx.fillStyle = "#dffefb";
  ctx.beginPath();
  ctx.moveTo(0, -player.height / 2);
  ctx.lineTo(player.width / 2, player.height / 2);
  ctx.lineTo(0, player.height * 0.28);
  ctx.lineTo(-player.width / 2, player.height / 2);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = "#5749b8";
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.lineTo(7, 8);
  ctx.lineTo(0, 4);
  ctx.lineTo(-7, 8);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawObstacle(obstacle) {
  ctx.save();
  ctx.translate(obstacle.x, obstacle.y);
  ctx.rotate(obstacle.rotation);
  const gradient = ctx.createRadialGradient(-7, -8, 2, 0, 0, obstacle.radius);
  gradient.addColorStop(0, "#787291");
  gradient.addColorStop(0.35, "#37354d");
  gradient.addColorStop(1, "#181827");
  ctx.fillStyle = gradient;
  ctx.strokeStyle = "rgba(255, 94, 170, 0.42)";
  ctx.lineWidth = 2;
  ctx.beginPath();
  obstacle.points.forEach((point, index) => {
    const angle = (index / obstacle.points.length) * Math.PI * 2;
    const radius = obstacle.radius * point;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (index === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawCore(core) {
  ctx.save();
  ctx.translate(core.x, core.y);
  const scale = 1 + Math.sin(core.pulse) * 0.12;
  ctx.scale(scale, scale);
  ctx.shadowColor = "#71f6e8";
  ctx.shadowBlur = 22;
  ctx.strokeStyle = "#71f6e8";
  ctx.lineWidth = 3;
  ctx.rotate(core.pulse * 0.2);
  ctx.strokeRect(-core.radius, -core.radius, core.radius * 2, core.radius * 2);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(-3, -3, 6, 6);
  ctx.restore();
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.fillStyle = particle.color;
    ctx.fillRect(particle.x, particle.y, particle.size, particle.size);
  });
  ctx.globalAlpha = 1;
}

function draw() {
  ctx.save();
  if (state.shake > 0) {
    ctx.translate((Math.random() - 0.5) * state.shake, (Math.random() - 0.5) * state.shake);
  }
  drawBackground();
  cores.forEach(drawCore);
  obstacles.forEach(drawObstacle);
  drawParticles();
  drawPlayer();
  ctx.restore();
}

function gameLoop(time) {
  if (!state.running || state.paused) return;
  const delta = Math.min((time - state.lastTime) / 1000, 0.04);
  state.lastTime = time;
  update(delta);
  draw();
  if (state.running) requestAnimationFrame(gameLoop);
}

function setMovement(key, active) {
  keys[key] = active;
}

function bindHoldButton(selector, key) {
  const button = document.querySelector(selector);
  ["pointerdown", "pointerenter"].forEach((eventName) => {
    button.addEventListener(eventName, (event) => {
      if (eventName === "pointerenter" && event.buttons !== 1) return;
      event.preventDefault();
      setMovement(key, true);
    });
  });
  ["pointerup", "pointercancel", "pointerleave"].forEach((eventName) => {
    button.addEventListener(eventName, () => setMovement(key, false));
  });
}

window.addEventListener("keydown", (event) => {
  if (["ArrowLeft", "ArrowRight", "Space"].includes(event.code)) event.preventDefault();
  if (["ArrowLeft", "KeyA"].includes(event.code)) keys.left = true;
  if (["ArrowRight", "KeyD"].includes(event.code)) keys.right = true;
  if (event.code === "Space" && !event.repeat) togglePause();
});

window.addEventListener("keyup", (event) => {
  if (["ArrowLeft", "KeyA"].includes(event.code)) keys.left = false;
  if (["ArrowRight", "KeyD"].includes(event.code)) keys.right = false;
});

window.addEventListener("blur", () => {
  keys.left = false;
  keys.right = false;
  if (state.running && !state.paused) togglePause();
});

startButton.addEventListener("click", startGame);
document.querySelector("#pause-button").addEventListener("click", togglePause);
bindHoldButton("#move-left", "left");
bindHoldButton("#move-right", "right");

createStars();
updateScore();
draw();
