import * as vscode from 'vscode';

/**
 * Niveles de telemetría disponibles
 */
export type TelemetryLevel = 'none' | 'basic' | 'detailed';

/**
 * Tipos de eventos de telemetría
 */
export type TelemetryEventType =
  | 'session_start'
  | 'session_end'
  | 'file_opened'
  | 'file_changed'
  | 'language_used'
  | 'function_detected'
  | 'custom';

/**
 * Evento de telemetría
 */
export interface TelemetryEvent {
  type: TelemetryEventType;
  timestamp: string;
  data?: Record<string, any>;
}

/**
 * Configuración de telemetría
 */
export interface TelemetryConfig {
  enabled: boolean;
  level: TelemetryLevel;
  webhookUrl?: string;
  collectLanguageStats?: boolean;
  collectFunctionStats?: boolean;
}

const KEY_CONSENT = 'dfnetwork.telemetryLevel';
const KEY_WEBHOOK = 'dfnetwork.webhookUrl';
const KEY_ENABLED = 'dfnetwork.telemetryEnabled';

/**
 * Obtiene el nivel de telemetría actual
 */
export async function getTelemetryLevel(context: vscode.ExtensionContext): Promise<TelemetryLevel> {
  return (context.globalState.get(KEY_CONSENT) as TelemetryLevel) || 'none';
}

/**
 * Establece el nivel de telemetría
 */
export async function setTelemetryLevel(context: vscode.ExtensionContext, level: TelemetryLevel) {
  await context.globalState.update(KEY_CONSENT, level);
  console.log(`Telemetry level set to: ${level}`);
}

/**
 * Obtiene la URL del webhook
 */
export function getWebhookUrl(context: vscode.ExtensionContext): string | undefined {
  return context.globalState.get(KEY_WEBHOOK) as string | undefined;
}

/**
 * Establece la URL del webhook
 */
export async function setWebhookUrl(context: vscode.ExtensionContext, url: string | undefined) {
  if (url) {
    await context.globalState.update(KEY_WEBHOOK, url);
    console.log('Webhook URL configured');
  } else {
    await context.globalState.update(KEY_WEBHOOK, undefined);
    console.log('Webhook URL removed');
  }
}

/**
 * Verifica si la telemetría está habilitada
 */
export async function isTelemetryEnabled(context: vscode.ExtensionContext): Promise<boolean> {
  const enabled = context.globalState.get(KEY_ENABLED, false);
  return enabled as boolean;
}

/**
 * Habilita o deshabilita la telemetría
 */
export async function setTelemetryEnabled(context: vscode.ExtensionContext, enabled: boolean) {
  await context.globalState.update(KEY_ENABLED, enabled);
}

/**
 * Solicita consentimiento de telemetría al usuario (solo la primera vez)
 */
export async function ensureTelemetryConsent(context: vscode.ExtensionContext): Promise<TelemetryLevel> {
  const current = await getTelemetryLevel(context);
  if (current && current !== 'none') return current;

  const choice = await vscode.window.showInformationMessage(
    'DF Network: Would you like to enable optional telemetry? (can be changed later)',
    'No',
    'Basic (activity without content)',
    'Detailed (metadata, no file content)'
  );

  if (choice === 'Basic (activity without content)') {
    await setTelemetryLevel(context, 'basic');
    await setTelemetryEnabled(context, true);
    return 'basic';
  } else if (choice === 'Detailed (metadata, no file content)') {
    const webhook = await vscode.window.showInputBox({
      prompt: 'Enter webhook URL to send telemetry (optional)',
      placeHolder: 'https://example.com/webhook',
      validateInput: (value) => {
        if (value && !value.startsWith('http')) {
          return 'URL must start with http:// or https://';
        }
        return null;
      }
    });
    if (webhook) await setWebhookUrl(context, webhook);
    await setTelemetryLevel(context, 'detailed');
    await setTelemetryEnabled(context, true);
    return 'detailed';
  } else {
    await setTelemetryLevel(context, 'none');
    await setTelemetryEnabled(context, false);
    return 'none';
  }
}

/**
 * Clase para recolectar estadísticas locales (sin enviar a servidor)
 */
export class TelemetryCollector {
  private context: vscode.ExtensionContext;
  private stats: Map<string, any> = new Map();

  constructor(context: vscode.ExtensionContext) {
    this.context = context;
    this.loadStats();
  }

  private loadStats() {
    const saved = this.context.globalState.get('dfnetwork.stats', {});
    this.stats = new Map(Object.entries(saved));
  }

  private async saveStats() {
    const obj = Object.fromEntries(this.stats);
    await this.context.globalState.update('dfnetwork.stats', obj);
  }

  async trackLanguageUsed(language: string) {
    const key = `lang_${language}`;
    const count = (this.stats.get(key) || 0) + 1;
    this.stats.set(key, count);
    await this.saveStats();
  }

  async trackFunctionDetected(language: string) {
    const key = `func_${language}`;
    const count = (this.stats.get(key) || 0) + 1;
    this.stats.set(key, count);
    await this.saveStats();
  }

  async trackSessionTime(seconds: number) {
    const total = (this.stats.get('total_session_time') || 0) + seconds;
    this.stats.set('total_session_time', total);
    await this.saveStats();
  }

  getStats(): Record<string, any> {
    return Object.fromEntries(this.stats);
  }

  async clearStats() {
    this.stats.clear();
    await this.saveStats();
  }
}

/**
 * Muestra las estadísticas locales al usuario
 */
export async function showTelemetryStats(context: vscode.ExtensionContext) {
  const collector = new TelemetryCollector(context);
  const stats = collector.getStats();

  if (Object.keys(stats).length === 0) {
    vscode.window.showInformationMessage('No telemetry stats collected yet.');
    return;
  }

  // Formatear estadísticas
  const lines = Object.entries(stats)
    .map(([key, value]) => `${key}: ${value}`)
    .join('\n');

  const totalTime = stats['total_session_time'] || 0;
  const hours = Math.floor(totalTime / 3600);
  const minutes = Math.floor((totalTime % 3600) / 60);

  vscode.window.showInformationMessage(
    `Total coding time: ${hours}h ${minutes}m\nCheck console for detailed stats.`
  );
  console.log('Telemetry Stats:\n', lines);
}

/**
 * Envía evento de telemetría (simplificado, solo logging local por ahora)
 */
export async function sendTelemetry(context: vscode.ExtensionContext, event: TelemetryEvent) {
  const level = await getTelemetryLevel(context);
  const enabled = await isTelemetryEnabled(context);

  if (level === 'none' || !enabled) {
    return;
  }

  // Por ahora solo logging local
  console.log('Telemetry event:', {
    level,
    type: event.type,
    timestamp: event.timestamp,
    data: level === 'detailed' ? event.data : undefined
  });

  // TODO: Implementar envío a webhook si está configurado
  // const webhook = getWebhookUrl(context);
  // if (webhook) { await sendToWebhook(webhook, event); }
}
