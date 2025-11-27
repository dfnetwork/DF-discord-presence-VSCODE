# DF Network Rich Presence para VS Code

<div align="center">

**Muestra tu actividad de codificación en Discord con Rich Presence**

[![Version](https://img.shields.io/badge/version-0.3.0-blue.svg)](https://github.com/DF-Network/DF-DISCORD-PRESENCE)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.60%2B-blue.svg)](https://code.visualstudio.com/)

</div>

## 🚀 Características Principales

### 🎮 Discord Rich Presence
- ✅ Muestra tu proyecto actual en Discord
- ✅ Archivo que estás editando
- ✅ Lenguaje de programación
- ✅ **Formato de línea inteligente**:
  - Dentro de función: `Line 132:245` (línea actual : última línea de función)
  - Fuera de función: `Line 777:2,442` (línea actual : total de líneas)
- ✅ Tiempo de sesión (NO se reinicia al hacer click)
- ✅ Botones personalizables
- ✅ Imágenes customizables

### 🔍 Detección Inteligente de Funciones
Soporta **más de 40 lenguajes de programación**:

**Lenguajes populares:**
JavaScript, TypeScript, Python, Java, C/C++, C#, Go, Rust, Swift, Kotlin, PHP, Ruby, Scala, Lua, Perl, R, Dart

**Lenguajes funcionales:**
Haskell, F#, Erlang, Lisp/Scheme/Racket

**Lenguajes científicos:**
MATLAB, Julia, R

**Lenguajes de scripting:**
PowerShell, Bash/Shell

**Lenguajes legacy:**
COBOL, Fortran, Ada, Delphi/Object Pascal, Visual Basic/VBA

[Ver lista completa con ejemplos →](SUPPORTED_LANGUAGES.md)

### 💾 Sistema de Backup
- ✅ Crea backups completos de tu workspace
- ✅ Excluye automáticamente `node_modules`, `.git`, etc.
- ✅ Interfaz de guardado intuitiva
- ✅ Configurable mediante patrones

### 📊 Estadísticas de Workspace
- ✅ Total de archivos y tamaño
- ✅ Distribución por tipo de archivo
- ✅ Top 5 extensiones más usadas

### 📈 Telemetría Local (Privada)
- ✅ Estadísticas **100% locales** (nunca salen de tu máquina)
- ✅ Rastrea lenguajes usados
- ✅ Cuenta funciones detectadas
- ✅ Mide tiempo de codificación
- ✅ Totalmente opcional

## 📥 Instalación

### Desde VSIX
```bash
# Descargar el archivo .vsix
# Luego en VS Code:
code --install-extension dfnetwork-vscode-presence-0.3.0.vsix
```

### Desde el código fuente
```bash
git clone https://github.com/DF-Network/DF-DISCORD-PRESENCE
cd DF-DISCORD-PRESENCE
npm install
npm run compile
npm run package
code --install-extension *.vsix
```

## 🎮 Uso

### Comandos Disponibles

Abre la paleta de comandos (`Ctrl+Shift+P` / `Cmd+Shift+P`) y busca:

- `DF Presence: Reset Session Timer` - Reinicia el temporizador de sesión
- `DF Presence: Show Workspace Statistics` - Muestra estadísticas del workspace
- `DF Presence: Create Workspace Backup` - Crea un backup del workspace
- `DF Presence: Show Telemetry Statistics` - Muestra tus estadísticas locales
- `DF Presence: Configure Telemetry` - Configura preferencias de telemetría

### Formato de Línea en Discord

#### Cuando estás dentro de una función:
```
archivo.ts • TYPESCRIPT (Line 132:245)
```
- `132` = Línea actual
- `245` = Última línea de la función

#### Cuando estás fuera de una función:
```
archivo.py • PYTHON (Line 777:2,442)
```
- `777` = Línea actual
- `2,442` = Total de líneas del archivo

## ⚙️ Configuración

### 🎯 TODA la Configuración desde VS Code Settings

**Abre Settings** (`Ctrl+,` / `Cmd+,`) y busca "DF Presence" para configurar TODO:

#### Discord Configuration
```json
{
  "dfpresence.discord.clientId": "TU_CLIENT_ID",
  "dfpresence.discord.largeImageKey": "imagen_grande",
  "dfpresence.discord.largeImageText": "Texto grande",
  "dfpresence.discord.smallImageKey": "imagen_pequeña",
  "dfpresence.discord.smallImageText": "Texto pequeño",
  "dfpresence.discord.button1Label": "Mi Botón 1",
  "dfpresence.discord.button1Url": "https://mi-sitio.com",
  "dfpresence.discord.button2Label": "Mi Botón 2",
  "dfpresence.discord.button2Url": "https://otro-sitio.com"
}
```

#### Customization
```json
{
  "dfpresence.customization.noFileOpenText": "No File Open",
  "dfpresence.customization.useThousandsSeparator": true
}
```

#### Telemetry & Backup
```json
{
  "dfpresence.telemetry.enabled": false,
  "dfpresence.backup.excludePatterns": [
    "node_modules",
    ".git",
    "out",
    "dist"
  ]
}
```

### 📄 Archivo `config.json` (Opcional - Legacy)

También puedes usar `config.json` como fallback, pero **Settings tiene prioridad**.

**Orden de prioridad:**
1. **VS Code Settings** (recomendado) ✅
2. config.json (fallback)
3. Valores por defecto

[Ver guía completa de configuración →](CONFIG_GUIDE.md)

## 🔒 Privacidad

### Telemetría Local
- **100% local**: Los datos NUNCA salen de tu máquina
- **Opcional**: Deshabilitada por defecto
- **Transparente**: Puedes ver exactamente qué se recolecta
- **Control total**: Puedes borrar los datos en cualquier momento

**Datos recolectados (solo localmente):**
- Lenguajes de programación usados y su frecuencia
- Número de funciones detectadas por lenguaje
- Tiempo total de sesión
- **NO se recolecta**: Contenido de código, nombres de archivos específicos, información personal

## 🛠️ Desarrollo

### Requisitos
- Node.js 14+
- VS Code 1.60+

### Compilar
```bash
npm install
npm run compile
```

### Probar
```bash
# Presiona F5 en VS Code para abrir ventana de desarrollo
```

### Empaquetar
```bash
npm run package
```

## 📚 Documentación Completa

- [CONFIG_GUIDE.md](CONFIG_GUIDE.md) - Guía de configuración
- [SUPPORTED_LANGUAGES.md](SUPPORTED_LANGUAGES.md) - Lenguajes soportados
- [CHANGELOG.md](CHANGELOG.md) - Historial de cambios

## 🤝 Contribuir

Las contribuciones son bienvenidas! Por favor:

1. Fork el proyecto
2. Crea tu rama de features (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## 🙏 Créditos

**Desarrollado por [DF Network](https://dfnetwork.in/)**

- Discord Rich Presence oficial: [discord-rpc](https://github.com/discordjs/RPC)
- Inspirado en la comunidad de desarrollo de VS Code

## 🔗 Links

- [GitHub Repository](https://github.com/DF-Network/DF-DISCORD-PRESENCE)
- [DF Network Store](https://dfstore.tebex.io/)
- [DF Network](https://dfnetwork.in/)

---

<div align="center">

**Si te gusta este proyecto, dale una ⭐ en GitHub!**

Made with ❤️ by DF Network

</div>
