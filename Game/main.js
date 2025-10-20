import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { Player } from './game/player.js';
import { createPath } from './game/path.js';
import { Enemy } from './game/enemy.js';
import { LOOT_DEFS, Loot, loadPersistentState, savePersistentState, applyLootToPlayerOrTower, addInventoryEntryFromPickup as addInvFromPickup, reserveInventoryUid as reserveInv, clearReservation as clearInvReservation, removeInventoryByUid, pickRandomLootKey, computeGoldMultiplier } from './game/loot.js';
import { HealerTower, MageTower, ArcherTower, highlightTowerById as towerHighlight, selectTowerById as towerSelect, clearTowerSelection as towerClear } from './game/tower.js';
import { GRID_SIZE, TILE_SIZE, PICKUP_RANGE, GHOST_OPACITY_VALID, GHOST_OPACITY_INVALID, RANGE_INDICATOR_COLOR_VALID, RANGE_INDICATOR_COLOR_INVALID, RANGE_INDICATOR_OPACITY, TOWER_DEFAULTS, TOAST_DURATION_MS, TOWER_COSTS, STARTING_GOLD, ATTACK_RANGE, ATTACK_DAMAGE, ATTACK_COOLDOWN } from './game/constants.js';
import { showToast } from './ui/toast.js';
// consolidated above

// Tower selection
let selectedTowerType = null; // "Healer", "Mage", "Archer"
let towers = []; // store all placed towers
let selectedTowerId = null; // persistent 'focused' tower id
// Ghost preview for tower placement
let ghostMesh = null;
let lastMouse = { x: 0, y: 0 };

document.addEventListener("DOMContentLoaded", () => {
  const healerBtn = document.getElementById("selectHealer");
  const mageBtn = document.getElementById("selectMage");
  const archerBtn = document.getElementById("selectArcher");

  function clearTowerButtonSelection() {
    [healerBtn, mageBtn, archerBtn].forEach(b => { if (b) b.classList.remove('tower-btn-selected'); });
  }

  if (healerBtn) healerBtn.addEventListener("click", () => {
    // toggle selection: clicking again cancels placement
    if (selectedTowerType === 'Healer') {
      selectedTowerType = null;
      clearTowerButtonSelection();
      removeGhost();
    } else {
      selectedTowerType = "Healer";
      clearTowerButtonSelection();
      healerBtn.classList.add('tower-btn-selected');
      createGhost('Healer');
    }
  });

  if (mageBtn) mageBtn.addEventListener("click", () => {
    if (selectedTowerType === 'Mage') {
      selectedTowerType = null;
      clearTowerButtonSelection();
      removeGhost();
    } else {
      selectedTowerType = "Mage";
      clearTowerButtonSelection();
      mageBtn.classList.add('tower-btn-selected');
      createGhost('Mage');
    }
  });

  if (archerBtn) archerBtn.addEventListener("click", () => {
    if (selectedTowerType === 'Archer') {
      selectedTowerType = null;
      clearTowerButtonSelection();
      removeGhost();
    } else {
      selectedTowerType = "Archer";
      clearTowerButtonSelection();
      archerBtn.classList.add('tower-btn-selected');
      createGhost('Archer');
    }
  });
});

// --- Ghost preview helpers ---
function createGhost(type) {
  removeGhost();
  let geom, color;
  let range = 0;
  switch ((type || '').toLowerCase()) {
    case 'healer': geom = new THREE.CylinderGeometry(0.5, 0.5, 1, 12); color = 0x00ff00; break;
    case 'mage': geom = new THREE.ConeGeometry(0.5, 1, 12); color = 0x8000ff; break;
    case 'archer': geom = new THREE.BoxGeometry(0.5, 1, 0.5); color = 0xff0000; break;
    default: return;
  }
  // set range according to tower defaults
  const tkey = (type || '').toLowerCase();
  range = (TOWER_DEFAULTS[tkey] && TOWER_DEFAULTS[tkey].range) ? TOWER_DEFAULTS[tkey].range : 0;
  const mat = new THREE.MeshStandardMaterial({ color: color, transparent: true, opacity: GHOST_OPACITY_VALID, depthWrite: false });
  ghostMesh = new THREE.Mesh(geom, mat);
  ghostMesh.renderOrder = 999;
  ghostMesh.visible = true;
  scene.add(ghostMesh);

  // create a circular range indicator under the ghost
  const ringGeom = new THREE.CircleGeometry(Math.max(0.2, range), 64);
  // rotate to lie flat on ground
  ringGeom.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({ color: RANGE_INDICATOR_COLOR_VALID, transparent: true, opacity: RANGE_INDICATOR_OPACITY, depthWrite: false });
  const rangeMesh = new THREE.Mesh(ringGeom, ringMat);
  rangeMesh.name = 'ghostRange';
  rangeMesh.position.set(0, 0.01, 0);
  ghostMesh.add(rangeMesh);
}

function removeGhost() {
  if (!ghostMesh) return;
  try { scene.remove(ghostMesh); } catch (e) {}
  ghostMesh = null;
}

function isPlacementValid(gridX, gridY) {
  // Bounds check
  if (gridX < 0 || gridY < 0 || gridX >= GRID_SIZE || gridY >= GRID_SIZE) return false;
  // Can't place on path tiles (grid value 1 is path)
  if (grid && grid[gridY] && grid[gridY][gridX] === 1) return false;
  // Can't place where an existing tower occupies
  for (const t of towers) {
    const g = towerWorldToGrid(t);
    if (!g) continue;
    if (g.x === gridX && g.y === gridY) return false;
  }
  return true;
}

function updateGhostFromMouse(clientX, clientY) {
  if (!ghostMesh || !selectedTowerType) return;
  // compute NDC coords
  const ndc = new THREE.Vector2();
  ndc.x = (clientX / window.innerWidth) * 2 - 1;
  ndc.y = -(clientY / window.innerHeight) * 2 + 1;
  raycaster.setFromCamera(ndc, camera);
  const hits = raycaster.intersectObject(ground);
  if (hits.length === 0) {
    ghostMesh.visible = false;
    return;
  }
  const pt = hits[0].point;
  const gx = Math.round(pt.x + GRID_SIZE/2);
  const gy = Math.round(pt.z + GRID_SIZE/2);
  const worldX = (gx - GRID_SIZE/2) + 0.5;
  const worldZ = (gy - GRID_SIZE/2) + 0.5;
  ghostMesh.position.set(worldX, 0.5, worldZ);
  ghostMesh.visible = true;

  // indicate validity by tinting color/emissive
  const valid = isPlacementValid(gx, gy);
  try {
    if (valid) {
      ghostMesh.material.color.setHex(RANGE_INDICATOR_COLOR_VALID);
      ghostMesh.material.opacity = GHOST_OPACITY_VALID;
      // range indicator greenish
      try { const r = ghostMesh.getObjectByName('ghostRange'); if (r) r.material.color.setHex(RANGE_INDICATOR_COLOR_VALID); } catch(e){}
    } else {
      ghostMesh.material.color.setHex(RANGE_INDICATOR_COLOR_INVALID);
      ghostMesh.material.opacity = GHOST_OPACITY_INVALID;
      try { const r = ghostMesh.getObjectByName('ghostRange'); if (r) r.material.color.setHex(RANGE_INDICATOR_COLOR_INVALID); } catch(e){}
    }
  } catch (e) {}
}

// Track last mouse position for animate loop updates
window.addEventListener('mousemove', (ev) => {
  lastMouse.x = ev.clientX;
  lastMouse.y = ev.clientY;
  // update ghost position live when top-down and a ghost exists
  if (selectedTowerType && ghostMesh && usingTopDown) updateGhostFromMouse(ev.clientX, ev.clientY);
});


const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

// Scene
const scene = new THREE.Scene();
// Use a neutral background so the horizon/sky doesn't show when we look straight down
scene.background = new THREE.Color(0x87CEEB);

// Array to store all cloud groups globally
const clouds = [];
const spawnMargin = 20;

// Function to create a single cloud
function createCloud(x, y, z) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.9 });

  // Make spheres
  for (let i = 0; i < 5; i++) {
      const sphere = new THREE.Mesh(new THREE.SphereGeometry(Math.random() * 1.5 + 0.5, 16, 16), mat);
      sphere.position.set(Math.random() * 2 - 1, Math.random() * 0.5, Math.random() * 2 - 1);
      group.add(sphere);
  }
  group.position.set(x, y, z);

  // Add random scale to vary cloud sizes
  const scale = 0.5 + Math.random() * 1.5;
  group.scale.set(scale, scale, scale);

  scene.add(group);
  return group;
}

// Create clouds
for (let i = 0; i < 100; i++) {
    const halfArea = GRID_SIZE / 2 + spawnMargin;
    const x = (Math.random() * 2 - 1) * halfArea;  
    const z = (Math.random() * 2 - 1) * halfArea; 
    const y = 12 + Math.random() ** 1.5 * 20; // Height above ground
    const cloud = createCloud(x, y, z);
    clouds.push(cloud);
}

// Update function to drift clouds
function updateClouds(delta) {
  for (const cloud of clouds) {
      cloud.position.x += delta * 0.2; // Move right slowly
      if (cloud.position.x > GRID_SIZE/2) cloud.position.x = -GRID_SIZE/2;
  }
}

// Camera - orthographic top-down view so the horizon/sky can't be seen
let camera;
function createTopDownCamera() {
  const aspect = window.innerWidth / window.innerHeight;
  // frustumHeight should comfortably fit the whole map
  const frustumHeight = GRID_SIZE + 6; // small margin around the grid
  const frustumWidth = frustumHeight * aspect;

  const left = -frustumWidth / 2;
  const right = frustumWidth / 2;
  const top = frustumHeight / 2;
  const bottom = -frustumHeight / 2;

  camera = new THREE.OrthographicCamera(left, right, top, bottom, 0.1, 500);
  // Place camera high above the scene and look straight down
  camera.position.set(0, 60, 0);
  camera.up.set(0, 0, -1); // orient forward along -Z so positive Z points 'down' on screen
  camera.lookAt(0, 0, 0);
}
createTopDownCamera();

// FIRST-PERSON CAMERA (attached to player)
let fpCamera = null;
let usingTopDown = true; // default to top-down for between-round view

// last time player attack performed (ms since epoch) for cooldown enforcement
let lastAttackAt = 0;

function createFirstPersonCamera() {
  fpCamera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  // initial position will be updated each frame to follow player
  // ensure the camera is part of the scene graph so children attached to it are rendered
  try { scene.add(fpCamera); } catch (e) {}
}
createFirstPersonCamera();
// Camera toggle UI and keyboard + start round + crosshair
let cameraToggleBtn;
let startRoundBtn;
let crosshairEl;
let roundActive = false;
let gameWon = false;
let endlessMode = false;
let paused = false;

function setUsingTopDown(v) {
  // Prevent switching back to top-down during an active round
  if (roundActive && v === true) return;
  usingTopDown = v;
  // hide player model in FP, show in top-down
  if (typeof player !== 'undefined' && player && player.mesh) player.mesh.visible = usingTopDown;
  // show/hide crosshair if element exists
  if (typeof crosshairEl !== 'undefined' && crosshairEl) crosshairEl.style.display = usingTopDown ? 'none' : 'block';
  if (!usingTopDown) {
    // attempt to enter pointer lock for a proper FPS feel (must be user gesture in many browsers)
    try { if (typeof canvas !== 'undefined' && canvas && canvas.requestPointerLock) canvas.requestPointerLock(); } catch (e) {}
  } else {
    // exit pointer lock when returning to top-down
    try { if (typeof document !== 'undefined' && document.exitPointerLock) document.exitPointerLock(); } catch (e) {}
  }
}

// Pointer lock & mouse look state
let pointerLocked = false;
let yaw = 0; // rotation around Y
let pitch = 0; // rotation around X
const pitchLimit = Math.PI / 2 - 0.05;

function onPointerLockChange() {
  pointerLocked = document.pointerLockElement === canvas;
}
document.addEventListener('pointerlockchange', onPointerLockChange);

function onMouseMove(e) {
  if (!pointerLocked) return;
  const sensitivity = 0.0025;
  yaw -= e.movementX * sensitivity;
  pitch -= e.movementY * sensitivity;
  if (pitch > pitchLimit) pitch = pitchLimit;
  if (pitch < -pitchLimit) pitch = -pitchLimit;
}
document.addEventListener('mousemove', onMouseMove);

// Renderer
const canvas = document.getElementById('gameCanvas');
const renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambientLight);

const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
directionalLight.position.set(10, 20, 10);
scene.add(directionalLight);

// Ground
const groundGeometry = new THREE.BoxGeometry(GRID_SIZE, 1, GRID_SIZE);
const groundMaterial = new THREE.MeshStandardMaterial({ color: 0x228B22 });
const ground = new THREE.Mesh(groundGeometry, groundMaterial);
ground.position.y = -0.5; // so top of ground is at y=0
scene.add(ground);

const {pathTiles, tiles, grid, pathCoords} = createPath(scene);


// Use pathCoords directly for enemy movement
// Enemy wave logic
const enemies = [];
const lootInstances = [];
let persistentState = loadPersistentState();
let enemiesRemainingEl = null;
// Castle health
let castleHealth = 10;
let castleHealthEl = null;

function updateEnemiesRemaining() {
  if (typeof enemiesRemainingEl === 'undefined' || enemiesRemainingEl === null) return;
  enemiesRemainingEl.textContent = enemies.length.toString();
}

function updateCastleHealthUI() {
  if (castleHealthEl) castleHealthEl.textContent = castleHealth.toString();
}
// Wave scaling config (tunable)
// Values adjusted to be gentler by default
const WAVE_CONFIG = {
  baseEnemies: 3,
  enemiesPerWave: 0.6, // added per wave (gentler growth)
  baseHealth: 10,
  healthScalePerWave: 1.08, // slower health growth
  baseSpeed: 0.025,
  speedIncreasePerWave: 0.002, // very small speed increases
  baseLootChance: 0.02,
  lootChancePerWave: 0.004,
  maxEnemies: 120,
  maxHealth: 500,
  maxSpeed: 0.12,
  maxLootChance: 0.5,
  // Extra powerup every N waves: chance to spawn one additional carrier on those waves
  extraPowerupEveryN: 5,
  extraPowerupChance: 0.45 // 45% chance on the milestone wave
};

function spawnWave(numEnemies) {
  // numEnemies may be used as a small offset from the computed wave size
  const offset = typeof numEnemies === 'number' ? numEnemies : 0;
  // Compute final enemy count (ensure it increases with waveNumber)
  const approxCount = Math.floor(WAVE_CONFIG.baseEnemies + (waveNumber - 1) * WAVE_CONFIG.enemiesPerWave) + offset;
  const finalCount = Math.max(1, Math.min(WAVE_CONFIG.maxEnemies, approxCount));
  // compute per-enemy stats
  const enemyHealth = Math.min(WAVE_CONFIG.baseHealth * Math.pow(WAVE_CONFIG.healthScalePerWave, Math.max(0, waveNumber - 1)), WAVE_CONFIG.maxHealth);
  const enemySpeed = Math.min(WAVE_CONFIG.baseSpeed + WAVE_CONFIG.speedIncreasePerWave * Math.max(0, waveNumber - 1), WAVE_CONFIG.maxSpeed);
  const lootChance = Math.min(WAVE_CONFIG.baseLootChance + WAVE_CONFIG.lootChancePerWave * Math.max(0, waveNumber - 1), WAVE_CONFIG.maxLootChance);

  // Choose random loot carriers for this wave. Normally one guaranteed carrier.
  const chosenLootKey = pickRandomLootKey();
  const carryIndex = Math.floor(Math.random() * finalCount);
  // On milestone waves (every extraPowerupEveryN), there is a chance to add an extra carrier
  const carryIndices = [carryIndex];
  if (WAVE_CONFIG.extraPowerupEveryN > 0 && waveNumber % WAVE_CONFIG.extraPowerupEveryN === 0) {
    if (Math.random() < WAVE_CONFIG.extraPowerupChance) {
      // pick a different index for the extra carrier
      let extraIdx = Math.floor(Math.random() * finalCount);
      let attempts = 0;
      while (extraIdx === carryIndex && attempts < 12) { extraIdx = Math.floor(Math.random() * finalCount); attempts++; }
      if (extraIdx !== carryIndex) carryIndices.push(extraIdx);
    }
  }

  // set currentWaveTotal so UI progress can use correct denominator
  currentWaveTotal = finalCount;

  for (let i = 0; i < finalCount; i++) {
    const carriesLootId = carryIndices.includes(i) ? chosenLootKey : null;
    const enemy = new Enemy(pathCoords, scene, { carriesLootId, maxHealth: enemyHealth, speed: enemySpeed, lootChance });
    // Stagger spawn by offsetting their starting progress
    enemy.progress = -i * 0.5;
    // If a cave spawn position exists, place enemy inside cave initially
    if (typeof caveSpawnPos !== 'undefined' && caveSpawnPos) {
      enemy.mesh.position.set(caveSpawnPos.x, caveSpawnPos.y, caveSpawnPos.z);
    }
    enemies.push(enemy);
  }
  updateEnemiesRemaining();
}

// Wave progress tracking
let waveNumber = 1;
let currentWaveTotal = 0;
let waveEl = null;
let waveProgressBar = null;

function startWave(numEnemies) {
  if (gameWon) {
    showToast('You have already won the game. Reset to play again.');
    return;
  }
  currentWaveTotal = numEnemies;
  updateWaveUI();
  // pulse the enemies counter to draw attention
  if (enemiesRemainingEl) {
    enemiesRemainingEl.classList.remove('pulse');
    // force reflow to restart animation
    void enemiesRemainingEl.offsetWidth;
    enemiesRemainingEl.classList.add('pulse');
  }
  spawnWave(numEnemies);
}

function updateWaveUI() {
  if (waveEl) waveEl.textContent = waveNumber.toString();
  if (waveProgressBar) {
    const remaining = enemies.length;
    const pct = currentWaveTotal > 0 ? ((currentWaveTotal - remaining) / currentWaveTotal) * 100 : 0;
    waveProgressBar.style.width = pct + '%';
  }
}

// need to add some substance to the map (trees, rocks, castle, etc.)
function addDecorations(scene, grid) {
  const treeGeometry = new THREE.ConeGeometry(2, 5, 12);
  const treeMaterial = new THREE.MeshStandardMaterial({ color: 0x006400 });
  const rockGeometry = new THREE.DodecahedronGeometry(0.8);
  const rockMaterial = new THREE.MeshStandardMaterial({ color: 0x808080 });

  const avoidRadius = 3; // tiles away from path to avoid

  // Collect all path coordinates
  const pathTiles = [];
  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      if (grid[y][x] === 1) {
        pathTiles.push({ x, y });
      }
    }
  }

  // Helper to check if (x, y) is too close to a path tile
  function isNearPath(x, y) {
    for (const tile of pathTiles) {
      const dx = x - tile.x;
      const dy = y - tile.y;
      if (Math.sqrt(dx * dx + dy * dy) <= avoidRadius) {
        return true;
      }
    }
    return false;
  }

  for (let y = 0; y < grid.length; y++) {
    for (let x = 0; x < grid[y].length; x++) {
      // Skip path tiles
      if (grid[y][x] === 1) continue;
      if (isNearPath(x, y)) continue;

      const rand = Math.random();
      if (rand < 0.05) {
        const tree = new THREE.Mesh(treeGeometry, treeMaterial);
        tree.position.set((x - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2, 0.75, (y - GRID_SIZE/2) * TILE_SIZE + TILE_SIZE/2);
        scene.add(tree);
      } else if (rand < 0.08) {
        const rock = new THREE.Mesh(rockGeometry, rockMaterial);
        rock.position.set(x - GRID_SIZE / 2, 0.25, y - GRID_SIZE / 2);
        scene.add(rock);
      }
    }
  }
}
addDecorations(scene, grid);

// Deterministic, gapless mountain ranges on left and right edges
function addMountainRanges(scene) {
  const half = GRID_SIZE / 2;
  const leftX = -half - 1.5;   // place mountains just outside the playable area
  const rightX = half + 1.5;
  const count = GRID_SIZE + 2; // one per tile plus a little extra to cover edges

  const baseHeight = 4;
  const heightRange = 6;
  const baseRadius = 1.5; // large radius to ensure overlap and no gaps

  for (let i = -1; i <= GRID_SIZE; i++) {
    // Deterministic variation using sine so it's the same every run
    const t = i / GRID_SIZE;
    const height = baseHeight + Math.abs(Math.sin(t * Math.PI * 2)) * heightRange;
    const radius = baseRadius + Math.abs(Math.cos(t * Math.PI)) * 0.8;
    const geom = new THREE.ConeGeometry(radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x6b4f3a }); // brownish

    // Position along Z to cover the whole edge continuously
    const z = (i) - (GRID_SIZE - 1) / 2;

    const leftPeak = new THREE.Mesh(geom, mat);
    leftPeak.position.set(leftX, height / 2 - 0.5, z);
    scene.add(leftPeak);

    const rightPeak = new THREE.Mesh(geom.clone(), mat.clone());
    rightPeak.position.set(rightX, height / 2 - 0.5, z);
    scene.add(rightPeak);
  }
}

addMountainRanges(scene);

// Add entrance-side mountain range with a cave opening aligned to the path start
let caveSpawnPos = null;
function addEntranceRangeWithCave(scene, pathCoords) {
  const half = GRID_SIZE / 2;
  const topZ = -half - 1.5; // just outside the playable area

  // Determine cave center from first path tile
  const start = pathCoords[0];
  const caveCenterX = start.x - half; // world x coordinate offset
  const caveZ = start.y - half - 0.5; // slightly outside

  // Create continuous peaks across X but leave a gap around cave
  const caveWidthTiles = 3; // number of tiles to leave open for cave
  for (let x = 0; x < GRID_SIZE; x++) {
    // Skip peaks inside cave area
    if (Math.abs(x - start.x) <= caveWidthTiles) continue;

    const t = x / GRID_SIZE;
    const height = 3 + Math.abs(Math.sin(t * Math.PI * 2)) * 5;
    const radius = 1.5 + Math.abs(Math.cos(t * Math.PI)) * 1.2;
    const geom = new THREE.ConeGeometry(radius, height, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5b4636 });

    const z = topZ + (Math.random() - 0.5) * 0.4; // small jitter
    const worldX = x - half;

    const peak = new THREE.Mesh(geom, mat);
    peak.position.set(worldX, height / 2 - 0.5, z);
    scene.add(peak);
  }

  // Build a simple cave entrance: two pillars and a lintel
  const pillarGeom = new THREE.BoxGeometry(1.4, 3, 1.4);
  const lintelGeom = new THREE.BoxGeometry(caveWidthTiles * 1.2 + 1.4, 1.2, 1.4);
  const caveMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a });

  const leftPillar = new THREE.Mesh(pillarGeom, caveMat);
  const rightPillar = new THREE.Mesh(pillarGeom, caveMat);
  const lintel = new THREE.Mesh(lintelGeom, caveMat);

  const pillarXOffset = (caveWidthTiles / 2) + 0.6;
  leftPillar.position.set(caveCenterX - pillarXOffset, 1.0, caveZ);
  rightPillar.position.set(caveCenterX + pillarXOffset, 1.0, caveZ);
  lintel.position.set(caveCenterX, 2.2, caveZ);

  scene.add(leftPillar);
  scene.add(rightPillar);
  scene.add(lintel);

  // Save cave spawn position slightly behind the lintel so enemies appear inside
  caveSpawnPos = { x: caveCenterX, y: 0.5, z: caveZ - 1.0 };

  // Add a dark interior box so enemies look like they're emerging from darkness
  const interiorWidth = caveWidthTiles * 1.2 + 0.6;
  const interiorHeight = 2.2;
  const interiorDepth = 2.2;
  const darkGeom = new THREE.BoxGeometry(interiorWidth, interiorHeight, interiorDepth);
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
  const darkBox = new THREE.Mesh(darkGeom, darkMat);
  // Position the box slightly inside the cave (behind the lintel)
  darkBox.position.set(caveCenterX, interiorHeight / 2 - 0.5, caveZ - 1.4);
  scene.add(darkBox);
}

addEntranceRangeWithCave(scene, pathCoords);

// Create a group for the castle
const castle = new THREE.Group();

// Main keep (taller)
const keepGeo = new THREE.BoxGeometry(10, 5, 4); // height doubled
const keepMat = new THREE.MeshStandardMaterial({ color: 0x777777 });
const keep = new THREE.Mesh(keepGeo, keepMat);
keep.position.y = 3; // half of new height
castle.add(keep);

// Position castle at end of path
const endTile = pathCoords[pathCoords.length - 1];
castle.position.set(endTile.x - GRID_SIZE / 2, 0, endTile.y - GRID_SIZE / 2);

scene.add(castle);


// Add exit battlement and corner towers aligned to the path end
addExitBattlement(scene, pathCoords);

// Add exit battlement and corner towers aligned to the path end
addExitBattlement(scene, pathCoords);

function addExitBattlement(scene, pathCoords) {
  const half = GRID_SIZE / 2;

  // Determine entrance location from the first path tile so we place the battlement
  // on the opposite side (exit side). This makes the wall consistently opposite the cave.
  const start = pathCoords[0];
  const dx = start.x - half;
  const dy = start.y - half;

  let entranceSide;
  if (Math.abs(dx) > Math.abs(dy)) {
    entranceSide = dx < 0 ? 'left' : 'right';
  } else {
    entranceSide = dy < 0 ? 'top' : 'bottom';
  }

  // Choose the opposite side for the exit battlement
  let targetSide;
  if (entranceSide === 'left') targetSide = 'right';
  else if (entranceSide === 'right') targetSide = 'left';
  else if (entranceSide === 'top') targetSide = 'bottom';
  else targetSide = 'top';

  const wallHeight = 2.2;
  const wallThickness = 1.2;
  const wallLength = GRID_SIZE + 2; // a little extra to cover corners

  const wallMat = new THREE.MeshStandardMaterial({ color: 0x777777 });
  const crenelMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const towerMat = new THREE.MeshStandardMaterial({ color: 0x6b6b6b });

  let wall;

  if (targetSide === 'left' || targetSide === 'right') {
    const isLeft = targetSide === 'left';
    const x = isLeft ? -half - 0.8 : half + 0.8;
    const geom = new THREE.BoxGeometry(wallThickness, wallHeight, wallLength);
    wall = new THREE.Mesh(geom, wallMat);
    wall.position.set(x, wallHeight / 2 - 0.5, 0);
    scene.add(wall);

    // Crenellations along Z
    const crenelW = wallThickness + 0.02;
    const crenelH = 0.8;
    const crenelD = 1.0;
    for (let i = 0; i < GRID_SIZE; i++) {
      const z = i - half + 0.5;
      const cGeom = new THREE.BoxGeometry(crenelW, crenelH, crenelD);
      const c = new THREE.Mesh(cGeom, crenelMat);
      c.position.set(x, wallHeight - 0.5 + crenelH / 2, z);
      scene.add(c);
    }

    // Corner towers at the two ends of the wall
    const towerRadius = 1.2;
    const towerHeight = 4.0;
    const leftTowerZ = -half + 0.5;
    const rightTowerZ = half - 0.5;
    const towerGeom = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
    const towerLeft = new THREE.Mesh(towerGeom, towerMat);
    const towerRight = new THREE.Mesh(towerGeom, towerMat);
    towerLeft.position.set(x, towerHeight / 2 - 0.5, leftTowerZ);
    towerRight.position.set(x, towerHeight / 2 - 0.5, rightTowerZ);
    scene.add(towerLeft);
    scene.add(towerRight);

  } else if (targetSide === 'top' || targetSide === 'bottom') {
    const isTop = targetSide === 'top';
    const z = isTop ? -half - 0.8 : half + 0.8;
    const geom = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
    wall = new THREE.Mesh(geom, wallMat);
    wall.position.set(0, wallHeight / 2 - 0.5, z);
    scene.add(wall);

    // Crenellations along X
    const crenelW = 1.0;
    const crenelH = 0.8;
    const crenelD = wallThickness + 0.02;
    for (let i = 0; i < GRID_SIZE; i++) {
      const x = i - half + 0.5;
      const cGeom = new THREE.BoxGeometry(crenelW, crenelH, crenelD);
      const c = new THREE.Mesh(cGeom, crenelMat);
      c.position.set(x, wallHeight - 0.5 + crenelH / 2, z);
      scene.add(c);
    }

    // Corner towers at the two ends of the wall
    const towerRadius = 1.2;
    const towerHeight = 4.0;
    const leftTowerX = -half + 0.5;
    const rightTowerX = half - 0.5;
    const towerGeom = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
    const towerLeft = new THREE.Mesh(towerGeom, towerMat);
    const towerRight = new THREE.Mesh(towerGeom, towerMat);
    towerLeft.position.set(leftTowerX, towerHeight / 2 - 0.5, z);
    towerRight.position.set(rightTowerX, towerHeight / 2 - 0.5, z);
    scene.add(towerLeft);
    scene.add(towerRight);
  } else {
    // Fallback: bottom
    const z = half + 0.8;
    const geom = new THREE.BoxGeometry(wallLength, wallHeight, wallThickness);
    wall = new THREE.Mesh(geom, wallMat);
    wall.position.set(0, wallHeight / 2 - 0.5, z);
    scene.add(wall);

    // Simple crenellations
    const crenelW = 1.0;
    const crenelH = 0.8;
    const crenelD = wallThickness + 0.02;
    for (let i = 0; i < GRID_SIZE; i++) {
      const x = i - half + 0.5;
      const cGeom = new THREE.BoxGeometry(crenelW, crenelH, crenelD);
      const c = new THREE.Mesh(cGeom, crenelMat);
      c.position.set(x, wallHeight - 0.5 + crenelH / 2, z);
      scene.add(c);
    }

    // Towers
    const towerRadius = 1.2;
    const towerHeight = 4.0;
    const leftTowerX = -half + 0.5;
    const rightTowerX = half - 0.5;
    const towerGeom = new THREE.CylinderGeometry(towerRadius, towerRadius, towerHeight, 16);
    const towerLeft = new THREE.Mesh(towerGeom, towerMat);
    const towerRight = new THREE.Mesh(towerGeom, towerMat);
    towerLeft.position.set(leftTowerX, towerHeight / 2 - 0.5, z);
    towerRight.position.set(rightTowerX, towerHeight / 2 - 0.5, z);
    scene.add(towerLeft);
    scene.add(towerRight);
  }
}

// Visual sun (optional, for seeing it in the sky)
const sunRadius = 10;
const sunGeo = new THREE.SphereGeometry(sunRadius, 100, 100);
const sunMat = new THREE.MeshStandardMaterial({
  color: 0xFFF200,
  emissive: 0xFFFF88,   
  emissiveIntensity: .05
});
const sun = new THREE.Mesh(sunGeo, sunMat);

// Position sun in the sky
const eastX = GRID_SIZE - 1;
const eastZ = Math.floor(GRID_SIZE / 2);
sun.position.set(eastX - GRID_SIZE / 2, 50, eastZ - GRID_SIZE / 2);
scene.add(sun);

// 2️⃣ Directional light to simulate sunlight
const sunLight = new THREE.DirectionalLight(0xFFF2AA, 20); // color, intensity
sunLight.position.copy(sun.position); // light comes from the sun
sunLight.castShadow = true;           // optional: enable shadows
scene.add(sunLight);


// Player
// Compute playable area bounds based on GRID_SIZE and tile placement (ground centered at 0)
const half = GRID_SIZE / 2;
const bounds = {
  minX: -half + 0.5,
  maxX: half - 0.5,
  minZ: -half + 0.5,
  maxZ: half - 0.5,
};

const player = new Player(fpCamera, bounds, ATTACK_DAMAGE);
player.mesh.position.y = 1; // raise above ground
scene.add(player.mesh);
player.enemies = enemies;

// Player movement
const keys = {};
document.addEventListener('keydown', e => keys[e.key] = true);
document.addEventListener('keyup', e => keys[e.key] = false);

// Start menu handling
const startMenu = document.getElementById('startMenu');
const startGameBtn = document.getElementById('startGameBtn');

function resetGameState() {
  // Reset castle, waves, towers, enemies, loot, and persistent upgrades
  // remove any lingering game over overlay
  try {
    const existingOverlay = document.getElementById('gameOverOverlay');
    if (existingOverlay && existingOverlay.parentNode) existingOverlay.parentNode.removeChild(existingOverlay);
  } catch (e) {}
  castleHealth = 10;
  // Clear player's inventory on reset (user requested)
  persistentState = { player: { upgrades: [], inventory: [] }, towers: {} };
  savePersistentState(persistentState);
  // reset gold
  gold = STARTING_GOLD;
  if (goldEl) goldEl.textContent = gold.toString();
  try { refreshTowerButtons(); } catch (e) {}
  // remove enemies and loot from scene
  enemies.forEach(e => { try { scene.remove(e.mesh); } catch (e) {} });
  enemies.length = 0;
  lootInstances.forEach(li => { try { li.dispose(); } catch (e) {} });
  lootInstances.length = 0;
  // remove towers from scene
  towers.forEach(t => { try { if (t.mesh) scene.remove(t.mesh); } catch (e) {} });
  towers.length = 0;
  // reset UI
  waveNumber = 1;
  currentWaveTotal = 0;
  waveProgressBar && (waveProgressBar.style.width = '0%');
  updateEnemiesRemaining();
  updateWaveUI();
  updateCastleHealthUI();
  refreshUpgradesUI();
}

function startGame() {
  // hide start menu and reset state
  if (startMenu) startMenu.style.display = 'none';
  resetGameState();
  roundActive = false;
  setUsingTopDown(true);
}

if (startGameBtn) startGameBtn.addEventListener('click', () => startGame());

// Now that canvas, renderer and player exist, wire up UI elements and events
cameraToggleBtn = document.getElementById('cameraToggle');
startRoundBtn = document.getElementById('startRound');
const endlessCheckbox = document.getElementById('endlessModeCheckbox');
if (endlessCheckbox) {
  endlessMode = !!endlessCheckbox.checked;
  endlessCheckbox.addEventListener('change', (e) => { endlessMode = !!e.target.checked; refreshEndlessIndicator(); });
}
// show/hide endless indicator if present
function refreshEndlessIndicator() {
  const el = document.getElementById('endlessIndicator');
  if (!el) return;
  if (endlessMode) {
    el.style.display = 'inline';
    try {
      // Explicit inline styles to ensure Chrome applies the reddish styling
      el.style.color = '#ff3b30';
      el.style.fontWeight = '800';
      el.style.textShadow = '0 0 6px rgba(255,59,48,0.4)';
    } catch (e) {}
  } else {
    el.style.display = 'none';
  }
}
refreshEndlessIndicator();
crosshairEl = document.getElementById('crosshair');
enemiesRemainingEl = document.getElementById('enemiesRemaining');
// castle health element
castleHealthEl = document.getElementById('castleHealth');
// Assign wave UI refs
waveProgressBar = document.getElementById('waveProgressBar');
waveEl = document.getElementById('wave');
// initialize UI text
updateEnemiesRemaining();
updateWaveUI();
updateCastleHealthUI();

// Gold UI
const goldEl = document.getElementById('gold');
let gold = goldEl ? parseInt(goldEl.textContent || '0', 10) : STARTING_GOLD;
if (!goldEl) {
  // ensure consistent starting value in UI
  try {
    const el = document.createElement('div');
    el.id = 'gold';
    el.style.display = 'none';
    el.textContent = STARTING_GOLD.toString();
    document.body.appendChild(el);
  } catch (e) {}
}

function addGold(amount) {
  // Apply diminishing returns multiplier from Gold Hoard tokens (caps effective multiplier at 2.0)
  try {
    const mult = computeGoldMultiplier(persistentState) || 1;
    const awarded = Math.floor(amount * mult);
    gold += awarded;
  } catch (e) {
    gold += amount;
  }
  if (goldEl) goldEl.textContent = gold.toString();
  try { refreshTowerButtons(); } catch (e) {}
}

function findNearestTowerToPlayer() {
  if (towers.length === 0) return null;
  let best = null;
  let bestDist = Infinity;
  for (const t of towers) {
    const dx = (t.mesh.position.x || 0) - player.mesh.position.x;
    const dz = (t.mesh.position.z || 0) - player.mesh.position.z;
    const d = Math.sqrt(dx*dx + dz*dz);
    if (d < bestDist) { bestDist = d; best = t; }
  }
  return best;
}

function ensureTowerId(tower) {
  if (!tower._id) tower._id = 'tower_' + Math.random().toString(36).slice(2,9);
  if (!persistentState.towers) persistentState.towers = {};
  if (!persistentState.towers[tower._id]) persistentState.towers[tower._id] = [];
  return tower._id;
}

// Active inventory uid for the currently-open loot modal (if any)
let activeModalInventoryUid = null;

// Helper: convert a tower's world position to grid coords for friendly labeling
function towerWorldToGrid(tower) {
  if (!tower || !tower.mesh) return null;
  const gx = Math.round(tower.mesh.position.x + GRID_SIZE/2);
  const gy = Math.round(tower.mesh.position.z + GRID_SIZE/2);
  return { x: gx, y: gy };
}

// Highlight a tower briefly in-world by changing material/emissive and scaling
// Use shared tower helper implementations from `game/tower.js` and keep
// minimal wrappers here to manage selectedTowerId and camera state.
function highlightTowerById(tid) {
  try { towerHighlight(towers, tid); } catch (e) { console.warn('highlightTowerById failed', e); }
}

function selectTowerById(tid) {
  // ensure top-down to view selection and highlight persistently
  setUsingTopDown(true);
  try {
    selectedTowerId = towerSelect(towers, tid, camera) || tid;
  } catch (e) { console.warn('selectTowerById failed', e); selectedTowerId = tid; }
}

function clearTowerSelection() {
  try { towerClear(towers, selectedTowerId); } catch (e) { console.warn('clearTowerSelection failed', e); }
  selectedTowerId = null;
  // revert camera to default top-down position (centered)
  createTopDownCamera();
}

// applyLootToPlayerOrTower moved to game/loot.js and imported above

// UI wiring for upgrades panel and loot modal
const upgradesPanel = document.getElementById('upgradesPanel');
const playerUpgradesList = document.getElementById('playerUpgradesList');
const towerUpgradesList = document.getElementById('towerUpgradesList');
const resetUpgradesBtn = document.getElementById('resetUpgrades');
const lootModal = document.getElementById('lootModal');
const lootModalContent = document.getElementById('lootModalContent');
const lootTowerList = document.getElementById('lootTowerList');
const lootCancelBtn = document.getElementById('lootCancel');
// Inventory UI
const inventoryPanel = document.getElementById('inventoryPanel');
const inventoryListEl = document.getElementById('inventoryList');
const inventoryClearBtn = document.getElementById('inventoryClear');
// Inventory HUD element (compact) - create if missing
let inventoryHud = document.getElementById('inventoryHud');
if (!inventoryHud) {
  inventoryHud = document.createElement('div');
  inventoryHud.id = 'inventoryHud';
  inventoryHud.className = 'inventory-hud';
  inventoryHud.textContent = 'Inventory: 0';
  document.body.appendChild(inventoryHud);
}

// clicking HUD toggles inventory panel visibility (use CSS class)
if (inventoryHud && inventoryPanel) {
  inventoryHud.addEventListener('click', () => {
    try {
      if (inventoryPanel.classList.contains('open')) {
        inventoryPanel.classList.remove('open');
        inventoryPanel.style.display = 'none';
      } else {
        inventoryPanel.classList.add('open');
        inventoryPanel.style.display = 'block';
      }
    } catch (e) {}
  });
}

// Toast helper
// showToast imported from ui/toast.js

function refreshUpgradesUI() {
  const p = persistentState.player || { upgrades: [] };
  // Aggregate player upgrades into counts so they display as 'Name xN' when stacked
  if (p.upgrades && p.upgrades.length > 0) {
    const counts = {};
    for (const u of p.upgrades) counts[u.id] = (counts[u.id] || 0) + 1;
    const parts = Object.keys(counts).map(id => {
      const name = LOOT_DEFS[id] ? LOOT_DEFS[id].name : id;
      const cnt = counts[id];
      return cnt > 1 ? `${name} x${cnt}` : name;
    });
    playerUpgradesList.textContent = parts.join(', ');
  } else playerUpgradesList.textContent = '(none)';

  // towers
  towerUpgradesList.innerHTML = '';
  if (persistentState.towers) {
    for (const tid of Object.keys(persistentState.towers)) {
      const ups = persistentState.towers[tid].map(u => (LOOT_DEFS[u.id] ? LOOT_DEFS[u.id].name : u.id)).join(', ');
      const el = document.createElement('div');
      el.textContent = `${tid}: ${ups}`;
      towerUpgradesList.appendChild(el);
    }
  }

  // Update persistent visible panel (always-on)
  const persistentPlayerEl = document.getElementById('persistentPlayerUpgradesList');
  const persistentTowersEl = document.getElementById('persistentTowersList');
  if (persistentPlayerEl) {
    if (p.upgrades && p.upgrades.length > 0) {
      const counts = {};
      for (const u of p.upgrades) counts[u.id] = (counts[u.id] || 0) + 1;
      const parts = Object.keys(counts).map(id => {
        const name = LOOT_DEFS[id] ? LOOT_DEFS[id].name : id;
        const cnt = counts[id];
        return cnt > 1 ? `${name} x${cnt}` : name;
      });
      // Show upgrades and the effective gold multiplier (if any)
      persistentPlayerEl.textContent = parts.join(', ');
      try {
        const mult = computeGoldMultiplier(persistentState);
        if (mult && mult > 1) {
          const mEl = document.getElementById('goldMultiplierDisplay');
          if (mEl) mEl.textContent = ` (Gold x${mult.toFixed(2)})`;
          else {
            const span = document.createElement('span');
            span.id = 'goldMultiplierDisplay';
            span.style.marginLeft = '8px';
            span.style.fontWeight = 'bold';
            span.textContent = ` (Gold x${mult.toFixed(2)})`;
            persistentPlayerEl.appendChild(span);
          }
        } else {
          const mEl = document.getElementById('goldMultiplierDisplay');
          if (mEl && mEl.parentNode) mEl.parentNode.removeChild(mEl);
        }
      } catch (e) {}
    } else persistentPlayerEl.textContent = '(none)';
  }
  if (persistentTowersEl) {
    persistentTowersEl.innerHTML = '';
    if (persistentState.towers) {
      for (const tid of Object.keys(persistentState.towers)) {
        const ups = persistentState.towers[tid].map(u => (LOOT_DEFS[u.id] ? LOOT_DEFS[u.id].name : u.id)).join(', ');
        const row = document.createElement('div');
        // try to find the live tower instance for friendly labeling
        const live = towers.find(tt => tt._id === tid);
        let label = tid;
        if (live) {
          const pos = towerWorldToGrid(live) || { x: '?', y: '?' };
          label = `${live.constructor.name} (${pos.x},${pos.y}) [${tid}]`;
        } else {
          label = `${tid} (missing)`;
        }
        // content and focus button
        const text = document.createElement('span');
        text.textContent = `${label}: ${ups}`;
        text.style.marginRight = '8px';
        row.appendChild(text);
        const btn = document.createElement('button');
        btn.textContent = (selectedTowerId === tid) ? 'Unfocus' : 'Focus';
        btn.style.marginLeft = '6px';
        btn.addEventListener('click', () => {
          if (selectedTowerId === tid) {
            // currently focused -> unfocus
            clearTowerSelection();
            btn.textContent = 'Focus';
          } else {
            // focus this tower
            // clear previous selection first
            clearTowerSelection();
            selectTowerById(tid);
            highlightTowerById(tid);
            btn.textContent = 'Unfocus';
            // center camera on tower if live
            if (live && camera) {
              camera.position.set(live.mesh.position.x, camera.position.y, live.mesh.position.z + 0.01);
              camera.lookAt(live.mesh.position.x, 0, live.mesh.position.z);
            }
          }
        });
        row.appendChild(btn);
        persistentTowersEl.appendChild(row);
      }
    }
  }

  // refresh inventory panel
  if (inventoryListEl) {
    inventoryListEl.innerHTML = '';
    // normalize inventory entries so each has a uid
    if (persistentState.player && Array.isArray(persistentState.player.inventory)) {
        persistentState.player.inventory = persistentState.player.inventory.map(it => {
          if (!it.uid) return Object.assign({}, it, { uid: `${Date.now()}_${Math.random().toString(36).slice(2,8)}` });
          return it;
        });
        savePersistentState(persistentState);
      }
    const inv = (persistentState.player && persistentState.player.inventory) ? persistentState.player.inventory : [];
    if (inv.length === 0) {
      inventoryListEl.textContent = '(empty)';
    } else {
        inv.forEach((item, idx) => {
        const row = document.createElement('div');
        row.style.marginBottom = '6px';
        const name = document.createElement('span');
        name.textContent = LOOT_DEFS[item.id] ? LOOT_DEFS[item.id].name : item.id;
        name.style.marginRight = '8px';
        row.appendChild(name);
        const btnApply = document.createElement('button');
        btnApply.textContent = 'Apply';
        btnApply.addEventListener('click', () => {
          // open modal but pass the inventory uid so the modal can remove the exact item after apply
          openLootModalForTowerSelection(item.id, { inventoryUid: item.uid });
          showToast(`Select a tower to apply: ${LOOT_DEFS[item.id] ? LOOT_DEFS[item.id].name : item.id}`);
        });
        row.appendChild(btnApply);
        const btnDrop = document.createElement('button');
        btnDrop.textContent = 'Drop';
        btnDrop.style.marginLeft = '6px';
        btnDrop.addEventListener('click', () => {
          // spawn the item at player location
          const pos = { x: player.mesh.position.x, y: player.mesh.position.y, z: player.mesh.position.z };
          const li = new Loot(scene, item.id, pos, null);
          lootInstances.push(li);
          // remove from inventory
          if (persistentState.player && Array.isArray(persistentState.player.inventory)) {
            const inv = persistentState.player.inventory;
            const findIdx = inv.findIndex(it => it.uid === item.uid);
            if (findIdx !== -1) {
              inv.splice(findIdx, 1);
              savePersistentState(persistentState);
              refreshUpgradesUI();
            }
          }
          showToast(`Dropped: ${LOOT_DEFS[item.id] ? LOOT_DEFS[item.id].name : item.id}`);
        });
        row.appendChild(btnDrop);
        inventoryListEl.appendChild(row);
      });
    }
  }

  // update compact HUD count
  try {
    const count = (persistentState.player && Array.isArray(persistentState.player.inventory)) ? persistentState.player.inventory.length : 0;
    inventoryHud.textContent = `Inventory: ${count}`;
  } catch (e) {}
}

// Upgrades open button removed from UI; panel can still be toggled via code if needed

if (resetUpgradesBtn) resetUpgradesBtn.addEventListener('click', () => {
  // clearing upgrades but keep inventory
  const inv = (persistentState && persistentState.player && Array.isArray(persistentState.player.inventory)) ? persistentState.player.inventory : [];
  persistentState = { player: { upgrades: [], inventory: inv }, towers: {} };
  savePersistentState(persistentState);
  // Reset runtime modifiers
  for (const t of towers) t._modifiers = {};
  refreshUpgradesUI();
});

if (lootCancelBtn) lootCancelBtn.addEventListener('click', () => { lootModal.style.display = 'none'; });

function openLootModalForTowerSelection(defId, opts) {
  lootTowerList.innerHTML = '';
  opts = opts || {};
  // clear previous active modal reservation if any
  if (activeModalInventoryUid) {
    clearInvReservation(persistentState, activeModalInventoryUid);
    activeModalInventoryUid = null;
  }
  // show loot title/name at top
  try {
    const title = document.createElement('div');
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.textContent = LOOT_DEFS[defId] ? LOOT_DEFS[defId].name : defId;
    lootTowerList.appendChild(title);
  } catch (e) {}
  // Add Store button so loot can be stored directly from modal if desired
  try {
    const storeBtn = document.createElement('button');
    // If modal was opened from inventory, change label to be clearer
    storeBtn.textContent = (opts && (typeof opts.inventoryUid === 'string' || typeof opts.inventoryIndex === 'number')) ? 'Keep in Inventory' : 'Store';
    storeBtn.style.marginLeft = '8px';
    storeBtn.addEventListener('click', () => {
      // If modal opened from an inventory item, the item is already in inventory.
      // Don't add a duplicate; just close and inform the player.
  if (opts && (typeof opts.inventoryUid === 'string' || typeof opts.inventoryIndex === 'number')) {
        // clear reservation for this uid now that modal is closing without consuming
        if (opts.inventoryUid) clearInvReservation(persistentState, opts.inventoryUid);
        lootModal.style.display = 'none';
        showToast(`Kept in inventory: ${LOOT_DEFS[defId] ? LOOT_DEFS[defId].name : defId}`);
        activeModalInventoryUid = null;
        return;
      }
      // Otherwise (pickup flow), store the item into inventory
      const added = addInvFromPickup(persistentState, defId);
      lootModal.style.display = 'none';
      showToast(`Stored: ${LOOT_DEFS[defId] ? LOOT_DEFS[defId].name : defId}`);
    });
    lootTowerList.appendChild(storeBtn);
  } catch (e) {}
  // Create list of towers with buttons to choose
  towers.forEach((t, idx) => {
    // ensure persistent id present so we can check upgrades
    try { ensureTowerId(t); } catch (e) {}
    const tid = t._id;
    // compute existing count for this defId on this tower
    let existing = 0;
    try {
      if (persistentState.towers && persistentState.towers[tid]) {
        existing = persistentState.towers[tid].filter(u => u && u.id === defId).length;
      }
    } catch (e) { existing = 0; }
    const def = LOOT_DEFS[defId] || {};
    const cap = (typeof def.stackCapPerTower === 'number') ? def.stackCapPerTower : 1;

    const b = document.createElement('button');
    b.textContent = `Apply to ${t.constructor.name} (${existing}/${cap})`;
    // disable if already at cap
    if (existing >= cap) {
      b.disabled = true;
      b.title = `Max ${def.name || defId} reached (${cap})`;
    }
    b.addEventListener('click', () => {
      // apply to this specific tower using centralized function
      const applied = applyLootToPlayerOrTower(persistentState, defId, { player, towers, tower: t, ensureTowerId, findNearestTower: findNearestTowerToPlayer, defaultPlayerBaseDamage: ATTACK_DAMAGE });
      if (!applied) {
        showToast('Cannot apply: upgrade at cap or no valid tower.');
        return;
      }
      // success toast: include friendly tower label when possible
      try {
        const name = LOOT_DEFS[defId] ? LOOT_DEFS[defId].name : defId;
        const pos = towerWorldToGrid(t) || { x: '?', y: '?' };
        showToast(`Applied ${name} to ${t.constructor.name} (${pos.x},${pos.y})`);
      } catch (e) {}
      // If this item was from the player's inventory (opts.inventoryUid defined), remove that specific uid
      if (opts && opts.inventoryUid && persistentState.player && Array.isArray(persistentState.player.inventory)) {
        const removed = removeInventoryByUid(persistentState, opts.inventoryUid);
        if (!removed) {
          console.warn(`Inventory UID ${opts.inventoryUid} not found when applying ${defId}. Inventory unchanged.`);
          showToast('Applied upgrade, but inventory item not found (no deletion).');
        }
        // clear reservation
        if (opts.inventoryUid) clearInvReservation(persistentState, opts.inventoryUid);
        activeModalInventoryUid = null;
      } else {
        // also support removing any stack copy if present (legacy)
        if (persistentState.player && Array.isArray(persistentState.player.inventory)) {
          const invIdx = persistentState.player.inventory.findIndex(it => it.id === defId);
          if (invIdx !== -1) persistentState.player.inventory.splice(invIdx, 1);
        }
      }
      savePersistentState(persistentState);
      lootModal.style.display = 'none';
      refreshUpgradesUI();
    });
    lootTowerList.appendChild(b);
  });
  if (towers.length === 0) {
    lootTowerList.textContent = 'No towers placed yet. Place a tower and return to apply.';
  }
  lootModal.style.display = 'flex';
  // If opened from inventory, mark that inventory uid as reserved to avoid race
  if (opts && opts.inventoryUid) {
    activeModalInventoryUid = opts.inventoryUid;
    reserveInv(persistentState, opts.inventoryUid);
  }
}

function attemptAttack() {
  if (usingTopDown) return; // only allow attacks in first-person
  const now = performance.now();
  if (now - lastAttackAt < ATTACK_COOLDOWN) return; // cooldown
  lastAttackAt = now;

  // find the nearest alive enemy within ATTACK_RANGE
  let nearest = null;
  let nearestDist = Infinity;
  for (let i = 0; i < enemies.length; i++) {
    const e = enemies[i];
    if (!e || !e.mesh) continue;
    if (e.health <= 0) continue;
    const dx = e.mesh.position.x - player.mesh.position.x;
    const dz = e.mesh.position.z - player.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
    if (dist <= ATTACK_RANGE && dist < nearestDist) {
      nearest = { enemy: e, index: i, dist };
      nearestDist = dist;
    }
  }

  if (!nearest) return; // nothing in range

  // Deal damage (use player.baseDamage if persistent upgrade applied)
  const damageToDeal = player.baseDamage || ATTACK_DAMAGE;
  const result = nearest.enemy.takeDamage(damageToDeal);

  // Visual feedback: scale up briefly and flash
  const origScale = nearest.enemy.mesh.scale.clone();
  nearest.enemy.mesh.scale.set(origScale.x * 1.25, origScale.y * 1.25, origScale.z * 1.25);
  const origColor = nearest.enemy.mesh.material.color.getHex();
  nearest.enemy.mesh.material.color.setHex(0xffff66);
  setTimeout(() => {
    if (nearest && nearest.enemy && nearest.enemy.mesh) {
      nearest.enemy.mesh.scale.copy(origScale);
      nearest.enemy.mesh.material.color.setHex(origColor);
    }
  }, 180);

  // If defeated, process rewards and remove enemy
  if (result) {
    const coins = result.coins || 0;
    addGold(coins);
    // If this enemy dropped loot, spawn the pickup (only one per round allowed)
    if (result.loot) {
      const lootId = result.loot.id || null;
      const pos = result.loot.pos || { x: nearest.enemy.mesh.position.x, y: nearest.enemy.mesh.position.y, z: nearest.enemy.mesh.position.z };
      // If lootId is null, pick random from LOOT_DEFS
  const finalLootId = lootId || pickRandomLootKey();
      const li = new Loot(scene, finalLootId, pos, null);
      lootInstances.push(li);
    }
    scene.remove(nearest.enemy.mesh);
    const idx = enemies.indexOf(nearest.enemy);
    if (idx !== -1) enemies.splice(idx, 1);
    updateEnemiesRemaining();
    updateWaveUI();
  }
}

// Mouse and keyboard attack handlers
if (canvas) {
  canvas.addEventListener('mousedown', (e) => {
    if (e.button === 0) {
      // In first-person, perform player's melee swing; in top-down fall back to attemptAttack
      try {
        if (!usingTopDown && typeof player !== 'undefined' && player && typeof player.startSwing === 'function') {
          player.startSwing({ scene, Loot, pickRandomLootKey, addGold, lootInstances, enemies, updateEnemiesRemaining, updateWaveUI });
          return;
        }
      } catch (err) {}
      attemptAttack();
    }
  });
}
document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    attemptAttack();
    e.preventDefault();
  }
});

if (cameraToggleBtn) cameraToggleBtn.addEventListener('click', () => setUsingTopDown(!usingTopDown));
if (startRoundBtn) startRoundBtn.addEventListener('click', () => {
  if (gameWon) {
    showToast('You already won — reset to play again.');
    return;
  }
  if (roundActive) return;
  roundActive = true;
  setUsingTopDown(false);
  startWave(6);
});
// Keyboard shortcut to start round: Enter or R
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key.toLowerCase() === 'r') && !roundActive) {
    if (gameWon) {
      showToast('You already won — reset to play again.');
      return;
    }
    roundActive = true;
    setUsingTopDown(false);
    startWave(6);
  }
});
document.addEventListener('keydown', (e) => { if (e.key.toLowerCase() === 'c') setUsingTopDown(!usingTopDown); });

// Keyboard: Tab toggles pause (prevent default focus change)
document.addEventListener('keydown', (e) => {
  if (e.key === 'Tab') {
    e.preventDefault();
    paused = !paused;
    const pauseOverlay = document.getElementById('pauseOverlay');
    if (paused) {
      if (pauseOverlay) pauseOverlay.style.display = 'flex';
    } else {
      if (pauseOverlay) pauseOverlay.style.display = 'none';
    }
  }
});

// Pause UI wiring
const pauseBtn = document.getElementById('pauseBtn');
const pauseOverlay = document.getElementById('pauseOverlay');
const resumeBtn = document.getElementById('resumeBtn');
const endGameBtn = document.getElementById('endGameBtn');
if (pauseBtn) pauseBtn.addEventListener('click', () => {
  paused = true;
  if (pauseOverlay) pauseOverlay.style.display = 'flex';
});
if (resumeBtn) resumeBtn.addEventListener('click', () => {
  paused = false;
  if (pauseOverlay) pauseOverlay.style.display = 'none';
});
if (endGameBtn) endGameBtn.addEventListener('click', () => {
  paused = false;
  if (pauseOverlay) pauseOverlay.style.display = 'none';
  if (startMenu) startMenu.style.display = 'flex';
  resetGameState();
});

function handlePlayerMovement() {
  // If in first-person, move relative to camera yaw
  if (!usingTopDown && fpCamera) {
    const moveSpeed = player.speed;
    let forward = 0;
    let right = 0;
    if (keys['w'] || keys['ArrowUp']) forward += 1;
    if (keys['s'] || keys['ArrowDown']) forward -= 1;
    if (keys['d'] || keys['ArrowRight']) right += 1;
    if (keys['a'] || keys['ArrowLeft']) right -= 1;

    if (forward !== 0 || right !== 0) {
      // Compute direction in world space from yaw
      const sinY = Math.sin(yaw);
      const cosY = Math.cos(yaw);
      // forward vector (z negative is forward in this world setup)
      const fx = -sinY * forward;
      const fz = -cosY * forward;
      // right vector
      const rx = cosY * right;
      const rz = -sinY * right;

      const dx = (fx + rx) * moveSpeed;
      const dz = (fz + rz) * moveSpeed;
      player.mesh.position.x += dx;
      player.mesh.position.z += dz;
      player.clampPosition();
    }
    return;
  }

  // top-down movement (grid-aligned)
  if (keys['w'] || keys['ArrowUp']) player.move('up');
  if (keys['s'] || keys['ArrowDown']) player.move('down');
  if (keys['a'] || keys['ArrowLeft']) player.move('left');
  if (keys['d'] || keys['ArrowRight']) player.move('right');
}

//Towers
let towersBuiltThisRound = 0;
let towerLimitPerRound = 1;



function buildTower(type, x, y) {
  if (towersBuiltThisRound >= towerLimitPerRound) return; // limit per round
  type = type.toLowerCase(); // normalize

  // Check cost
  const cost = TOWER_COSTS[type] || 0;
  if (typeof gold !== 'number' || gold < cost) {
    showToast(`Not enough gold to build ${type}. Need ${cost}g.`);
    return;
  }

  let tower;
  switch(type) {
    case "healer": tower = new HealerTower(x, y, scene); break;
    case "mage":   tower = new MageTower(x, y, scene); break;
    case "archer": tower = new ArcherTower(x, y, scene); break;
    default: return;
  }

  // Deduct gold and add tower
  gold -= cost;
  if (goldEl) goldEl.textContent = gold.toString();
  towers.push(tower);
  towersBuiltThisRound++;
  showToast(`Built ${type} for ${cost}g`);
  // refresh tower button states
  try { refreshTowerButtons(); } catch (e) {}
  return tower;
}

function getGridCoordsFromClick(mouseX, mouseY) {
  // Use raycasting in THREE.js
  const raycaster = new THREE.Raycaster();
  const mouse = new THREE.Vector2();
  mouse.x = (mouseX / window.innerWidth) * 2 - 1;
  mouse.y = -(mouseY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObject(ground);
  if (intersects.length > 0) {
    const point = intersects[0].point;
    const x = Math.round(point.x + GRID_SIZE/2);
    const y = Math.round(point.z + GRID_SIZE/2);
    buildTower(selectedTowerType, x, y);
    selectedTowerType = null;
  }
  return null;
}

window.addEventListener("click", (event) => {
  if (!selectedTowerType) return; if (towersBuiltThisRound >= towerLimitPerRound) {
    console.log("Tower limit reached for this round");
    return;
  }

  // Convert mouse coordinates to normalized device coordinates (-1 to +1)
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

  raycaster.setFromCamera(mouse, camera);

  // Assuming 'ground' is your THREE.Mesh plane
  const intersects = raycaster.intersectObject(ground);
  if (intersects.length > 0) {
      const point = intersects[0].point;

      // Snap to grid
      const x = Math.round(point.x + GRID_SIZE/2);
      const y = Math.round(point.z + GRID_SIZE/2);

    // Validate placement
    if (!isPlacementValid(x, y)) {
    console.log('Invalid placement at', x, y);
    return;
    }

    // Centralized build (handles cost and UI)
    const placed = buildTower(selectedTowerType, x, y);
  // reset after placing
  selectedTowerType = null;
  // clear selected button state
  const healerBtn = document.getElementById("selectHealer");
  const mageBtn = document.getElementById("selectMage");
  const archerBtn = document.getElementById("selectArcher");
  [healerBtn, mageBtn, archerBtn].forEach(b => { if (b) b.classList.remove('tower-btn-selected'); });
  // remove ghost if present
  removeGhost();
    if (placed) console.log(`${placed.constructor.name} placed at (${x},${y})`);
  }
});


// For swinging sword
const clock = new THREE.Clock();

// Animate
function animate() {
  requestAnimationFrame(animate);

  // If paused, skip game updates but continue rendering so overlays stay visible
  if (paused) {
    const activeCam = usingTopDown ? camera : fpCamera;
    renderer.render(scene, activeCam);
    return;
  }
  handlePlayerMovement();
  const delta = clock.getDelta(); // seconds since last frame
  player.update(delta);
  player.updateHealthBar();
  updateClouds(delta);

  // Check for player death
  if (player.health <= 0 && roundActive) {
    roundActive = false; // stop the round

    // Show game over overlay
    if (!document.getElementById('gameOverOverlay')) {
      const overlay = document.createElement('div');
      overlay.id = 'gameOverOverlay';
      overlay.style.position = 'fixed';
      overlay.style.left = '0';
      overlay.style.top = '0';
      overlay.style.right = '0';
      overlay.style.bottom = '0';
      overlay.style.display = 'flex';
      overlay.style.alignItems = 'center';
      overlay.style.justifyContent = 'center';
      overlay.style.background = 'rgba(0,0,0,0.8)';
      overlay.style.color = 'white';
      overlay.style.fontSize = '28px';
      overlay.style.zIndex = 9999;

      const box = document.createElement('div');
      box.style.textAlign = 'center';
      box.style.padding = '20px';
      box.style.background = '#222';
      box.style.borderRadius = '8px';
      box.textContent = 'Game Over - Player Defeated';

      const btn = document.createElement('button');
      btn.textContent = 'Return to Menu';
      btn.style.marginTop = '12px';
      btn.addEventListener('click', () => {
        try {
          const ov = document.getElementById('gameOverOverlay');
          if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
        } catch (e) {}
        if (startMenu) startMenu.style.display = 'flex';
        resetGameState(); // make sure your reset function also restores player HP
      });

      box.appendChild(btn);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    }
  }

  // Update first-person camera to follow player if active
  if (fpCamera && player) {
    // Apply yaw/pitch to the fpCamera orientation
    const cosY = Math.cos(yaw);
    const sinY = Math.sin(yaw);

    // Place camera slightly in front of the player's head so player geometry is not visible
    const forwardOffset = 0.35; // small forward offset
    const camX = player.mesh.position.x - sinY * forwardOffset;
    const camZ = player.mesh.position.z - cosY * forwardOffset;
    const camY = player.mesh.position.y + 1.2;
    fpCamera.position.set(camX, camY, camZ);

    // Build a quaternion from yaw/pitch and apply to camera
    const quat = new THREE.Quaternion();
    const euler = new THREE.Euler(pitch, yaw, 0, 'YXZ');
    quat.setFromEuler(euler);
    fpCamera.quaternion.copy(quat);
  }
  // Update enemies
  for (let i = enemies.length - 1; i >= 0; i--) {
    const enemy = enemies[i];  // assign the current enemy
    enemy.update(fpCamera);     // update its position & health bar
    enemy.attackPlayer(player); // attack the player if in range


    // Remove enemy if it reached the end -> damage castle
    if (enemies[i].currentStep >= enemies[i].pathCoords.length - 1) {
      // remove visual
      scene.remove(enemies[i].mesh);
      enemies.splice(i, 1);
      // damage castle
      castleHealth = Math.max(0, castleHealth - 1);
      updateCastleHealthUI();
      updateEnemiesRemaining();
      // simple game over check
      if (castleHealth <= 0) {
        // stop the round and show basic game over UI
        roundActive = false;
        // avoid creating multiple overlays
        if (!document.getElementById('gameOverOverlay')) {
          // display a simple overlay with return button
          const overlay = document.createElement('div');
          overlay.id = 'gameOverOverlay';
          overlay.style.position = 'fixed';
          overlay.style.left = '0';
          overlay.style.top = '0';
          overlay.style.right = '0';
          overlay.style.bottom = '0';
          overlay.style.display = 'flex';
          overlay.style.alignItems = 'center';
          overlay.style.justifyContent = 'center';
          overlay.style.background = 'rgba(0,0,0,0.7)';
          overlay.style.color = 'white';
          overlay.style.fontSize = '28px';
          overlay.style.zIndex = 999;
          const box = document.createElement('div');
          box.style.textAlign = 'center';
          box.style.padding = '20px';
          box.style.background = '#222';
          box.style.borderRadius = '8px';
          box.textContent = 'Game Over - Castle Destroyed';
          const btn = document.createElement('button');
          btn.textContent = 'Return to Menu';
          btn.addEventListener('click', () => {
            // remove overlay by querying DOM (more robust)
            try {
              const ov = document.getElementById('gameOverOverlay');
              if (ov && ov.parentNode) ov.parentNode.removeChild(ov);
            } catch (e) {}
            if (startMenu) startMenu.style.display = 'flex';
            resetGameState();
          });
          box.appendChild(btn);
          overlay.appendChild(box);
          document.body.appendChild(overlay);
        }
      }
    }
  }

  // Update loot instances and check for player pickup
  const pickupRange = PICKUP_RANGE;
  for (let i = lootInstances.length - 1; i >= 0; i--) {
    const li = lootInstances[i];
    li.update(0.016); // approx frame delta
    const dx = li.mesh.position.x - player.mesh.position.x;
    const dz = li.mesh.position.z - player.mesh.position.z;
    const dist = Math.sqrt(dx*dx + dz*dz);
    if (dist <= pickupRange) {
      // apply loot or open selection modal for tower-targeted upgrades
      const def = LOOT_DEFS[li.defId];
        if (def) {
        if (def.target === 'tower_individual') {
          // Store the picked item into inventory immediately (so canceling later won't lose it)
          const entry = addInvFromPickup(persistentState, li.defId);
          // Inform the player that the item was stored on pickup
          showToast(`Stored: ${LOOT_DEFS[li.defId] ? LOOT_DEFS[li.defId].name : li.defId}`);
          // open modal to let player choose tower to apply this stored item
          openLootModalForTowerSelection(li.defId, { inventoryUid: entry.uid });
          // remove the pickup visually and from array
          li.dispose();
          lootInstances.splice(i, 1);
        } else if (def.target === 'player') {
          // Apply player-targeted loot immediately (centralized)
          const applied = applyLootToPlayerOrTower(persistentState, li.defId, { player, towers, ensureTowerId, findNearestTower: findNearestTowerToPlayer, defaultPlayerBaseDamage: ATTACK_DAMAGE });
          if (applied) {
            savePersistentState(persistentState);
            try { showToast(`Applied: ${LOOT_DEFS[li.defId] ? LOOT_DEFS[li.defId].name : li.defId}`); } catch (e) {}
          } else {
            try { showToast(`Could not apply: ${LOOT_DEFS[li.defId] ? LOOT_DEFS[li.defId].name : li.defId}`); } catch (e) {}
          }
          // remove pickup visual
          li.dispose();
          lootInstances.splice(i, 1);
          refreshUpgradesUI();
        } else {
          // For other loot, store in inventory for later
          const entry = addInvFromPickup(persistentState, li.defId);
          // notify player
          showToast(`Stored: ${LOOT_DEFS[li.defId] ? LOOT_DEFS[li.defId].name : li.defId}`);
          // remove pickup visual
          li.dispose();
          lootInstances.splice(i, 1);
          refreshUpgradesUI();
        }
      } else {
        // Unknown loot id: store defensively
          addInvFromPickup(persistentState, li.defId);
          // notify player
          showToast(`Stored: ${li.defId}`);
          showToast(`Stored: ${li.defId}`);
          li.dispose();
          lootInstances.splice(i, 1);
          refreshUpgradesUI();
      }
    }
  }

  // If a round is active and there are no more enemies, end the round
  if (roundActive && enemies.length === 0) {
    roundActive = false;
    // advance wave count and reset progress
    waveNumber += 1;
    currentWaveTotal = 0;
    if (waveProgressBar) waveProgressBar.style.width = '0%';
    updateWaveUI();
    setUsingTopDown(true);
    towersBuiltThisRound = 0;
    // Check win condition: beating round 20 (unless Endless Mode is enabled)
    if (waveNumber > 20 && !gameWon && !endlessMode) {
      gameWon = true;
      // show a win overlay similar to game over
      if (!document.getElementById('gameWinOverlay')) {
        const overlay = document.createElement('div');
        overlay.id = 'gameWinOverlay';
        overlay.style.position = 'fixed';
        overlay.style.left = '0';
        overlay.style.top = '0';
        overlay.style.right = '0';
        overlay.style.bottom = '0';
        overlay.style.display = 'flex';
        overlay.style.alignItems = 'center';
        overlay.style.justifyContent = 'center';
        overlay.style.background = 'rgba(0,0,0,0.8)';
        overlay.style.color = 'white';
        overlay.style.fontSize = '32px';
        overlay.style.zIndex = 9999;
        const box = document.createElement('div');
        box.style.textAlign = 'center';
        box.style.padding = '24px';
        box.style.background = '#111';
        box.style.borderRadius = '10px';
        box.textContent = 'Victory! You cleared Round 20.';
        const btn = document.createElement('button');
        btn.textContent = 'Return to Menu';
        btn.style.display = 'block';
        btn.style.margin = '12px auto 0';
        btn.addEventListener('click', () => {
          try { const ov = document.getElementById('gameWinOverlay'); if (ov && ov.parentNode) ov.parentNode.removeChild(ov); } catch (e) {}
          if (startMenu) startMenu.style.display = 'flex';
          resetGameState();
          gameWon = false;
        });
        box.appendChild(btn);
        overlay.appendChild(box);
        document.body.appendChild(overlay);
      }
    }
  }

  // Choose the active camera each frame
  const activeCam = usingTopDown ? camera : fpCamera;
  renderer.render(scene, activeCam);

// Update towers
const currentTime = performance.now() / 1000;

towers.forEach(tower => {
  if (tower instanceof HealerTower) tower.update(player, currentTime);
  else tower.update(enemies, currentTime);
});
// Process any enemies killed by towers during their update pass
for (let i = enemies.length - 1; i >= 0; i--) {
  const e = enemies[i];
  if (!e) continue;
  // If the enemy has a stored death result or marked dead, process removal
  const death = e._deathResult || (e.dead ? e.die && e.die() : null);
  if (death) {
    // Give coins
    const coins = death.coins || 0;
    if (coins) addGold(coins);
    // spawn loot if present and none spawned this round
    if (death.loot) {
      const finalLootId = death.loot.id || pickRandomLootKey();
      const pos = death.loot.pos || { x: e.mesh.position.x, y: e.mesh.position.y, z: e.mesh.position.z };
      const li = new Loot(scene, finalLootId, pos, null);
      lootInstances.push(li);
    }
    // remove visual
    try { scene.remove(e.mesh); } catch (err) {}
    enemies.splice(i, 1);
    updateEnemiesRemaining();
    updateWaveUI();
  }
}
}
animate();

// Handle window resize
window.addEventListener('resize', () => {
  // Recreate the orthographic frustum to match new aspect
  createTopDownCamera();
  // Update perspective camera aspect as well
  if (fpCamera) {
    fpCamera.aspect = window.innerWidth / window.innerHeight;
    fpCamera.updateProjectionMatrix();
  }
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Update UI labels on tower buttons to include cost and disable if unaffordable
function refreshTowerButtons() {
  const healerBtn = document.getElementById('selectHealer');
  const mageBtn = document.getElementById('selectMage');
  const archerBtn = document.getElementById('selectArcher');
  if (healerBtn) {
    healerBtn.textContent = `Healer Tower (${TOWER_COSTS.healer}g)`;
    healerBtn.disabled = gold < TOWER_COSTS.healer;
  }
  if (mageBtn) {
    mageBtn.textContent = `Mage Tower (${TOWER_COSTS.mage}g)`;
    mageBtn.disabled = gold < TOWER_COSTS.mage;
  }
  if (archerBtn) {
    archerBtn.textContent = `Archer Tower (${TOWER_COSTS.archer}g)`;
    archerBtn.disabled = gold < TOWER_COSTS.archer;
  }
}
// initial refresh
refreshTowerButtons();