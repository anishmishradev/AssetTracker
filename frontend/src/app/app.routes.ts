
import { Routes, CanActivateFn, Router } from '@angular/router';
import { inject } from '@angular/core';
import { AssetService } from './services/asset.service';
import { AssetsComponent } from './assets.component';
import { AdminComponent } from './admin.component';

export const adminGuard: CanActivateFn = () => {
  const api = inject(AssetService);
  const router = inject(Router);

  return api.isAdmin ? true : router.createUrlTree(['/assets']);
};

export const routes: Routes = [
  { path: 'assets', component: AssetsComponent },
  {
    path: 'admin',
    component: AdminComponent,
    canActivate: [adminGuard]
  },
  { path: '', redirectTo: 'assets', pathMatch: 'full' },
  { path: '**', redirectTo: 'assets' }
];
