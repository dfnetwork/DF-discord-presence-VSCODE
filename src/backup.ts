import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import archiver from 'archiver';

/**
 * Configuración de backup desde config.json
 */
export interface BackupConfig {
  enabled?: boolean;
  excludePatterns?: string[];
  defaultBackupLocation?: string;
  webhookUrl?: string;
}

/**
 * Crea un backup del workspace actual
 */
export async function createWorkspaceBackup(context: vscode.ExtensionContext): Promise<string | null> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    vscode.window.showErrorMessage('No workspace open to create backup.');
    return null;
  }

  const root = folders[0].uri.fsPath;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19);
  const workspaceName = path.basename(root);
  const backupName = `${workspaceName}-backup-${timestamp}`;

  // Preguntar al usuario dónde guardar el backup
  const saveUri = await vscode.window.showSaveDialog({
    defaultUri: vscode.Uri.file(path.join(root, '..', backupName + '.zip')),
    filters: { 'Zip Archives': ['zip'] }
  });

  if (!saveUri) {
    return null; // Usuario canceló
  }

  try {
    // Crear lista de archivos a incluir
    const filesToBackup = await collectFilesForBackup(root);

    vscode.window.showInformationMessage(
      `Creating backup with ${filesToBackup.length} files...`
    );

    // Crear el archivo zip
    const zipPath = await createZipArchive(root, filesToBackup, saveUri.fsPath);

    vscode.window.showInformationMessage(
      `Backup created successfully: ${zipPath}`
    );

    return zipPath;
  } catch (err) {
    console.error('Backup error:', err);
    vscode.window.showErrorMessage(`Backup failed: ${err}`);
    return null;
  }
}

/**
 * Recolecta archivos para backup excluyendo node_modules, .git, etc.
 */
async function collectFilesForBackup(rootPath: string): Promise<string[]> {
  const excludePatterns = [
    'node_modules',
    '.git',
    'out',
    'dist',
    'build',
    '.vscode-test',
    '*.vsix',
    '*.log',
    '.DS_Store',
    'Thumbs.db'
  ];

  const files: string[] = [];

  function walkDir(dir: string) {
    const items = fs.readdirSync(dir);

    for (const item of items) {
      const fullPath = path.join(dir, item);
      const relativePath = path.relative(rootPath, fullPath);

      // Verificar si debe excluirse
      const shouldExclude = excludePatterns.some(pattern => {
        if (pattern.startsWith('*')) {
          return relativePath.endsWith(pattern.substring(1));
        }
        return relativePath.includes(pattern);
      });

      if (shouldExclude) continue;

      const stat = fs.statSync(fullPath);
      if (stat.isDirectory()) {
        walkDir(fullPath);
      } else {
        files.push(fullPath);
      }
    }
  }

  walkDir(rootPath);
  return files;
}

/**
 * Crea un archivo ZIP con los archivos especificados
 */
async function createZipArchive(rootPath: string, files: string[], outputPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(outputPath);
    const archive = archiver('zip', {
      zlib: { level: 9 } // Nivel de compresión máximo
    });

    output.on('close', () => {
      console.log(`Backup created: ${archive.pointer()} total bytes`);
      resolve(outputPath);
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') {
        console.warn('Archive warning:', err);
      } else {
        reject(err);
      }
    });

    // Conectar el archiver al stream de salida
    archive.pipe(output);

    // Añadir cada archivo al zip
    for (const file of files) {
      const relativePath = path.relative(rootPath, file);
      archive.file(file, { name: relativePath });
    }

    // Finalizar el archivo
    archive.finalize();
  });
}

/**
 * Obtiene estadísticas del workspace
 */
export async function getWorkspaceStats(): Promise<WorkspaceStats | null> {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return null;
  }

  const root = folders[0].uri.fsPath;
  const files = await collectFilesForBackup(root);

  let totalSize = 0;
  const filesByType: Record<string, number> = {};

  for (const file of files) {
    try {
      const stat = fs.statSync(file);
      totalSize += stat.size;

      const ext = path.extname(file) || 'no-extension';
      filesByType[ext] = (filesByType[ext] || 0) + 1;
    } catch (err) {
      // Ignorar archivos que no se pueden leer
    }
  }

  return {
    totalFiles: files.length,
    totalSize,
    filesByType,
    workspaceName: path.basename(root)
  };
}

export interface WorkspaceStats {
  totalFiles: number;
  totalSize: number;
  filesByType: Record<string, number>;
  workspaceName: string;
}

/**
 * Muestra estadísticas del workspace
 */
export async function showWorkspaceStats() {
  const stats = await getWorkspaceStats();
  if (!stats) {
    vscode.window.showErrorMessage('No workspace open.');
    return;
  }

  const sizeMB = (stats.totalSize / (1024 * 1024)).toFixed(2);
  const topTypes = Object.entries(stats.filesByType)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([ext, count]) => `${ext}: ${count}`)
    .join(', ');

  vscode.window.showInformationMessage(
    `Workspace: ${stats.workspaceName} | Files: ${stats.totalFiles} | Size: ${sizeMB} MB | Top types: ${topTypes}`
  );
}
