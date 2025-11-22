export type ItemType = 'weapon' | 'armor' | 'helm' | 'accessory' | 'consumable';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
export type AiType = 'hunter' | 'guardian'; // hunter = chases far, guardian = returns to spawn

export interface Stats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  level: number;
  // Special Attributes
  critRate?: number; // Percentage (0-100)
  critDmg?: number; // Percentage (base 150%)
  dodge?: number; // Percentage (0-100)
  lifesteal?: number; // Percentage of damage returned as HP
  attackSpeed?: number; // 100 is base. 200 = 2x chance to hit.
}

export interface Item {
  id: string;
  name: string;
  type: ItemType;
  rarity: Rarity;
  stats: Partial<Stats>;
  value: number;
  description: string;
  color: string;
  effect?: 'teleport' | 'xp' | 'full_heal'; // Special effects for consumables
  visualTags?: string[]; // e.g., 'fire', 'ice', 'poison', 'lightning'
}

export interface Equipment {
  weapon: Item | null;
  armor: Item | null;
  helm: Item | null;
  accessory: Item | null;
}

export interface Entity {
  id: string;
  x: number;
  y: number;
  type: 'player' | 'monster' | 'npc';
  name: string;
  stats: Stats;
  symbol: string; // Emoji or char
  color: string; // Hex
  equipment?: Equipment; // Monsters can have loot/gear
  activeTags?: string[]; // Visual auras active on entity
  
  // AI Properties
  ai?: AiType;
  spawnOrigin?: { x: number, y: number };
}

export interface Tile {
  x: number;
  y: number;
  type: 'grass' | 'water' | 'mountain' | 'sand' | 'forest';
  visible: boolean;
}

export interface GameLog {
  message: string;
  type: 'info' | 'combat' | 'loot' | 'level' | 'crit';
  timestamp: number;
}