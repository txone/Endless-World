import { Component, computed, inject, Signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from '../services/game.service';
import { Entity, Tile } from '../game.types';

@Component({
  selector: 'app-game-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="relative w-full h-full flex items-center justify-center overflow-hidden bg-black/80">
      <!-- ISO Container -->
      <div class="iso-container relative" 
           [style.width.px]="boardSize()" 
           [style.height.px]="boardSize()">
           
        <!-- Tiles Layer -->
        @for (tile of tiles(); track tile.x + ',' + tile.y) {
          <div class="absolute w-[60px] h-[60px] border-b-4 border-r-4 transition-colors duration-300"
               [style.left.px]="(tile.x - center().x + 5) * 60"
               [style.top.px]="(tile.y - center().y + 5) * 60"
               [style.background-color]="getTileColor(tile.type)"
               [style.border-color]="getTileBorder(tile.type)">
             <!-- Decorative pixel noise -->
             <div class="w-full h-full opacity-10 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0IiBoZWlnaHQ9IjQiPgo8cmVjdCB3aWR0aD0iNCIgaGVpZ2h0PSI0IiBmaWxsPSIjZmZmIi8+CjxyZWN0IHdpZHRoPSIxIiBoZWlnaHQ9IjEiIGZpbGw9IiMwMDAiLz4KPC9zdmc+')]"></div>
          </div>
        }

        <!-- Entities Layer -->
        @for (entity of visibleEntities(); track entity.id) {
           <div class="absolute w-[60px] h-[60px] flex items-center justify-center z-10 transition-all duration-200 entity-float"
               [style.left.px]="(entity.x - center().x + 5) * 60"
               [style.top.px]="(entity.y - center().y + 5) * 60">
               <!-- Shadow -->
               <div class="absolute bottom-1 w-8 h-3 bg-black/40 rounded-[50%] blur-sm"></div>
               <!-- Sprite Body -->
               <div class="text-3xl filter drop-shadow-md relative" 
                    [style.color]="entity.color">
                 {{ entity.symbol }}
                 <!-- Health Bar for Monsters -->
                 @if (entity.type === 'monster') {
                    <div class="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-1 bg-red-900 rounded-full overflow-hidden">
                        <div class="h-full bg-red-500" [style.width.%]="(entity.stats.hp / entity.stats.maxHp) * 100"></div>
                    </div>
                 }
               </div>
           </div>
        }

        <!-- Player -->
        <div class="absolute w-[60px] h-[60px] flex items-center justify-center z-20 transition-all duration-200"
             [style.left.px]="5 * 60"
             [style.top.px]="5 * 60">
             
             <!-- Visual Auras -->
             <div class="absolute -inset-4 pointer-events-none z-0">
                @for (tag of activeTags(); track tag) {
                    @if (tag === 'fire') {
                        <div class="absolute inset-0 rounded-full bg-orange-500/20 blur-lg animate-pulse"></div>
                        <div class="absolute -inset-2 rounded-full border-2 border-orange-500/40 border-dashed animate-spin-slow"></div>
                    }
                    @if (tag === 'ice') {
                        <div class="absolute inset-0 rounded-full bg-cyan-500/20 blur-lg"></div>
                        <div class="absolute -top-4 left-0 animate-bounce text-cyan-300 text-xs">❄️</div>
                        <div class="absolute -bottom-2 right-0 animate-bounce text-cyan-300 text-xs delay-150">❄️</div>
                        <div class="absolute inset-0 border border-cyan-400/40 rounded-full animate-ping opacity-20"></div>
                    }
                    @if (tag === 'lightning') {
                        <div class="absolute inset-0 rounded-full border-4 border-yellow-300/50 animate-pulse"></div>
                        <div class="absolute -inset-1 bg-yellow-400/10 blur-md"></div>
                    }
                    @if (tag === 'poison') {
                        <div class="absolute inset-0 rounded-full bg-green-600/30 blur-xl animate-pulse"></div>
                        <div class="absolute inset-0 flex items-center justify-center overflow-hidden">
                             <div class="w-full h-full bg-[radial-gradient(circle,_#22c55e_10%,_transparent_20%)] bg-[length:10px_10px] opacity-50 animate-pulse"></div>
                        </div>
                    }
                }
             </div>

             <div class="absolute bottom-1 w-10 h-4 bg-black/50 rounded-[50%] blur-md z-10"></div>
             <div class="text-4xl filter drop-shadow-xl animate-bounce z-20" [style.color]="player().color">
                {{ player().symbol }}
             </div>
        </div>

      </div>
      
      <!-- Interaction Overlay -->
      @if (game.gameOver()) {
        <div class="absolute inset-0 bg-black/70 flex flex-col items-center justify-center z-50">
            <h1 class="text-4xl text-red-600 mb-4 pixel-text">YOU DIED</h1>
            <button class="px-6 py-3 bg-red-700 text-white font-bold border-4 border-red-900 hover:bg-red-600"
                    (click)="restart()">
                RESPAWN
            </button>
        </div>
      }
    </div>
  `,
  styles: [`
    .animate-spin-slow {
        animation: spin 4s linear infinite;
    }
    @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
    }
  `]
})
export class GameBoardComponent {
  game = inject(GameService);
  
  tiles = this.game.mapTiles;
  player = this.game.player;
  center = computed(() => ({ x: this.player().x, y: this.player().y }));
  boardSize = computed(() => this.game.CHUNK_SIZE * 60);

  // Active visual effects on player derived from totalStats which aggregates equipment
  activeTags = computed(() => this.game.totalStats().tags);

  // Entities relative to player view
  visibleEntities = this.game.entities;

  getTileColor(type: Tile['type']): string {
    switch (type) {
      case 'grass': return '#4ade80'; // green-400
      case 'water': return '#60a5fa'; // blue-400
      case 'mountain': return '#57534e'; // stone-600
      case 'sand': return '#fde047'; // yellow-300
      case 'forest': return '#15803d'; // green-700
      default: return '#000';
    }
  }

  getTileBorder(type: Tile['type']): string {
    switch (type) {
        case 'grass': return '#22c55e'; 
        case 'water': return '#3b82f6'; 
        case 'mountain': return '#44403c'; 
        case 'sand': return '#facc15'; 
        case 'forest': return '#166534';
        default: return '#111';
    }
  }

  restart() {
      window.location.reload(); // Simple reload for endless roguelike
  }
}
