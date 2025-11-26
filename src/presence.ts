import * as RPC from 'discord-rpc';

export type PresenceInfo = {
  project?: string;
  file?: string;
  language?: string;
  line?: number;
  totalLines?: number;
  totalFiles?: number;
};

export type PresenceOptions = {
  largeImageKey?: string;
  largeImageText?: string;
  smallImageKey?: string;
  smallImageText?: string;
  buttons?: { label: string; url: string }[];
};

export class PresenceManager {
  private client: any = null; // use any because no official types
  private clientId: string;
  private startTimestamp: number;
  private detailsFixed: string;
  private options: PresenceOptions | undefined;
  private connected = false;

  constructor(clientId: string, detailsFixed?: string, options?: PresenceOptions) {
    this.clientId = clientId;
    this.detailsFixed = detailsFixed || 'DF Network';
    this.options = options;
    this.startTimestamp = Math.floor(Date.now() / 1000);
  }

  async connect() {
    if (this.client) return;
    // discord-rpc uses IPC transport (desktop Discord required)
    this.client = new (RPC as any).Client({ transport: 'ipc' });

    this.client.on('ready', () => {
      this.connected = true;
      console.log('Discord RPC ready');
      // initial activity
      this.setActivity({ file: 'Idle', language: '', project: this.detailsFixed });
    });

    this.client.on('disconnected', () => {
      this.connected = false;
      console.log('Discord RPC disconnected');
    });

    try {
      await this.client.login({ clientId: this.clientId });
    } catch (err) {
      console.error('Discord RPC login failed:', err);
      this.client = null;
    }
  }

  async setActivity(info: PresenceInfo) {
    if (!this.client || !this.connected) return;

    const filePart = info.file ? `${info.file}` : 'No file';
    const langPart = info.language ? ` • ${info.language}` : '';
    const linePart =
      typeof info.line === 'number' && typeof info.totalLines === 'number' ? ` (L${info.line}/${info.totalLines})` : '';
    const filesPart = typeof info.totalFiles === 'number' ? ` • ${info.totalFiles} files` : '';

    const state = `${filePart}${linePart}${langPart}${filesPart}`;

    const activity: any = {
      details: this.detailsFixed,
      state,
      timestamps: { start: this.startTimestamp },
      largeImageKey: this.options?.largeImageKey || 'df_large',
      largeImageText: this.options?.largeImageText || this.detailsFixed,
      smallImageKey: this.options?.smallImageKey || 'df_small',
      smallImageText: this.options?.smallImageText || 'DF',
      buttons: this.options?.buttons || [{ label: 'DF Network', url: 'https://dfnetwork.in/' }]
    };

    try {
      await (this.client as any).setActivity(activity);
    } catch (err) {
      console.error('Failed to set activity', err);
    }
  }

  resetTimer() {
    this.startTimestamp = Math.floor(Date.now() / 1000);
  }

  dispose() {
    try {
      if (this.client) {
        this.client.destroy();
        this.client = null;
      }
    } catch (e) {
      console.error('Error disposing RPC client', e);
    }
  }
}
