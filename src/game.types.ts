export type ItemType = 'weapon' | 'armor' | 'helm' | 'accessory' | 'consumable';
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary';

export interface Stats {
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  exp: number;
  level: number;
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
}

export interface Tile {
  x: number;
  y: number;
  type: 'grass' | 'water' | 'mountain' | 'sand' | 'forest';
  visible: boolean;
}

export interface GameLog {
  message: string;
  type: 'info' | 'combat' | 'loot' | 'level';
  timestamp: number;
}
