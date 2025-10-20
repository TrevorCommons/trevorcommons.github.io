import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';
import { GRID_SIZE, TOWER_DEFAULTS } from './constants.js';

export class Tower {
  constructor(x, y, scene) {
    this.x = x;
    this.y = y;
    this.scene = scene;
    this.level = 1;
    this.mesh = null;
    this.attackCooldown = 1.0;
    this.lastAttackTime = 0;
    this._modifiers = null;
  }

  canAttack(currentTime) {
    return currentTime - this.lastAttackTime >= this.attackCooldown;
  }

  recordAttack(currentTime) {
    this.lastAttackTime = currentTime;
  }

  update() {}
}

export class HealerTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    this.attackCooldown = 0.5;

    // Bigger cylinder for tower base
    const baseGeo = new THREE.CylinderGeometry(1, 1, 3, 12);
    const baseMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5, metalness: 0.1 });
    const base = new THREE.Mesh(baseGeo, baseMat);
    base.position.y = 1.5; // half of height

    // Optional: add glowing orb on top
    const orbGeo = new THREE.SphereGeometry(0.5, 16, 16);
    const orbMat = new THREE.MeshStandardMaterial({ color: 0x00ffcc, emissive: 0x00ffcc, emissiveIntensity: 0.6 });
    const orb = new THREE.Mesh(orbGeo, orbMat);
    orb.position.y = 3.5;

    // Group the parts
    this.mesh = new THREE.Group();
    this.mesh.add(base);
    this.mesh.add(orb);

    // Position the tower and add it to the scene
    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0, (y - GRID_SIZE/2) + 0.5);
    scene.add(this.mesh);
  }

  update(player, currentTime) {
    if (!this.canAttack(currentTime)) return;
    if (!player || !player.mesh) return;
    const dx = player.mesh.position.x - this.mesh.position.x;
    const dz = player.mesh.position.z - this.mesh.position.z;
    const r = (TOWER_DEFAULTS.healer && TOWER_DEFAULTS.healer.range) || 10;
    if (Math.hypot(dx, dz) <= r) {
      player.health = Math.min(player.health + 10, player.maxHealth);
      this.recordAttack(currentTime);
    }
  }
}


export class MageTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    this.attackCooldown = 0.85;

    // Use a group to combine parts
    this.mesh = new THREE.Group();

    // Taller crystal-like cone
    const coneGeo = new THREE.ConeGeometry(1, 4, 12);
    const coneMat = new THREE.MeshStandardMaterial({ color: 0x8000ff, emissive: 0x6600ff, roughness: 0.3 });
    const cone = new THREE.Mesh(coneGeo, coneMat);
    cone.position.y = 2; // half height of cone
    this.mesh.add(cone);

    // Optional: floating crystal on top
    const crystalGeo = new THREE.OctahedronGeometry(0.5);
    const crystalMat = new THREE.MeshStandardMaterial({ color: 0x9900ff, emissive: 0x9900ff, metalness: 0.8 });
    const crystal = new THREE.Mesh(crystalGeo, crystalMat);
    crystal.position.y = 4.5;
    this.mesh.add(crystal);

    // Position the whole tower
    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0, (y - GRID_SIZE/2) + 0.5);

    // Add to scene
    scene.add(this.mesh);
  }

  update(enemies, currentTime) {
    if (!this.canAttack(currentTime)) return;
    if (!enemies || enemies.length === 0) return;
    const range = (TOWER_DEFAULTS.mage && TOWER_DEFAULTS.mage.range) || 8;
    for (const e of enemies) {
      if (!e || !e.mesh) continue;
      const d = Math.hypot(e.mesh.position.x - this.mesh.position.x, e.mesh.position.z - this.mesh.position.z);
      if (d <= range) {
  // Slightly higher base damage for mage (buffed)
  const dmg = 0.18 * ((this._modifiers && this._modifiers.damage) || 1);
        if (typeof e.takeDamage === 'function') {
          const res = e.takeDamage(dmg);
          if (res) e._deathResult = res;
        } else {
          e.health -= dmg;
          if (e.health <= 0 && typeof e.die === 'function') e._deathResult = e.die();
        }
      }
    }
    this.recordAttack(currentTime);
  }
}

export class ArcherTower extends Tower {
  constructor(x, y, scene) {
    super(x, y, scene);
    this.mesh = new THREE.Group();

     // Tower base
     const baseGeo = new THREE.BoxGeometry(2, 0.2, 2);
     const baseMat = new THREE.MeshStandardMaterial({ color: 0x8b4513, roughness: 0.6 });
     const base = new THREE.Mesh(baseGeo, baseMat);
     base.position.y = 0.1; // half height of base
     this.mesh.add(base);
 
     // Pillars (4 corners)
     const pillarGeo = new THREE.CylinderGeometry(0.1, 0.1, 3, 8);
     const pillarMat = new THREE.MeshStandardMaterial({ color: 0x654321, roughness: 0.7 });
     const pillarPositions = [
       [-0.9, 1.5, -0.9],
       [-0.9, 1.5,  0.9],
       [ 0.9, 1.5, -0.9],
       [ 0.9, 1.5,  0.9],
     ];
     for (const pos of pillarPositions) {
       const pillar = new THREE.Mesh(pillarGeo, pillarMat);
       pillar.position.set(...pos);
       this.mesh.add(pillar);
     }

      // Platform on top
      const platformGeo = new THREE.BoxGeometry(2, 0.2, 2);
      const platformMat = new THREE.MeshStandardMaterial({ color: 0x8b4513 });
      const platform = new THREE.Mesh(platformGeo, platformMat);
      platform.position.y = 3; // top of pillars
      this.mesh.add(platform)

    // Add a tiny archer figure on top 
    const archerGeo = new THREE.BoxGeometry(0.3, 0.8, 0.3);
    const archerMat = new THREE.MeshStandardMaterial({ color: 0x0000ff });
    const archer = new THREE.Mesh(archerGeo, archerMat);
    archer.position.set(0, 3.4, 0); // standing on platform
    this.mesh.add(archer);

    this.mesh.position.set((x - GRID_SIZE/2) + 0.5, 0.5, (y - GRID_SIZE/2) + 0.5);
    scene.add(this.mesh);
  }

  update(enemies, currentTime) {
    if (!this.canAttack(currentTime)) return;
    if (!enemies || enemies.length === 0) return;
    let closest = null;
    let dist = Infinity;
    for (const e of enemies) {
      if (!e || !e.mesh) continue;
      const d = Math.hypot(e.mesh.position.x - this.mesh.position.x, e.mesh.position.z - this.mesh.position.z);
      if (d < dist) { dist = d; closest = e; }
    }
    const range = (TOWER_DEFAULTS.archer && TOWER_DEFAULTS.archer.range) || 20;
    if (closest && dist <= range) {
      if (typeof closest.takeDamage === 'function') {
        const result = closest.takeDamage(7);
        if (result) closest._deathResult = result;
      } else {
        closest.health -= 7;
        if (closest.health <= 0 && typeof closest.die === 'function') closest._deathResult = closest.die();
      }
      this.recordAttack(currentTime);
    }
  }
}

// Helpers for UI interactions with towers
export function highlightTowerById(towers, tid) {
  const t = towers.find(x => x._id === tid);
  if (!t || !t.mesh) return;
  const origScale = t.mesh.scale ? t.mesh.scale.clone() : new THREE.Vector3(1,1,1);
  const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material];
  const origEmissives = mats.map(m => (m && m.emissive ? m.emissive.clone() : null));
  try {
    t.mesh.scale.set(origScale.x * 1.18, origScale.y * 1.18, origScale.z * 1.18);
    mats.forEach(m => { if (!m) return; if (m.emissive) m.emissive.setHex(0xFFFF66); });
  } catch (e) {}
  setTimeout(() => {
    try { if (!t.mesh) return; t.mesh.scale.copy(origScale); mats.forEach((m, i) => { if (!m) return; if (origEmissives[i] && m.emissive) m.emissive.copy(origEmissives[i]); }); } catch (e) {}
  }, 1200);
}

export function selectTowerById(towers, tid, camera) {
  const t = towers.find(x => x._id === tid);
  if (!t || !t.mesh) return null;
  if (!t._origScale) t._origScale = t.mesh.scale.clone();
  try { t.mesh.scale.set(t._origScale.x * 1.08, t._origScale.y * 1.08, t._origScale.z * 1.08); } catch (e) {}
  if (camera && t.mesh) { try { camera.position.set(t.mesh.position.x, camera.position.y, t.mesh.position.z + 0.01); camera.lookAt(t.mesh.position.x, 0, t.mesh.position.z); } catch (e) {} }
  return tid;
}

export function clearTowerSelection(towers, selectedTid) {
  if (!selectedTid) return null;
  const t = towers.find(x => x._id === selectedTid);
  if (!t || !t.mesh) return null;
  try { if (t._origScale) t.mesh.scale.copy(t._origScale); if (t._origMaterials) { const mats = Array.isArray(t.mesh.material) ? t.mesh.material : [t.mesh.material]; mats.forEach((m, idx) => { const orig = t._origMaterials[idx]; if (!m || !orig) return; if (orig.emissive && m.emissive) m.emissive.copy(orig.emissive); if (orig.color && m.color) m.color.copy(orig.color); }); } } catch (e) {}
  return null;
}

