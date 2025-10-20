import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { STORAGE_KEY } from './constants.js';

export const LOOT_DEFS = {
  powercore_module: {
    id: 'powercore_module',
    name: 'Powercore Module',
    description: '+12% tower damage (applies to 1 tower permanently).',
    target: 'tower_individual',
    effect: { type: 'mul_damage', value: 1.12 },
    stackCapPerTower: 3,
    rarity: 'uncommon',
    persistent: true,
  },
  overclock_chip: {
    id: 'overclock_chip',
    name: 'Overclock Chip',
    description: '+30% fire rate for one tower (permanent, single).',
    target: 'tower_individual',
    effect: { type: 'mul_fireRate', value: 1.30 },
    stackCapPerTower: 1,
    rarity: 'rare',
    persistent: true,
  },
  sharpened_blade: {
    id: 'sharpened_blade',
    name: 'Sharpened Blade',
    description: '+18% player melee damage (permanent).',
    target: 'player',
    effect: { type: 'mul_playerDamage', value: 1.18 },
    stackCapPlayer: 2,
    rarity: 'uncommon',
    // weight is used for weighted random selection; lower weight -> rarer
    weight: 0.8,
    persistent: true,
  },
  gold_hoard: {
    id: 'gold_hoard',
    name: 'Gold Hoard Token',
    description: '+20% gold from kills (permanent, diminishing returns).',
    target: 'player',
    effect: { type: 'add_goldPercent', value: 0.20 },
    rarity: 'uncommon',
    // Allow stacking in persistent state; diminishing returns will be applied when computing multiplier.
    // No tight per-item cap here; the effective bonus is computed with diminishing returns and capped at +100%.
    stackCapPlayer: 999,
    persistent: true,
  }
};

// Compute effective gold multiplier from persistent state player's goldBonus.
// Uses a diminishing-returns curve and caps effective multiplier at 2.0 (i.e. +100% max).
// Formula used: effectiveBonus = goldBonus / (1 + 0.5 * goldBonus)
// multiplier = 1 + Math.min(effectiveBonus, maxBonus)
export function computeGoldMultiplier(persistentState) {
  const maxBonus = 1.0; // +100% -> multiplier 2.0
  const raw = (persistentState && persistentState.player && typeof persistentState.player.goldBonus === 'number') ? persistentState.player.goldBonus : 0;
  if (!raw || raw <= 0) return 1;
  const effectiveBonus = raw / (1 + 0.5 * raw);
  const capped = Math.min(effectiveBonus, maxBonus);
  return 1 + capped;
}

// Helper: pick a random loot key using weights defined in LOOT_DEFS.
export function pickRandomLootKey() {
  const entries = Object.entries(LOOT_DEFS).map(([k, v]) => ({ key: k, weight: (typeof v.weight === 'number') ? v.weight : 1 }));
  const total = entries.reduce((s, e) => s + e.weight, 0);
  if (total <= 0) return entries.length ? entries[0].key : null;
  let r = Math.random() * total;
  for (const e of entries) {
    if (r < e.weight) return e.key;
    r -= e.weight;
  }
  return entries.length ? entries[entries.length - 1].key : null;
}

export function loadPersistentState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { player: { upgrades: [] }, towers: {} };
    return JSON.parse(raw);
  } catch (e) {
    console.warn('Failed to load persistent state', e);
    return { player: { upgrades: [] }, towers: {} };
  }
}

export function savePersistentState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('Failed to save persistent state', e);
  }
}

// Inventory helper functions (moved here to centralize loot persistence)
export function makeInvEntry(defId) {
  return { id: defId, pickedAt: Date.now(), uid: `${Date.now()}_${Math.random().toString(36).slice(2,8)}` };
}

export function addInventoryEntryFromPickup(persistentState, defId) {
  if (!persistentState.player) persistentState.player = { upgrades: [], inventory: [] };
  if (!Array.isArray(persistentState.player.inventory)) persistentState.player.inventory = [];
  const entry = makeInvEntry(defId);
  persistentState.player.inventory.push(entry);
  savePersistentState(persistentState);
  return entry;
}

export function reserveInventoryUid(persistentState, uid) {
  if (!uid) return;
  if (!persistentState.player) persistentState.player = { upgrades: [], inventory: [] };
  if (!Array.isArray(persistentState.player.inventory)) persistentState.player.inventory = [];
  const inv = persistentState.player.inventory;
  const idx = inv.findIndex(it => it.uid === uid);
  if (idx !== -1) {
    inv[idx].reserved = true;
    savePersistentState(persistentState);
  }
}

export function clearReservation(persistentState, uid) {
  if (!uid) return;
  if (!persistentState.player || !Array.isArray(persistentState.player.inventory)) return;
  const inv = persistentState.player.inventory;
  const idx = inv.findIndex(it => it.uid === uid);
  if (idx !== -1 && inv[idx].reserved) {
    delete inv[idx].reserved;
    savePersistentState(persistentState);
  }
}

export function removeInventoryByUid(persistentState, uid) {
  if (!persistentState.player || !Array.isArray(persistentState.player.inventory)) return false;
  const inv = persistentState.player.inventory;
  const idx = inv.findIndex(it => it.uid === uid);
  if (idx !== -1) {
    inv.splice(idx, 1);
    savePersistentState(persistentState);
    return true;
  }
  return false;
}

// Apply a loot definition to the player or to a specific tower.
// Context (ctx) may include:
// - player: the Player instance
// - towers: array of tower instances
// - findNearestTower: function() -> tower instance (preferred)
// - ensureTowerId: function(tower) to assign an _id and register persistentState.towers
// - defaultPlayerBaseDamage: number fallback when player.baseDamage is not set
// This function mutates persistentState and live tower/player objects but does NOT
// call savePersistentState; caller should persist after calling.
export function applyLootToPlayerOrTower(persistentState, defId, ctx = {}) {
  const def = LOOT_DEFS[defId];
  if (!def) return false;

  if (def.target === 'player') {
    persistentState.player = persistentState.player || { upgrades: [] };
    if (!Array.isArray(persistentState.player.upgrades)) persistentState.player.upgrades = [];
    const existing = persistentState.player.upgrades.filter(u => u.id === defId).length;
    const cap = def.stackCapPlayer || 99;
    if (existing >= cap) return false; // at cap
    persistentState.player.upgrades.push({ id: defId, appliedAt: Date.now() });
    // apply immediate effect if possible
    if (def.effect && def.effect.type === 'mul_playerDamage') {
      // resolve current base damage from persistent state, runtime player, or default
      let resolvedBase = null;
      if (persistentState.player && typeof persistentState.player.baseDamage === 'number') resolvedBase = persistentState.player.baseDamage;
      if (resolvedBase === null && ctx && ctx.player && typeof ctx.player.baseDamage === 'number') resolvedBase = ctx.player.baseDamage;
      if (resolvedBase === null && typeof ctx.defaultPlayerBaseDamage === 'number') resolvedBase = ctx.defaultPlayerBaseDamage;
      if (resolvedBase === null) resolvedBase = 4;
      // multiply and write back to both runtime player (if available) and persistent state
      const newBase = resolvedBase * def.effect.value;
      if (ctx && ctx.player) ctx.player.baseDamage = newBase;
      persistentState.player.baseDamage = newBase;
    }
    if (def.effect && def.effect.type === 'add_goldPercent') {
      persistentState.player.goldBonus = (persistentState.player.goldBonus || 0) + def.effect.value;
    }
    return true;
  }

  if (def.target === 'tower_individual') {
    // Determine the tower to apply to. Prefer explicit tower or towerId provided
    // by the caller context. Fall back to findNearestTower or nearest to player.
    let tower = null;
    if (ctx && ctx.tower) {
      tower = ctx.tower;
    } else if (ctx && (ctx.tid || ctx.towerId)) {
      const idToFind = ctx.tid || ctx.towerId;
      if (Array.isArray(ctx.towers)) tower = ctx.towers.find(tt => tt && tt._id === idToFind) || null;
    }
    if (!tower) {
      if (typeof ctx.findNearestTower === 'function') tower = ctx.findNearestTower();
      else if (Array.isArray(ctx.towers) && ctx.player) {
        let best = null; let bestDist = Infinity;
        for (const t of ctx.towers) {
          if (!t || !t.mesh || !ctx.player || !ctx.player.mesh) continue;
          const dx = (t.mesh.position.x || 0) - ctx.player.mesh.position.x;
          const dz = (t.mesh.position.z || 0) - ctx.player.mesh.position.z;
          const d = Math.sqrt(dx*dx + dz*dz);
          if (d < bestDist) { bestDist = d; best = t; }
        }
        tower = best;
      }
    }
  if (!tower) return false;
  if (typeof ctx.ensureTowerId === 'function') ctx.ensureTowerId(tower);
  const tid = String(tower._id);
  if (!persistentState.towers || typeof persistentState.towers !== 'object') persistentState.towers = {};
  if (!Array.isArray(persistentState.towers[tid])) persistentState.towers[tid] = [];
  const upgrades = persistentState.towers[tid];
  const sameCount = upgrades.filter(u => u && u.id === defId).length;
  const cap = (typeof def.stackCapPerTower === 'number') ? def.stackCapPerTower : 1;
  if (sameCount >= cap) return false;
  // Push a normalized upgrade entry and persist by caller
  upgrades.push({ id: defId, appliedAt: Date.now() });
  persistentState.towers[tid] = upgrades;
    if (!tower._modifiers) tower._modifiers = {};
    if (def.effect && def.effect.type === 'mul_damage') {
      tower._modifiers.damage = (tower._modifiers.damage || 1) * def.effect.value;
    }
    if (def.effect && def.effect.type === 'mul_fireRate') {
      tower._modifiers.fireRate = (tower._modifiers.fireRate || 1) * def.effect.value;
    }
    return true;
  }

  return false;
}

// Small floating loot pickup class
export class Loot {
  constructor(scene, defId, pos, onPickup) {
    this.defId = defId;
    this.def = LOOT_DEFS[defId];
    this.scene = scene;
    this.onPickup = onPickup;
    this.mesh = this._createMesh();
    this.mesh.position.set(pos.x, pos.y + 0.5, pos.z);
    scene.add(this.mesh);
    this._t = 0;
    this.picked = false;
  }

  _createMesh() {
    const geom = new THREE.IcosahedronGeometry(0.4, 1);
    const mat = new THREE.MeshStandardMaterial({ color: 0xffd27b, emissive: 0x884400 });
    const m = new THREE.Mesh(geom, mat);
    return m;
  }

  update(delta) {
    this._t += delta;
    // float & rotate
    this.mesh.position.y += Math.sin(this._t * 2) * 0.002;
    this.mesh.rotation.y += 0.02;
  }

  dispose() {
    if (this.mesh) this.scene.remove(this.mesh);
    this.mesh = null;
  }
}
