import { Injectable, signal, computed } from '@angular/core';
import { Entity, Tile, Item, Stats, GameLog, Equipment, Rarity, ItemType } from '../game.types';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  // Config
  readonly VIEW_RADIUS = 5; // 11x11 grid
  readonly CHUNK_SIZE = 11;

  // State
  readonly player = signal<Entity>({
    id: 'player',
    x: 0,
    y: 0,
    type: 'player',
    name: 'Hero',
    symbol: '🧙‍♂️',
    color: '#3b82f6',
    stats: { hp: 100, maxHp: 100, atk: 10, def: 2, exp: 0, level: 1 }
  });

  readonly playerEquipment = signal<Equipment>({
    weapon: null,
    armor: null,
    helm: null,
    accessory: null
  });

  readonly inventory = signal<Item[]>([]);
  readonly mapTiles = signal<Tile[]>([]);
  readonly entities = signal<Entity[]>([]);
  readonly logs = signal<GameLog[]>([]);
  readonly gameOver = signal<boolean>(false);

  // Derived
  readonly totalStats = computed(() => {
    const base = this.player().stats;
    const equip = this.playerEquipment();
    
    let atk = base.atk;
    let def = base.def;
    let maxHp = base.maxHp;

    [equip.weapon, equip.armor, equip.helm, equip.accessory].forEach(item => {
      if (item && item.stats) {
        atk += item.stats.atk || 0;
        def += item.stats.def || 0;
        maxHp += item.stats.maxHp || 0;
      }
    });

    return { ...base, atk, def, maxHp };
  });

  constructor() {
    this.addLog('Welcome to the endless realms of Hua Xia.', 'info');
    this.addLog('Use ARROW keys to move. Bump into enemies to attack.', 'info');
    this.generateMapArea(0, 0);
    
    // Starter gear
    this.addItemToInventory(this.generateItem(1, 'weapon', 'common'));
  }

  // --- Actions ---

  movePlayer(dx: number, dy: number) {
    if (this.gameOver()) return;

    const current = this.player();
    const targetX = current.x + dx;
    const targetY = current.y + dy;

    // Check collision with entities
    const targetEntity = this.entities().find(e => e.x === targetX && e.y === targetY);
    if (targetEntity) {
      this.interactWithEntity(targetEntity);
      return;
    }

    // Check terrain (simple check: water/mountain block)
    const tileType = this.getTileType(targetX, targetY);
    if (tileType === 'water' || tileType === 'mountain') {
      this.addLog('Blocked by terrain.', 'info');
      return;
    }

    // Move
    this.player.update(p => ({ ...p, x: targetX, y: targetY }));
    this.generateMapArea(targetX, targetY);
    this.processTurn();
  }

  equipItem(item: Item) {
    if (item.type === 'consumable') {
      this.consumeItem(item);
      return;
    }

    const currentEquip = this.playerEquipment();
    const slot = item.type as keyof Equipment;

    const unequipped = currentEquip[slot];

    // Remove from inventory
    this.inventory.update(inv => inv.filter(i => i.id !== item.id));

    // Add old item back to inventory if exists
    if (unequipped) {
      this.inventory.update(inv => [...inv, unequipped]);
    }

    // Equip new
    this.playerEquipment.update(eq => ({ ...eq, [slot]: item }));
    this.addLog(`Equipped ${item.name}`, 'info');
  }

  unequipItem(slot: keyof Equipment) {
    const item = this.playerEquipment()[slot];
    if (item) {
      this.playerEquipment.update(eq => ({ ...eq, [slot]: null }));
      this.inventory.update(inv => [...inv, item]);
      this.addLog(`Unequipped ${item.name}`, 'info');
    }
  }

  consumeItem(item: Item) {
    if (item.stats.hp) {
      this.healPlayer(item.stats.hp);
      this.inventory.update(inv => inv.filter(i => i.id !== item.id));
      this.addLog(`Used ${item.name}`, 'info');
    }
  }

  // --- Internals ---

  private processTurn() {
    // Regenerate health slightly
    if (this.player().stats.hp < this.totalStats().maxHp) {
        this.player.update(p => ({...p, stats: {...p.stats, hp: Math.min(p.stats.hp + 1, this.totalStats().maxHp)}}));
    }

    // Spawn entities randomly near player if low count
    if (this.entities().length < 5) {
      if (Math.random() > 0.7) this.spawnMonster();
    }
    
    // Despawn far entities
    const px = this.player().x;
    const py = this.player().y;
    this.entities.update(ents => ents.filter(e => Math.abs(e.x - px) <= this.VIEW_RADIUS + 2 && Math.abs(e.y - py) <= this.VIEW_RADIUS + 2));
  }

  private interactWithEntity(target: Entity) {
    if (target.type === 'monster') {
      this.combatRound(target);
    } else if (target.type === 'npc') {
      this.addLog(`${target.name} says: "Stay safe out there, traveler."`, 'info');
      this.healPlayer(1000); // Full heal at NPC
      this.addLog('You have been fully healed.', 'info');
    }
  }

  private combatRound(target: Entity) {
    const pStats = this.totalStats();
    
    // Player hits monster
    const damage = Math.max(1, pStats.atk - target.stats.def + Math.floor(Math.random() * 3));
    target.stats.hp -= damage;
    this.addLog(`You hit ${target.name} for ${damage} dmg!`, 'combat');

    if (target.stats.hp <= 0) {
      this.killEntity(target);
      return;
    }

    // Monster hits player
    const mDmg = Math.max(1, target.stats.atk - pStats.def + Math.floor(Math.random() * 2));
    this.player.update(p => ({ ...p, stats: { ...p.stats, hp: p.stats.hp - mDmg } }));
    this.addLog(`${target.name} hits you for ${mDmg} dmg!`, 'combat');

    if (this.player().stats.hp <= 0) {
      this.gameOver.set(true);
      this.addLog('YOU HAVE DIED.', 'combat');
    }
  }

  private killEntity(target: Entity) {
    this.entities.update(prev => prev.filter(e => e.id !== target.id));
    this.addLog(`Defeated ${target.name}!`, 'combat');
    
    // Loot
    if (Math.random() > 0.3) {
      const item = this.generateItem(this.player().stats.level, undefined, undefined);
      this.addItemToInventory(item);
    }

    // Exp
    const xpGain = 10 + (target.stats.level * 5);
    this.gainExp(xpGain);
  }

  private gainExp(amount: number) {
    const current = this.player();
    let newExp = current.stats.exp + amount;
    let newLevel = current.stats.level;
    const nextLevel = newLevel * 100;

    if (newExp >= nextLevel) {
      newLevel++;
      newExp -= nextLevel;
      this.addLog(`LEVEL UP! You are now level ${newLevel}`, 'level');
      // Stat boost handled by base stats update (simplified here, just increasing base HP/Atk)
      this.player.update(p => ({
        ...p,
        stats: {
          ...p.stats,
          maxHp: p.stats.maxHp + 20,
          hp: p.stats.maxHp + 20,
          atk: p.stats.atk + 2,
          def: p.stats.def + 1,
          level: newLevel,
          exp: newExp
        }
      }));
    } else {
      this.player.update(p => ({ ...p, stats: { ...p.stats, exp: newExp } }));
    }
  }

  private healPlayer(amount: number) {
     const max = this.totalStats().maxHp;
     this.player.update(p => ({
        ...p, stats: { ...p.stats, hp: Math.min(p.stats.hp + amount, max) }
     }));
  }

  private addItemToInventory(item: Item) {
    if (this.inventory().length >= 20) {
      this.addLog('Inventory full! Item lost.', 'info');
      return;
    }
    this.inventory.update(inv => [...inv, item]);
    this.addLog(`Found ${item.name} (${item.rarity})`, 'loot');
  }

  // --- Generation ---

  private generateMapArea(cx: number, cy: number) {
    const newTiles: Tile[] = [];
    const r = this.VIEW_RADIUS;
    for (let y = cy - r; y <= cy + r; y++) {
      for (let x = cx - r; x <= cx + r; x++) {
        newTiles.push({
          x, y,
          type: this.getTileType(x, y),
          visible: true
        });
      }
    }
    this.mapTiles.set(newTiles);
  }

  private getTileType(x: number, y: number): Tile['type'] {
    // Deterministic pseudo-random based on coords
    const val = Math.abs(Math.sin(x * 12.9898 + y * 78.233) * 43758.5453) % 1;
    if (val < 0.1) return 'water';
    if (val < 0.15) return 'mountain';
    if (val < 0.25) return 'forest';
    if (val < 0.30) return 'sand';
    return 'grass';
  }

  private spawnMonster() {
    const r = this.VIEW_RADIUS;
    const px = this.player().x;
    const py = this.player().y;
    // Random spot in view but not on player
    const dx = Math.floor(Math.random() * (r * 2)) - r;
    const dy = Math.floor(Math.random() * (r * 2)) - r;
    if (dx === 0 && dy === 0) return;
    
    const mx = px + dx;
    const my = py + dy;

    // Check blocked
    const tile = this.getTileType(mx, my);
    if (tile === 'water' || tile === 'mountain') return;

    const level = this.player().stats.level;
    const typeRoll = Math.random();
    let name = 'Wild Dog';
    let symbol = '🐕';
    let color = '#a8a29e';
    let stats: Stats = { hp: 20 + level * 5, maxHp: 20, atk: 5 + level, def: 0 + level, exp: 0, level: level };

    if (typeRoll > 0.6) {
        name = 'Bandit'; symbol = '🥷'; color = '#ef4444';
        stats = { hp: 40 + level * 8, maxHp: 40, atk: 8 + level * 2, def: 2 + level, exp: 0, level: level };
    }
    if (typeRoll > 0.9) {
        name = 'Tiger King'; symbol = '🐯'; color = '#f59e0b';
        stats = { hp: 100 + level * 10, maxHp: 100, atk: 15 + level * 2, def: 5 + level, exp: 0, level: level };
    }

    this.entities.update(prev => [
      ...prev,
      {
        id: Math.random().toString(36),
        x: mx, y: my,
        type: 'monster',
        name, symbol, color, stats
      }
    ]);
  }

  // --- Item Gen ---
  
  private generateItem(level: number, forceType?: ItemType, forceRarity?: Rarity): Item {
    const types: ItemType[] = ['weapon', 'armor', 'helm', 'accessory', 'consumable'];
    const type = forceType || types[Math.floor(Math.random() * types.length)];
    
    const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
    const rarityWeights = [0.6, 0.3, 0.08, 0.02];
    let rarity = forceRarity;
    
    if (!rarity) {
        const rVal = Math.random();
        let accum = 0;
        for(let i=0; i<rarities.length; i++) {
            accum += rarityWeights[i];
            if (rVal < accum) { rarity = rarities[i]; break; }
        }
        if (!rarity) rarity = 'common';
    }

    const prefixes = ['Broken', 'Iron', 'Bronze', 'Silver', 'Gold', 'Jade', 'Celestial', 'Dragon'];
    // Scale prefix index by level roughly
    let pIndex = Math.floor(Math.min(level / 3, prefixes.length - 1));
    if (rarity === 'legendary') pIndex = Math.min(pIndex + 2, prefixes.length - 1);
    
    const prefix = prefixes[pIndex];
    let baseName = '';
    let stats: Partial<Stats> = {};

    switch (type) {
      case 'weapon': 
        baseName = 'Sword'; 
        stats = { atk: (pIndex + 1) * 5 + Math.floor(Math.random() * 5) }; 
        break;
      case 'armor': 
        baseName = 'Plate'; 
        stats = { def: (pIndex + 1) * 3 + Math.floor(Math.random() * 3), maxHp: (pIndex + 1) * 10 }; 
        break;
      case 'helm': 
        baseName = 'Helm'; 
        stats = { def: (pIndex + 1) * 2, maxHp: (pIndex + 1) * 5 }; 
        break;
      case 'accessory': 
        baseName = 'Ring'; 
        stats = { atk: (pIndex + 1) * 2, maxHp: (pIndex + 1) * 20 }; 
        break;
      case 'consumable':
        baseName = 'Potion';
        stats = { hp: 50 * (pIndex + 1) };
        break;
    }

    // Rarity Multipliers
    let mult = 1;
    let color = '#9ca3af'; // gray
    if (rarity === 'rare') { mult = 1.5; color = '#3b82f6'; } // blue
    if (rarity === 'epic') { mult = 2.5; color = '#a855f7'; } // purple
    if (rarity === 'legendary') { mult = 4.0; color = '#eab308'; } // gold

    if (stats.atk) stats.atk = Math.floor(stats.atk * mult);
    if (stats.def) stats.def = Math.floor(stats.def * mult);
    if (stats.maxHp) stats.maxHp = Math.floor(stats.maxHp * mult);

    return {
      id: Math.random().toString(36),
      name: `${prefix} ${baseName}`,
      type,
      rarity,
      stats,
      value: (pIndex + 1) * 10 * mult,
      description: `A ${rarity} ${type}.`,
      color
    };
  }

  private addLog(msg: string, type: GameLog['type']) {
    this.logs.update(prev => [{ message: msg, type, timestamp: Date.now() }, ...prev].slice(0, 30));
  }
}