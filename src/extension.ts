import * as vscode from 'vscode';
import { PresenceManager, PresenceInfo } from './presence';
import * as path from 'path';
import * as fs from 'fs';
import { createWorkspaceBackup, showWorkspaceStats } from './backup';
import { ensureTelemetryConsent, showTelemetryStats, TelemetryCollector, sendTelemetry } from './telemetry';

/**
 * Obtiene la configuración desde VS Code Settings
 * PRIORIDAD: Settings > config.json > defaults
 */
function getConfig() {
    const vsConfig = vscode.workspace.getConfiguration('dfpresence');

    // Intentar cargar config.json como fallback
    let fileConfig: any = {};
    try {
        const configPath = path.join(__dirname, '..', 'config.json');
        fileConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (err) {
        console.log('config.json not found, using VS Code settings only');
    }

    return {
        discord: {
            clientId: vsConfig.get<string>('discord.clientId') || fileConfig.discord?.clientId || '1443545245525610506',
            images: {
                largeImageKey: vsConfig.get<string>('discord.largeImageKey') || fileConfig.discord?.images?.largeImageKey || 'df_large',
                largeImageText: vsConfig.get<string>('discord.largeImageText') || fileConfig.discord?.images?.largeImageText || 'DF Network',
                smallImageKey: vsConfig.get<string>('discord.smallImageKey') || fileConfig.discord?.images?.smallImageKey || 'df_small',
                smallImageText: vsConfig.get<string>('discord.smallImageText') || fileConfig.discord?.images?.smallImageText || 'Coding'
            },
            buttons: [
                {
                    label: vsConfig.get<string>('discord.button1Label') || fileConfig.discord?.buttons?.[0]?.label || 'DF Store',
                    url: vsConfig.get<string>('discord.button1Url') || fileConfig.discord?.buttons?.[0]?.url || 'https://dfstore.tebex.io/'
                },
                {
                    label: vsConfig.get<string>('discord.button2Label') || fileConfig.discord?.buttons?.[1]?.label || 'DF Network',
                    url: vsConfig.get<string>('discord.button2Url') || fileConfig.discord?.buttons?.[1]?.url || 'https://dfnetwork.in/'
                }
            ]
        },
        customization: {
            noFileOpenText: vsConfig.get<string>('customization.noFileOpenText') || fileConfig.customization?.noFileOpenText || 'No File Open',
            lineFormatStyle: 'colon',
            useThousandsSeparator: vsConfig.get<boolean>('customization.useThousandsSeparator') ?? fileConfig.customization?.useThousandsSeparator ?? true
        }
    };
}

let presence: PresenceManager | null = null;
let updateTimer: NodeJS.Timeout | null = null;
let telemetryCollector: TelemetryCollector | null = null;
let sessionStartTime = Date.now();
let lastInteractionTime = Date.now();

export async function activate(context: vscode.ExtensionContext) {
    console.log('Activating DF Network Presence');
    const workspaceName = vscode.workspace.name || 'No workspace';

    // Cargar configuración (Settings > config.json > defaults)
    const config = getConfig();
    const CLIENT_ID = config.discord.clientId;

    presence = new PresenceManager(CLIENT_ID, workspaceName, config);

    // Inicializar telemetry collector
    telemetryCollector = new TelemetryCollector(context);

    await presence.connect();

    // Enviar evento de inicio de sesión
    await sendTelemetry(context, {
        type: 'session_start',
        timestamp: new Date().toISOString(),
        data: { workspace: workspaceName }
    });

    const updatePresence = () => {
        const editor = vscode.window.activeTextEditor;
        const info: PresenceInfo = {};

        if (editor) {
            const doc = editor.document;
            const file = doc.uri.scheme === 'file' ? vscode.workspace.asRelativePath(doc.uri) : doc.fileName;
            info.file = file.split('/').pop();
            info.language = doc.languageId;
            info.line = editor.selection.active.line + 1;
            info.totalLines = doc.lineCount;

            // Intentar detectar si estamos dentro de una función
            info.functionEndLine = findFunctionEndLine(editor);

            const folder = vscode.workspace.getWorkspaceFolder(doc.uri);
            info.project = folder ? folder.name : (vscode.workspace.name || 'No workspace');

            // Telemetría: rastrear uso de lenguaje
            if (telemetryCollector && info.language) {
                telemetryCollector.trackLanguageUsed(info.language);
                if (info.functionEndLine) {
                    telemetryCollector.trackFunctionDetected(info.language);
                }
            }
        } else {
            info.file = 'No file open';
            info.language = '';
            info.project = vscode.workspace.name || 'No workspace';
        }

        presence?.setActivity(info);
    };

    const scheduleUpdate = throttle(updatePresence, 4000);

    setTimeout(updatePresence, 2000);

    context.subscriptions.push(vscode.window.onDidChangeActiveTextEditor(() => {
        lastInteractionTime = Date.now();
        scheduleUpdate();
    }));
    context.subscriptions.push(vscode.window.onDidChangeTextEditorSelection(() => {
        lastInteractionTime = Date.now();
        scheduleUpdate();
    }));
    context.subscriptions.push(vscode.workspace.onDidOpenTextDocument(() => {
        lastInteractionTime = Date.now();
        scheduleUpdate();
    }));

    updateTimer = setInterval(() => updatePresence(), 12000);

    // Comandos
    const resetCmd = vscode.commands.registerCommand('dfpresence.resetTimer', () => {
        presence?.resetTimer();
        sessionStartTime = Date.now();
        vscode.window.showInformationMessage('DF Presence: Session timer reset');
    });
    context.subscriptions.push(resetCmd);

    const statsCmd = vscode.commands.registerCommand('dfpresence.showStats', async () => {
        await showWorkspaceStats();
    });
    context.subscriptions.push(statsCmd);

    const backupCmd = vscode.commands.registerCommand('dfpresence.createBackup', async () => {
        const result = await createWorkspaceBackup(context);
        if (result) {
            vscode.window.showInformationMessage(`Backup preparation complete: ${result}`);
        }
    });
    context.subscriptions.push(backupCmd);

    const telemetryStatsCmd = vscode.commands.registerCommand('dfpresence.showTelemetryStats', async () => {
        await showTelemetryStats(context);
    });
    context.subscriptions.push(telemetryStatsCmd);

    const configureTelemetryCmd = vscode.commands.registerCommand('dfpresence.configureTelemetry', async () => {
        await ensureTelemetryConsent(context);
        vscode.window.showInformationMessage('Telemetry settings updated');
    });
    context.subscriptions.push(configureTelemetryCmd);

    context.subscriptions.push({ dispose: () => { deactivate(); } });
}

export function deactivate() {
    // Guardar tiempo de sesión antes de desactivar
    if (telemetryCollector) {
        const sessionTime = Math.floor((Date.now() - sessionStartTime) / 1000);
        telemetryCollector.trackSessionTime(sessionTime);
    }

    if (updateTimer) {
        clearInterval(updateTimer);
        updateTimer = null;
    }
    presence?.dispose();
    presence = null;
    telemetryCollector = null;
}

function findFunctionEndLine(editor: vscode.TextEditor): number | undefined {
    const doc = editor.document;
    const currentLine = editor.selection.active.line;
    const text = doc.getText();
    const lines = text.split('\n');
    const language = doc.languageId;

    // Buscar hacia atrás para encontrar el inicio de una función
    let functionStartLine = -1;
    let braceCount = 0;

    // Patrones completos para detectar inicio de funciones en TODOS los lenguajes populares
    const functionPatterns = [
        // JavaScript/TypeScript
        /function\s+\w+\s*\(/,
        /const\s+\w+\s*=\s*\([^)]*\)\s*=>/,
        /let\s+\w+\s*=\s*\([^)]*\)\s*=>/,
        /var\s+\w+\s*=\s*function/,
        /\w+\s*\([^)]*\)\s*{/,
        /=>\s*{/,

        // Python
        /def\s+\w+\s*\(/,
        /async\s+def\s+\w+\s*\(/,

        // Java/C#/Kotlin
        /public\s+\w+\s+\w+\s*\(/,
        /private\s+\w+\s+\w+\s*\(/,
        /protected\s+\w+\s+\w+\s*\(/,
        /static\s+\w+\s+\w+\s*\(/,
        /override\s+fun\s+\w+\s*\(/,  // Kotlin
        /fun\s+\w+\s*\(/,              // Kotlin

        // C/C++
        /\w+\s+\w+\s*\([^)]*\)\s*{/,
        /\w+::\w+\s*\([^)]*\)\s*{/,    // C++ class methods

        // Go
        /func\s+\w+\s*\(/,
        /func\s+\(\w+\s+\*?\w+\)\s+\w+\s*\(/,  // Go methods

        // Rust
        /fn\s+\w+/,
        /pub\s+fn\s+\w+/,
        /async\s+fn\s+\w+/,

        // Swift
        /func\s+\w+/,
        /private\s+func\s+\w+/,
        /public\s+func\s+\w+/,

        // PHP
        /function\s+\w+\s*\(/,
        /public\s+function\s+\w+\s*\(/,
        /private\s+function\s+\w+\s*\(/,
        /protected\s+function\s+\w+\s*\(/,

        // Ruby
        /def\s+\w+/,
        /def\s+self\.\w+/,

        // Scala
        /def\s+\w+\s*\(/,
        /def\s+\w+\s*:/,

        // Lua
        /function\s+\w+\s*\(/,
        /local\s+function\s+\w+\s*\(/,

        // Perl
        /sub\s+\w+\s*{/,

        // R
        /\w+\s*<-\s*function\s*\(/,
        /\w+\s*=\s*function\s*\(/,

        // Dart
        /\w+\s+\w+\s*\([^)]*\)\s*{/,
        /Future<\w+>\s+\w+\s*\(/,

        // Elixir
        /def\s+\w+/,
        /defp\s+\w+/,

        // Haskell
        /\w+\s*::/,

        // Julia
        /function\s+\w+\s*\(/,

        // Visual Basic/VBA
        /Sub\s+\w+\s*\(/i,
        /Function\s+\w+\s*\(/i,
        /Private\s+Sub\s+\w+/i,
        /Public\s+Function\s+\w+/i,

        // Delphi/Object Pascal
        /procedure\s+\w+/i,
        /function\s+\w+/i,

        // Fortran
        /subroutine\s+\w+/i,
        /function\s+\w+/i,
        /program\s+\w+/i,

        // Ada
        /procedure\s+\w+/i,
        /function\s+\w+/i,

        // COBOL
        /PROCEDURE\s+DIVISION/i,
        /IDENTIFICATION\s+DIVISION/i,

        // Objective-C
        /[-+]\s*\(\w+\)\s*\w+/,

        // F#
        /let\s+\w+\s*\(/,
        /let\s+rec\s+\w+/,

        // Erlang
        /\w+\s*\([^)]*\)\s*->/,

        // Lisp/Scheme/Racket
        /\(define\s+\(/,
        /\(defun\s+\w+/,

        // Prolog
        /\w+\s*\([^)]*\)\s*:-/,

        // MATLAB
        /function\s+\[?\w+\]?\s*=\s*\w+\s*\(/,

        // PowerShell
        /function\s+\w+/i,
        /Function\s+\w+\s*{/,

        // Bash/Shell
        /\w+\s*\(\)\s*{/,
        /function\s+\w+\s*{/,

        // SQL/PL-SQL
        /CREATE\s+(?:OR\s+REPLACE\s+)?(?:PROCEDURE|FUNCTION)\s+\w+/i,
        /PROCEDURE\s+\w+/i,
        /FUNCTION\s+\w+/i,

        // Class declarations (general)
        /class\s+\w+/,
        /interface\s+\w+/,
        /struct\s+\w+/,
        /enum\s+\w+/,
    ];

    // Buscar hacia atrás desde la línea actual
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i];

        // Contar llaves para detectar bloques
        for (let char of line) {
            if (char === '}') braceCount++;
            if (char === '{') braceCount--;
        }

        // Si encontramos una llave de apertura sin cerrar, verificamos si es inicio de función
        if (braceCount < 0) {
            for (let pattern of functionPatterns) {
                if (pattern.test(line)) {
                    functionStartLine = i;
                    break;
                }
            }
            if (functionStartLine >= 0) break;
        }
    }

    // Manejo especial para Python (usa indentación, no llaves)
    if (language === 'Python' && functionStartLine < 0) {
        return findPythonFunctionEnd(lines, currentLine);
    }

    // Manejo especial para Ruby, Elixir (usan 'end' en lugar de llaves)
    if ((language === 'Ruby' || language === 'Elixir') && functionStartLine < 0) {
        return findEndBasedFunctionEnd(lines, currentLine, language);
    }

    // Manejo especial para Lua (usa 'end' también)
    if (language === 'Lua' && functionStartLine < 0) {
        return findEndBasedFunctionEnd(lines, currentLine, language);
    }

    // Manejo especial para Visual Basic/VBA (usa 'End Sub' / 'End Function')
    if ((language === 'VB' || language === 'VBA') && functionStartLine < 0) {
        return findVBFunctionEnd(lines, currentLine);
    }

    // Manejo especial para Fortran (usa 'END' statements)
    if (language === 'Fortran' && functionStartLine < 0) {
        return findFortranFunctionEnd(lines, currentLine);
    }

    // Si encontramos el inicio de una función, buscar su cierre
    if (functionStartLine >= 0) {
        braceCount = 0;
        let inFunction = false;

        for (let i = functionStartLine; i < lines.length; i++) {
            const line = lines[i];

            for (let char of line) {
                if (char === '{') {
                    braceCount++;
                    inFunction = true;
                }
                if (char === '}') {
                    braceCount--;
                    if (inFunction && braceCount === 0) {
                        return i + 1; // +1 porque las líneas empiezan en 0
                    }
                }
            }
        }
    }

    return undefined;
}

// Función especial para detectar el final de funciones en Python (basado en indentación)
function findPythonFunctionEnd(lines: string[], currentLine: number): number | undefined {
    let functionStartLine = -1;
    let baseIndent = -1;

    // Buscar hacia atrás para encontrar 'def '
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('def ') || trimmed.startsWith('async def ')) {
            functionStartLine = i;
            // Calcular indentación base
            baseIndent = line.search(/\S/);
            break;
        }
    }

    if (functionStartLine >= 0 && baseIndent >= 0) {
        // Buscar hacia adelante para encontrar donde termina la indentación
        for (let i = functionStartLine + 1; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Ignorar líneas vacías o comentarios
            if (trimmed === '' || trimmed.startsWith('#')) {
                continue;
            }

            const currentIndent = line.search(/\S/);

            // Si la indentación vuelve al nivel base o menor, la función terminó
            if (currentIndent <= baseIndent) {
                return i;
            }
        }

        // Si llegamos al final del archivo, la función termina ahí
        return lines.length;
    }

    return undefined;
}

// Función para lenguajes que usan 'end' (Ruby, Lua, Elixir)
function findEndBasedFunctionEnd(lines: string[], currentLine: number, language: string): number | undefined {
    let functionStartLine = -1;
    let endCount = 0;

    // Patrones de inicio según lenguaje
    const startPatterns = language === 'ruby'
        ? [/def\s+\w+/, /def\s+self\.\w+/]
        : language === 'elixir'
        ? [/def\s+\w+/, /defp\s+\w+/]
        : [/function\s+\w+/, /local\s+function\s+\w+/]; // Lua

    // Buscar hacia atrás para encontrar el inicio de la función
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i].trim();

        for (let pattern of startPatterns) {
            if (pattern.test(line)) {
                functionStartLine = i;
                break;
            }
        }

        if (functionStartLine >= 0) break;
    }

    if (functionStartLine >= 0) {
        // Buscar hacia adelante para encontrar el 'end' correspondiente
        for (let i = functionStartLine; i < lines.length; i++) {
            const line = lines[i].trim();

            // Contar 'def', 'function', etc. (abre bloque)
            for (let pattern of startPatterns) {
                if (pattern.test(line)) {
                    endCount++;
                }
            }

            // Contar 'end' (cierra bloque)
            if (/^end\b/.test(line) || /\bend\s*$/.test(line)) {
                endCount--;
                if (endCount === 0) {
                    return i + 1;
                }
            }
        }
    }

    return undefined;
}

// Función para Visual Basic/VBA (usa 'End Sub' / 'End Function')
function findVBFunctionEnd(lines: string[], currentLine: number): number | undefined {
    let functionStartLine = -1;
    let functionType = '';

    // Buscar hacia atrás para encontrar Sub o Function
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i].trim();

        if (/^(Public\s+|Private\s+)?Sub\s+\w+/i.test(line)) {
            functionStartLine = i;
            functionType = 'Sub';
            break;
        } else if (/^(Public\s+|Private\s+)?Function\s+\w+/i.test(line)) {
            functionStartLine = i;
            functionType = 'Function';
            break;
        }
    }

    if (functionStartLine >= 0 && functionType) {
        // Buscar 'End Sub' o 'End Function'
        const endPattern = new RegExp(`^End\\s+${functionType}`, 'i');

        for (let i = functionStartLine + 1; i < lines.length; i++) {
            const line = lines[i].trim();

            if (endPattern.test(line)) {
                return i + 1;
            }
        }
    }

    return undefined;
}

// Función para Fortran (usa 'END SUBROUTINE' / 'END FUNCTION')
function findFortranFunctionEnd(lines: string[], currentLine: number): number | undefined {
    let functionStartLine = -1;
    let functionType = '';
    let functionName = '';

    // Buscar hacia atrás para encontrar SUBROUTINE o FUNCTION
    for (let i = currentLine; i >= 0; i--) {
        const line = lines[i].trim();

        const subroutineMatch = /^SUBROUTINE\s+(\w+)/i.exec(line);
        const functionMatch = /^FUNCTION\s+(\w+)/i.exec(line);

        if (subroutineMatch) {
            functionStartLine = i;
            functionType = 'SUBROUTINE';
            functionName = subroutineMatch[1];
            break;
        } else if (functionMatch) {
            functionStartLine = i;
            functionType = 'FUNCTION';
            functionName = functionMatch[1];
            break;
        }
    }

    if (functionStartLine >= 0 && functionType) {
        // Buscar 'END SUBROUTINE nombre' o 'END FUNCTION nombre'
        const endPattern = new RegExp(`^END\\s+${functionType}(\\s+${functionName})?`, 'i');

        for (let i = functionStartLine + 1; i < lines.length; i++) {
            const line = lines[i].trim();

            if (endPattern.test(line)) {
                return i + 1;
            }
        }
    }

    return undefined;
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
