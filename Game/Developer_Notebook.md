**CSCI-310 Development Notebook**

---

**Guideline:** 

* Please document all your development activities, whether you use any AI coding tool or not. You might mix your manual coding or AI tool usage. Just document the entire process.   
  * If this is a team project or assignment, list all team members’ names in the “Name” field. For each iteration, record the name of the person who contributed any part of the work in the “What do you do?” field.  
* Any interactions with AI coding tools such as ChatGPT, Gemini, Copilot, and others must capture the full conversation history.   
* Use the format below to record your development activities in a clear and consistent manner.   
  * Adding more iteration sections if needed.

---

#### **Name:** Trevor Commons & Allen Merrill

#### **Project/Assignment:** 3D Top-Down / First-Person Game Prototype (CSCI-310 Project 2)

##### **Problem/Task:**

Add gameplay features and polish to a browser-based Three.js prototype: deterministic path/enemy spawns, enemy waves, melee combat, dual cameras (top-down & FP), UI/HUD, and map edge hiding (mountains/cave/battlement). Keep the scene performant and simple geometry.

##### **Development Log**

- **Iteration 1:**  
  - **Goal/Task/Rationale:**  Fix and stabilize the procedural path generator and ensure the path coordinates are returned in deterministic, ordered form. Enemies must be able to follow the ordered path.
    
  - **What do you do?**   
    Reviewed `game/path.js` and repaired generation that lost ordering. Ensured the function returns an ordered `pathCoords` array and a `grid` occupancy map. Documented the return shape so `Enemy` can consume `pathCoords` in order.
    
  - **Response/Result:**
    Path generation now returns a deterministic ordered `pathCoords` array. Enemies can interpolate along the path reliably.

  - **Your Evaluation:** done — ordering issue fixed; no immediate regressions. (Contributor: Trevor Commons)

- **Iteration 2:**  
  - **Goal/Task/Rationale:**  Clamp the player inside the playable area so the player cannot escape the scene geometry.
  
  - **What do you do?**   
    Added optional `bounds` to `Player` in `game/player.js`. Implemented `clampPosition()` and called it after movement. In `main.js` computed scene bounds from `GRID_SIZE` and passed them to the `Player` constructor.
    
  - **Response/Result:**
    Player movement is clamped to the playable area, preventing leaving the ground. Movement remains responsive in both top-down and FP modes.

  - **Your Evaluation:** done — small, safe API change; (Contributor: Trevor Commons)

- **Iteration 3:**
  - **Goal/Task/Rationale:**  Improve visual boundaries to hide the map edge and make a believable entrance (cave) for enemy spawns.

  - **What do you do?**
    Added deterministic mountain ranges along left/right edges and an entrance-side mountain range with a cave opening aligned to the path start. Created a simple cave entrance (pillars + lintel) and a dark interior box to visually hide early spawns. Exposed `caveSpawnPos` so spawns originate from inside the cave.
    
  - **Response/Result:**
    Map edges are obscured by mountains and the cave entrance is aligned with the path start. `caveSpawnPos` is computed for enemy spawn placement.

  - **Your Evaluation:** done — improves immersion and hides artifacts at map boundaries. (Contributor: Trevor Commons)

- **Iteration 4:**
  - **Goal/Task/Rationale:**  Add an exit battlement on the side opposite the cave, with crenellations and corner towers, to make the map feel finished and give a defensive focal point.

  - **What do you do?**
    Implemented `addExitBattlement(scene, pathCoords)` in `main.js`. The function determines entrance side from `pathCoords[0]` and places a continuous wall on the opposite side, adding repeated crenellations and two corner towers.

  - **Response/Result:**
    The battlement appears opposite the cave, with simple repeated geometry for crenellations and two towers. It's made with low-poly meshes to keep render cost low.

  - **Your Evaluation:** done — visually acceptable and fast. (Contributor: Trevor Commons)

- **Iteration 5:**
  - **Goal/Task/Rationale:**  Add dual cameras: a top-down orthographic camera for overview and a first-person perspective camera for active play. Include a UI toggle and pointer-lock-based mouse look for FP.

  - **What do you do?**
    Added `createTopDownCamera()` that constructs an OrthographicCamera sized to the `GRID_SIZE` frustum and `createFirstPersonCamera()` with a PerspectiveCamera. Implemented `setUsingTopDown()` to switch modes, added pointer-lock handling and mousemove yaw/pitch handlers, and added UI wiring (`#cameraToggle`, `#crosshair`). Ensured toggle is prevented during an active round (`roundActive`). Each frame the FP camera follows the player and applies yaw/pitch.

  - **Response/Result:**
    Camera toggle works; pointer-lock and mouse look operate in FP. Crosshair is visible in FP and hidden in top-down. Movement respects yaw in FP and grid moves in top-down.

  - **Your Evaluation:** done — FP feel is basic but functional; toggle guard prevents mid-round switching. (Contributor: Trevor Commons)

- **Iteration 6:**
  - **Goal/Task/Rationale:**  Implement the wave lifecycle: start round, spawn waves of enemies from cave, show enemies remaining counter and a wave progress bar, and end the round when all enemies are cleared.

  - **What do you do?**
    Implemented `spawnWave(numEnemies)` and `startWave(numEnemies)` in `main.js`. Spawns are staggered by setting negative initial `progress` values. Added an `enemies` array and `updateEnemiesRemaining()` to sync the HUD. Added wave progress calculation and pulse animation trigger.

  - **Response/Result:**
    Starting a round spawns enemies from `caveSpawnPos`, HUD updates, and when enemies are all removed the round ends and the camera returns to top-down.

  - **Your Evaluation:** done — basic wave behavior works; room for balancing and additional enemy behaviors. (Contributor: Trevor Commons)

- **Iteration 7:**
  - **Goal/Task/Rationale:**  Add player melee attacks so the player can interact with enemies: a simple range, damage, cooldown model with visual feedback and coin reward on defeat.

  - **What do you do?**
    Added attack constants (ATTACK_RANGE, ATTACK_DAMAGE, ATTACK_COOLDOWN) and `attemptAttack()` input handlers (left mouse and Spacebar) in `main.js`. The attack finds the nearest enemy in range, calls `enemy.takeDamage()`, briefly scales and flashes the enemy mesh, and if defeated, adds coins via `addGold()` and removes the enemy from the scene and `enemies` array. Wired `#gold` updates.

  - **Response/Result:**
    Attacks damage and can defeat enemies; gold updates on enemy defeat. Simple visual feedback helps confirm hits.

  - **Your Evaluation:** done — functional combat; future polish could add SFX, flinch/knockback and health bars. (Contributor: Trevor Commons)

- **Iteration 8 (Polish & Merge):**
  - **Goal/Task/Rationale:**  Finalize UI wiring, add small animations (wave pulse), ensure DOM wiring occurs after the `canvas` and `player` exist, and prepare commits/PR for merge.

  - **What do you do?**
    Moved DOM wiring to after player/canvas creation, added CSS `.pulse` and progress bar styling, produced a multi-commit plan, split changes into a feature branch, pushed, opened a PR and merged into `main`. Backups of pre-change files were saved in `commit_backups/`.

  - **Response/Result:**
    The branch `split/feature-small-commits` was pushed, PR created and merged into `main`, and the remote branch cleaned up. Syntax checks on edited JS files returned no parse errors.

  - **Your Evaluation:** done — merged to `main`. (Contributor: Trevor Commons)

---

## Notes about AI assistance
- I used an AI coding assistant interactively during development to prototype algorithms, debug issues, and structure event wiring. Full interaction logs are available in the project activity history (chat logs saved locally). The AI was used as an aide; all final code decisions and merges were performed and reviewed by the contributor listed above.

## Quick smoke test (how to run)
1. From the project root run a static server (example using Python):
```
python -m http.server 8000
```
2. Open http://localhost:8000/ in a modern browser. Verify:
  - Start Round (Enter/R or Start Round button) spawns enemies from cave.
  - Crosshair & pointer-lock engage in FP mode (click the canvas), attacks with left-click or Space damage enemies and yield gold.
  - Player cannot leave the ground bounds.
  - Wave ends and camera returns to top-down when enemies are cleared.

## Follow-ups (ideas)
- Enemy flinch/knockback and health bars above enemies.
- Sound effects for attacks and enemy death.
- Convert repeated battlement meshes to InstancedMesh for performance.
- Add automated smoke test (Puppeteer) to validate the Start Round → combat → round end flow.

---

### Iteration (2025-10-18): Features, bugfixes & polish

- **Goal/Task/Rationale:** Ship a set of gameplay features and bugfixes requested during today's session: improve inventory reliability and apply flow, implement economy and tower costs, centralize constants, add weighted loot & diminishing gold returns, fix sword visibility and make player melee upgrades consistent via a single source of truth, and add UI flows (pause menu, endless mode, win condition, toasts).

- **What I did?**
  - Centralized attack constants into `game/constants.js` and updated `main.js` to import them.
  - Implemented uid-based inventory entries and reservation semantics. Added `addInventoryEntryFromPickup`, `reserveInventoryUid`, `clearReservation`, and `removeInventoryByUid` in `game/loot.js` to avoid inventory loss when picking up multiple items.
  - Added weighted random loot selection (`pickRandomLootKey`) and adjusted `sharpened_blade` rarity.
  - Implemented `computeGoldMultiplier` (diminishing-returns formula, capped at +100%) and applied it in `addGold()` so `gold_hoard` tokens affect coin gains correctly.
  - Added tower economy: `TOWER_COSTS` and `STARTING_GOLD` in `game/constants.js`. `buildTower()` now checks/deducts gold and tower buttons disable when unaffordable.
  - Implemented Apply/Drop flows and toasts for inventory: player-targeted loot applies immediately, tower-targeted loot is stored and opened in a modal for selection. Inventory entries persist to `localStorage` immediately on pickup.
  - Hardened `applyLootToPlayerOrTower` to properly resolve and persist `player.baseDamage` on `mul_playerDamage` upgrades and to enforce per-tower caps for tower upgrades.
  - Made `player.baseDamage` the single source of truth for player melee damage; initialized it from `ATTACK_DAMAGE` and ensured all melee code reads this value.
  - Replaced the simple box sword with a grouped blade+hilt, tuned materials for visibility, and fixed first-person rendering by adding the FP camera to the scene and fixing sword rest position/swing animation.
  - Added pause menu overlay (Resume, End/Reset), Tab binding to toggle pause, an Endless Mode checkbox with on-screen indicator, and a campaign win overlay when clearing round 20 (skippable with Endless Mode).
  - Fixed several runtime errors: moved ATTACK_* constants before use (then centralized), returned created tower from `buildTower()` to avoid undefined logs, and removed legacy `f` key binding.

- **Files changed (high level):**
  - `game/loot.js` — LOOT_DEFS updates, persistence helpers, pickRandomLootKey, computeGoldMultiplier, improved applyLootToPlayerOrTower.
  - `game/player.js` — `baseDamage` SOT, sword Group (blade+hilt), rest position & swing animation, removed 'f' key binding.
  - `game/constants.js` — added ATTACK_RANGE/ATTACK_DAMAGE/ATTACK_COOLDOWN, TOWER_COSTS, STARTING_GOLD, visual constants.
  - `main.js` — imports updated, buildTower return, inventory apply flows, addGold uses computeGoldMultiplier, pause/endless/win overlays, pointer-lock & FP camera added to scene, tower button UI updates.
  - `ui/toast.js` — used for toasts on pickup/apply/store.

- **Response/Result:**
  - Inventory no longer loses items when multiple pickups occur before applying. Player-targeted upgrades apply immediately and persist correctly. Sword is visible and swings in FP; upgrades that increase melee damage persist and affect swings. Gold hoard tokens now boost coin gains with diminishing returns. Tower building enforces costs.

- **Your Evaluation:** done — major features implemented and integrated. Visual polish remains (sword look, hit VFX/SFX). (Contributors: Trevor Commons)

---

End of entry.
