# 🚀 TEMPORALIZADOR SINCRONIZADO - INDABI

Sistema de temporizadores médicos sincronizados en tiempo real entre múltiples PCs.

## 📋 INSTALACIÓN

### 1. Instalar Node.js
Si no tienes Node.js instalado:
- Descargar desde: https://nodejs.org/
- Instalar la versión LTS (recomendada)
- Verificar instalación: abrir CMD y ejecutar `node --version`

### 2. Instalar Dependencias
Abrir terminal/CMD en la carpeta del proyecto:
```
cd "ruta\a\tu\carpeta\Temporalizador nuevo"
npm install
```

## ▶️ INICIAR EL SERVIDOR

### Opción 1: Comando directo
```
node server.js
```

### Opción 2: Usando npm
```
npm start
```

Verás un mensaje como:
```
🚀 Servidor de Temporizadores Sincronizados
📍 Local: http://localhost:3000
🌐 Red: http://192.168.19.209:3000
✅ Listo para aceptar conexiones
```

## 🌐 ACCEDER DESDE OTRAS PCS

1. **En la PC del servidor:** Anotar la IP mostrada (ej: 192.168.19.209)
2. **En otras PCs de la red:** Abrir navegador y visitar:
   ```
   http://192.168.19.209:3000
   ```

## ✨ CARACTERÍSTICAS

- ✅ **Sincronización en Tiempo Real:** Todos ven lo mismo instantáneamente
- ✅ **Múltiples PCs:** Cualquier PC puede crear, pausar, reiniciar o eliminar temporizadores
- ✅ **Persistencia:** Los temporizadores se guardan en `timers.json`
- ✅ **Precisión:** Configuración en minutos y segundos
- ✅ **Alarma Sonora:** Al completarse un temporizador
- ✅ **Notificaciones:** Del navegador cuando se completa

## 🔧 SOLUCIÓN DE PROBLEMAS

### El servidor no inicia
- Verificar que el puerto 3000 no esté ocupado
- Cambiar PORT en `server.js` si es necesario

### No se conectan otras PCs
- Verificar que todas estén en la misma red
- Desactivar temporalmente el firewall de Windows
- Verificar la IP correcta del servidor

### Los cambios no se sincronizan
- Refrescar la página (F5)
- Verificar la conexión del servidor (debe estar corriendo)

## 📁 ARCHIVOS DEL SISTEMA

- `server.js` - Servidor Node.js con Socket.IO
- `index.html` - Interfaz web
- `script.js` - Lógica del cliente
- `style.css` - Estilos visuales
- `package.json` - Configuración y dependencias
- `timers.json` - Base de datos de temporizadores (se crea automáticamente)
- `logo.png` - Logo de INDABI

## 🛑 DETENER EL SERVIDOR

En la terminal donde corre el servidor:
- Windows: `Ctrl + C`
- Confirmar con `S` o `Y`

---

**Desarrollado para INDABI - Instituto de Análisis Bioquímicos**
