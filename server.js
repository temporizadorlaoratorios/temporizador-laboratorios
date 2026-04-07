const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs').promises;
const path = require('path');
const os = require('os');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3001;

// Middlewares
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, 'data', 'logos'))); // Servir logos directamente
app.use(express.json({ limit: '10mb' })); // Aumentar límite para base64

// Rutas de datos
const DB_PATHS = {
    perfiles: path.join(__dirname, 'data', 'perfiles.json'),
    laboratorios: path.join(__dirname, 'data', 'laboratorios.json'),
    timers: path.join(__dirname, 'data', 'timers.json'),
    historial: path.join(__dirname, 'data', 'historial.json'),
    conversaciones: path.join(__dirname, 'data', 'conversaciones.json'),
    logosDir: path.join(__dirname, 'data', 'logos')
};

// Estados en memoria
let timers = []; 
let activeSessions = new Map(); // labId -> Set(socket.id)
let socketToLab = new Map(); 
let labLimits = new Map();

// === FUNCIONES DE BASE DE DATOS LOCAL ===
async function readDB(fileKey) {
    try {
        const data = await fs.readFile(DB_PATHS[fileKey], 'utf8');
        return JSON.parse(data);
    } catch (e) {
        console.error(`Error leyendo ${fileKey}:`, e);
        return [];
    }
}

async function writeDB(fileKey, content) {
    try {
        await fs.writeFile(DB_PATHS[fileKey], JSON.stringify(content, null, 2), 'utf8');
    } catch (e) {
        console.error(`Error escribiendo ${fileKey}:`, e);
    }
}

// === API DE LOGIN ===
app.post('/api/login', async (req, res) => {
    const { email, password } = req.body;
    const perfiles = await readDB('perfiles');
    const user = perfiles.find(p => p.email === email && p.password === password);
    
    if (user) {
        const laboratorios = await readDB('laboratorios');
        const lab = laboratorios.find(l => l.id === user.laboratorio_id);
        res.json({ 
            success: true, 
            token: user.id, 
            labId: user.laboratorio_id, 
            rol: user.rol,
            labLogo: lab ? lab.logo : null,
            labNombre: lab ? lab.nombre : 'Laboratorio'
        });
    } else {
        res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }
});

// === API DE TIEMPO (Sincronización) ===
app.get('/api/time', (req, res) => {
    res.json({ serverTime: Date.now() });
});

// === API DE LOGOS ===
app.post('/api/upload-logo', async (req, res) => {
    try {
        const { labId, image, fileName } = req.body;
        if (!labId || !image) {
            return res.status(400).json({ success: false, error: 'Datos insuficientes' });
        }

        // image es un string base64: "data:image/png;base64,..."
        const base64Data = image.replace(/^data:image\/\w+;base64,/, "");
        const ext = fileName ? path.extname(fileName) : '.png';
        const logoName = `logo-${labId}${ext}`;
        const logoPath = path.join(DB_PATHS.logosDir, logoName);

        await fs.writeFile(logoPath, base64Data, 'base64');

        // Actualizar laboratorios.json
        const laboratorios = await readDB('laboratorios');
        const labIdx = laboratorios.findIndex(l => l.id === labId);
        if (labIdx > -1) {
            laboratorios[labIdx].logo = logoName;
            await writeDB('laboratorios', laboratorios);
            res.json({ success: true, logo: logoName });
        } else {
            res.status(404).json({ success: false, error: 'Laboratorio no encontrado' });
        }
    } catch (error) {
        console.error('Error subiendo logo:', error);
        res.status(500).json({ success: true, error: error.message });
    }
});

app.post('/api/delete-logo', async (req, res) => {
    try {
        const { labId } = req.body;
        if (!labId) {
            return res.status(400).json({ success: false, error: 'Datos insuficientes' });
        }

        const laboratorios = await readDB('laboratorios');
        const labIdx = laboratorios.findIndex(l => l.id === labId);
        if (labIdx > -1) {
            const currentLogo = laboratorios[labIdx].logo;
            laboratorios[labIdx].logo = null;
            await writeDB('laboratorios', laboratorios);
            
            // Opcional: intentar eliminar el archivo físico
            if (currentLogo) {
                const logoPath = path.join(DB_PATHS.logosDir, currentLogo);
                try {
                    await fs.unlink(logoPath);
                } catch (err) {
                    console.error('No se pudo eliminar el archivo físico del logo:', err);
                }
            }

            res.json({ success: true });
        } else {
            res.status(404).json({ success: false, error: 'Laboratorio no encontrado' });
        }
    } catch (error) {
        console.error('Error eliminando logo:', error);
        res.status(500).json({ success: false, error: 'Error del servidor' });
    }
});

// === API DE CONVERSACIONES ===
app.get('/api/conversaciones', async (req, res) => {
    const conversaciones = await readDB('conversaciones');
    res.json(conversaciones);
});

app.post('/api/conversaciones', async (req, res) => {
    const { tema, mensajes } = req.body;
    const conversaciones = await readDB('conversaciones');
    conversaciones.push({
        id: Date.now().toString(),
        tema: tema || 'Sin título',
        mensajes: mensajes || [],
        fecha: new Date().toISOString()
    });
    await writeDB('conversaciones', conversaciones);
    res.json({ success: true });
});

// === UTILIDADES ===
function formatTime(totalSeconds) {
    const h = Math.floor(totalSeconds / 3600);
    const m = Math.floor((totalSeconds % 3600) / 60);
    const s = totalSeconds % 60;
    if (h > 0) return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function getLocalIP() {
    const interfaces = os.networkInterfaces();
    for (const name of Object.keys(interfaces)) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
    }
    return '127.0.0.1';
}

async function logHistory(action, timer) {
    console.log(`[HISTORIAL] ${action} - ${timer.patientName} (${timer.laboratorio_id})`);
    const historyEvent = {
        id: Date.now().toString(),
        laboratorio_id: timer.laboratorio_id,
        action: action,
        patientName: timer.patientName,
        studyType: timer.studyType,
        timestamp: new Date().toISOString()
    };
    
    // Guardar historial en JSON
    const historial = await readDB('historial');
    historial.push(historyEvent);
    await writeDB('historial', historial);
    
    io.to(timer.laboratorio_id).emit('historyUpdate', historyEvent);
}

// === LÓGICA DEL TEMPORIZADOR ===
// === LÓGICA DEL TEMPORIZADOR (DESACTIVADA: Usando Supabase como fuente de verdad) ===
/*
setInterval(async () => {
    let hasChanges = false;
    timers.forEach(t => {
        if (t.isRunning && !t.isCompleted) {
            t.remainingSeconds--;
            hasChanges = true;

            if (t.remainingSeconds <= 0) {
                t.remainingSeconds = 0;
                t.isRunning = false;
                t.isCompleted = true;
                logHistory('COMPLETADO', t);
                console.log(`⏰ ALARMA: ${t.patientName} - ${t.studyType}`);
            }

            io.to(t.laboratorio_id).emit('timerUpdate', {
                ...t,
                displayTime: formatTime(t.remainingSeconds)
            });
        }
    });

    // Guardar timers a disco periódicamente (por si el servidor se apaga)
    if (hasChanges) {
        const timersToSave = timers.map(t => ({...t, displayTime: undefined}));
        await writeDB('timers', timersToSave);
    }
}, 1000);
*/


// === SOCKET.IO EVENTOS ===
io.on('connection', async (socket) => {
    const { labId, token } = socket.handshake.auth;

    // Verificar token en perfiles locales
    const perfiles = await readDB('perfiles');
    const userProfile = perfiles.find(p => p.id === token);
    
    if (!userProfile) {
        console.log(`❌ Conexión rechazada: Token inválido`);
        socket.disconnect();
        return;
    }

    // Super Admin Socket
    if (labId === 'super-admin') {
        if (userProfile.rol === 'super_admin') {
            socket.join('super-admins');
            
            socket.on('get_admin_stats', async () => {
                const laboratorios = await readDB('laboratorios');
                const perfiles = await readDB('perfiles');
                const superAdmin = perfiles.find(p => p.rol === 'super_admin');
                const stats = {
                    labs: laboratorios.map(l => {
                        const perfil = perfiles.find(p => p.laboratorio_id === l.id);
                        return {
                            ...l,
                            email: perfil ? perfil.email : '',
                            password: perfil ? perfil.password : '',
                            online: activeSessions.has(l.id) && activeSessions.get(l.id).size > 0,
                            active_pcs: activeSessions.has(l.id) ? activeSessions.get(l.id).size : 0
                        };
                    }),
                    superAdmin: superAdmin ? { email: superAdmin.email, password: superAdmin.password } : null,
                    total_active_pcs: Array.from(activeSessions.entries()).filter(([id]) => id !== 'super-admin').reduce((acc, [_, set]) => acc + set.size, 0)
                };
                socket.emit('admin_stats_update', stats);
            });

            socket.on('update_admin_profile', async (data) => {
                const perfiles = await readDB('perfiles');
                const adminIdx = perfiles.findIndex(p => p.id === token && p.rol === 'super_admin');
                if (adminIdx > -1) {
                    if (data.email) perfiles[adminIdx].email = data.email;
                    if (data.password) perfiles[adminIdx].password = data.password;
                    await writeDB('perfiles', perfiles);
                    socket.emit('admin_action_success', 'Perfil de administrador actualizado.');
                }
            });

            socket.on('create_lab', async (data) => {
                const laboratorios = await readDB('laboratorios');
                const perfiles = await readDB('perfiles');
                
                const newLabId = `lab-${Date.now()}`;
                const newLab = {
                    id: newLabId,
                    nombre: data.nombre,
                    max_pcs: parseInt(data.max_pcs) || 3,
                    activo: true
                };
                
                const newProfile = {
                    id: `user-${Date.now()}`,
                    email: data.email,
                    password: data.password,
                    rol: 'user',
                    laboratorio_id: newLabId
                };

                laboratorios.push(newLab);
                perfiles.push(newProfile);

                await writeDB('laboratorios', laboratorios);
                await writeDB('perfiles', perfiles);
                
                labLimits.set(newLabId, newLab.max_pcs);
                socket.emit('admin_action_success', 'Laboratorio creado correctamente.');
                
                // Disparamos una actualización completa para que el admin vea las credenciales
                const updatedPerfiles = await readDB('perfiles');
                const stats = {
                    labs: laboratorios.map(l => {
                        const perfil = updatedPerfiles.find(p => p.laboratorio_id === l.id);
                        return {
                            ...l,
                            email: perfil ? perfil.email : '',
                            password: perfil ? perfil.password : '',
                            online: activeSessions.has(l.id) && activeSessions.get(l.id).size > 0,
                            active_pcs: activeSessions.has(l.id) ? activeSessions.get(l.id).size : 0
                        };
                    }),
                    total_active_pcs: Array.from(activeSessions.entries()).filter(([id]) => id !== 'super-admin').reduce((acc, [_, set]) => acc + set.size, 0)
                };
                socket.emit('admin_stats_update', stats);
            });

            socket.on('update_lab', async (data) => {
                const laboratorios = await readDB('laboratorios');
                const perfiles = await readDB('perfiles');
                
                const labIdx = laboratorios.findIndex(l => l.id === data.id);
                if (labIdx > -1) {
                    laboratorios[labIdx].nombre = data.nombre;
                    laboratorios[labIdx].max_pcs = parseInt(data.max_pcs);
                    await writeDB('laboratorios', laboratorios);
                    labLimits.set(data.id, laboratorios[labIdx].max_pcs);
                }

                const profileIdx = perfiles.findIndex(p => p.laboratorio_id === data.id);
                if (profileIdx > -1) {
                    perfiles[profileIdx].email = data.email;
                    perfiles[profileIdx].password = data.password;
                    await writeDB('perfiles', perfiles);
                }

                socket.emit('admin_action_success', 'Datos de laboratorio actualizados.');
            });

            socket.on('refresh_limits', async () => {
                const laboratorios = await readDB('laboratorios');
                laboratorios.forEach(l => labLimits.set(l.id, l.max_pcs));
                console.log('🔄 Límites actualizados en memoria.');
            });

            socket.on('update_lab_limit', async ({id, max}) => {
                const laboratorios = await readDB('laboratorios');
                const i = laboratorios.findIndex(l => l.id === id);
                if (i > -1) {
                    laboratorios[i].max_pcs = parseInt(max);
                    await writeDB('laboratorios', laboratorios);
                    labLimits.set(id, parseInt(max));
                    // Ya no emitimos un objeto parcial, ahora el cliente refresca solo
                }
            });

            socket.on('toggle_lab_status', async ({id, status}) => {
                const laboratorios = await readDB('laboratorios');
                const i = laboratorios.findIndex(l => l.id === id);
                if (i > -1) {
                    laboratorios[i].activo = status;
                    await writeDB('laboratorios', laboratorios);
                    socket.emit('admin_action_success', `Laboratorio ${status ? 'activado' : 'desactivado'}.`);
                }
            });

            socket.on('delete_lab', async (id) => {
                const laboratorios = await readDB('laboratorios');
                const perfiles = await readDB('perfiles');
                
                const labsFiltrados = laboratorios.filter(l => l.id !== id);
                const perfilesFiltrados = perfiles.filter(p => p.laboratorio_id !== id);
                
                await writeDB('laboratorios', labsFiltrados);
                await writeDB('perfiles', perfilesFiltrados);
                
                labLimits.delete(id);
                socket.emit('admin_action_success', 'Laboratorio eliminado correctamente.');
                // Refrescar
                socket.emit('admin_stats_update', { labs: labsFiltrados.map(l => ({...l, online: activeSessions.has(l.id), active_pcs: 0})) });
            });

            // ELIMINAMOS EL RETURN para que el admin pueda seguir a los listeners de timers si está en index.html
            // return; 
        }
    }

    // Chequear si lab está activo (Super Admin salta esta validación)
    const laboratorios = await readDB('laboratorios');
    const labInfo = laboratorios.find(l => l.id === labId);
    
    if (labId !== 'super-admin') {
        if (!labInfo || !labInfo.activo) {
            socket.emit('error_limit', `Este laboratorio está inactivo.`);
            socket.disconnect();
            return;
        }
    }

    // Limites
    if (!activeSessions.has(labId)) activeSessions.set(labId, new Set());
    
    // Si es super-admin, no aplicamos límites o ponemos uno infinito para evitar errores
    if (labId === 'super-admin') {
        if (!labLimits.has(labId)) labLimits.set(labId, 999);
    } else {
        if (!labLimits.has(labId)) labLimits.set(labId, labInfo.max_pcs || 3);
    }

    const labSessions = activeSessions.get(labId);
    const maxAllowed = labLimits.get(labId);

    if (labSessions.size >= maxAllowed && !labSessions.has(socket.id)) {
        socket.emit('error_limit', `Límite de ${maxAllowed} PCs excedido.`);
        socket.disconnect();
        return;
    }

    labSessions.add(socket.id);
    socketToLab.set(socket.id, labId);
    socket.join(labId);

    console.log(`🔌 Cliente conectado al lab ${labId} (Activos: ${labSessions.size})`);

    // Enviar timers de lab
    const labTimers = timers.filter(t => t.laboratorio_id === labId);
    socket.emit('timersList', labTimers);

    // Enviar historial del lab (opcional, últimos 50)
    const allHistory = await readDB('historial');
    const labHistory = allHistory.filter(h => h.laboratorio_id === labId).slice(-50).reverse();
    socket.emit('historyList', labHistory);

    // Timers
    socket.on('addTimer', async (data) => {
        const newTimer = {
            id: Date.now().toString(),
            laboratorio_id: labId,
            patientName: data.patientName,
            studyType: data.studyType,
            totalSeconds: data.totalSeconds,
            remainingSeconds: data.totalSeconds,
            targetTime: data.targetTime,
            isRunning: true,
            isPaused: false,
            isCompleted: false
        };
        timers.push(newTimer);
        await writeDB('timers', timers.map(t => ({...t, displayTime: undefined})));
        logHistory('CREADO', newTimer);
        
        const timerWithDisplay = { ...newTimer, displayTime: formatTime(newTimer.remainingSeconds) };
        io.to(labId).emit('timerAdded', timerWithDisplay);
        io.to(labId).emit('timerUpdate', timerWithDisplay);
    });

    socket.on('startTimer', async (id) => {
        const strId = String(id);
        const timer = timers.find(t => t.id === strId);
        if (timer && !timer.isRunning && !timer.isCompleted) {
            timer.isRunning = true;
            timer.isPaused = false;
            await writeDB('timers', timers);
            logHistory('INICIADO', timer);
            io.to(timer.laboratorio_id).emit('timerUpdate', { ...timer, displayTime: formatTime(timer.remainingSeconds) });
        }
    });

    socket.on('stopTimer', async (id) => {
        const strId = String(id);
        const timer = timers.find(t => t.id === strId);
        if (timer && timer.isRunning) {
            timer.isRunning = false;
            timer.isPaused = true;
            await writeDB('timers', timers);
            logHistory('PAUSADO', timer);
            io.to(timer.laboratorio_id).emit('timerUpdate', { ...timer, displayTime: formatTime(timer.remainingSeconds) });
        }
    });

    socket.on('resetTimer', async (id) => {
        const strId = String(id);
        const timer = timers.find(t => t.id === strId);
        if (timer) {
            timer.remainingSeconds = timer.totalSeconds;
            timer.isRunning = false;
            timer.isPaused = false;
            timer.isCompleted = false;
            await writeDB('timers', timers);
            logHistory('REINICIADO', timer);
            io.to(timer.laboratorio_id).emit('timerUpdate', { ...timer, displayTime: formatTime(timer.remainingSeconds) });
        }
    });

    socket.on('deleteTimer', async (id) => {
        const strId = String(id);
        const timer = timers.find(t => t.id === strId);
        if (timer) {
            logHistory('ELIMINADO', timer);
            timers = timers.filter(t => t.id !== strId);
            await writeDB('timers', timers);
            io.to(labId).emit('timerDeleted', strId);
        }
    });

    socket.on('change_own_password', async ({ oldPassword, newPassword }) => {
        const perfiles = await readDB('perfiles');
        const profileIdx = perfiles.findIndex(p => p.laboratorio_id === labId && p.rol === 'user');
        
        if (profileIdx > -1) {
            if (perfiles[profileIdx].password !== oldPassword) {
                socket.emit('password_change_error', 'La contraseña actual instalada es incorrecta.');
                return;
            }

            perfiles[profileIdx].password = newPassword;
            await writeDB('perfiles', perfiles);
            socket.emit('password_change_success', 'Tu cambio de contraseña ha sido exitoso.');

            // Notificar a los super admins que hay una actualización (refleja la contraseña en el panel central)
            const laboratorios = await readDB('laboratorios');
            const stats = {
                labs: laboratorios.map(l => {
                    const perfil = perfiles.find(p => p.laboratorio_id === l.id);
                    return {
                        ...l,
                        email: perfil ? perfil.email : '',
                        password: perfil ? perfil.password : '',
                        online: activeSessions.has(l.id) && activeSessions.get(l.id).size > 0,
                        active_pcs: activeSessions.has(l.id) ? activeSessions.get(l.id).size : 0
                    };
                }),
                total_active_pcs: Array.from(activeSessions.entries()).filter(([id]) => id !== 'super-admin').reduce((acc, [_, set]) => acc + set.size, 0)
            };
            io.to('super-admins').emit('admin_stats_update', stats);

        } else {
            socket.emit('password_change_error', 'No se encontró tu perfil en la base de datos.');
        }
    });

    socket.on('disconnect', () => {
        const myLab = socketToLab.get(socket.id);
        if (myLab && activeSessions.has(myLab)) {
            activeSessions.get(myLab).delete(socket.id);
            console.log(`🔌 Cliente desconectado del lab ${myLab}`);
        }
        socketToLab.delete(socket.id);
    });
});

async function boot() {
    timers = await readDB('timers');
    console.log(`✅ ${timers.length} timers cargados en memoria.`);
    
    server.listen(PORT, '0.0.0.0', () => {
        console.log(`🚀 NodeJS Servidor Local OK`);
        console.log(`🌐 http://${getLocalIP()}:${PORT}`);
    });
}
boot();
