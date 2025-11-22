import { Component, HostListener, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { GameService } from './services/game.service';
import { GameBoardComponent } from './components/game-board.component';
import { InventoryComponent } from './components/inventory.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GameBoardComponent, InventoryComponent],
  templateUrl: './app.component.html'
})
export class AppComponent {
  game = inject(GameService);
  
  // UI Tabs for mobile/small screens if needed, mostly handled by responsive layout
  activeTab = signal<'game'|'inv'>('game');

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    switch (event.key) {
      case 'ArrowUp':
      case 'w':
        this.game.movePlayer(0, -1);
        break;
      case 'ArrowDown':
      case 's':
        this.game.movePlayer(0, 1);
        break;
      case 'ArrowLeft':
      case 'a':
        this.game.movePlayer(-1, 0);
        break;
      case 'ArrowRight':
      case 'd':
        this.game.movePlayer(1, 0);
        break;
    }
  }

  toggleTab(tab: 'game' | 'inv') {
    this.activeTab.set(tab);
  }
}
