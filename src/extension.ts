import * as vscode from 'vscode';
import { PresenceManager, PresenceInfo } from './presence';
import { ensureTelemetryConsent, sendTelemetry, setWebhookUrl, getWebhookUrl, TelemetryLevel } from './telemetry';
import { backupAndMaybeUpload } from './backup';

const CLIENT_ID = '1218551789553582161';

let presence: PresenceManager | null = null;
let updateTimer: NodeJS.Timeout | null = null;

export async function activate(context: vscode.ExtensionContext) {
  console.log('Activating DF Network Presence');

  // Ensure telemtry consent at startup (user can change later)
  const level = await ensureTelemetryConsent(context);
  console.log('Telemetry level:', level);

  if (level === 'detailed' && !getWebhookUrl(context)) {
    const webhook = await vscode.window.showInputBox({ prompt: 'Introduce la URL del webhook para telemetría (opcional).' });
    if (webhook) await setWebhookUrl(context, webhook);
  }

  const workspaceName = vscode.workspace.name || 'No Workspace';

  // Optional presence visuals + GitHub button (edit URL)
  presence = new PresenceManager(CLIENT_ID, workspaceName, {
    largeImageKey: 'df_large',
    largeImageText: workspaceName,
    smallImageKey: 'df_small',
    smallImageText: 'DF Network',
    buttons: [
      { label: 'DF Network', url: 'https://dfnetwork.in/' },
      { label: 'GitHub', url: 'https://github.com/tu-usuario/tu-repo' }
    ]
  });
  presence.connect();

  // Commands
  context.subscriptions.push(
    vscode.commands.registerCommand('dfpresence.resetTimer', () => {
      presence?.resetTimer();
      vscode.window.showInformationMessage('DF Presence: Session timer reset');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dfpresence.configureTelemetry', async () => {
      const choice = await vscode.window.showQuickPick(['none', 'basic', 'detailed'], { placeHolder: 'Selecciona nivel de telemetría' });
      if (choice) {
        await context.globalState.update('dfnetwork.telemetryLevel', choice);
        vscode.window.showInformationMessage(`Telemetría: ${choice}`);
        if (choice === 'detailed') {
          const hook = await vscode.window.showInputBox({ prompt: 'Webhook URL para telemetría (opcional)' });
          if (hook) await setWebhookUrl(context, hook);
        }
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('dfpresence.createBackup', async () => {
      const confirm = await vscode.window.showWarningMessage(
        '¿Crear backup del workspace y opcionalmente subir al webhook? (Se excluirán node_modules/.git)',
        'Sí, crear backup',
        'Cancelar'
      );
      if (confirm === 'Sí, crear backup') {
        await backupAndMaybeUpload(context);
      }
    })
  );

  // Telemetry: edits
  context.subscriptions.push(
    vscode.workspace.onDidChangeTextDocument(async (e) => {
      const level = (context.globalState.get('dfnetwork.telemetryLevel') || 'none') as TelemetryLevel;
      if (level === 'none') return;

      const doc = e.document;
      const relative = vscode.workspace.asRelativePath(doc.uri);

      let linesChanged = 0;
      for (const change of e.contentChanges) {
        const start = change.range.start.line;
        const end = change.range.end.line;
        const added = (change.text.match(/\n/g) || []).length;
        linesChanged += Math.abs(end - start) + Math.max(1, added);
      }

      const payload = {
        type: 'edit',
        workspace: vscode.workspace.name || 'No Workspace',
        file: relative,
        language: doc.languageId,
        linesChanged,
        timestamp: new Date().toISOString()
      };

      await sendTelemetry(context, payload);
    })
  );

  // Telemetry: open file
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(async (editor) => {
      if (!editor) return;
      const doc = editor.document;
      const payload = {
        type: 'open',
        workspace: vscode.workspace.name || 'No Workspace',
        file: vscode.workspace.asRelativePath(doc.uri),
        language: doc.languageId,
        timestamp: new Date().toISOString()
      };
      await sendTelemetry(context, payload);
    })
  );

  // Presence update routine
  const scheduleUpdate = throttle(async () => {
    const editor = vscode.window.activeTextEditor;
    const info: PresenceInfo = {};

    if (editor) {
      const doc = editor.document;
      info.file = doc.uri.scheme === 'file' ? vscode.workspace.asRelativePath(doc.uri) : doc.fileName;
      info.line = editor.selection.active.line + 1;
      info.totalLines = doc.lineCount;
      info.language = doc.languageId;

      const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
      info.project = folder ? folder.name : workspaceName;

      const allFiles = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
      info.totalFiles = allFiles.length;
    } else {
      info.file = 'No file';
      info.line = 0;
      info.totalLines = 0;
      info.language = '';
      info.project = workspaceName;
      info.totalFiles = 0;
    }

    presence?.setActivity(info);
  }, 3000);

  context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => scheduleUpdate()));
  context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(() => scheduleUpdate()));
  context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(() => scheduleUpdate()));

  updateTimer = setInterval(() => scheduleUpdate(), 10000);
}

export function deactivate() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
  }
  presence?.dispose();
  presence = null;
}

function throttle(fn: (...args: any[]) => void, wait: number) {
  let last = 0;
  let timeout: NodeJS.Timeout | null = null;
  return function (...args: any[]) {
    const now = Date.now();
    const remaining = wait - (now - last);
    if (remaining <= 0) {
      if (timeout) { clearTimeout(timeout); timeout = null; }
      last = now;
      fn.apply(null, args);
    } else if (!timeout) {
      timeout = setTimeout(() => {
        last = Date.now();
        timeout = null;
        fn.apply(null, args);
      }, remaining);
    }
  };
}
