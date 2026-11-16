
import {
    Component,
    OnInit,
    OnDestroy
  } from '@angular/core';
  
  import { CommonModule } from '@angular/common';
  import { FormsModule } from '@angular/forms';
  import { RouterLink } from '@angular/router';
  import { Subscription } from 'rxjs';
  
  import {
    Asset,
    AssetService
  } from './services/asset.service';
  
  import {
    AssetLiveService
  } from './services/asset-live.service';
  
  @Component({
    selector: 'app-assets',
    standalone: true,
    imports: [
      CommonModule,
      FormsModule,
      RouterLink
    ],
    template: `
      <!-- Page header -->
      <div class="d-flex flex-wrap justify-content-between
                  align-items-center gap-3 mb-4">
  
        <div>
          <h2 class="page-heading mb-1">Asset Inventory</h2>
          <p class="text-secondary mb-0">
            Track equipment availability and manage checkouts.
          </p>
        </div>
  
        <a *ngIf="api.isAdmin"
           routerLink="/admin"
           class="btn btn-primary">
          <i class="bi bi-plus-lg me-2"></i>
          Add Asset
        </a>
      </div>
  
      <!-- Dashboard cards -->
      <div class="row g-3 mb-4">
  
        <div class="col-6 col-lg-3">
          <div class="stat-card">
            <div class="text-secondary small mb-2">
              Total Assets
            </div>
            <div class="stat-number">
              {{ totalAssets }}
            </div>
            <i class="bi bi-box-seam text-primary"></i>
          </div>
        </div>
  
        <div class="col-6 col-lg-3">
          <div class="stat-card">
            <div class="text-secondary small mb-2">
              Available
            </div>
            <div class="stat-number text-success">
              {{ count('Available') }}
            </div>
            <i class="bi bi-check-circle text-success"></i>
          </div>
        </div>
  
        <div class="col-6 col-lg-3">
          <div class="stat-card">
            <div class="text-secondary small mb-2">
              Checked Out
            </div>
            <div class="stat-number text-warning">
              {{ count('CheckedOut') }}
            </div>
            <i class="bi bi-person-check text-warning"></i>
          </div>
        </div>
  
        <div class="col-6 col-lg-3">
          <div class="stat-card">
            <div class="text-secondary small mb-2">
              Retired
            </div>
            <div class="stat-number text-secondary">
              {{ count('Retired') }}
            </div>
            <i class="bi bi-archive text-secondary"></i>
          </div>
        </div>
  
      </div>
  
      <div class="app-card p-3 p-lg-4">
  
        <!-- Toolbar -->
        <div class="d-flex flex-wrap justify-content-between
                    align-items-center gap-2 mb-3">
  
          <h5 class="fw-bold mb-0">All Equipment</h5>
  
          <button
            class="btn btn-outline-secondary btn-sm"
            (click)="load()"
            [disabled]="loading">
  
            <i class="bi bi-arrow-clockwise me-1"></i>
            Refresh
          </button>
        </div>
  
        <!-- Search and filters -->
        <div class="row g-3 mb-4">
  
          <div class="col-12 col-lg-5">
            <label class="form-label">Search equipment</label>
  
            <div class="input-group">
              <span class="input-group-text bg-white">
                <i class="bi bi-search"></i>
              </span>
  
              <input
                class="form-control"
                placeholder="Search by name or asset tag..."
                [(ngModel)]="search"
                (keyup.enter)="applySearch()">
  
              <button
                class="btn btn-primary"
                (click)="applySearch()">
                Search
              </button>
            </div>
          </div>
  
          <div class="col-6 col-lg-3">
            <label class="form-label">Status</label>
  
            <select
              class="form-select"
              [(ngModel)]="status"
              (ngModelChange)="onStatusChange()">
  
              <option value="">All statuses</option>
              <option value="Available">Available</option>
              <option value="CheckedOut">Checked Out</option>
              <option value="Retired">Retired</option>
            </select>
          </div>
  
          <div class="col-6 col-lg-2">
            <label class="form-label">Category</label>
  
            <select
              class="form-select"
              [(ngModel)]="category"
              (ngModelChange)="resetPage()">
  
              <option value="">All categories</option>
  
              <option
                *ngFor="let item of categories"
                [value]="item">
                {{ item }}
              </option>
            </select>
          </div>
  
          <div class="col-6 col-lg-2">
            <label class="form-label">Per page</label>
  
            <select
              class="form-select"
              [(ngModel)]="pageSize"
              (ngModelChange)="resetPage()">
  
              <option [ngValue]="5">5</option>
              <option [ngValue]="10">10</option>
              <option [ngValue]="20">20</option>
            </select>
          </div>
  
        </div>
  
        <!-- Error -->
        <div
          *ngIf="error"
          class="alert alert-danger"
          role="alert">
  
          <i class="bi bi-exclamation-triangle me-2"></i>
          {{ error }}
        </div>
  
        <!-- Success -->
        <div
          *ngIf="message"
          class="alert alert-success"
          role="status">
          {{ message }}
        </div>
  
        <!-- Loading -->
        <div
          *ngIf="loading"
          class="text-center py-5">
  
          <div class="spinner-border text-primary"></div>
  
          <p class="text-secondary mt-2">
            Loading assets...
          </p>
        </div>
  
        <!-- Asset table -->
        <div
          *ngIf="!loading"
          class="table-responsive">
  
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
  
              <tr *ngFor="let asset of pagedAssets">
  
                <td>
                  <span class="asset-tag">
                    {{ asset.tag }}
                  </span>
                </td>
  
                <td class="fw-semibold">
                  {{ asset.name }}
                </td>
  
                <td>{{ asset.category }}</td>
  
                <td>
                  <span
                    class="status-badge"
                    [ngClass]="'status-' + asset.status">
  
                    {{
                      asset.status === 'CheckedOut'
                        ? 'Checked Out'
                        : asset.status
                    }}
                  </span>
                </td>
  
                <td>
                  {{ asset.heldByUserId || '—' }}
                </td>
  
                <td class="text-end">
  
                  <button
                    *ngIf="asset.status === 'Available'"
                    class="btn btn-sm btn-primary"
                    [disabled]="busyId === asset.id"
                    (click)="perform(asset, 'checkout')">
  
                    <span
                      *ngIf="busyId === asset.id"
                      class="spinner-border spinner-border-sm me-1">
                    </span>
  
                    Checkout
                  </button>
  
                  <button
                    *ngIf="
                      asset.status === 'CheckedOut' &&
                      (api.isAdmin ||
                       asset.heldByUserId === api.user)
                    "
                    class="btn btn-sm btn-outline-primary"
                    [disabled]="busyId === asset.id"
                    (click)="perform(asset, 'return')">
  
                    Return
                  </button>
  
                  <span
                    *ngIf="
                      asset.status === 'Retired' ||
                      (asset.status === 'CheckedOut' &&
                       !api.isAdmin &&
                       asset.heldByUserId !== api.user)
                    "
                    class="text-secondary small">
                    No actions
                  </span>
  
                </td>
              </tr>
  
              <tr *ngIf="pagedAssets.length === 0">
                <td
                  colspan="6"
                  class="text-center text-secondary py-5">
  
                  <i class="bi bi-inbox fs-2 d-block mb-2"></i>
                  No assets found.
                </td>
              </tr>
  
            </tbody>
          </table>
        </div>
  
        <!-- Pagination -->
        <div
          *ngIf="!loading"
          class="d-flex flex-wrap justify-content-between
                 align-items-center gap-3 mt-3">
  
          <span class="text-secondary small">
            Showing {{ showingFrom }}–{{ showingTo }}
            of {{ filteredAssets.length }} assets
          </span>
  
          <div class="btn-group">
  
            <button
              class="btn btn-outline-primary btn-sm"
              [disabled]="page === 1"
              (click)="previousPage()">
  
              <i class="bi bi-chevron-left"></i>
              Previous
            </button>
  
            <button
              class="btn btn-outline-secondary btn-sm"
              disabled>
  
              Page {{ page }} of {{ totalPages }}
            </button>
  
            <button
              class="btn btn-outline-primary btn-sm"
              [disabled]="page >= totalPages"
              (click)="nextPage()">
  
              Next
              <i class="bi bi-chevron-right"></i>
            </button>
  
          </div>
        </div>
  
      </div>
    `
  })
  export class AssetsComponent implements OnInit, OnDestroy {
  
    assets: Asset[] = [];
  
    status = '';
    search = '';
    category = '';
  
    page = 1;
    pageSize = 5;
  
    loading = false;
    busyId: number | null = null;
  
    error = '';
    message = '';
  
    private liveSubscription?: Subscription;
    private loadSubscription?: Subscription;
  
    constructor(
      public api: AssetService,
      private live: AssetLiveService
    ) {}
  
    ngOnInit(): void {
      this.load();
  
      this.liveSubscription = this.live.assetsChanged$
        .subscribe(() => {
          this.load();
        });
  
      void this.live.start();
    }
  
    ngOnDestroy(): void {
      this.liveSubscription?.unsubscribe();
      this.loadSubscription?.unsubscribe();
    }
  
    get totalAssets(): number {
      return this.assets.length;
    }
  
    count(status: string): number {
      return this.assets.filter(
        a => a.status === status
      ).length;
    }
  
    get categories(): string[] {
      return [...new Set(
        this.assets.map(a => a.category)
      )].sort();
    }
  
    get filteredAssets(): Asset[] {
      return this.assets.filter(asset => {
        return !this.category ||
          asset.category === this.category;
      });
    }
  
    get totalPages(): number {
      return Math.max(
        1,
        Math.ceil(
          this.filteredAssets.length / this.pageSize
        )
      );
    }
  
    get pagedAssets(): Asset[] {
      const start = (this.page - 1) * this.pageSize;
  
      return this.filteredAssets.slice(
        start,
        start + this.pageSize
      );
    }
  
    get showingFrom(): number {
      if (this.filteredAssets.length === 0) {
        return 0;
      }
  
      return (this.page - 1) * this.pageSize + 1;
    }
  
    get showingTo(): number {
      return Math.min(
        this.page * this.pageSize,
        this.filteredAssets.length
      );
    }
  
    resetPage(): void {
      this.page = 1;
    }
  
    previousPage(): void {
      this.page = Math.max(1, this.page - 1);
    }
  
    nextPage(): void {
      this.page = Math.min(
        this.totalPages,
        this.page + 1
      );
    }
  
    applySearch(): void {
      this.resetPage();
      this.load();
    }
  
    onStatusChange(): void {
      this.resetPage();
      this.load();
    }
  
    load(): void {
      this.loadSubscription?.unsubscribe();
  
      this.loading = true;
      this.error = '';
  
      this.loadSubscription = this.api.getAssets(
        this.status,
        this.search
      ).subscribe({
        next: data => {
          this.assets = data;
  
          if (
            this.category &&
            !data.some(a => a.category === this.category)
          ) {
            this.category = '';
          }
  
          this.page = Math.min(
            this.page,
            this.totalPages
          );
  
          this.loading = false;
        },
  
        error: err => {
          this.error =
            err.error?.message ||
            'Unable to load assets.';
  
          this.loading = false;
        }
      });
    }
  
    perform(
      asset: Asset,
      action: 'checkout' | 'return'
    ): void {
  
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
            : err.error?.message ||
              'Unable to complete the action.';
  
          if (err.status === 409) {
            this.load();
          }
        }
      });
    }
  }
  