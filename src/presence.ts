import * as RPC from 'discord-rpc';
import * as vscode from 'vscode';

export type PresenceInfo = {
    project?: string;
    file?: string;
    language?: string;
    line?: number;
    totalLines?: number;
    functionEndLine?: number;
};

export class PresenceManager {
    private client: any = null;
    private clientId: string;
    private startTimestamp: number;
    private detailsFixed: string;
    private connected = false;
    private reconnectTimer: NodeJS.Timeout | null = null;
    private lastActivityState: string = '';
    private config: any;

    constructor(clientId: string, detailsFixed: string, config?: any) {
        this.clientId = clientId;
        this.detailsFixed = detailsFixed;
        this.startTimestamp = Math.floor(Date.now() / 1000);
        this.config = config || {
            discord: {
                images: {
                    largeImageKey: 'quasar_large',
                    largeImageText: 'Quasar Store',
                    smallImageKey: 'quasar_small',
                    smallImageText: 'Quasar Project'
                },
                buttons: [
                    { label: 'Quasar Store', url: 'https://quasar-store.com/' },
                    { label: 'Quasar University', url: 'https://quasaruniversity.com/' }
                ]
            },
            customization: {
                noFileOpenText: 'NO HAY ARCHIVO ABIERTO',
                lineFormatStyle: 'colon',
                useThousandsSeparator: true
            }
        };
    }

    async connect() {
        if (this.client) return;
        
        this.client = new RPC.Client({ transport: 'ipc' });

        this.client.on('ready', () => {
            this.connected = true;
            console.log('Discord RPC connected successfully');
            vscode.window.showInformationMessage('Discord Rich Presence connected');
        });

        this.client.on('disconnected', () => {
            this.connected = false;
            console.log('Discord RPC disconnected');
            this.client = null;
            
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
                console.log('Attempting to reconnect...');
                this.connect();
            }, 5000);
        });

        try {
            await this.client.login({ clientId: this.clientId });
        } catch (err) {
            console.error('Discord RPC login failed:', err);
            vscode.window.showWarningMessage('Discord Rich Presence: No se pudo conectar. ¿Discord está abierto?');
            this.client = null;
            
            if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
            this.reconnectTimer = setTimeout(() => {
                console.log('Retrying connection...');
                this.connect();
            }, 10000);
        }
    }

    async setActivity(info: PresenceInfo) {
        if (!this.client || !this.connected) {
            console.log('Client not ready, skipping activity update');
            return;
        }

        const noFileText = this.config.customization?.noFileOpenText || 'NO HAY ARCHIVO ABIERTO';
        const useThousandsSeparator = this.config.customization?.useThousandsSeparator !== false;

        const filePart = info.file ? `${info.file}` : noFileText;
        // Convertir lenguaje a MAYÚSCULAS
        const langPart = info.language ? ` • ${info.language.toUpperCase()}` : '';

        // Construir el estado SIN el número de línea para comparación
        const stateWithoutLine = `${filePart}${langPart}`;

        let linePart = '';
        if (typeof info.line === 'number') {
            if (info.functionEndLine) {
                // Si está dentro de una función, mostrar línea actual y línea final de la función
                linePart = ` (Line ${info.line}:${info.functionEndLine})`;
            } else if (info.totalLines) {
                // Si está fuera de función, mostrar línea actual y total de líneas
                const formattedTotal = useThousandsSeparator
                    ? info.totalLines.toLocaleString('en-US')
                    : info.totalLines.toString();
                linePart = ` (Line ${info.line}:${formattedTotal})`;
            }
        }

        const state = `${filePart}${langPart}${linePart}`;

        // Solo actualizar Discord si cambió el archivo o el lenguaje, NO si solo cambió la línea
        // Esto evita que Discord resetee el temporizador al moverte por el código
        if (this.lastActivityState === state) {
            return; // No hacer nada si el estado es exactamente el mismo
        }

        // Verificar si solo cambió la línea (archivo y lenguaje son los mismos)
        const lastStateWithoutLine = this.lastActivityState.replace(/ \(Line \d+[,:]\d+[,\d]*\)/, '');
        if (lastStateWithoutLine === stateWithoutLine && this.lastActivityState !== '') {
            // Solo cambió la línea, no actualizar Discord para preservar el timer
            console.log('Only line changed, not updating Discord to preserve timer');
            return;
        }

        this.lastActivityState = state;

        const images = this.config.discord?.images || {};
        const buttons = this.config.discord?.buttons || [];

        const activity: any = {
            details: this.detailsFixed,
            state: state,
            timestamps: { start: this.startTimestamp },
            largeImageKey: images.largeImageKey || 'quasar_large',
            largeImageText: images.largeImageText || 'Quasar Store',
            smallImageKey: images.smallImageKey || 'quasar_small',
            smallImageText: info.project || images.smallImageText || 'Quasar Project',
            buttons: buttons.length > 0 ? buttons : [
                { label: 'Quasar Store', url: 'https://quasar-store.com/' },
                { label: 'Quasar University', url: 'https://quasaruniversity.com/' }
            ]
        };

        try {
            await (this.client as any).setActivity(activity);
            console.log('Activity updated:', state);
        } catch (err) {
            console.error('Failed to set activity:', err);
        }
    }

    resetTimer() {
        this.startTimestamp = Math.floor(Date.now() / 1000);
    }

    dispose() {
        if (this.reconnectTimer) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        
        try {
            if (this.client) {
                this.client.destroy();
                this.client = null;
            }
        } catch (e) {
            console.error('Error disposing RPC client:', e);
        }
    }
}
