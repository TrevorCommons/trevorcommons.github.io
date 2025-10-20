import { savePersistentState } from './loot.js';

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

export default { makeInvEntry, addInventoryEntryFromPickup, reserveInventoryUid, clearReservation, removeInventoryByUid };
