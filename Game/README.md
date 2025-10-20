# 3dGameProject

A compact, browser-based hybrid of tower-defense and small-action gameplay built with Three.js and vanilla ES modules.

Overview
--------
Defend your castle from waves of enemies by placing towers, fighting with a first-person melee weapon, and collecting loot that upgrades your player or individual towers. The game supports a campaign win (clear round 20) and an Endless Mode to continue indefinitely.

Key features
- Top-down and first-person camera modes (toggle with `C`). First-person enables melee combat.
- Placed towers (Healer, Mage, Archer) that can be built between waves using gold.
- Loot system with persistent inventory: some loot applies immediately to the player, some are stored in inventory and can be applied to specific towers.
- Mouse:
  - Left click (top-down): place the selected tower (when a tower type is selected).
-----------
- HUD: shows Gold, Castle health, Wave number and Enemies remaining.
- Endless Mode indicator: shows "Endless ON" when the mode is active.

Tower types
-----------
- Healer Tower
  - Role: sustain/support.
  - What it does: periodically heals the player (and nearby allies) and can help the player survive longer in first-person combat.
  - Usage: place when you expect to play aggressively or when the castle needs sustain.

- Mage Tower
  - Role: single-target burst damage.
  - What it does: deals high damage to single targets at range; especially effective against high-health enemies and loot carriers.
  - Usage: build against tanky enemies or to quickly remove priority targets.

- Archer Tower
  - Role: consistent DPS and crowd control.
  - What it does: fast shots with moderate damage and good range; ideal for thinning groups of enemies.
  - Usage: use to cover long corridors and handle many weaker enemies.

Powerups (Loot)
---------------
Loot definitions live in `game/loot.js` under `LOOT_DEFS`. Each entry defines the ID, friendly name, target (player or `tower_individual`), weight (rarity) and effect.

- `gold_hoard` (Gold Hoard Token)
  - Target: player (persistent)
  - Effect: increases gold awarded from kills by contributing to a stacked multiplier. Uses diminishing returns and a hard cap (see `computeGoldMultiplier()` in `game/loot.js`).

- `sharpened_blade` (Sharpened Blade)
  - Target: player (persistent)
  - Effect: increases player melee damage when applied (persists and stacks up to defined caps).

- Tower modules (e.g. `powercore_module`, `overclock_chip`)
  - Target: `tower_individual`
  - Effect: apply to a single tower to improve damage, cooldown, or other stats. Must be applied from the inventory modal and are subject to per-tower caps.

Pickup behavior
---------------
- Tower-targeted pickups are stored immediately in the player's inventory with a stable `uid` to prevent loss during modal interactions. Opening the apply modal reserves that UID until the modal is closed.


-----------------
- `index.html` — main HTML and UI skeleton.
- `main.js` — game loop, scene setup, UI wiring, wave spawning and core gameplay logic.
- `game/constants.js` — centralized constants: grid/tile size, UI visuals, tower defaults/costs, attack constants.
- `game/loot.js` — LOOT_DEFS, weighted selection, inventory helpers, persistence helpers and gold multiplier logic.
- `game/tower.js` — Tower classes (Healer, Mage, Archer) and per-tower behavior.
- `game/enemy.js` — Enemy behavior, health, loot/coin drops and attack logic.
Persistence & state
-------------------
- Persistent player upgrades, inventory and per-tower applied upgrades are stored in `localStorage` under the key in `game/constants.js`.
- Inventory entries use stable `uid` strings at pickup time to avoid race conditions (for example when opening a modal while picking up a second item).
Balance, economy and tuning
---------------------------
- Tower costs and starting gold are controlled in `game/constants.js` via `TOWER_COSTS` and `STARTING_GOLD`.
- Gold-hoard tokens are implemented as stacking powerups that feed into a diminishing-returns formula (see `game/loot.js` → `computeGoldMultiplier()`) and cap at 2× effective gold.
- Recent balance notes:
  - The Mage tower has been buffed for stronger single-target damage.
  - Player base melee damage was nerfed slightly to balance sword power relative to towers.

Recent behavior & UI changes
---------------------------
- Inventory now persists pickups immediately with unique UIDs so items are not lost if the player picks up another item while a modal is open.
- Player sword was replaced by a grouped blade+hilt mesh parented to the first-person camera for correct visibility and animation. Sword swings award coins/loot identically to tower kills.
- Ghost placement visuals: range circle opacity and valid/invalid color values were adjusted for better visibility; the valid green was darkened for contrast.
- Endless indicator styling and behavior: the onscreen "Endless ON" label is styled reddish and updates reliably when toggled.
- Toasts and modal/applied/inventory text colors were adjusted for consistent readability across dark UIs.

Running locally (quick)
-----------------------
1. Open the `3dGameProject` folder in VS Code.
2. Use Live Server (or any static file server) to serve `index.html` so ES module imports load correctly.
   - Live Server extension (right-click `index.html` → "Open with Live Server").
3. Open the page in a modern browser (Chrome recommended for development). Use the Developer Console for logs.

Development notes
-----------------
- Editing files: keep import paths relative and valid for browser ES modules.
- Rendering notes: the player's sword is intentionally rendered last (high `renderOrder` and depth writes disabled) so it stays visible in first-person.
- If you change visual constants, update `game/constants.js` and test in both camera modes.


