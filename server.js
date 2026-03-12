const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Configuración Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const PORT = process.env.PORT || 3001;
// Eliminamos JSON_FILE y BACKUP_FILE para usar Supabase
let activeSessions = new Map(); // laboratorio_id -> Set(socket.id)
let socketToLab = new Map(); // socket.id -> laboratorio_id
let labLimits = new Map(); // laboratorio_id -> max_pcs (Cache en memoria para rapidez)

// === GESTIÓN DE SUPABASE ===

async function getTimersForLab(laboratorioId) {
    const { data, error } = await supabase
        .from('temporizadores')
        .select('*')
        .eq('laboratorio_id', laboratorioId);
    
    if (error) {
        console.error('Error cargando timers de Supabase:', error);
        return [];
    }
    return data;
}

async function saveTimerToSupabase(timer) {
    const { error } = await supabase
        .from('temporizadores')
        .upsert({
            ...timer,
            updated_at: new Date().toISOString()
        });
    if (error) console.error('Error guardando timer en Supabase:', error);
}

async function logHistoryToSupabase(action, timer, extraInfo = '') {
    // Implementar si se desea persistir el historial en Supabase
    console.log(`[HISTORIAL] ${action} - ${timer.patientName} (${timer.laboratorio_id})`);
}

// === LÓGICA DEL TEMPORIZADOR ===

// El bucle principal que corre cada segundo
setInterval(() => {
    let hasChanges = false;

    timers.forEach(t => {
        if (t.isRunning && !t.isCompleted) {
            t.remainingSeconds--;
            hasChanges = true;

            if (t.remainingSeconds <= 0) {
                t.remainingSeconds = 0;
                t.isRunning = false;
                t.isCompleted = true;
                logHistory('COMPLETADO', t); // Log al completar
                console.log(`⏰ ALARMA: ${t.patientName} - ${t.studyType}`);
            }

            // Notificar a todos los clientes
            io.emit('timerUpdate', {
                ...t,
                displayTime: formatTime(t.remainingSeconds)
            });
        }
    });

    if (hasChanges) {
        saveTimers();
    }
}, 1000);

// === SOCKET.IO EVENTOS ===

io.on('connection', async (socket) => {
    const { labId, token } = socket.handshake.auth;

    // Verificar token con Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
        console.log(`❌ Conexión rechazada: Token inválido`);
        socket.disconnect();
        return;
    }

    // Caso particular: Super Admin
    if (labId === 'super-admin') {
        const { data: perfil } = await supabase.from('perfiles').select('rol').eq('id', user.id).single();
        if (perfil?.rol === 'super_admin') {
            socket.join('super-admins');
            console.log(`👑 Super Admin conectado: ${socket.id}`);
            
            socket.on('get_admin_stats', async () => {
                const { data: labs } = await supabase.from('laboratorios').select('*');
                const stats = {
                    labs: labs.map(l => ({
                        ...l,
                        online: activeSessions.has(l.id) && activeSessions.get(l.id).size > 0,
                        active_pcs: activeSessions.has(l.id) ? activeSessions.get(l.id).size : 0
                    })),
                    total_active_pcs: Array.from(activeSessions.values()).reduce((acc, set) => acc + set.size, 0)
                };
                socket.emit('admin_stats_update', stats);
            });

            socket.on('refresh_limits', async () => {
                const { data } = await supabase.from('laboratorios').select('id, max_pcs');
                data.forEach(l => labLimits.set(l.id, l.max_pcs));
                console.log('🔄 Límites de laboratorios actualizados en memoria.');
            });

            return;
        }
    }

    // Control de límite de 3 PCs (o el límite personalizado)
    if (!activeSessions.has(labId)) {
        activeSessions.set(labId, new Set());
    }

    // Cargar límite de laboratorio si no está en cache
    if (!labLimits.has(labId)) {
        const { data } = await supabase.from('laboratorios').select('max_pcs').eq('id', labId).single();
        labLimits.set(labId, data?.max_pcs || 3);
    }

    const labSessions = activeSessions.get(labId);
    const maxAllowed = labLimits.get(labId);

    if (labSessions.size >= maxAllowed && !labSessions.has(socket.id)) {
        console.log(`🚫 Límite de ${maxAllowed} PCs excedido para el laboratorio ${labId}`);
        socket.emit('error_limit', `Lo sentimos, has superado el límite de ${maxAllowed} dispositivos activos. Contacta a soporte para expandir tu plan.`);
        socket.disconnect();
        return;
    }

    labSessions.add(socket.id);
    socketToLab.set(socket.id, labId);
    socket.join(labId); // Unirse al canal exclusivo del laboratorio

    console.log(`🔌 Cliente conectado al laboratorio ${labId}: ${socket.id} (Activos: ${labSessions.size})`);

    // Enviar timers específicos del laboratorio
    const labTimers = await getTimersForLab(labId);
    socket.emit('timersList', labTimers);

    // Eventos del temporizador (ahora con labId)
    socket.on('addTimer', async (data) => {
        const newTimer = {
            laboratorio_id: labId,
            patientName: data.patientName,
            studyType: data.studyType,
            totalSeconds: data.totalSeconds,
            remainingSeconds: data.totalSeconds,
            estado: 'corriendo',
            targetTime: data.targetTime
        };

        const { data: saved, error } = await supabase.from('temporizadores').insert(newTimer).select().single();
        if (!error) {
            io.to(labId).emit('timerAdded', saved);
        }
    });

    socket.on('disconnect', () => {
        const myLab = socketToLab.get(socket.id);
        if (myLab && activeSessions.has(myLab)) {
            activeSessions.get(myLab).delete(socket.id);
            console.log(`🔌 Cliente desconectado del lab ${myLab}. Restantes: ${activeSessions.get(myLab).size}`);
        }
        socketToLab.delete(socket.id);
    });

    // Iniciar/Reanudar temporizador
    socket.on('startTimer', (id) => {
        const timer = timers.find(t => t.id === id);
        if (timer && !timer.isRunning && !timer.isCompleted) {
            timer.isRunning = true;
            timer.isPaused = false;
            logHistory('INICIADO', timer); // Log inicio/reanudación
            saveTimers();
            io.emit('timerUpdate', { ...timer, displayTime: formatTime(timer.remainingSeconds) });
            console.log(`▶️ Iniciado: ${timer.patientName}`);
        }
    });

    // Pausar temporizador
    socket.on('stopTimer', (id) => {
        const timer = timers.find(t => t.id === id);
        if (timer && timer.isRunning) {
            timer.isRunning = false;
            timer.isPaused = true;
            logHistory('PAUSADO', timer); // Log pausa
            saveTimers();
            io.emit('timerUpdate', { ...timer, displayTime: formatTime(timer.remainingSeconds) });
            console.log(`⏸️ Pausado: ${timer.patientName}`);
        }
    });

    // Reiniciar temporizador
    socket.on('resetTimer', (id) => {
        const timer = timers.find(t => t.id === id);
        if (timer) {
            timer.remainingSeconds = timer.totalSeconds;
            timer.isRunning = false;
            timer.isPaused = false;
            timer.isCompleted = false;
            logHistory('REINICIADO', timer); // Log reinicio
            saveTimers();
            io.emit('timerUpdate', { ...timer, displayTime: formatTime(timer.remainingSeconds) });
            console.log(`🔄 Reiniciado: ${timer.patientName}`);
        }
    });

    // Eliminar temporizador
    socket.on('deleteTimer', (id) => {
        const timer = timers.find(t => t.id === id);
        if (timer) {
            logHistory('ELIMINADO', timer); // Log eliminación antes de borrar
            console.log(`🗑️ Eliminado: ${timer.patientName}`);
        }

        timers = timers.filter(t => t.id !== id);
        saveTimers();
        io.emit('timerDeleted', id);
    });

    socket.on('disconnect', () => {
        console.log(`🔌 Cliente desconectado: ${socket.id}`);
    });
});

// === SERVIDOR EXPRESS ===

// Servir archivos estáticos (HTML, CSS, JS, imágenes)
app.use(express.static(__dirname));

// Cargar temporizadores al iniciar
loadTimers();

// Iniciar servidor
server.listen(PORT, '0.0.0.0', () => {
    const localIP = getLocalIP();
    console.log(`🚀 Servidor de Temporizadores Sincronizados`);
    console.log(`📍 Local: http://localhost:${PORT}`);
    console.log(`🌐 Red: http://${localIP}:${PORT} (o tu IP local)`);
    console.log(`\n✅ Listo para aceptar conexiones\n`);
});
