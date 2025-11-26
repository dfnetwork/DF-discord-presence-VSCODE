import * as vscode from 'vscode';
import fetch from 'node-fetch';

export type TelemetryLevel = 'none' | 'basic' | 'detailed';
const KEY_CONSENT = 'dfnetwork.telemetryLevel';
const KEY_WEBHOOK = 'dfnetwork.webhookUrl';

export async function getTelemetryLevel(context: vscode.ExtensionContext): Promise<TelemetryLevel> {
  return (context.globalState.get(KEY_CONSENT) as TelemetryLevel) || 'none';
}

export async function setTelemetryLevel(context: vscode.ExtensionContext, level: TelemetryLevel) {
  await context.globalState.update(KEY_CONSENT, level);
}

export function getWebhookUrl(context: vscode.ExtensionContext): string | undefined {
  return context.globalState.get(KEY_WEBHOOK) as string | undefined;
}

export async function setWebhookUrl(context: vscode.ExtensionContext, url: string | undefined) {
  if (url) await context.globalState.update(KEY_WEBHOOK, url);
  else await context.globalState.update(KEY_WEBHOOK, undefined);
}

export async function ensureTelemetryConsent(context: vscode.ExtensionContext) {
  const current = await getTelemetryLevel(context);
  if (current && current !== 'none') return current;

  const choice = await vscode.window.showInformationMessage(
    'DF Network: ¿Deseas habilitar telemetría opcional? (se puede cambiar luego)',
    'No',
    'Básica (actividad sin contenido)',
    'Detallada (metadatos, sin contenido de archivos)'
  );

  if (choice === 'Básica (actividad sin contenido)') {
    await setTelemetryLevel(context, 'basic');
    return 'basic';
  } else if (choice === 'Detallada (metadatos, sin contenido de archivos)') {
    const webhook = await vscode.window.showInputBox({
      prompt: 'Introduce la URL del webhook donde enviar la telemetría (opcional)',
      placeHolder: 'https://example.com/webhook'
    });
    if (webhook) await setWebhookUrl(context, webhook);
    await setTelemetryLevel(context, 'detailed');
    return 'detailed';
  } else {
    await setTelemetryLevel(context, 'none');
    return 'none';
  }
}

export async function sendTelemetry(context: vscode.ExtensionContext, event: any) {
  const level = await getTelemetryLevel(context);
  const webhook = getWebhookUrl(context);

  if (level === 'none') return;

  if (!webhook) {
    console.log('Telemetry skipped (no webhook):', event);
    return;
  }

  const payload = { level, timestamp: new Date().toISOString(), event };

  try {
    await fetch(webhook, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Content-Type': 'application/json' }
    } as any);
  } catch (err) {
    console.error('Failed to send telemetry:', err);
  }
}
