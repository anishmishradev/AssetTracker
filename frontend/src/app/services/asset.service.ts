
import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Asset {
  id: number;
  tag: string;
  name: string;
  category: string;
  status: string;
  heldByUserId: string | null;
}

export interface AssetInput {
  tag: string;
  name: string;
  category: string;
}

@Injectable({ providedIn: 'root' })
export class AssetService {
  private readonly baseUrl = 'http://localhost:5077/api/assets';

  constructor(private http: HttpClient) {}

  get user(): string {
    return localStorage.getItem('user') || 'emp1';
  }

  set user(value: string) {
    localStorage.setItem('user', value);
  }

  get isAdmin(): boolean {
    return this.user === 'admin';
  }

  private headers(): HttpHeaders {
    return new HttpHeaders({
      'X-User-Id': this.user
    });
  }

  getAssets(status = '', search = ''): Observable<Asset[]> {
    let params = new HttpParams();

    if (status) {
      params = params.set('status', status);
    }

    if (search.trim()) {
      params = params.set('search', search.trim());
    }

    return this.http.get<Asset[]>(this.baseUrl, {
      headers: this.headers(),
      params
    });
  }

  createAsset(input: AssetInput): Observable<Asset> {
    return this.http.post<Asset>(this.baseUrl, input, {
      headers: this.headers()
    });
  }

  updateAsset(
    id: number,
    input: { name: string; category: string }
  ): Observable<Asset> {
    return this.http.put<Asset>(`${this.baseUrl}/${id}`, input, {
      headers: this.headers()
    });
  }

  checkout(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/checkout`, {}, {
      headers: this.headers()
    });
  }

  returnAsset(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/return`, {}, {
      headers: this.headers()
    });
  }

  retire(id: number): Observable<any> {
    return this.http.post(`${this.baseUrl}/${id}/retire`, {}, {
      headers: this.headers()
    });
  }
}
