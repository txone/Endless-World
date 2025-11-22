import { Injectable, signal, computed } from '@angular/core';
import { Entity, Tile, Item, Stats, GameLog, Equipment, Rarity, ItemType, AiType } from '../game.types';

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
    stats: { 
        hp: 100, maxHp: 100, atk: 10, def: 2, exp: 0, level: 1,
        critRate: 5, critDmg: 150, dodge: 0, lifesteal: 0, attackSpeed: 100
    },
    activeTags: []
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
    let critRate = base.critRate || 5;
    let critDmg = base.critDmg || 150;
    let dodge = base.dodge || 0;
    let lifesteal = base.lifesteal || 0;
    let attackSpeed = base.attackSpeed || 100;
    
    const activeTags = new Set<string>();

    [equip.weapon, equip.armor, equip.helm, equip.accessory].forEach(item => {
      if (item && item.stats) {
        atk += item.stats.atk || 0;
        def += item.stats.def || 0;
        maxHp += item.stats.maxHp || 0;
        
        // Special Attributes
        critRate += item.stats.critRate || 0;
        critDmg += item.stats.critDmg || 0;
        dodge += item.stats.dodge || 0;
        lifesteal += item.stats.lifesteal || 0;
        attackSpeed += item.stats.attackSpeed || 0;

        if (item.visualTags) {
            item.visualTags.forEach(tag => activeTags.add(tag));
        }
      }
    });
    
    return { 
        stats: { ...base, atk, def, maxHp, critRate, critDmg, dodge, lifesteal, attackSpeed },
        tags: Array.from(activeTags)
    };
  });

  constructor() {
    this.addLog('Welcome to the endless realms of Hua Xia.', 'info');
    this.addLog('Use ARROW keys to move. Bump into enemies to attack.', 'info');
    this.generateMapArea(0, 0);
    
    // Starter gear - Give a visual item for demonstration
    const starterSword = this.generateItem(1, 'weapon', 'rare');
    starterSword.name = "Burning Blade";
    starterSword.visualTags = ['fire'];
    starterSword.description = "A blade wreathed in eternal flame.";
    this.addItemToInventory(starterSword);
    
    this.addItemToInventory(this.generateItem(1, 'consumable', 'common')); // Free potion
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
      // Attacking takes a turn
      this.processTurn(); 
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
    let consumed = false;

    // Healing
    if (item.stats.hp) {
      this.healPlayer(item.stats.hp);
      this.addLog(`Used ${item.name}, restored ${item.stats.hp} HP`, 'info');
      consumed = true;
    }

    // Special Effects
    if (item.effect === 'full_heal') {
        this.healPlayer(10000);
        this.addLog(`Used ${item.name}, fully recovered!`, 'info');
        consumed = true;
    }
    else if (item.effect === 'teleport') {
        this.player.update(p => ({ ...p, x: 0, y: 0 }));
        this.generateMapArea(0, 0);
        this.addLog(`${item.name} warps you to the start!`, 'level');
        consumed = true;
    }
    else if (item.effect === 'xp') {
        const xpAmount = (item.stats.exp || 100);
        this.gainExp(xpAmount);
        this.addLog(`Read ${item.name}, gained ${xpAmount} EXP`, 'level');
        consumed = true;
    }

    if (consumed) {
        this.inventory.update(inv => inv.filter(i => i.id !== item.id));
    }
  }

  synthesizeItems(id1: string, id2: string) {
    const inv = this.inventory();
    const item1 = inv.find(i => i.id === id1);
    const item2 = inv.find(i => i.id === id2);

    if (!item1 || !item2) return;

    if (item1.rarity !== item2.rarity) {
        this.addLog('Synthesis Failed: Rarities must match!', 'info');
        return;
    }

    const rarities: Rarity[] = ['common', 'rare', 'epic', 'legendary'];
    const currentIndex = rarities.indexOf(item1.rarity);
    
    if (currentIndex >= rarities.length - 1) {
        this.addLog('Synthesis Failed: Cannot upgrade Legendary items!', 'info');
        return;
    }

    // Consume items
    this.inventory.update(prev => prev.filter(i => i.id !== id1 && i.id !== id2));

    // Create new item
    const newRarity = rarities[currentIndex + 1];
    // Inherit type from item 1, but regenerate completely with higher tier
    const newItem = this.generateItem(this.player().stats.level, item1.type, newRarity);
    
    // --- Special Attribute Inheritance ---
    // Check for visual tags from parents
    const parentTags = new Set<string>([
        ...(item1.visualTags || []),
        ...(item2.visualTags || [])
    ]);

    // 50% chance for each parent tag to carry over to child
    const inheritedTags: string[] = newItem.visualTags || [];
    parentTags.forEach(tag => {
        if (Math.random() > 0.5 && !inheritedTags.includes(tag)) {
            inheritedTags.push(tag);
        }
    });
    newItem.visualTags = inheritedTags;

    // Append inherited name if meaningful tags exist
    if (inheritedTags.length > 0 && newItem.visualTags?.length !== item1.visualTags?.length) {
        newItem.description += ` Synthesized with latent power.`;
    }

    this.addItemToInventory(newItem);
    this.addLog(`Synthesis Success! Created ${newItem.name}`, 'level');
  }

  // --- Internals ---

  private processTurn() {
    const p = this.player();
    const fullStats = this.totalStats().stats;

    // 1. Passive Regen
    if (p.stats.hp < fullStats.maxHp) {
        this.player.update(curr => ({...curr, stats: {...curr.stats, hp: Math.min(curr.stats.hp + 1, fullStats.maxHp)}}));
    }

    // 2. Monster AI (Two-Phase: Plan Move -> Execute Attack)
    const currentEntities = this.entities();
    const nextEntities: Entity[] = [];
    const occupied = new Set<string>();
    
    // Reserve player spot
    occupied.add(`${p.x},${p.y}`);

    const attackingMonsters: Entity[] = [];

    for (const entity of currentEntities) {
        if (entity.type !== 'monster') {
            nextEntities.push(entity);
            occupied.add(`${entity.x},${entity.y}`);
            continue;
        }

        // Determine logic based on AI Type
        // Hunter: Aggro range 8, pursues relentlessly
        // Guardian: Aggro range 4, Leash range 7 (returns to spawn if too far)
        
        const distToPlayer = Math.abs(p.x - entity.x) + Math.abs(p.y - entity.y);
        const origin = entity.spawnOrigin || { x: entity.x, y: entity.y };
        const distToSpawn = Math.abs(origin.x - entity.x) + Math.abs(origin.y - entity.y);
        
        let targetX = entity.x;
        let targetY = entity.y;
        let intent: 'attack_player' | 'return_spawn' | 'idle' = 'idle';

        if (entity.ai === 'hunter') {
            if (distToPlayer <= 8) {
                intent = 'attack_player';
            } else {
                intent = 'idle'; // Wander?
            }
        } else { // Guardian
            if (distToPlayer <= 4 && distToSpawn <= 7) {
                intent = 'attack_player';
            } else if (distToSpawn > 0) {
                intent = 'return_spawn';
            }
        }

        // Calculate Next Step
        if (intent === 'attack_player') {
             if (distToPlayer === 1) {
                 // Attack position achieved
                 attackingMonsters.push(entity);
                 nextEntities.push(entity);
                 occupied.add(`${entity.x},${entity.y}`);
                 continue;
             }
             // Move towards player
             targetX = p.x;
             targetY = p.y;
        } else if (intent === 'return_spawn') {
             targetX = origin.x;
             targetY = origin.y;
             
             // Regen while returning
             if (entity.stats.hp < entity.stats.maxHp) {
                 entity.stats.hp = Math.min(entity.stats.hp + 2, entity.stats.maxHp);
             }
        } else {
             // Idle/Wander logic could go here
             nextEntities.push(entity);
             occupied.add(`${entity.x},${entity.y}`);
             continue;
        }

        // Simple Pathfinding (Towards Target)
        const dx = targetX - entity.x;
        const dy = targetY - entity.y;
        
        let nextX = entity.x;
        let nextY = entity.y;

        // Prefer axis with larger distance
        if (Math.abs(dx) > Math.abs(dy)) {
            nextX += Math.sign(dx);
        } else {
            nextY += Math.sign(dy);
        }

        // Check if blocked
        const key = `${nextX},${nextY}`;
        const tile = this.getTileType(nextX, nextY);
        const isBlocked = occupied.has(key) || tile === 'water' || tile === 'mountain';

        if (!isBlocked) {
            nextEntities.push({ ...entity, x: nextX, y: nextY });
            occupied.add(key);
        } else {
            // Try secondary axis if blocked
            let altX = entity.x;
            let altY = entity.y;
            if (Math.abs(dx) > Math.abs(dy)) {
                altY += Math.sign(dy); // Try Y instead
            } else {
                altX += Math.sign(dx); // Try X instead
            }
            
            const altKey = `${altX},${altY}`;
            const altTile = this.getTileType(altX, altY);
            const altBlocked = occupied.has(altKey) || altTile === 'water' || altTile === 'mountain';
            
            if (!altBlocked && (altX !== entity.x || altY !== entity.y)) {
                 nextEntities.push({ ...entity, x: altX, y: altY });
                 occupied.add(altKey);
            } else {
                 // Truly blocked
                 nextEntities.push(entity);
                 occupied.add(`${entity.x},${entity.y}`);
            }
        }
    }

    // Update positions
    this.entities.set(nextEntities);

    // Execute attacks
    attackingMonsters.forEach(m => this.monsterAttackPlayer(m));

    // 3. Spawn System
    if (this.entities().length < 8) { // Increased cap slightly
      if (Math.random() > 0.65) this.spawnMonster();
    }
    
    // 4. Cleanup Distance (Despawn if VERY far)
    const px = p.x;
    const py = p.y;
    this.entities.update(ents => ents.filter(e => Math.abs(e.x - px) <= this.VIEW_RADIUS + 6 && Math.abs(e.y - py) <= this.VIEW_RADIUS + 6));
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
    const pStats = this.totalStats().stats;
    
    // --- Player Attack Logic ---
    const performAttack = () => {
        let dmg = Math.max(1, pStats.atk - target.stats.def);
        
        // Crit Check
        let isCrit = false;
        if (Math.random() * 100 < (pStats.critRate || 5)) {
            isCrit = true;
            dmg = Math.floor(dmg * (pStats.critDmg || 150) / 100);
        }

        // Variance
        dmg += Math.floor(Math.random() * (pStats.level + 2));
        target.stats.hp -= dmg;
        
        // Lifesteal
        if ((pStats.lifesteal || 0) > 0) {
            const healAmount = Math.ceil(dmg * (pStats.lifesteal! / 100));
            if (healAmount > 0) this.healPlayer(healAmount);
        }

        this.addLog(
            `You hit ${target.name} for ${dmg}${isCrit ? '!' : ''}`, 
            isCrit ? 'crit' : 'combat'
        );
    };

    performAttack();

    // Attack Speed / Double Hit Check
    const extraHitChance = (pStats.attackSpeed || 100) - 100;
    if (extraHitChance > 0 && target.stats.hp > 0) {
        if (Math.random() * 100 < extraHitChance) {
            this.addLog('Double Strike!', 'crit');
            performAttack();
        }
    }

    if (target.stats.hp <= 0) {
      this.killEntity(target);
      return;
    }
  }

  private monsterAttackPlayer(monster: Entity) {
    if (this.gameOver()) return;
    
    const pStats = this.totalStats().stats;

    // Dodge Check
    if (Math.random() * 100 < (pStats.dodge || 0)) {
        this.addLog(`You dodged ${monster.name}'s attack!`, 'info');
        return;
    }

    const mDmg = Math.max(1, monster.stats.atk - pStats.def + Math.floor(Math.random() * 2));
    this.player.update(p => ({ ...p, stats: { ...p.stats, hp: p.stats.hp - mDmg } }));
    this.addLog(`${monster.name} hits you for ${mDmg} dmg!`, 'combat');

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
      
      // Base Stat Growth
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
     const max = this.totalStats().stats.maxHp;
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
    this.addLog(`Found ${item.name}`, 'loot');
  }

  // --- Map & Spawning ---

  public getTileType(x: number, y: number): Tile['type'] {
    // Pseudo-random based on coords for infinite consistency
    const seed = Math.sin(x * 12.9898 + y * 78.233) * 43758.5453;
    const val = seed - Math.floor(seed);
    
    if (val > 0.85) return 'mountain';
    if (val > 0.80) return 'water';
    if (val > 0.70) return 'forest';
    if (val > 0.60) return 'sand';
    return 'grass';
  }

  private generateMapArea(centerX: number, centerY: number) {
    const tiles: Tile[] = [];
    const r = this.VIEW_RADIUS + 1; // +1 buffer for smooth visual edges

    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = centerX + dx;
        const y = centerY + dy;
        tiles.push({
          x, y,
          type: this.getTileType(x, y),
          visible: true
        });
      }
    }
    this.mapTiles.set(tiles);
  }

  private spawnMonster() {
      const player = this.player();
      const r = this.VIEW_RADIUS;
      
      // Try 5 times to find a valid spot
      for (let i=0; i<5; i++) {
          const dx = Math.floor(Math.random() * (r * 2 + 1)) - r;
          const dy = Math.floor(Math.random() * (r * 2 + 1)) - r;
          
          // Not on player
          if (dx === 0 && dy === 0) continue;

          const x = player.x + dx;
          const y = player.y + dy;

          // Check terrain
          const tile = this.getTileType(x, y);
          if (tile === 'water' || tile === 'mountain') continue;

          // Check existing
          if (this.entities().some(e => e.x === x && e.y === y)) continue;

          // Create
          const level = player.stats.level;
          const types = [
              { name: 'Slime', s: '💧', c: '#60a5fa', ai: 'guardian' },
              { name: 'Goblin', s: '👺', c: '#4ade80', ai: 'guardian' },
              { name: 'Skeleton', s: '💀', c: '#d1d5db', ai: 'guardian' },
              { name: 'Orc', s: '👹', c: '#16a34a', ai: 'hunter' }, // Orcs hunt
              { name: 'Demon', s: '👿', c: '#dc2626', ai: 'hunter' } // Demons hunt
          ];
          const t = types[Math.floor(Math.random() * types.length)];
          
          // Scale stats slightly
          const scale = 1 + (level * 0.1);

          const monster: Entity = {
              id: Math.random().toString(36),
              x, y, type: 'monster',
              name: t.name, symbol: t.s, color: t.c,
              ai: t.ai as AiType,
              spawnOrigin: { x, y },
              stats: {
                  hp: Math.floor(20 * scale), maxHp: Math.floor(20 * scale),
                  atk: Math.floor(5 * scale), def: Math.floor(1 * scale),
                  exp: 0, level
              }
          };
          
          this.entities.update(ents => [...ents, monster]);
          break;
      }
  }

  // --- Rich Item Generation ---
  
  private generateItem(level: number, forceType?: ItemType, forceRarity?: Rarity): Item {
    const types: ItemType[] = ['weapon', 'armor', 'helm', 'accessory', 'consumable'];
    const type = forceType || types[Math.floor(Math.random() * types.length)];
    
    // 1. Rarity
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

    // 2. Special Handling for Consumables
    if (type === 'consumable') {
        return this.generateConsumable(level, rarity);
    }

    // 3. Equipment Prefixes (Material/Tier)
    const materials = [
        { name: 'Broken', scale: 0.5 },
        { name: 'Rusty', scale: 0.8 },
        { name: 'Iron', scale: 1.0 },
        { name: 'Steel', scale: 1.2 },
        { name: 'Mithril', scale: 1.5 },
        { name: 'Adamant', scale: 2.0 },
        { name: 'Dragon', scale: 2.5 },
        { name: 'Void', scale: 3.0 }
    ];
    // Pick material based on level
    let matIndex = Math.min(Math.floor(level / 4), materials.length - 1);
    // Variance
    matIndex = Math.max(0, Math.min(materials.length - 1, matIndex + (Math.random() > 0.5 ? 1 : -1)));
    const mat = materials[matIndex];

    // 4. Base Stats
    let baseName = '';
    let stats: Partial<Stats> = {};
    const baseVal = (level * 2) * mat.scale;

    switch (type) {
      case 'weapon': 
        baseName = 'Blade'; 
        stats = { atk: Math.floor(baseVal * 2) }; 
        break;
      case 'armor': 
        baseName = 'Plate'; 
        stats = { def: Math.floor(baseVal), maxHp: Math.floor(baseVal * 5) }; 
        break;
      case 'helm': 
        baseName = 'Helm'; 
        stats = { def: Math.floor(baseVal * 0.5), maxHp: Math.floor(baseVal * 3) }; 
        break;
      case 'accessory': 
        baseName = 'Ring'; 
        stats = { atk: Math.floor(baseVal * 0.5), maxHp: Math.floor(baseVal * 4) }; 
        break;
    }

    // 5. Affixes (Suffixes) - The "Rich" part
    const suffixes = [
        { name: 'of Power', stat: 'atk', val: 0.2 }, // +20% base
        { name: 'of Iron', stat: 'def', val: 0.2 },
        { name: 'of Vitality', stat: 'maxHp', val: 0.2 },
        { name: 'of the Hawk', stat: 'critRate', flat: 5 }, // +5% crit
        { name: 'of Ruin', stat: 'critDmg', flat: 25 }, // +25% crit dmg
        { name: 'of Mist', stat: 'dodge', flat: 3 }, // +3% dodge
        { name: 'of the Bat', stat: 'lifesteal', flat: 2 }, // +2% lifesteal
        { name: 'of Haste', stat: 'attackSpeed', flat: 15 }, // +15% AS
        
        // Elemental Visual Affixes
        { name: 'of Hellfire', stat: 'atk', val: 0.1, visual: 'fire' },
        { name: 'of Glaciation', stat: 'def', val: 0.1, visual: 'ice' },
        { name: 'of Storms', stat: 'critRate', flat: 5, visual: 'lightning' },
        { name: 'of Venom', stat: 'attackSpeed', flat: 10, visual: 'poison' }
    ];

    let suffixName = '';
    let suffixCount = 0;
    const visualTags: string[] = [];

    if (rarity === 'rare') suffixCount = 1;
    if (rarity === 'epic') suffixCount = 2;
    if (rarity === 'legendary') suffixCount = 3;
    // Small chance for common to have 1
    if (rarity === 'common' && Math.random() > 0.9) suffixCount = 1;

    for(let i=0; i<suffixCount; i++) {
        const suff = suffixes[Math.floor(Math.random() * suffixes.length)];
        if (i === 0) suffixName = suff.name; // Only use first suffix for name
        
        if (suff.flat) {
            // @ts-ignore
            stats[suff.stat] = (stats[suff.stat] || 0) + suff.flat;
        } else if (suff.val) {
            // Percent boost to base stats
             if (suff.stat === 'atk' && stats.atk) stats.atk = Math.floor(stats.atk * (1 + suff.val));
             if (suff.stat === 'def' && stats.def) stats.def = Math.floor(stats.def * (1 + suff.val));
             if (suff.stat === 'maxHp' && stats.maxHp) stats.maxHp = Math.floor(stats.maxHp * (1 + suff.val));
        }

        if (suff.visual) {
            visualTags.push(suff.visual);
        }
    }

    // Rarity Color & Multiplier
    let mult = 1;
    let color = '#9ca3af'; // gray
    if (rarity === 'rare') { mult = 1.2; color = '#3b82f6'; } // blue
    if (rarity === 'epic') { mult = 1.5; color = '#a855f7'; } // purple
    if (rarity === 'legendary') { mult = 2.0; color = '#eab308'; } // gold

    // Apply final rarity multiplier to main stats
    if (stats.atk) stats.atk = Math.floor(stats.atk * mult);
    if (stats.def) stats.def = Math.floor(stats.def * mult);
    if (stats.maxHp) stats.maxHp = Math.floor(stats.maxHp * mult);

    return {
      id: Math.random().toString(36),
      name: `${mat.name} ${baseName} ${suffixName}`.trim(),
      type,
      rarity,
      stats,
      value: Math.floor(baseVal * 10 * mult),
      description: `A ${rarity} item made of ${mat.name}.`,
      color,
      visualTags: visualTags.length > 0 ? visualTags : undefined
    };
  }

  private generateConsumable(level: number, rarity: Rarity): Item {
     const roll = Math.random();
     if (roll < 0.6) {
         const hp = 50 + (level * 20);
         return {
             id: Math.random().toString(36),
             name: 'Health Potion', type: 'consumable', rarity: 'common',
             stats: { hp }, value: 10, color: '#ef4444',
             description: `Restores ${hp} HP.`
         };
     }
     if (roll < 0.75) {
         return {
             id: Math.random().toString(36),
             name: 'Scroll of Return', type: 'consumable', rarity: 'rare',
             stats: {}, value: 50, color: '#3b82f6',
             effect: 'teleport',
             description: 'Teleports you back to the starting point.'
         };
     }
     if (roll < 0.9) {
         const xp = 100 + (level * 50);
         return {
             id: Math.random().toString(36),
             name: 'Tome of Knowledge', type: 'consumable', rarity: 'epic',
             stats: { exp: xp }, value: 100, color: '#a855f7',
             effect: 'xp',
             description: `Grants ${xp} Experience instantly.`
         };
     }
     return {
         id: Math.random().toString(36),
         name: 'Elixir of Life', type: 'consumable', rarity: 'legendary',
         stats: {}, value: 500, color: '#eab308',
         effect: 'full_heal',
         description: 'Fully restores Health.'
     };
  }

  private addLog(msg: string, type: GameLog['type']) {
    this.logs.update(prev => [{ message: msg, type, timestamp: Date.now() }, ...prev].slice(0, 30));
  }
}