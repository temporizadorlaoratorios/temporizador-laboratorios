# Temporalizador INDABI

## Descripción
Sistema de temporizadores para laboratorios médicos. Permite gestionar timers de estudios médicos con cuenta regresiva, multi-laboratorio y panel de administración.

## Estructura del Proyecto
```
C:\Temporalizador nuevo\
├── server.js              # Servidor Node.js con Express + Socket.IO
├── login.html             # Página de login
├── index.html             # Interfaz de temporizadores (usuarios normales)
├── superadmin.html        # Panel de administración global
├── script.js              # Lógica del cliente (timers)
├── data/
│   ├── perfiles.json      # Usuarios (email, password, rol, laboratorio_id)
│   ├── laboratorios.json  # Laboratorios (id, nombre, max_pcs, activo)
│   ├── timers.json        # Timers activos
│   └── historial.json     # Log de acciones
├── crear_admin.js         # Script para crear super admin
└── *.bat, *.vbs           # Scripts de inicio Windows
```

## Roles de Usuario
- `super_admin`: Accede a `superadmin.html`, gestiona laboratorios
- `user`: Accede a `index.html`, usa timers en su laboratorio

## API de Login
- **POST /api/login**: Recibe `{email, password}`, retorna `{success, token, labId, rol}`
- El `token` es el `id` del perfil del usuario

## Base de Datos Local (JSON)
### perfiles.json
```json
[
  {
    "id": "admin-1",
    "email": "eferro888@gmail.com",
    "password": "Tenis888",
    "rol": "super_admin",
    "laboratorio_id": "super-admin"
  }
]
```

## Bugs Conocidos y Fixes
### 2026-03-23: Super Admin no mostraba su propio perfil
- **Problema**: En `superadmin.html`, el código buscaba el perfil del admin en `stats.labs`, pero el super admin no es un laboratorio
- **Fix aplicado**: 
  - `server.js` ahora envía `stats.superAdmin` con los datos del super admin
  - `superadmin.html` ahora usa `stats.superAdmin` en lugar de buscar en labs

## Socket.IO
- El cliente se conecta con `auth: { token, labId }`
- El servidor valida el token contra `perfiles.json`
- Super admin usa `labId: 'super-admin'`

## Puerto por defecto
- 3001 (configurable via .env PORT)

## Historial de Conversaciones
- Archivo: data/conversaciones.json
- Contiene todas las conversaciones previas con el agente
