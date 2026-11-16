
import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AssetService } from './services/asset.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    RouterLink,
    RouterLinkActive,
    RouterOutlet
  ],
  template: `
    <nav class="navbar navbar-dark app-navbar py-3">
      <div class="container-fluid app-shell px-3 px-lg-4">
        <div class="d-flex align-items-center flex-wrap gap-3 w-100">
          <a class="navbar-brand fw-bold mb-0" routerLink="/assets">
            <i class="bi bi-box-seam me-2"></i>
            AssetTracker
          </a>

          <div class="d-flex gap-2 me-auto">
            <a routerLink="/assets"
               routerLinkActive="active"
               class="nav-link text-white px-3 py-2">
              <i class="bi bi-grid me-1"></i> Assets
            </a>

            <a *ngIf="api.isAdmin"
               routerLink="/admin"
               routerLinkActive="active"
               class="nav-link text-white px-3 py-2">
              <i class="bi bi-gear me-1"></i> Admin
            </a>
          </div>

          <div class="d-flex align-items-center gap-2">
            <span class="text-white-50 small d-none d-sm-inline">
              Current user
            </span>
            <select class="form-select form-select-sm"
                    style="width: 155px"
                    [ngModel]="api.user"
                    (ngModelChange)="changeUser($event)">
              <option value="emp1">Employee 1</option>
              <option value="emp2">Employee 2</option>
              <option value="admin">Administrator</option>
            </select>
          </div>
        </div>
      </div>
    </nav>

    <main class="app-shell px-3 px-lg-4 py-4">
      <router-outlet></router-outlet>
    </main>
  `
})
export class AppComponent {
  constructor(public api: AssetService) {}

  changeUser(user: string): void {
    this.api.user = user;
    window.location.href = '/assets';
  }
}
