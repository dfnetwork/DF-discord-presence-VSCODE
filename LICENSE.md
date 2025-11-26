# df_network_extension

Extensión ligera para gestionar y monitorizar conexiones de red. Útil para proxies, reglas de filtrado, tun/tap virtual y captura de tráfico en entornos controlados.

## Características
- Gestión de conexiones entrantes y salientes
- Interfaces para reglas de filtrado y enrutamiento
- Monitor de eventos de red y métricas
- Integración con sistemas de configuración y logs

## Requisitos
- Sistema operativo: macOS, Linux o Windows (según implementación)
- Lenguaje: Swift / Go / Rust / Node (adapte según la implementación)
- Compilador: Xcode 12+ / Go 1.18+ / Rust stable / Node 14+

## Instalación
Clonar el repositorio y compilar:
```bash
git clone https://github.com/tu-org/df_network_extension.git
cd df_network_extension
# Ejemplo SwiftPM
swift build -c release
# Ejemplo Go
go build ./...
```

Instalación con gestor de paquetes (ejemplo SwiftPM):
```swift
dependencies: [
    .package(url: "https://github.com/tu-org/df_network_extension.git", from: "0.1.0"),
]
```

## Uso básico
Ejemplo de inicialización (pseudo-código):
```swift
import DFNetworkExtension

let manager = DFNetworkManager(configuration: .default)
try manager.start()

// Añadir una regla
let rule = DFNetworkRule(match: "tcp", port: 80, action: .allow)
manager.add(rule: rule)

// Monitor
manager.onConnection { connection in
    print("Conexión: \(connection.remoteAddress)")
}
```

Ejemplo de CLI:
```bash
# Iniciar
dfnetctl start

# Añadir regla
dfnetctl rule add --proto tcp --port 22 --action deny

# Mostrar estado
dfnetctl status
```

## Configuración
Formato YAML de ejemplo:
```yaml
interface: "df0"
routing:
    - match: "tcp"
        ports: [80, 443]
        action: redirect
log:
    level: "info"
    file: "/var/log/df_network_extension.log"
```

## Desarrollo
- Ejecutar pruebas:
    - Swift: swift test
    - Go: go test ./...
    - Node: npm test
- Linting y formateo: ejecutar las herramientas del lenguaje antes de hacer PRs.

## Contribuir
1. Abre un issue para discutir cambios importantes.
2. Crea una rama con tu feature/bugfix.
3. Añade pruebas y documentación.
4. Envía un pull request.

## Licencia
MIT — ver archivo LICENSE para más detalles.

## Contacto
Para dudas o soporte, abre un issue o contacta a maintainer@tu-org.example