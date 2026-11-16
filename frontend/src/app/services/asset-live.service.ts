
import { Injectable } from '@angular/core';
import * as signalR from '@microsoft/signalr';
import { Subject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AssetLiveService {

  private connection?: signalR.HubConnection;

  private changes = new Subject<void>();

  readonly assetsChanged$ = this.changes.asObservable();

  async start(): Promise<void> {

    if (this.connection) {
      return;
    }

    this.connection = new signalR.HubConnectionBuilder()
      .withUrl('http://localhost:5000/hubs/assets')
      .withAutomaticReconnect()
      .build();

    this.connection.on('AssetsChanged', () => {
      this.changes.next();
    });

    this.connection.onreconnected(() => {
      this.changes.next();
    });

    try {
      await this.connection.start();

      console.log('SignalR connected successfully');

    } catch (error) {
      console.error('SignalR connection failed:', error);
    }
  }
}
