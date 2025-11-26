import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';
import FormData from 'form-data';
import fetch from 'node-fetch';
import { getWebhookUrl } from './telemetry';

export async function createWorkspaceZip(context: vscode.ExtensionContext): Promise<string | null> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('No hay workspace abierto para crear backup.');
    return null;
  }

  const root = folders[0].uri.fsPath;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const zipName = `dfnetwork-backup-${timestamp}.zip`;
  const outPath = path.join(root, zipName);

  const output = fs.createWriteStream(outPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  return new Promise((resolve, reject) => {
    output.on('close', () => resolve(outPath));
    archive.on('error', (err) => {
      console.error('Archive error', err);
      reject(null);
    });

    archive.pipe(output);
    archive.glob('**/*', {
      cwd: root,
      dot: true,
      ignore: ['**/node_modules/**', '**/.git/**']
    });
    archive.finalize();
  });
}

export async function backupAndMaybeUpload(context: vscode.ExtensionContext) {
  const zipPath = await createWorkspaceZip(context);
  if (!zipPath) return;

  const action = await vscode.window.showInformationMessage(
    `Backup creado: ${zipPath}`,
    'Abrir carpeta',
    'Subir a webhook (si está configurado)',
    'Cancelar'
  );

  if (action === 'Abrir carpeta') {
    const folder = path.dirname(zipPath);
    vscode.env.openExternal(vscode.Uri.file(folder));
    return;
  } else if (action === 'Subir a webhook (si está configurado)') {
    const webhook = getWebhookUrl(context);
    if (!webhook) {
      vscode.window.showErrorMessage('No hay webhook configurado. Define uno en configuración de telemetría.');
      return;
    }

    try {
      await uploadFileToWebhook(zipPath, webhook);
      vscode.window.showInformationMessage('Backup subido correctamente al webhook.');
    } catch (err) {
      console.error(err);
      vscode.window.showErrorMessage('Error subiendo backup al webhook: ' + String(err));
    }
  }
}

async function uploadFileToWebhook(filePath: string, webhookUrl: string) {
  const form = new FormData();
  form.append('file', fs.createReadStream(filePath));
  form.append('meta', JSON.stringify({ name: path.basename(filePath), timestamp: new Date().toISOString() }));

  const res = await fetch(webhookUrl, {
    method: 'POST',
    body: form as any,
    headers: (form.getHeaders ? form.getHeaders() : {})
  } as any);

  if (!res.ok) {
    throw new Error(`Upload failed: ${res.status} ${res.statusText}`);
  }
}
