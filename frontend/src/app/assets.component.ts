
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Asset, AssetService } from './services/asset.service';

@Component({
  selector: 'app-assets',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-4">
      <div>
        <h2 class="page-heading mb-1">Asset Inventory</h2>
        <p class="text-secondary mb-0">
          Track equipment availability and manage checkouts.
        </p>
      </div>

      <a *ngIf="api.isAdmin" routerLink="/admin"
         class="btn btn-primary">
        <i class="bi bi-plus-lg me-2"></i>Add Asset
      </a>
    </div>

    <div class="row g-3 mb-4">
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="text-secondary small mb-2">Total Assets</div>
          <div class="stat-number">{{ assets.length }}</div>
          <i class="bi bi-box-seam text-primary"></i>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="text-secondary small mb-2">Available</div>
          <div class="stat-number text-success">{{ count('Available') }}</div>
          <i class="bi bi-check-circle text-success"></i>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="text-secondary small mb-2">Checked Out</div>
          <div class="stat-number text-warning">{{ count('CheckedOut') }}</div>
          <i class="bi bi-person-check text-warning"></i>
        </div>
      </div>
      <div class="col-6 col-lg-3">
        <div class="stat-card">
          <div class="text-secondary small mb-2">Retired</div>
          <div class="stat-number text-secondary">{{ count('Retired') }}</div>
          <i class="bi bi-archive text-secondary"></i>
        </div>
      </div>
    </div>

    <div class="app-card p-3 p-lg-4">
      <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
        <h5 class="fw-bold mb-0">All Equipment</h5>
        <button class="btn btn-outline-secondary btn-sm"
                (click)="load()" [disabled]="loading">
          <i class="bi bi-arrow-clockwise me-1"></i> Refresh
        </button>
      </div>

      <div class="row g-3 mb-4">
        <div class="col-12 col-md-7">
          <div class="input-group">
            <span class="input-group-text bg-white">
              <i class="bi bi-search"></i>
            </span>
            <input class="form-control"
                   placeholder="Search by name or asset tag..."
                   [(ngModel)]="search"
                   (keyup.enter)="load()">
            <button class="btn btn-primary" (click)="load()">Search</button>
          </div>
        </div>

        <div class="col-12 col-md-5">
          <select class="form-select" [(ngModel)]="status"
                  (ngModelChange)="load()">
            <option value="">All statuses</option>
            <option value="Available">Available</option>
            <option value="CheckedOut">Checked Out</option>
            <option value="Retired">Retired</option>
          </select>
        </div>
      </div>

      <div *ngIf="error" class="alert alert-danger" role="alert">
        <i class="bi bi-exclamation-triangle me-2"></i>{{ error }}
      </div>

      <div *ngIf="message" class="alert alert-success" role="status">
        {{ message }}
      </div>

      <div *ngIf="loading" class="text-center py-5">
        <div class="spinner-border text-primary"></div>
        <p class="text-secondary mt-2">Loading assets...</p>
      </div>

      <div *ngIf="!loading" class="table-responsive">
        <table class="table table-hover align-middle">
          <thead>
            <tr>
              <th>Asset Tag</th>
              <th>Equipment</th>
              <th>Category</th>
              <th>Status</th>
              <th>Held By</th>
              <th class="text-end">Action</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let asset of assets">
              <td><span class="asset-tag">{{ asset.tag }}</span></td>
              <td class="fw-semibold">{{ asset.name }}</td>
              <td>{{ asset.category }}</td>
              <td>
                <span class="status-badge"
                      [ngClass]="'status-' + asset.status">
                  {{ asset.status === 'CheckedOut' ? 'Checked Out' : asset.status }}
                </span>
              </td>
              <td>{{ asset.heldByUserId || '—' }}</td>
              <td class="text-end">
                <button *ngIf="asset.status === 'Available'"
                        class="btn btn-sm btn-primary"
                        [disabled]="busyId === asset.id"
                        (click)="perform(asset, 'checkout')">
                  Checkout
                </button>

                <button *ngIf="asset.status === 'CheckedOut' &&
                              (api.isAdmin || asset.heldByUserId === api.user)"
                        class="btn btn-sm btn-outline-primary"
                        [disabled]="busyId === asset.id"
                        (click)="perform(asset, 'return')">
                  Return
                </button>

                <span *ngIf="asset.status === 'Retired'"
                      class="text-secondary small">No actions</span>
              </td>
            </tr>

            <tr *ngIf="assets.length === 0">
              <td colspan="6" class="text-center text-secondary py-5">
                <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                No assets found.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `
})
export class AssetsComponent implements OnInit {
  assets: Asset[] = [];
  status = '';
  search = '';
  loading = false;
  busyId: number | null = null;
  error = '';
  message = '';

  constructor(public api: AssetService) {}

  ngOnInit(): void {
    this.load();
  }

  count(status: string): number {
    return this.assets.filter(a => a.status === status).length;
  }

  load(): void {
    this.loading = true;
    this.error = '';

    this.api.getAssets(this.status, this.search).subscribe({
      next: data => {
        this.assets = data;
        this.loading = false;
      },
      error: err => {
        this.error = err.error?.message || 'Unable to load assets.';
        this.loading = false;
      }
    });
  }

  perform(asset: Asset, action: 'checkout' | 'return'): void {
    this.error = '';
    this.message = '';
    this.busyId = asset.id;

    const request = action === 'checkout'
      ? this.api.checkout(asset.id)
      : this.api.returnAsset(asset.id);

    request.subscribe({
      next: () => {
        this.busyId = null;
        this.message = action === 'checkout'
          ? 'Asset checked out successfully.'
          : 'Asset returned successfully.';
        this.load();
      },
      error: err => {
        this.busyId = null;
        this.error = err.status === 409
          ? 'This asset is no longer available for this action. Please refresh.'
          : err.error?.message || 'Unable to complete the action.';
      }
    });
  }
}
