import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.152.2/build/three.module.js';

const GRID_SIZE = 50;
const TILE_SIZE = 1;

export class Enemy {
  
  constructor(pathCoords, scene, options = {}) {
    // Create a simple enemy mesh (sphere)
    const geometry = new THREE.SphereGeometry(0.4, 16, 16);
    const material = new THREE.MeshStandardMaterial({ color: 0xff0000 });
    this.mesh = new THREE.Mesh(geometry, material);
    scene.add(this.mesh);

    // Path following state
    this.pathCoords = pathCoords;
    this.currentStep = 0;
    this.speed = 0.03; // Adjust for desired speed
    this.progress = 0; // Progress between steps

    // Enemy stats
  this.maxHealth = options.maxHealth || 10;
  this.health = this.maxHealth;
  this.maxCoins = options.maxCoins || 5;
    this.coinDrop = Math.floor(Math.random() * (this.maxCoins + 1));
    // Enemies can be explicitly assigned loot via options.carriesLootId
    this.carriesLootId = options.carriesLootId || null;
  this.lootChance = typeof options.lootChance === 'number' ? options.lootChance : 0.0; // default 0 unless explicitly assigned
    this.hasDroppedLoot = false;
    this.dead = false;
  // Allow speed override
  if (typeof options.speed === 'number') this.speed = options.speed;

    // Health bar background
    const barBgGeo = new THREE.PlaneGeometry(0.8, 0.1);
    const barBgMat = new THREE.MeshBasicMaterial({ color: 0x000000, side: THREE.DoubleSide });
    this.healthBg = new THREE.Mesh(barBgGeo, barBgMat);
    this.healthBg.position.set(0, 1.5, 0);
    this.mesh.add(this.healthBg);

    // Health bar
    const barGeo = new THREE.PlaneGeometry(0.8, 0.1);
    const barMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide });
    this.healthBar = new THREE.Mesh(barGeo, barMat);
    this.healthBar.position.set(0, 0, 0.001);
    this.healthBg.add(this.healthBar);

    // Small damage flash timer
    this.flashTimer = 0;
    this.originalColor = material.color.clone();
  }

  update(camera) {
    if (this.dead) return;

    //Movement
    if (this.currentStep < this.pathCoords.length - 1) {
      const start = this.pathCoords[this.currentStep];
      const end = this.pathCoords[this.currentStep + 1];

      // Interpolate position
      this.mesh.position.x = THREE.MathUtils.lerp(
        (start.x - 25) + 0.5, (end.x - 25) + 0.5, this.progress
      );
      this.mesh.position.z = THREE.MathUtils.lerp(
        (start.y - 25) + 0.5, (end.y - 25) + 0.5, this.progress
      );
      this.mesh.position.y = 0.5;

      this.progress += this.speed;
      if (this.progress >= 1) {
        this.progress = 0;
        this.currentStep++;
      }
    }

 //Make health bar face the player's camera
 if (camera) {
  this.healthBg.lookAt(camera.position);
}

  // Reset color flash after hit
  if (this.flashTimer > 0) {
    this.flashTimer -= 0.05;
    if (this.flashTimer <= 0) {
      this.mesh.material.color.copy(this.originalColor);
    }
  }
}

  // Call this to deal damage to the enemy
  takeDamage(amount) {
    if (this.dead) return null;

    this.health -= amount;
    this.health = Math.max(this.health, 0);

    // Flash red when hit
    this.mesh.material.color.set(0xffffff);
    this.flashTimer = 0.2;

    // Update health bar
    const pct = this.health / this.maxHealth;
    this.healthBar.scale.x = pct;
    this.healthBar.position.x = (pct - 1) / 2;
    this.healthBar.material.color.setHSL(pct * 0.3, 1, 0.5);

    if (this.health <= 0) {
      return this.die();
    }

    return null;
  }
  
  die() {
    this.dead = true;
    this.mesh.visible = false;

    // Drop coins
    const coins = this.coinDrop;
    let loot = null;

    if (!this.hasDroppedLoot) {
      if (this.carriesLootId) {
        loot = { id: this.carriesLootId, pos: { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z } };
        this.hasDroppedLoot = true;
      } else if (this.lootChance && Math.random() < this.lootChance) {
        loot = { id: null, pos: { x: this.mesh.position.x, y: this.mesh.position.y, z: this.mesh.position.z } };
        this.hasDroppedLoot = true;
      }
    }

    return { coins, loot };
  }

  attackPlayer(player) {
    if (this.dead) return;
  
    const dx = player.mesh.position.x - this.mesh.position.x;
    const dz = player.mesh.position.z - this.mesh.position.z;
    const dist = Math.sqrt(dx * dx + dz * dz);
  
    // Attack range and cooldown
    const attackRange = 2;
    const attackCooldown = 1.2; // seconds
    const now = performance.now() / 1000;
  
    if (dist <= attackRange) {
      if (!this.lastAttackTime || now - this.lastAttackTime >= attackCooldown) {
        this.lastAttackTime = now;
        if (typeof player.takeDamage === 'function') {
          player.takeDamage(5); // deal 10 damage per hit
        } else {
          // fallback: direct damage
          player.health -= 10;
          player.updateHealthBar();
        }
      }
    }
  }
  
}

 