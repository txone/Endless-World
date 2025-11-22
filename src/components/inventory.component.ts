import { Component, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../services/game.service';
import { Item, Equipment } from '../game.types';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-[#2a2a2a] border-l-4 border-[#444] h-full flex flex-col p-4 text-white font-mono select-none">
      
      <!-- Equipment Stats -->
      <div class="mb-6 bg-[#111] p-3 rounded border border-[#333]">
        <h3 class="text-yellow-500 text-sm mb-2 border-b border-[#333] pb-1">Stats</h3>
        <div class="grid grid-cols-2 gap-2 text-xs">
           <div class="text-red-400">HP: {{ stats().hp }} / {{ stats().maxHp }}</div>
           <div class="text-orange-400">ATK: {{ stats().atk }}</div>
           <div class="text-blue-400">DEF: {{ stats().def }}</div>
           <div class="text-green-400">LVL: {{ stats().level }}</div>
        </div>
        <div class="mt-2 w-full bg-gray-800 h-2 rounded-full overflow-hidden">
             <div class="bg-yellow-600 h-full" [style.width.%]="(stats().exp % (stats().level * 100)) / (stats().level * 100) * 100"></div>
        </div>
      </div>

      <!-- Equipment Slots -->
      <div class="mb-6">
         <h3 class="text-gray-400 text-sm mb-2">Equipment</h3>
         <div class="grid grid-cols-2 gap-3">
             @for (slot of slots; track slot) {
                 <div class="relative bg-[#1a1a1a] border-2 border-[#333] p-1 h-16 flex items-center justify-center cursor-pointer hover:border-yellow-600 group"
                      (click)="unequip(slot)">
                    @if (equip()[slot]) {
                        <div class="text-center">
                            <div class="text-2xl" [style.color]="equip()[slot]?.color">{{ getItemIcon(slot) }}</div>
                            <div class="text-[10px] truncate w-20" [style.color]="equip()[slot]?.color">
                                {{ equip()[slot]?.name }}
                            </div>
                        </div>
                        <!-- Tooltip -->
                        <div class="absolute right-full top-0 mr-2 w-40 bg-black border border-yellow-600 p-2 z-50 hidden group-hover:block pointer-events-none">
                            <div class="text-yellow-500 text-xs font-bold">{{ equip()[slot]?.name }}</div>
                            <div class="text-gray-400 text-[10px]">{{ equip()[slot]?.description }}</div>
                            <div class="text-white text-[10px] mt-1">
                                @if (equip()[slot]?.stats?.atk) { <div>ATK +{{equip()[slot]?.stats?.atk}}</div> }
                                @if (equip()[slot]?.stats?.def) { <div>DEF +{{equip()[slot]?.stats?.def}}</div> }
                                @if (equip()[slot]?.stats?.maxHp) { <div>HP +{{equip()[slot]?.stats?.maxHp}}</div> }
                            </div>
                        </div>
                    } @else {
                        <span class="text-gray-700 text-xs uppercase">{{ slot }}</span>
                    }
                 </div>
             }
         </div>
      </div>

      <!-- Inventory Grid -->
      <div class="flex-1 overflow-hidden flex flex-col">
          <h3 class="text-gray-400 text-sm mb-2">Bag ({{ inventory().length }}/20)</h3>
          <div class="flex-1 overflow-y-auto pr-1">
             <div class="grid grid-cols-4 gap-2">
                 @for (item of inventory(); track item.id) {
                     <div class="aspect-square bg-[#1a1a1a] border border-[#444] flex items-center justify-center cursor-pointer hover:bg-[#333] relative group"
                          [style.borderColor]="item.color"
                          (click)="equipItem(item)">
                         <span class="text-xl">{{ getItemTypeIcon(item.type) }}</span>
                         
                         <!-- Tooltip -->
                        <div class="absolute right-full top-0 mr-2 w-48 bg-black border border-white p-2 z-50 hidden group-hover:block pointer-events-none">
                            <div class="text-xs font-bold" [style.color]="item.color">{{ item.name }}</div>
                            <div class="text-[10px] text-gray-400">{{ item.rarity }} {{ item.type }}</div>
                            <div class="text-white text-[10px] mt-1">
                                @if (item.stats.atk) { <div>ATK +{{item.stats.atk}}</div> }
                                @if (item.stats.def) { <div>DEF +{{item.stats.def}}</div> }
                                @if (item.stats.hp) { <div>RESTORE {{item.stats.hp}} HP</div> }
                                @if (item.stats.maxHp) { <div>MaxHP +{{item.stats.maxHp}}</div> }
                            </div>
                            <div class="text-[9px] text-gray-500 mt-1 italic">Click to equip/use</div>
                        </div>
                     </div>
                 }
                 <!-- Empty slots filler -->
                 @for (i of emptySlots(); track i) {
                     <div class="aspect-square bg-[#111] border border-[#222]"></div>
                 }
             </div>
          </div>
      </div>

    </div>
  `,
  styles: []
})
export class InventoryComponent {
  game = inject(GameService);
  inventory = this.game.inventory;
  equip = this.game.playerEquipment;
  stats = this.game.totalStats;
  
  slots: (keyof Equipment)[] = ['weapon', 'armor', 'helm', 'accessory'];

  emptySlots = computed(() => {
     const count = 20 - this.inventory().length;
     return count > 0 ? Array(count).fill(0).map((_, i) => i) : [];
  });

  equipItem(item: Item) {
      this.game.equipItem(item);
  }

  unequip(slot: keyof Equipment) {
      this.game.unequipItem(slot);
  }

  getItemIcon(slot: string): string {
      switch(slot) {
          case 'weapon': return '⚔️';
          case 'armor': return '🛡️';
          case 'helm': return '🪖';
          case 'accessory': return '💍';
          default: return '?';
      }
  }

  getItemTypeIcon(type: string): string {
      if (type === 'consumable') return '🧪';
      return this.getItemIcon(type);
  }
}