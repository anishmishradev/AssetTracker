
import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Asset, AssetService } from './services/asset.service';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-4">
      <div>
        <h2 class="page-heading mb-1">Asset Administration</h2>
        <p class="text-secondary mb-0">
          Create, update and retire company equipment.
        </p>
      </div>
      <a routerLink="/assets" class="btn btn-outline-secondary">
        <i class="bi bi-arrow-left me-2"></i>Back to Assets
      </a>
    </div>

    <div class="row g-4">
      <div class="col-12 col-lg-4">
        <div class="app-card p-4">
          <h5 class="fw-bold mb-1">
            <i class="bi bi-plus-circle text-primary me-2"></i>
            {{ editingId ? 'Edit Asset' : 'Create Asset' }}
          </h5>
          <p class="small text-secondary mb-4">
            {{ editingId ? 'Update asset information.' : 'Register new company equipment.' }}
          </p>

          <div *ngIf="error" class="alert alert-danger" role="alert">
            {{ error }}
          </div>
          <div *ngIf="message" class="alert alert-success" role="status">
            {{ message }}
          </div>

          <form #assetForm="ngForm" (ngSubmit)="save()">
            <div class="mb-3">
              <label class="form-label fw-semibold">Asset Tag *</label>
              <input name="tag" class="form-control"
                     [(ngModel)]="form.tag"
                     #tag="ngModel"
                     required
                     [disabled]="editingId !== null"
                     placeholder="e.g. AST-011">
              <div *ngIf="tag.invalid && (tag.touched || submitted)"
                   class="text-danger small mt-1">
                Asset tag is required.
              </div>
            </div>

            <div class="mb-3">
              <label class="form-label fw-semibold">Asset Name *</label>
              <input name="name" class="form-control"
                     [(ngModel)]="form.name"
                     #name="ngModel"
                     required
                     placeholder="e.g. Dell Latitude 5440">
              <div *ngIf="name.invalid && (name.touched || submitted)"
                   class="text-danger small mt-1">
                Asset name is required.
              </div>
            </div>

            <div class="mb-4">
              <label class="form-label fw-semibold">Category *</label>
              <input name="category" class="form-control"
                     [(ngModel)]="form.category"
                     #category="ngModel"
                     required
                     placeholder="e.g. Laptop">
              <div *ngIf="category.invalid && (category.touched || submitted)"
                   class="text-danger small mt-1">
                Category is required.
              </div>
            </div>

            <div class="d-flex gap-2">
              <button type="submit"
                      class="btn btn-primary flex-grow-1"
                      [disabled]="saving">
                <i class="bi bi-check-lg me-1"></i>
                {{ saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Asset' }}
              </button>
              <button *ngIf="editingId !== null" type="button"
                      class="btn btn-outline-secondary"
                      (click)="reset()">
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>

      <div class="col-12 col-lg-8">
        <div class="app-card p-3 p-lg-4">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h5 class="fw-bold mb-0">Manage Assets</h5>
            <button class="btn btn-outline-secondary btn-sm"
                    (click)="load()" [disabled]="loading">
              <i class="bi bi-arrow-clockwise me-1"></i>Refresh
            </button>
          </div>

          <div *ngIf="loading" class="text-center py-5">
            <div class="spinner-border text-primary"></div>
          </div>

          <div *ngIf="!loading" class="table-responsive">
            <table class="table table-hover align-middle">
              <thead>
                <tr>
                  <th>Tag</th>
                  <th>Name</th>
                  <th>Status</th>
                  <th class="text-end">Actions</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let asset of assets">
                  <td><span class="asset-tag">{{ asset.tag }}</span></td>
                  <td>
                    <div class="fw-semibold">{{ asset.name }}</div>
                    <small class="text-secondary">{{ asset.category }}</small>
                  </td>
                  <td>
                    <span class="status-badge"
                          [ngClass]="'status-' + asset.status">
                      {{ asset.status === 'CheckedOut' ? 'Checked Out' : asset.status }}
                    </span>
                  </td>
                  <td class="text-end">
                    <div class="d-flex justify-content-end gap-2">
                      <button *ngIf="asset.status !== 'Retired'"
                              class="btn btn-sm btn-outline-primary"
                              (click)="edit(asset)">
                        <i class="bi bi-pencil me-1"></i>Edit
                      </button>
                      <button *ngIf="asset.status === 'Available'"
                              class="btn btn-sm btn-outline-danger"
                              (click)="retire(asset)">
                        <i class="bi bi-archive me-1"></i>Retire
                      </button>
                    </div>
                  </td>
                </tr>
                <tr *ngIf="assets.length === 0">
                  <td colspan="4" class="text-center text-secondary py-4">
                    No assets found.
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  `
})
export class AdminComponent implements OnInit {
  assets: Asset[] = [];
  editingId: number | null = null;
  form = { tag: '', name: '', category: '' };
  loading = false;
  saving = false;
  submitted = false;
  error = '';
  message = '';

  constructor(public api: AssetService) {}

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading = true;
    this.api.getAssets().subscribe({
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

  edit(asset: Asset): void {
    this.editingId = asset.id;
    this.form = {
      tag: asset.tag,
      name: asset.name,
      category: asset.category
    };
    this.error = '';
    this.message = '';
    this.submitted = false;
  }

  reset(): void {
    this.editingId = null;
    this.form = { tag: '', name: '', category: '' };
    this.submitted = false;
  }

  save(): void {
    this.submitted = true;
    this.error = '';
    this.message = '';

    const tag = this.form.tag.trim();
    const name = this.form.name.trim();
    const category = this.form.category.trim();

    if (!tag || !name || !category) {
      this.error = 'Please complete all required fields.';
      return;
    }

    this.saving = true;

    const request = this.editingId !== null
      ? this.api.updateAsset(this.editingId, { name, category })
      : this.api.createAsset({ tag, name, category });

    request.subscribe({
      next: () => {
        this.saving = false;
        this.message = this.editingId !== null
          ? 'Asset updated successfully.'
          : 'Asset created successfully.';
        this.reset();
        this.load();
      },
      error: err => {
        this.saving = false;
        this.error = err.status === 409
          ? 'This operation conflicts with the current asset status.'
          : err.error?.message || 'Unable to save asset.';
      }
    });
  }

  retire(asset: Asset): void {
    if (!confirm(`Retire ${asset.tag}? This action cannot be undone.`)) {
      return;
    }

    this.error = '';
    this.message = '';

    this.api.retire(asset.id).subscribe({
      next: () => {
        this.message = 'Asset retired successfully.';
        this.load();
      },
      error: err => {
        this.error = err.error?.message || 'Unable to retire asset.';
      }
    });
  }
}
