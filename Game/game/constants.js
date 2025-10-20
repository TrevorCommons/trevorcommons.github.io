// Centralized game constants
export const GRID_SIZE = 50;
export const TILE_SIZE = 1;

// Pickup / physics
export const PICKUP_RANGE = 1.2;

// Inventory / persistence
export const STORAGE_KEY = '3dgame_persist_v1';

// Toast / UI
export const TOAST_DURATION_MS = 1600;

// Ghost/visuals
export const GHOST_OPACITY_VALID = 0.55;
export const GHOST_OPACITY_INVALID = 0.45;
// Darker green for better visibility and contrast
export const RANGE_INDICATOR_COLOR_VALID = 0x2e8b57;
export const RANGE_INDICATOR_COLOR_INVALID = 0xff8888;
// Increased so the placement range circle is more visible when previewing towers
export const RANGE_INDICATOR_OPACITY = 0.35;

// Tower defaults
export const TOWER_DEFAULTS = {
  healer: { range: 10, color: 0x2e8b57, baseCooldown: 1.0 },
  mage:   { range: 10, color: 0x8000ff, baseCooldown: 1.0 },
  archer: { range: 20, color: 0xff0000, baseCooldown: 1.0 },
};

// Economy: cost to build each tower type (gold)
export const TOWER_COSTS = {
  healer: 30,
  mage: 50,
  archer: 40,
};

// Starting gold for player (default shown in index.html too)
export const STARTING_GOLD = 100;

// Player attack constants
export const ATTACK_RANGE = 1.8; // world units
export const ATTACK_DAMAGE = 3.5; // nerfed slightly from 4
export const ATTACK_COOLDOWN = 600; // ms
