import { Component, inject, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../services/game.service';
import { Item, Equipment, Rarity } from '../game.types';

@Component({
  selector: 'app-inventory',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bg-[#2a2a2a] border-l-4 border-[#444] h-full flex flex-col p-4 text-white font-mono select-none relative">
      
      <!-- Header / Actions -->
      <div class="flex justify-between items-center mb-4">
         <h3 class="text-yellow-500 text-sm font-bold">Inventory</h3>
         <button class="px-2 py-1 text-[10px] border transition-colors"
                 [class.bg-purple-700]="synthesisMode()"
                 [class.border-purple-500]="synthesisMode()"
                 [class.bg-gray-800]="!synthesisMode()"
                 [class.border-gray-600]="!synthesisMode()"
                 (click)="toggleSynthesis()">
             {{ synthesisMode() ? 'CANCEL MERGE' : 'MERGE GEAR' }}
         </button>
      </div>

      @if (synthesisMode()) {
        <div class="mb-2 p-2 bg-purple-900/30 border border-purple-500/50 text-[10px] text-purple-200 text-center rounded">
            Select 2 items of same rarity to upgrade.
            @if (selectedIds().length === 2) {
                <button class="block w-full mt-2 bg-purple-600 hover:bg-purple-500 text-white font-bold py-1 px-2 rounded animate-pulse"
                        (click)="confirmSynthesis()">
                    FUSE ITEMS
                </button>
            }
        </div>
      }

      <!-- Equipment Stats -->
      <div class="mb-4 bg-[#111] p-3 rounded border border-[#333]">
        <h3 class="text-gray-500 text-xs mb-2 border-b border-[#333] pb-1">Attributes</h3>
        <div class="grid grid-cols-2 gap-x-2 gap-y-1 text-[10px]">
           <div class="text-red-400">HP: {{ stats().hp }}/{{ stats().maxHp }}</div>
           <div class="text-orange-400">ATK: {{ stats().atk }}</div>
           <div class="text-blue-400">DEF: {{ stats().def }}</div>
           <div class="text-green-400">LVL: {{ stats().level }}</div>
           <!-- Advanced Stats -->
           <div class="text-yellow-300" title="Crit Chance">CRT: {{ stats().critRate }}%</div>
           <div class="text-yellow-500" title="Crit Damage">CDMG: {{ stats().critDmg }}%</div>
           <div class="text-cyan-300" title="Dodge Chance">EVA: {{ stats().dodge }}%</div>
           <div class="text-rose-400" title="Life Steal">VAMP: {{ stats().lifesteal }}%</div>
           <div class="text-white" title="Attack Speed">SPD: {{ stats().attackSpeed }}</div>
        </div>
        <div class="mt-2 w-full bg-gray-800 h-2 rounded-full overflow-hidden">
             <div class="bg-yellow-600 h-full" [style.width.%]="(stats().exp % (stats().level * 100)) / (stats().level * 100) * 100"></div>
        </div>
      </div>

      <!-- Equipment Slots -->
      <div class="mb-4">
         <h3 class="text-gray-400 text-xs mb-2">Equipped</h3>
         <div class="grid grid-cols-2 gap-2">
             @for (slot of slots; track slot) {
                 <div class="relative bg-[#1a1a1a] border-2 border-[#333] p-1 h-14 flex items-center justify-center cursor-pointer hover:border-yellow-600"
                      (mouseenter)="onMouseEnter(equip()[slot])"
                      (mouseleave)="onMouseLeave()"
                      (click)="unequip(slot)">
                    @if (equip()[slot]) {
                        <div class="text-center pointer-events-none">
                            <div class="text-xl" [style.color]="equip()[slot]?.color">{{ getItemIcon(slot) }}</div>
                        </div>
                    } @else {
                        <span class="text-gray-700 text-[10px] uppercase">{{ slot }}</span>
                    }
                 </div>
             }
         </div>
      </div>

      <!-- Inventory Grid -->
      <div class="flex-1 overflow-hidden flex flex-col">
          <h3 class="text-gray-400 text-xs mb-2">Bag ({{ inventory().length }}/20)</h3>
          <div class="flex-1 overflow-y-auto pr-1 custom-scrollbar">
             <div class="grid grid-cols-4 gap-2">
                 @for (item of inventory(); track item.id) {
                     <div class="aspect-square bg-[#1a1a1a] border-2 flex items-center justify-center cursor-pointer relative transition-all"
                          [class.border-purple-500]="isSelected(item.id)"
                          [class.bg-purple-900]="isSelected(item.id)"
                          [class.bg-gray-800]="!isSelected(item.id) && hoveredItem() === item"
                          [style.borderColor]="isSelected(item.id) ? '#a855f7' : (hoveredItem() === item ? item.color : '#444')"
                          (mouseenter)="onMouseEnter(item)"
                          (mouseleave)="onMouseLeave()"
                          (click)="handleItemClick(item)">
                         <span class="text-xl pointer-events-none">{{ getItemTypeIcon(item.type) }}</span>
                         @if(item.type === 'consumable') {
                            <span class="absolute bottom-0 right-1 text-[8px] text-white font-bold">x1</span>
                         }
                         <!-- Visual Dot for special items -->
                         @if(item.visualTags && item.visualTags.length > 0) {
                             <div class="absolute top-0 right-0 w-2 h-2 rounded-full bg-white animate-pulse"></div>
                         }
                     </div>
                 }
                 <!-- Empty slots filler -->
                 @for (i of emptySlots(); track i) {
                     <div class="aspect-square bg-[#111] border border-[#222]"></div>
                 }
             </div>
          </div>
      </div>

      <!-- FIXED TOOLTIP OVERLAY -->
      @if (hoveredItem(); as item) {
         <div class="absolute left-2 right-2 bottom-2 z-50 bg-black/95 border border-white shadow-2xl p-3 rounded pointer-events-none animate-in fade-in slide-in-from-bottom-2 duration-150">
             <div class="flex justify-between items-start mb-2">
                 <div>
                     <div class="font-bold text-sm" [style.color]="item.color">{{ item.name }}</div>
                     <div class="text-[10px] text-gray-400 uppercase">{{ item.rarity }} {{ item.type }}</div>
                 </div>
                 <div class="text-2xl opacity-50">{{ getItemTypeIcon(item.type) }}</div>
             </div>
             
             <div class="space-y-1 text-[11px] text-gray-200 border-t border-gray-800 pt-2">
                 <p class="italic text-gray-500 text-[10px] mb-2">{{ item.description }}</p>
                 
                 <!-- Basic Stats -->
                 @if (item.stats.atk) { 
                    <div class="flex justify-between"><span class="text-orange-400">Attack</span> <span>+{{item.stats.atk}}</span></div> 
                 }
                 @if (item.stats.def) { 
                    <div class="flex justify-between"><span class="text-blue-400">Defense</span> <span>+{{item.stats.def}}</span></div> 
                 }
                 @if (item.stats.maxHp) { 
                    <div class="flex justify-between"><span class="text-red-400">Max HP</span> <span>+{{item.stats.maxHp}}</span></div> 
                 }
                 
                 <!-- Special Stats -->
                 @if (item.stats.critRate) {
                    <div class="flex justify-between"><span class="text-yellow-300">Crit Chance</span> <span>+{{item.stats.critRate}}%</span></div>
                 }
                 @if (item.stats.critDmg) {
                    <div class="flex justify-between"><span class="text-yellow-500">Crit Damage</span> <span>+{{item.stats.critDmg}}%</span></div>
                 }
                 @if (item.stats.dodge) {
                    <div class="flex justify-between"><span class="text-cyan-300">Evasion</span> <span>+{{item.stats.dodge}}%</span></div>
                 }
                 @if (item.stats.lifesteal) {
                    <div class="flex justify-between"><span class="text-rose-400">Lifesteal</span> <span>+{{item.stats.lifesteal}}%</span></div>
                 }
                 @if (item.stats.attackSpeed) {
                    <div class="flex justify-between"><span class="text-white">Atk Speed</span> <span>+{{item.stats.attackSpeed}}%</span></div>
                 }

                 <!-- Visual Tags Info -->
                 @if (item.visualTags && item.visualTags.length > 0) {
                     <div class="flex flex-wrap gap-1 mt-1">
                         @for (tag of item.visualTags; track tag) {
                             <span class="px-1 bg-gray-700 rounded text-[9px] uppercase text-gray-300">{{tag}} Aura</span>
                         }
                     </div>
                 }

                 <!-- Consumable Effects -->
                 @if (item.stats.hp) { 
                    <div class="flex justify-between"><span class="text-green-400">Restore</span> <span>{{item.stats.hp}} HP</span></div> 
                 }
                 @if (item.stats.exp) { 
                    <div class="flex justify-between"><span class="text-purple-400">Grant</span> <span>{{item.stats.exp}} EXP</span></div> 
                 }
                 @if (item.effect === 'teleport') {
                     <div class="text-blue-300 text-center font-bold py-1">WARP TO HOME</div>
                 }
                 @if (item.effect === 'full_heal') {
                     <div class="text-green-300 text-center font-bold py-1">FULL RECOVERY</div>
                 }
                 
                 <div class="text-[9px] text-gray-600 mt-2 pt-1 border-t border-gray-800">
                    {{ synthesisMode() ? 'Click to Select for Merge' : 'Click to Equip/Use' }}
                 </div>
             </div>
         </div>
      }

    </div>
  `,
  styles: [`
    .custom-scrollbar::-webkit-scrollbar { width: 4px; }
    .custom-scrollbar::-webkit-scrollbar-track { background: #111; }
    .custom-scrollbar::-webkit-scrollbar-thumb { background: #444; }
  `]
})
export class InventoryComponent {
  game = inject(GameService);
  inventory = this.game.inventory;
  equip = this.game.playerEquipment;
  // totalStats returns { stats: Stats, tags: string[] } now
  totalStats = this.game.totalStats;
  // Convenience signal for the template that expects just stats
  stats = computed(() => this.totalStats().stats);
  
  // Signals for local UI state
  hoveredItem = signal<Item | null>(null);
  synthesisMode = signal<boolean>(false);
  selectedIds = signal<string[]>([]);

  slots: (keyof Equipment)[] = ['weapon', 'armor', 'helm', 'accessory'];

  emptySlots = computed(() => {
     const count = 20 - this.inventory().length;
     return count > 0 ? Array(count).fill(0).map((_, i) => i) : [];
  });

  toggleSynthesis() {
      this.synthesisMode.update(v => !v);
      this.selectedIds.set([]);
  }

  handleItemClick(item: Item) {
      if (this.synthesisMode()) {
          this.toggleSelection(item);
      } else {
          this.game.equipItem(item);
          this.hoveredItem.set(null); // Clear tooltip after action
      }
  }

  toggleSelection(item: Item) {
      const current = this.selectedIds();
      if (current.includes(item.id)) {
          this.selectedIds.update(ids => ids.filter(id => id !== item.id));
      } else {
          // If we have items, check rarity match
          if (current.length > 0) {
              const firstItem = this.inventory().find(i => i.id === current[0]);
              if (firstItem && firstItem.rarity !== item.rarity) {
                  // feedback handled visually or via log? keeping it simple for now
                  return; 
              }
          }
          if (current.length < 2) {
              this.selectedIds.update(ids => [...ids, item.id]);
          }
      }
  }

  isSelected(id: string): boolean {
      return this.selectedIds().includes(id);
  }

  confirmSynthesis() {
      const ids = this.selectedIds();
      if (ids.length === 2) {
          this.game.synthesizeItems(ids[0], ids[1]);
          this.selectedIds.set([]);
          // Optional: Disable mode after success? Let's keep it on for bulk merging
      }
  }

  unequip(slot: keyof Equipment) {
      this.game.unequipItem(slot);
      this.hoveredItem.set(null);
  }

  onMouseEnter(item: Item | null) {
      this.hoveredItem.set(item);
  }

  onMouseLeave() {
      this.hoveredItem.set(null);
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