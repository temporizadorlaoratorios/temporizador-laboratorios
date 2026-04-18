// ==================== EXCLUSIVIDAD PWA vs NAVEGADOR ====================
const IS_PWA = window.matchMedia('(display-mode: standalone)').matches 
            || window.navigator.standalone === true
            || new URLSearchParams(window.location.search).get('mode') === 'pwa';

function showPwaBlockOverlay() {
    // Si ya existe el overlay, no crear otro
    if (document.getElementById('pwa-block-overlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'pwa-block-overlay';
    overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(10,10,30,0.97);z-index:99999;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;padding:20px;box-sizing:border-box;backdrop-filter:blur(10px);';
    overlay.innerHTML = `
        <div style="font-size:4rem;margin-bottom:20px;">📱</div>
        <h2 style="color:#ffb347;font-family:Inter,sans-serif;font-size:1.5rem;margin-bottom:15px;">La aplicación PWA está abierta</h2>
        <p style="color:#ccc;font-family:Inter,sans-serif;font-size:1rem;max-width:400px;line-height:1.6;">
            Para evitar conflictos de sonido y que Chrome duerma esta pestaña, 
            usá la <strong style="color:#ffb347;">app instalada</strong> (PWA).
        </p>
        <p style="color:#888;font-family:Inter,sans-serif;font-size:0.85rem;margin-top:20px;">
            Esta pestaña se desbloqueará automáticamente si cerrás la PWA.
        </p>
    `;
    document.body.appendChild(overlay);
    // Silenciar todas las alarmas activas en esta pestaña
    Object.keys(AppState?.activeAlarms || {}).forEach(id => stopAlarm?.(id));
}

function removePwaBlockOverlay() {
    const overlay = document.getElementById('pwa-block-overlay');
    if (overlay) overlay.remove();
}

function isPwaAlive() {
    if (IS_PWA) return false; // La PWA no se bloquea a sí misma
    const lastHeartbeat = parseInt(localStorage.getItem('pwa-active') || '0');
    return (Date.now() - lastHeartbeat) < 8000; // 8s de margen (heartbeat cada 3s)
}

// Agregamos un log visual para debugging (dura 4 segundos)
const debugDiv = document.createElement('div');
debugDiv.style.cssText = 'position:fixed;bottom:10px;left:10px;background:rgba(0,0,0,0.85);color:#ffb347;padding:8px 15px;border-radius:8px;font-size:13px;z-index:99999;pointer-events:none;font-family:Inter,sans-serif;box-shadow:0 5px 15px rgba(0,0,0,0.5);border:1px solid rgba(255,255,255,0.1);';
debugDiv.textContent = IS_PWA ? '✅ IDENTIFICADO COMO PWA' : '🌐 IDENTIFICADO COMO NAVEGADOR';
document.body.appendChild(debugDiv);
setTimeout(() => debugDiv.remove(), 4000);

if (IS_PWA) {
    // ===== SOY LA PWA =====
    // Marco heartbeat inmediato para que Chrome lo detecte
    localStorage.setItem('pwa-active', Date.now().toString());
    
    // Heartbeat cada 3 segundos
    setInterval(() => {
        localStorage.setItem('pwa-active', Date.now().toString());
    }, 3000);

    // Cuando la PWA se cierra, limpiar heartbeat
    window.addEventListener('beforeunload', () => {
        localStorage.removeItem('pwa-active');
    });
    
    // También limpiar con visibilitychange (por si beforeunload no se dispara en PWA)
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            // Volvió al foco: refrescar heartbeat
            localStorage.setItem('pwa-active', Date.now().toString());
        }
    });

} else {
    // ===== SOY NAVEGADOR (Chrome pestaña) =====
    
    // Check inicial: ¿la PWA ya está corriendo?
    if (isPwaAlive()) {
        // Esperar a que el DOM cargue para mostrar overlay
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', showPwaBlockOverlay);
        } else {
            showPwaBlockOverlay();
        }
    }

    // Escuchar cambios en localStorage (se dispara cuando OTRA ventana/PWA escribe)
    window.addEventListener('storage', (e) => {
        if (e.key === 'pwa-active') {
            if (e.newValue) {
                // La PWA acaba de escribir heartbeat → bloquear esta pestaña
                showPwaBlockOverlay();
            } else {
                // La PWA limpió el heartbeat (se cerró) → desbloquear
                removePwaBlockOverlay();
            }
        }
    });

    // Verificación periódica por si el storage event no se dispara (fallback)
    setInterval(() => {
        if (isPwaAlive()) {
            showPwaBlockOverlay();
        } else {
            removePwaBlockOverlay();
        }
    }, 5000);
}

// ==================== CONEXIÓN SUPABASE ====================
// Protección de ruta
const token = localStorage.getItem('sb-token');
const labId = localStorage.getItem('lab-id');

if (!token || !labId) {
    const pwaParam = IS_PWA ? '?mode=pwa' : '';
    window.location.href = 'login.html' + pwaParam;
}

const supabaseUrl = 'https://qhjrqfrsphctbdjubxpv.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoanJxZnJzcGhjdGJkanVieHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg5NzAsImV4cCI6MjA5MDgwNDk3MH0.fLF8SGXXE7BdbdzUHo7GiBM58BbZkUN89N8Cl1KnEHk';
const sb = window.supabase.createClient(supabaseUrl, supabaseKey);

// ==================== INICIALIZACIÓN LOGO ====================
function initLabBranding() {
    const labLogo = localStorage.getItem('lab-logo');
    const labNombre = localStorage.getItem('lab-nombre');
    const logoImg = document.getElementById('app-logo');
    const logoPlaceholder = document.getElementById('logo-placeholder');
    const appTitle = document.getElementById('app-title-display');

    if (labNombre && appTitle) {
        appTitle.textContent = labNombre.toUpperCase();
    }

    if (labLogo) {
        if (logoImg) {
            logoImg.src = labLogo;
            logoImg.style.display = 'block';
        }
        if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    } else if (labId === 'super-admin') {
        // Fallback para super-admin si no hay logo personalizado aún
        if (logoImg) {
            logoImg.src = 'logo.png';
            logoImg.style.display = 'block';
        }
        if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    } else {
        if (logoImg) logoImg.style.display = 'none';
        if (logoPlaceholder) logoPlaceholder.style.display = 'block';
    }
}

// Menú Logo
function handleLogoClick(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }

    const logoImg = document.getElementById('app-logo');
    const logoMenu = document.getElementById('logo-options-menu');
    
    if (logoImg.style.display === 'none') {
        document.getElementById('logo-upload').click();
    } else {
        if (logoMenu.style.display === 'flex') {
            closeLogoMenu();
        } else {
            logoMenu.style.display = 'flex';
        }
    }
}

function closeLogoMenu() {
    const logoMenu = document.getElementById('logo-options-menu');
    if (logoMenu) logoMenu.style.display = 'none';
}

document.addEventListener('click', (e) => {
    const logoContainer = document.getElementById('logo-container');
    const logoMenu = document.getElementById('logo-options-menu');
    
    if (logoMenu && logoMenu.style.display === 'flex') {
        if (logoContainer && !logoContainer.contains(e.target)) {
            closeLogoMenu();
        }
    }
});

async function deleteLogo() {
    if (!confirm('¿Seguro que deseas eliminar el logo de tu laboratorio?')) return;
    try {
        const { error } = await sb.from('laboratorios').update({ logo: null }).eq('id', labId);
        if (!error) {
            localStorage.removeItem('lab-logo');
            initLabBranding(); 
            alert('Logo eliminado correctamente');
        } else {
            alert('Error al eliminar logo');
        }
    } catch (err) {
        alert('Error de conexión');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initLabBranding();
    
    const logoContainer = document.getElementById('logo-container');
    
    const logoUpload = document.getElementById('logo-upload');
    if (logoUpload) {
        logoUpload.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Validar tamaño (opcional, p.ej. 1MB)
            if (file.size > 1024 * 1024) {
                alert("El archivo es demasiado grande. Por favor, selecciona una imagen de menos de 1MB.");
                return;
            }

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64Data = event.target.result;
                try {
                    const { error } = await sb.from('laboratorios').update({ logo: base64Data }).eq('id', labId);
                    if (!error) {
                        localStorage.setItem('lab-logo', base64Data);
                        initLabBranding();
                        alert('Logo actualizado correctamente');
                    } else {
                        throw error;
                    }
                } catch (err) {
                    console.error('Error al subir logo:', err);
                    alert('Error al guardar el logo en la base de datos.');
                }
            };
            reader.readAsDataURL(file);
        });
    }

    loadInitialData();
    
    // Cargar último operador usado
    const lastOp = localStorage.getItem('last-operator');
    if (lastOp && elements.operatorInput) {
        elements.operatorInput.value = lastOp;
    }
    
    // Sincronización de Reloj Inicial y Periódica (Cada 10 segundos)
    createDebugOverlay();
    syncTimeWithServer().then(() => {
        setInterval(syncTimeWithServer, 10000); 
    });
});

// ==================== ESTADO GLOBAL LOCAL ====================
const AppState = {
    timers: [],
    presets: [],
    activeAlarms: {},
    serverTimeOffset: 0 // Diferencia entre servidor y PC local (ms)
};

let realtimeChannel = null;


// --- HACK ANTI-THROTTLING PARA SEGUNDO PLANO ---
const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
silentAudio.loop = true;
silentAudio.volume = 0.01;
let backgroundModeEnabled = false;

function enableBackgroundMode() {
    if (!backgroundModeEnabled) {
        silentAudio.play().then(() => {
            backgroundModeEnabled = true;
            console.log('🛡️ Protección anti-suspensión activada.');
        }).catch(e => console.warn('No se pudo activar protección (requiere clic previo)', e));
    }
}

// Activar al primer clic o tap en cualquier parte de la pantalla
document.addEventListener('click', enableBackgroundMode, { once: true });
document.addEventListener('touchstart', enableBackgroundMode, { once: true });

// --- RECARGA AUTOMÁTICA AL MAXIMIZAR ---
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        console.log('🔄 Ventana maximizada: Forzando recarga de datos para evitar desincronización...');
        loadInitialData(); 
    }
});
// -----------------------------------------------

// MOTOR DE BACKGROUND CON WEB WORKER (Anti-Throttling)
const workerCode = `
    let interval;
    let alarms = {}; // Almacena los contadores para cada alarma activa
    self.onmessage = function(e) {
        if (e.data.type === 'start_engine') {
            interval = setInterval(() => { 
                self.postMessage({ type: 'tick' }); 
                // Alertas de sonido (cada 1.5s = 15 ticks)
                Object.keys(alarms).forEach(id => {
                    alarms[id]++;
                    if (alarms[id] >= 15) {
                        alarms[id] = 0;
                        self.postMessage({ type: 'beep', id: id });
                    }
                });
            }, 100);
        } else if (e.data.type === 'start_alarm') {
            alarms[e.data.id] = 15; // Iniciar disparo en el siguiente tick
        } else if (e.data.type === 'stop_alarm') {
            delete alarms[e.data.id];
        } else if (e.data.type === 'stop_engine') {
            clearInterval(interval);
        }
    };
`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const backgroundWorker = new Worker(URL.createObjectURL(workerBlob));
backgroundWorker.postMessage({ type: 'start_engine' });

async function syncTimeWithServer() {
    try {
        const start = Date.now();
        // RPC get_server_time devuelve milisegundos desde el epoch (UTC)
        const { data: serverMs, error } = await sb.rpc('get_server_time');
        const end = Date.now();
        
        if (error) throw error;

        const latency = (end - start) / 2;
        const syncedServerTime = serverMs + latency;
        AppState.serverTimeOffset = syncedServerTime - end;
        
        console.log(`🕒 Sincronización OK. Offset: ${AppState.serverTimeOffset}ms (Latencia: ${latency}ms)`);
        
        // Si el offset es demasiado grande (ej: > 1 hora), podría haber un problema de zona horaria en la PC
        if (Math.abs(AppState.serverTimeOffset) > 1800000) {
            console.warn('⚠️ Se detectó un desfase mayor a 30 mins. Verifica la zona horaria de la PC.');
        }
    } catch (e) {
        console.warn('⚠️ Falló sincronización precisa. Usando fallback de cabeceras...', e);
        try {
            const start = Date.now();
            const response = await fetch(supabaseUrl + '/rest/v1/?select=id', {
                headers: { 'apikey': supabaseKey }
            });
            const end = Date.now();
            const serverDateStr = response.headers.get('date');
            if (serverDateStr) {
                const latency = (end - start) / 2;
                const serverTime = new Date(serverDateStr).getTime() + latency;
                AppState.serverTimeOffset = serverTime - end;
            }
        } catch (err2) {
            console.error('❌ Error total en sincronización:', err2);
        }
    }
}

const elements = {
    form: document.getElementById('timer-form'),
    patientNameInput: document.getElementById('patient-name'),
    operatorInput: document.getElementById('operator-name'), // Nuevo campo
    studyTypeInput: document.getElementById('study-type'),
    hoursInput: document.getElementById('timer-hours'),
    minutesInput: document.getElementById('timer-minutes'),
    secondsInput: document.getElementById('timer-seconds'),
    timersGrid: document.getElementById('timers-grid'),
    emptyState: document.getElementById('empty-state')
};

// ==================== UTILIDADES ====================
function formatTime(totalSeconds) {
    const hours = Math.floor(Math.max(0, totalSeconds) / 3600);
    const minutes = Math.floor((Math.max(0, totalSeconds) % 3600) / 60);
    const seconds = Math.floor((Math.max(0, totalSeconds) % 60));

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function adjustTime(type, delta) {
    if (type === 'hours') {
        let current = parseInt(elements.hoursInput.value) || 0;
        current = Math.max(0, Math.min(24, current + delta));
        elements.hoursInput.value = current;
        formatInputValue(elements.hoursInput);
    } else if (type === 'minutes') {
        let current = parseInt(elements.minutesInput.value) || 0;
        current = Math.max(0, Math.min(59, current + delta));
        elements.minutesInput.value = current;
        formatInputValue(elements.minutesInput);
    } else if (type === 'seconds') {
        let current = parseInt(elements.secondsInput.value) || 0;
        current = Math.max(0, Math.min(59, current + delta));
        elements.secondsInput.value = current;
        formatInputValue(elements.secondsInput);
    }
}

// AudioContext global reutilizable (evita crear uno nuevo cada beep)
let globalAudioContext = null;
function getAudioContext() {
    if (!globalAudioContext || globalAudioContext.state === 'closed') {
        globalAudioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (globalAudioContext.state === 'suspended') {
        globalAudioContext.resume();
    }
    return globalAudioContext;
}

// Desbloquear AudioContext con la primera interacción del usuario y solicitar permisos
document.addEventListener('click', () => {
    getAudioContext();
    if ('Notification' in window && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
    }
}, { once: true });

// Alarma
function startContinuousAlarm(timerId) {
    if (AppState.activeAlarms[timerId]) return;
    
    // UI Actualización
    const card = document.getElementById(`timer-${timerId}`);
    if (card) card.classList.add('alarm-active');

    // Registrar alarma en Web Worker para evitar el throttling del navegador en background
    backgroundWorker.postMessage({ type: 'start_alarm', id: timerId });
    AppState.activeAlarms[timerId] = true;
}

function playBeepTone() {
    try {
        const audioContext = getAudioContext();
        audioContext.resume(); // Forzar despertar en background si es posible
        const frequencies = [900, 1100, 900, 1100];
        let currentTime = audioContext.currentTime;

        frequencies.forEach((freq, index) => {
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            oscillator.frequency.value = freq;
            oscillator.type = 'square';
            const startTime = currentTime + (index * 0.2);
            gainNode.gain.setValueAtTime(0.5, startTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + 0.18);
            oscillator.start(startTime);
            oscillator.stop(startTime + 0.18);
        });
    } catch (e) {
        console.warn('Error reproduciendo audio en background:', e);
    }
}

function stopAlarm(timerId) {
    if (AppState.activeAlarms[timerId]) {
        backgroundWorker.postMessage({ type: 'stop_alarm', id: timerId });
        delete AppState.activeAlarms[timerId];
    }

    // Limpieza de UI incondicional (siempre que exista la tarjeta)
    const card = document.getElementById(`timer-${timerId}`);
    if (card) {
        card.classList.remove('alarm-active');
        const stopBtn = card.querySelector('.control-btn-stop-compact');
        if (stopBtn) stopBtn.remove();
    }
}

function showNotification(timer) {
    if ('Notification' in window && Notification.permission === 'granted') {
        const options = {
            body: `${timer.patientName} - ${timer.studyType} completado.`,
            icon: 'logo.png',
            requireInteraction: true,
            silent: false, // Forzar que no sea silenciosa (ayuda en background)
            vibrate: [300, 100, 300, 100, 300]
        };
        
        if (navigator.serviceWorker && navigator.serviceWorker.ready) {
            navigator.serviceWorker.ready.then(registration => {
                registration.showNotification('⏱️ Temporizador Completado', options);
            }).catch(() => {
                new Notification('⏱️ Temporizador Completado', options);
            });
        } else {
            new Notification('⏱️ Temporizador Completado', options);
        }
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// ==================== SUPABASE DB & EVENTOS ====================
async function loadInitialData() {
    // Cargar Timers - Todos filtran por su propio labId (incluido super-admin para aislamiento)
    const { data: timersData, error } = await sb
        .from('timers')
        .select('*')
        .eq('laboratorio_id', labId);
    
    if (error) {
        console.error('Error cargando timers:', error);
    }

    const now = Date.now() + AppState.serverTimeOffset;
    AppState.timers = (timersData || []).map(t => {
        // Validación matemática pre-renderizado: Si el tiempo real ya pasó, forzamos completion
        // Evita el bug donde cargar datos viejos desde Supabase hace "rearrancar" la alarma.
        if (t.isRunning && !t.isPaused && t.targetTime) {
            const target = new Date(t.targetTime).getTime();
            if (target <= now) {
                t.isCompleted = true;
                t.isRunning = false;
                t.remainingSeconds = 0;
            }
        }
        
        // Conservar el bloqueo de silencio local si la BD está atrasada en registrar el clic
        const localTimer = AppState.timers.find(local => local.id === t.id);
        if (localTimer && localTimer.isAcknowledged && !t.isRunning && t.isCompleted) {
            t.isAcknowledged = true;
        }

        return {
            ...t,
            visualRemaining: t.remainingSeconds
        };
    });
    
    // Detener cualquier sonido fantasma que ya haya sido apagado o eliminado en la base de datos
    Object.keys(AppState.activeAlarms).forEach(id => {
        const timer = AppState.timers.find(t => t.id === id);
        // Si no existe, no está completo, o ya fue reconocido -> pararlo
        if (!timer || !timer.isCompleted || timer.isAcknowledged) {
            stopAlarm(id);
        }
    });

    // Iniciar alarmas para cualquier temporizador recién completado (o que despertó ya completado)
    AppState.timers.forEach(t => {
        if (t.isCompleted && !t.isAcknowledged && !AppState.activeAlarms[t.id]) {
            startContinuousAlarm(t.id);
            // No floodeamos con showNotification aquí por si son varios de golpe al abrir, o lo hacemos discreto
        }
    });

    renderTimers();

    // Cargar Historial
    const { data: historyData } = await sb
        .from('historial')
        .select('*')
        .eq('laboratorio_id', labId)
        .order('timestamp', { ascending: false })
        .limit(50);
    if (historyData) HistoryManager.loadList(historyData);

    // Cargar Presets (Ajustes de Tiempo)
    await loadPresets();

    // Suscribirse a cambios en DB REALTIME (Reemplazo Socket.io)
    if (realtimeChannel) {
        sb.removeChannel(realtimeChannel);
    }
    realtimeChannel = sb.channel('db_changes');
    
    realtimeChannel
    .on('broadcast', { event: 'stop_alarm' }, payload => {
        if (payload.payload && payload.payload.id) {
            const id = payload.payload.id;
            stopAlarm(id);
            const timer = AppState.timers.find(t => t.id === id);
            if (timer) {
                timer.isAcknowledged = true;
                updateTimerDisplay(id);
            }
        }
    })
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'timers', 
        filter: `laboratorio_id=eq.${labId}` 
    }, payload => {
        console.log('Cambio en Timer detectado:', payload);
        if (payload.eventType === 'INSERT') {
            // Solo agregar si no existe ya localmente
            if (!AppState.timers.find(t => t.id === payload.new.id)) {
                const timer = payload.new;
                AppState.timers.push(timer);
                renderTimers();
            }
        } else if (payload.eventType === 'UPDATE') {
            const idx = AppState.timers.findIndex(t => t.id == payload.new.id);
            if (idx !== -1) {
                const localTimer = AppState.timers[idx];
                const wasCompleted = localTimer.isCompleted;
                const wasAcknowledged = localTimer.isAcknowledged;

                // Mezcla segura: Preservar propiedades locales si payload viene incompleto
                let updated = { ...localTimer, ...payload.new };

                // PROTECCIÓN ESTRICTA CONTRA REVERSIONES (Time Travel Prevention)
                // Si ya estaba completado localmente, no permitir que un evento rezagado lo des-complete
                // (a menos que sea un reinicio explícito donde targetTime === null)
                if (wasCompleted && !updated.isCompleted && updated.targetTime !== null) {
                    updated.isCompleted = true;
                    updated.isRunning = false;
                    updated.remainingSeconds = 0;
                }
                
                // Si ya estaba silenciado localmente, no permitir que un evento viejo lo des-silencie
                if (wasAcknowledged && updated.isCompleted) {
                    updated.isAcknowledged = true;
                }

                AppState.timers[idx] = updated;
                
                if (updated.isCompleted && !updated.isAcknowledged) {
                    // Si el motor local no interceptó el disparo a cuenta 0 (ej. porque la PWA estaba minimizada y Chromium suspendió JS), lo arrancamos aquí.
                    if (!AppState.activeAlarms[updated.id]) {
                        updateTimerDisplay(updated.id);
                        startContinuousAlarm(updated.id);
                        showNotification(updated);
                        
                        // Hacer un intento de despertar audio API (aunque en background puro puede fallar si no hay interacciones previas que lo mantengan vivo, pero con la tab focusada lo aseguramos y la Notification de arriba es nuestro backup ruidoso y fuerte)
                        // si el timer no tiene stopAlarm, lo creamos forzadamente en la UI
                    }
                } else {
                    // RED DE SEGURIDAD ABSOLUTA:
                    // Si ya NO está completado o ya fue silenciado (isAcknowledged: true)
                    stopAlarm(updated.id);
                }
                
                updateTimerDisplay(updated.id);
            }
        } else if (payload.eventType === 'DELETE') {
            stopAlarm(payload.old.id);
            AppState.timers = AppState.timers.filter(t => t.id !== payload.old.id);
            renderTimers();
        }
    })
    .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'historial', 
        filter: `laboratorio_id=eq.${labId}` 
    }, payload => {
        console.log('Nuevo historial detectado:', payload);
        HistoryManager.addEvent(payload.new);
    })
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'ajustes_tiempo', 
        filter: `laboratorio_id=eq.${labId}` 
    }, payload => {
        console.log('Cambio en Ajuste detectado:', payload);
        loadPresets(); // Recargar presets cuando cambien
    })
    .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'laboratorios', 
        filter: `id=eq.${labId}` 
    }, payload => {
        console.log('Cambio en Branding detectado:', payload);
        if (payload.new.logo) {
            localStorage.setItem('lab-logo', payload.new.logo);
            initLabBranding();
        }
    })
    .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime conectado con éxito al lab:', labId);
        } else {
            console.error('⚠️ Realtime con problemas de conexión:', status);
        }
    });
}

async function loadPresets() {
    const { data: presetsData, error } = await sb
        .from('ajustes_tiempo')
        .select('*')
        .eq('laboratorio_id', labId)
        .order('sigla', { ascending: true });
    
    if (!error) {
        AppState.presets = presetsData || [];
        updatePresetsDatalist();
        if (document.getElementById('modal-presets').style.display === 'flex') {
            renderPresetsList();
        }
    }
}

function updatePresetsDatalist() {
    const datalist = document.getElementById('study-suggestions');
    if (!datalist) return;
    datalist.innerHTML = '';
    AppState.presets.forEach(p => {
        const opt = document.createElement('option');
        opt.value = p.sigla;
        opt.textContent = p.descripcion || '';
        datalist.appendChild(opt);
    });
}

async function logHistoryLocally(action, timer, forcedOperator = null) {
    const operator = forcedOperator || document.getElementById('operator-name')?.value.trim() || 'SISTEMA';
    const historyEvent = {
        id: Date.now().toString(),
        laboratorio_id: timer.laboratorio_id || labId,
        action: action,
        patientName: timer.patientName || 'N/A',
        studyType: timer.studyType || 'N/A',
        operador: operator,
        timestamp: new Date().toISOString()
    };
    
    // Intentar insertar con el campo operador
    const { error } = await sb.from('historial').insert(historyEvent);
    
    // Si falla porque la columna no existe (Error 42703 en Postgres/Supabase)
    if (error && (error.code === '42703' || error.message?.includes('column "operador"'))) {
        console.warn('⚠️ La columna "operador" no existe en la tabla historial. Reintentando sin ella...');
        delete historyEvent.operador;
        await sb.from('historial').insert(historyEvent);
    } else if (error) {
        console.error('❌ Error al guardar en historial:', error);
    }
}

// Nueva función de validación interactiva
function validateOperator(isModification = false) {
    let op = document.getElementById('operator-name');
    let operatorName = op ? op.value.trim() : "";

    // REGLA: Si es modificación, SIEMPRE pedir prompt ignorando el panel central.
    // Si es creación, solo pedir prompt si el panel central está vacío.
    if (isModification || !operatorName) {
        const msg = isModification 
            ? "⚠️ MODIFICACIÓN: Ingrese su nombre o iniciales de operador:" 
            : "⚠️ ACCIÓN REQUERIDA: Ingrese su nombre o iniciales de operador para continuar:";
            
        const response = prompt(msg);
        
        if (response && response.trim()) {
            const finalName = response.trim();
            // Solo actualizamos el panel central si NO es una modificación (o si estaba vacío)
            if (!isModification && op) {
                op.value = finalName;
                localStorage.setItem('last-operator', finalName);
            }
            return finalName; // Retornamos el nombre para usarlo en la acción
        } else {
            // Si cancela o deja vacío
            if (!isModification && op && !operatorName) {
                op.classList.add('input-error');
                op.focus();
                setTimeout(() => op.classList.remove('input-error'), 1000);
            }
            return false;
        }
    }
    
    return operatorName; // Retornamos el nombre del panel central (para creación)
}

// ==================== PANEL DE DIAGNÓSTICO ====================
function createDebugOverlay() {
    if (document.getElementById('debug-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'debug-overlay';
    overlay.className = 'debug-overlay';
    overlay.innerHTML = `
        <div class="debug-line">
            <span class="debug-label"><span class="debug-status-dot"></span>Local:</span>
            <span class="debug-value" id="debug-local-time">--:--:--</span>
        </div>
        <div class="debug-line">
            <span class="debug-label">Master:</span>
            <span class="debug-value master" id="debug-master-time">--:--:--</span>
        </div>
        <div class="debug-line">
            <span class="debug-label">Offset:</span>
            <span class="debug-value offset" id="debug-offset">0ms</span>
        </div>
    `;
    document.body.appendChild(overlay);
    
    // Actualización rápida (cada 1s)
    setInterval(updateDebugOverlay, 1000);
}

function updateDebugOverlay() {
    const local = document.getElementById('debug-local-time');
    const master = document.getElementById('debug-master-time');
    const offset = document.getElementById('debug-offset');
    
    if (!local || !master || !offset) return;
    
    const now = new Date();
    const masterNow = new Date(Date.now() + AppState.serverTimeOffset);
    
    local.textContent = now.toLocaleTimeString();
    master.textContent = masterNow.toLocaleTimeString();
    offset.textContent = (AppState.serverTimeOffset > 0 ? '+' : '') + AppState.serverTimeOffset + 'ms';
}

// MOTOR DEL RELOJ LOCAL PROCESADO EN BACKGROUND POR EL WEB WORKER
backgroundWorker.onmessage = function(e) {
    if (e.data.type === 'beep') {
        playBeepTone();
        // Fallback: mostrar notificación de respaldo cada vez que hace beep (pero limitada para no hacer spam)
        // Solo las mostramos en la PC receptora si no está en foco y tiene el tab en background
        if (document.visibilityState !== 'visible') {
            const t = AppState.timers.find(timer => timer.id === e.data.id);
            if (t && Math.random() < 0.1) { // 10% de probabilidad por tick (cada 15s) para no floodear el SO
                // Opcional: showNotification(t); 
            }
        }
    } else if (e.data.type === 'tick') {
        const now = Date.now() + AppState.serverTimeOffset;
        AppState.timers.forEach(t => {
            if (t.isRunning && !t.isPaused && !t.isCompleted && t.targetTime) {
                const target = new Date(t.targetTime).getTime();
                const theoreticalRemaining = Math.max(0, (target - now) / 1000);
                
                t.remainingSeconds = Math.round(theoreticalRemaining);

                if (theoreticalRemaining <= 0 && !t.isCompleted) {
                    t.remainingSeconds = 0;
                    t.isRunning = false;
                    t.isCompleted = true;
                    
                    updateTimerDisplay(t.id);
                    
                    // FILTRO ESTRICTO: Solo disparar si llegó a 0 absoluto
                    if (t.remainingSeconds === 0) {
                        startContinuousAlarm(t.id);
                        showNotification(t);
                    }
                    
                    sb.from('timers').update({ 
                        remainingSeconds: 0, 
                        isRunning: false, 
                        isCompleted: true 
                    }).eq('id', t.id).catch(console.error);
                    
                    logHistoryLocally('COMPLETADO', t);
                }
                updateTimerDisplay(t.id);
            }
        });
    }
};

// ==================== RENDERIZADO UI ====================
function renderTimers() {
    const cards = elements.timersGrid.querySelectorAll('.timer-card-compact');
    cards.forEach(card => card.remove());

    if (AppState.timers.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    } else {
        elements.emptyState.classList.add('hidden');
    }

    AppState.timers.forEach(timer => {
        elements.timersGrid.appendChild(createTimerCard(timer));
    });
}

function createTimerCard(timer) {
    const card = document.createElement('div');
    card.className = 'timer-card-compact';
    card.id = `timer-${timer.id}`;

    if (timer.isPaused) card.classList.add('paused');
    if (timer.isCompleted) card.classList.add('completed');
    if (AppState.activeAlarms[timer.id]) card.classList.add('alarm-active');

    const studyTypeUpper = (timer.studyType || '').toUpperCase();
    
    // Aplicar color del preset si existe
    if (timer.color) {
        card.style.borderColor = timer.color;
        card.style.boxShadow = `0 0 20px ${timer.color}44`; // Glow tenue de la tarjeta
        card.setAttribute('data-preset-color', timer.color);
    } else {
        // Fallback a los hardcoded actuales
        if (studyTypeUpper.includes('PLR')) card.classList.add('card-plr');
        else if (studyTypeUpper.includes('CTGN')) card.classList.add('card-ctgn');
        else if (studyTypeUpper.includes('CTM')) card.classList.add('card-ctm');
        else if (studyTypeUpper.includes('HPYLORI') || studyTypeUpper.includes('H PYLORI')) card.classList.add('card-hpylori');
    }

    const buttonText = timer.isCompleted ? 'Completado' : (timer.isRunning ? 'Pausar' : 'Iniciar');
    const buttonIcon = timer.isCompleted ? '✓' : (timer.isRunning ? '⏸' : '▶');

    card.innerHTML = `
        <div class="timer-header-compact">
            <div class="patient-name-compact">${escapeHtml(timer.patientName)}</div>
            <div class="study-type-compact" style="${timer.color ? `color: ${timer.color}; text-shadow: 0 0 5px ${timer.color}66;` : ''}">
                ${escapeHtml(timer.studyType)} 
                ${timer.studyType && timer.totalSeconds===0 ? `<span class="target-time-badge">🔔 ${timer.targetTime}</span>` : ''}
            </div>
        </div>
        
        <div class="timer-display-compact">
            <div class="timer-time-compact" data-timer-id="${timer.id}">
                ${formatTime(timer.remainingSeconds)}
            </div>
        </div>
        
        <div class="timer-controls-compact">
            <button class="control-btn-compact control-btn-primary-compact" onclick="toggleTimer('${timer.id}')" ${timer.isCompleted ? 'disabled' : ''}>
                ${buttonIcon} ${buttonText}
            </button>
            <button class="control-btn-compact control-btn-secondary-compact" onclick="resetTimer('${timer.id}')" title="Reiniciar">↻</button>
            <button class="control-btn-compact control-btn-danger-compact" onclick="deleteTimer('${timer.id}')" title="Eliminar">×</button>
            ${(timer.isCompleted && !timer.isAcknowledged) ? `<button class="control-btn-compact control-btn-stop-compact" onclick="handleStopAlarm('${timer.id}')">🔕 Detener Alarma</button>` : ''}
        </div>
    `;
    return card;
}

function updateTimerDisplay(timerId) {
    const timer = AppState.timers.find(t => t.id == timerId);
    if (!timer) return;

    const card = document.getElementById(`timer-${timerId}`);
    if (!card) return;

    const timeDisplay = card.querySelector(`.timer-time-compact[data-timer-id="${timerId}"]`);
    if (timeDisplay) {
        timeDisplay.textContent = formatTime(timer.remainingSeconds);
        // Si hay color de preset, podemos teñir el tiempo también
        if (timer.color) {
            timeDisplay.style.webkitBackgroundClip = 'initial';
            timeDisplay.style.webkitTextFillColor = 'initial';
            timeDisplay.style.background = 'none';
            timeDisplay.style.color = timer.color;
            timeDisplay.style.filter = `drop-shadow(0 0 10px ${timer.color}88)`; // Brillo en los números
        }
    }

    card.classList.toggle('paused', timer.isPaused);
    card.classList.toggle('completed', timer.isCompleted);
    
    if (timer.isCompleted && timer.color) {
        card.style.boxShadow = `0 0 20px ${timer.color}66`; // 40% alpha
    }

    const button = card.querySelector('.control-btn-primary-compact');
    if (button && !timer.isCompleted) {
        button.innerHTML = `${timer.isRunning ? '⏸' : '▶'} ${timer.isRunning ? 'Pausar' : 'Iniciar'}`;
        button.disabled = false;
    } else if (button && timer.isCompleted) {
        button.innerHTML = '✓ Completado';
        button.disabled = true;
    }

    let stopBtn = card.querySelector('.control-btn-stop-compact');
    if (timer.isCompleted && !timer.isAcknowledged && !stopBtn) {
        const controlsDiv = card.querySelector('.timer-controls-compact');
        const newBtn = document.createElement('button');
        newBtn.className = 'control-btn-compact control-btn-stop-compact';
        newBtn.innerHTML = '🔕 Detener Alarma';
        newBtn.onclick = () => handleStopAlarm(timer.id);
        controlsDiv.appendChild(newBtn);
    } else if ((!timer.isCompleted || timer.isAcknowledged) && stopBtn) {
        stopBtn.remove();
    }
}

// ==================== ACCIONES DB MANUALES ====================
window.toggleTimer = async (id) => {
    const op = validateOperator(true); // Siempre pedir en modificaciones
    if (!op) return;
    
    const timer = AppState.timers.find(t => t.id === id);
    if (!timer) return;

    if (timer.isRunning) {
        // Pausar - actualizar UI localmente primero
        timer.isRunning = false;
        timer.isPaused = true;
        timer.targetTime = null;
        updateTimerDisplay(id);
        await sb.from('timers').update({
            isRunning: false,
            isPaused: true,
            remainingSeconds: timer.remainingSeconds,
            targetTime: null
        }).eq('id', id);
        logHistoryLocally('PAUSADO', timer, op);
    } else {
        // Iniciar - actualizar UI localmente primero
        syncTimeWithServer(); // Sincronización On-Demand
        const nowReal = Date.now() + AppState.serverTimeOffset;
        const targetTime = new Date(nowReal + (timer.remainingSeconds * 1000)).toISOString();
        timer.isRunning = true;
        timer.isPaused = false;
        timer.targetTime = targetTime;
        updateTimerDisplay(id);
        await sb.from('timers').update({
            isRunning: true,
            isPaused: false,
            targetTime: targetTime
        }).eq('id', id);
        logHistoryLocally('INICIADO', timer, op);
    }
};

window.resetTimer = async (id) => {
    const op = validateOperator(true); // Siempre pedir en modificaciones
    if (!op) return;
    
    const timer = AppState.timers.find(t => t.id === id);
    if (!timer) return;
    stopAlarm(id);
    // Actualizar UI localmente primero
    timer.remainingSeconds = timer.totalSeconds;
    timer.isRunning = false;
    timer.isPaused = false;
    timer.isCompleted = false;
    timer.isAcknowledged = false;
    timer.targetTime = null;
    updateTimerDisplay(id);
    await sb.from('timers').update({
        remainingSeconds: timer.totalSeconds,
        isRunning: false,
        isPaused: false,
        isCompleted: false,
        isAcknowledged: false,
        targetTime: null
    }).eq('id', id);
    syncTimeWithServer(); // Sincronización On-Demand
    logHistoryLocally('REINICIADO', timer, op);
};

window.deleteTimer = async (id) => {
    const op = validateOperator(true); // Siempre pedir en modificaciones
    if (!op) return;
    
    if (confirm('¿Eliminar este temporizador?')) {
        const timer = AppState.timers.find(t => t.id === id);
        stopAlarm(id);
        // Actualizar UI localmente sin depender de Realtime
        AppState.timers = AppState.timers.filter(t => t.id !== id);
        renderTimers();
        await sb.from('timers').delete().eq('id', id);
        if(timer) logHistoryLocally('ELIMINADO', timer, op);
    }
};

window.handleStopAlarm = async (id) => {
    const op = validateOperator(true); // Siempre pedir en modificaciones
    if (!op) return;
    
    stopAlarm(id);
    const timer = AppState.timers.find(t => t.id == id);
    if (timer) {
        timer.isAcknowledged = true;
        updateTimerDisplay(id); // Actualizar UI localmente de inmediato
        
        // Enviar broadcast ultra-rápido (~50ms) para apagar la alarma instantáneamente en otras PCs
        if (realtimeChannel) {
            realtimeChannel.send({
                type: 'broadcast',
                event: 'stop_alarm',
                payload: { id: id }
            }).catch(e => console.error('Error enviando broadcast:', e));
        }

        // Sincronizar el "silencio" en la base de datos de manera definitiva
        try {
            await sb.from('timers').update({ 
                isAcknowledged: true,
                isCompleted: true,
                isRunning: false,
                remainingSeconds: 0
            }).eq('id', id);
            
            // LOG DEL EVENTO (CORRECCIÓN SOLICITADA)
            logHistoryLocally('ALARMA DETENIDA', timer, op);
        } catch (e) {
            console.error('Error al silenciar alarma globalmente:', e);
        }
    }
};

// ==================== FORMULARIO ====================
function formatInputValue(input) {
    let val = parseInt(input.value) || 0;
    input.value = String(val).padStart(2, '0');
}

[elements.hoursInput, elements.minutesInput, elements.secondsInput].forEach(input => {
    input.addEventListener('change', () => formatInputValue(input));
    input.addEventListener('blur', () => formatInputValue(input));
    formatInputValue(input);
});

let currentMode = 'duration';

window.clearForm = () => {
    elements.patientNameInput.value = '';
    elements.studyTypeInput.value = '';
    elements.hoursInput.value = '00';
    elements.minutesInput.value = '00';
    elements.secondsInput.value = '00';
    document.querySelector('input[name="timer-mode"][value="duration"]').checked = true;
    toggleTimerMode();
    elements.patientNameInput.focus();
};

window.toggleTimerMode = () => {
    currentMode = document.querySelector('input[name="timer-mode"]:checked').value;
    const secondsWrapper = elements.secondsInput.closest('.time-control-wrapper');

    document.querySelectorAll('.mode-option-btn').forEach(btn => {
        btn.classList.toggle('active', btn.querySelector('input').checked);
    });

    if (currentMode === 'fixed') {
        if (secondsWrapper) secondsWrapper.style.display = 'none';
        const h = parseInt(elements.hoursInput.value) || 0;
        const m = parseInt(elements.minutesInput.value) || 0;
        if (h === 0 && m === 0) {
            const now = new Date();
            elements.hoursInput.value = String(now.getHours()).padStart(2, '0');
            elements.minutesInput.value = String(now.getMinutes()).padStart(2, '0');
        }
    } else {
        if (secondsWrapper) secondsWrapper.style.display = 'flex';
        if (!elements.studyTypeInput.value || !AppState.presets.find(p => p.sigla.toUpperCase() === elements.studyTypeInput.value.toUpperCase())) {
            elements.hoursInput.value = '00';
            elements.minutesInput.value = '00';
        }
    }
};

elements.studyTypeInput.addEventListener('input', (e) => {
    const val = e.target.value.toUpperCase().trim();
    // Buscar en presets por sigla o descripción
    const preset = AppState.presets.find(p => 
        p.sigla.toUpperCase() === val || 
        (p.descripcion && p.descripcion.toUpperCase() === val)
    );
    
    if (preset) {
        const modeRadio = document.querySelector(`input[name="timer-mode"][value="${preset.tipo}"]`);
        if (modeRadio && !modeRadio.checked) {
            modeRadio.checked = true;
            toggleTimerMode();
        }
        
        elements.hoursInput.value = String(preset.horas || 0).padStart(2, '0');
        elements.minutesInput.value = String(preset.minutos || 0).padStart(2, '0');
        elements.secondsInput.value = String(preset.segundos || 0).padStart(2, '0');
    }
});

elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const op = validateOperator(false); // Creación: usar panel central si tiene valor
    if (!op) return; 
    
    // Persistir operador localmente
    localStorage.setItem('last-operator', document.getElementById('operator-name').value);

    const patientName = elements.patientNameInput.value.trim();
    const studyType = elements.studyTypeInput.value.trim();
    const hours = parseInt(elements.hoursInput.value) || 0;
    const minutes = parseInt(elements.minutesInput.value) || 0;
    let seconds = parseInt(elements.secondsInput.value) || 0;
    let totalSeconds = 0;
    
    if (currentMode === 'fixed') {
        seconds = 0;
        const nowReal = Date.now() + AppState.serverTimeOffset;
        const now = new Date(nowReal); 
        const targetDate = new Date(nowReal); 
        targetDate.setHours(hours, minutes, 0, 0);
        if (targetDate <= now) targetDate.setDate(targetDate.getDate() + 1);
        totalSeconds = Math.floor((targetDate - now) / 1000);
    } else {
        totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
    }
    syncTimeWithServer(); // Sincronización On-Demand

    if (patientName && studyType && totalSeconds > 0) {
        // USAMOS LA HORA CORREGIDA PARA CALCULAR EL TARGET INICIAL
        const nowReal = Date.now() + AppState.serverTimeOffset;
        const targetTimeIso = new Date(nowReal + (totalSeconds * 1000)).toISOString();
        const newTimerId = Date.now().toString();

        // Buscar preset para heredar color e ID
        const presetMatch = AppState.presets.find(p => p.sigla.toUpperCase() === studyType.toUpperCase());
        const timerColor = presetMatch ? presetMatch.color : '#c20078';

        const newTimerData = {
            id: newTimerId,
            laboratorio_id: labId,
            patientName,
            studyType: presetMatch ? presetMatch.sigla : studyType, // Usar sigla oficial si coincide
            totalSeconds,
            remainingSeconds: totalSeconds,
            targetTime: targetTimeIso,
            isRunning: true,
            isPaused: false,
            isCompleted: false,
            color: timerColor
        };

        // Actualizar localmente al instante para el creador
        AppState.timers.push(newTimerData);
        renderTimers();

        await sb.from('timers').insert(newTimerData);

        // Insert log
        logHistoryLocally('CREADO', { laboratorio_id: labId, patientName, studyType }, op);

        elements.patientNameInput.value = '';
        elements.studyTypeInput.value = '';
        elements.hoursInput.value = '00';
        elements.minutesInput.value = '00';
        elements.secondsInput.value = '00';
        elements.patientNameInput.focus();
    }
});

// Manejador del Formulario de Presets (Añadir / Editar)
const presetForm = document.getElementById('preset-form');
if (presetForm) {
    presetForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const id = document.getElementById('preset-id').value;
        const sigla = document.getElementById('preset-sigla').value.trim().toUpperCase();
        const descripcion = document.getElementById('preset-desc').value.trim();
        const tipo = document.getElementById('preset-tipo').value;
        const horas = parseInt(document.getElementById('preset-h').value) || 0;
        const minutos = parseInt(document.getElementById('preset-m').value) || 0;
        const segundos = parseInt(document.getElementById('preset-s').value) || 0;
        const color = document.getElementById('preset-color').value;

        // --- VALIDACIÓN DE UNICIDAD ---
        // Buscar si ya existe otro preset con la misma sigla o descripción (excluyendo el que estamos editando si aplica)
        const duplicateSigla = AppState.presets.find(p => p.id !== id && p.sigla.toUpperCase() === sigla);
        if (duplicateSigla) {
            alert(`Ya existe un preajuste con la sigla "${sigla}". Por favor, usa una diferente.`);
            return;
        }

        const duplicateDesc = AppState.presets.find(p => p.id !== id && p.descripcion && p.descripcion.toUpperCase() === descripcion.toUpperCase());
        if (duplicateDesc) {
            alert(`Ya existe un preajuste con la descripción "${descripcion}". Por favor, usa una diferente.`);
            return;
        }

        const presetData = {
            laboratorio_id: labId,
            sigla,
            descripcion,
            tipo,
            horas,
            minutos,
            segundos,
            color
        };

        try {
            if (id) {
                // Modo Edición: Actualizar
                const { error } = await sb.from('ajustes_tiempo').update(presetData).eq('id', id);
                if (error) throw error;
                alert('Preajuste actualizado correctamente');
            } else {
                // Modo Añadir: Insertar
                const { error } = await sb.from('ajustes_tiempo').insert(presetData);
                if (error) throw error;
                alert('Preajuste añadido correctamente');
            }
            
            cancelPresetEdit(); // Limpiar formulario y salir de modo edición
            loadPresets(); // Recargar lista
        } catch (err) {
            console.error('Error guardando preajuste:', err);
            alert('Error al guardar el preajuste');
        }
    });
}

if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// ==================== HISTORIAL DE EVENTOS ====================
const HistoryManager = {
    panel: null,
    list: null,
    toggleBtn: null,
    closeBtn: null,
    exportBtn: null,
    exportModal: null,

    init() {
        this.panel = document.getElementById('history-panel');
        this.list = document.getElementById('history-list');
        this.toggleBtn = document.getElementById('toggle-history-btn');
        this.closeBtn = document.getElementById('close-history-btn');
        this.exportBtn = document.getElementById('open-export-btn');
        this.exportModal = document.getElementById('export-modal');

        if (this.toggleBtn) this.toggleBtn.addEventListener('click', () => this.togglePanel());
        if (this.closeBtn) this.closeBtn.addEventListener('click', () => this.togglePanel());
        if (this.exportBtn) this.exportBtn.onclick = () => this.openExport();

        // Cerrar modales de exportación
        const closeExp = document.getElementById('close-export-btn');
        const cancelExp = document.getElementById('cancel-export-btn');
        if (closeExp) closeExp.onclick = () => this.closeExport();
        if (cancelExp) cancelExp.onclick = () => this.closeExport();

        // Botón confirmar exportación
        const confirmBtn = document.getElementById('confirm-export-btn');
        if (confirmBtn) confirmBtn.onclick = () => this.handleExportAction();
    },
    togglePanel() {
        if (!this.panel) return;
        this.panel.classList.toggle('visible');
    },
    openExport() {
        if (this.exportModal) {
            // Establecer fechas por defecto locales (YYYY-MM-DD)
            const todayStr = new Date().toLocaleDateString('sv-SE');
            document.getElementById('export-date-start').value = todayStr;
            document.getElementById('export-date-end').value = todayStr;
            this.exportModal.classList.remove('hidden');
        }
    },
    closeExport() {
        if (this.exportModal) this.exportModal.classList.add('hidden');
    },
    async handleExportAction() {
        const start = document.getElementById('export-date-start').value;
        const end = document.getElementById('export-date-end').value;
        const selectedEvents = Array.from(document.querySelectorAll('.chk-event:checked')).map(cb => cb.value);
        const allChecked = document.getElementById('chk-all').checked;

        let query = sb.from('historial').select('*').eq('laboratorio_id', labId);
        
        if (start) {
            // Asegurar inicio del día local
            const startDate = new Date(start + "T00:00:00");
            query = query.gte('timestamp', startDate.toISOString());
        }
        if (end) {
            // Asegurar fin del día local
            const endDate = new Date(end + "T23:59:59.999");
            query = query.lte('timestamp', endDate.toISOString());
        }

        const { data, error } = await query.order('timestamp', { ascending: false });

        if (error || !data) {
            alert("Error al obtener datos para exportar");
            return;
        }

        // Filtrar por tipo de evento si no es "Todos"
        let filteredData = data;
        if (!allChecked) {
            filteredData = data.filter(ev => selectedEvents.includes(ev.action));
        }

        if (filteredData.length === 0) {
            alert("No hay eventos en el rango seleccionado");
            return;
        }

        this.downloadCSV(filteredData);
        this.closeExport();
    },
    downloadCSV(data) {
        const headers = ["Fecha", "Hora", "Acción", "Paciente", "Estudio", "Operador"];
        const rows = data.map(ev => {
            const date = new Date(ev.timestamp);
            return [
                date.toLocaleDateString(),
                date.toLocaleTimeString(),
                ev.action,
                ev.patientName,
                ev.studyType,
                ev.operador || '-'
            ];
        });

        let csvContent = headers.join(",") + "\n" + rows.map(r => r.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `historial_${labId}_${new Date().toISOString().split('T')[0]}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },
    renderItem(event) {
        const li = document.createElement('li');
        li.className = `history-item action-${(event.action||'').toLowerCase()}`;
        const date = new Date(event.timestamp);
        li.innerHTML = `
            <div class="history-item-header">
                <span>${event.action} ${event.operador ? `<strong style="color:var(--color-primary); margin-left:5px;">(${event.operador})</strong>` : ''}</span>
                <span>${date.toLocaleDateString()} ${date.toLocaleTimeString()}</span>
            </div>
            <div class="history-item-content">${escapeHtml(event.patientName)}</div>
            <div class="history-item-details">${escapeHtml(event.studyType)}</div>
        `;
        return li;
    },
    addEvent(event) {
        const item = this.renderItem(event);
        this.list.insertBefore(item, this.list.firstChild);
    },
    loadList(events) {
        this.list.innerHTML = '';
        events.forEach(event => this.list.appendChild(this.renderItem(event)));
    }
};

HistoryManager.init();

function logout() {
    if (confirm('¿Cerrar sesión?')) {
        localStorage.clear();
        const pwaParam = IS_PWA ? '?mode=pwa' : '';
        window.location.href = 'login.html' + pwaParam;
    }
}
window.logout = logout;

// ==================== OPCIONES & PASSWORD ====================
window.toggleOptionsMenu = (e) => {
    if (e) e.stopPropagation();
    const drop = document.getElementById('options-dropdown');
    if(drop) drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
};

window.openChangePasswordModal = () => {
    const drop = document.getElementById('options-dropdown');
    if (drop) drop.style.display = 'none';
    document.getElementById('modal-change-password').style.display = 'flex';
};

window.closeChangePasswordModal = () => {
    document.getElementById('modal-change-password').style.display = 'none';
};

window.togglePassVisibility = (id, btn) => {
    const inp = document.getElementById(id);
    if(inp.type === 'password'){ inp.type = 'text'; btn.style.opacity = 1; }
    else { inp.type = 'password'; btn.style.opacity = 0.8;}
};

document.getElementById('change-password-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPass = document.getElementById('lab-old-password').value;
    const newPass = document.getElementById('lab-new-password').value;
    
    // Verificamos password actual y actualizamos en Supabase
    const { data: perfiles } = await sb.from('perfiles').select('*').eq('id', token);
    if(perfiles && perfiles.length > 0 && perfiles[0].password === oldPass) {
        await sb.from('perfiles').update({ password: newPass }).eq('id', token);
        alert("Contraseña actualizada exitosamente.");
        closeChangePasswordModal();
    } else {
        alert("Contraseña actual incorrecta.");
    }
});

// ==================== GESTIÓN DE PRESETS (AJUSTES) ====================
window.openPresetsModal = () => {
    const drop = document.getElementById('options-dropdown');
    if (drop) drop.style.display = 'none';
    document.getElementById('modal-presets').style.display = 'flex';
    renderPresetsList();
};

window.closePresetsModal = () => {
    document.getElementById('modal-presets').style.display = 'none';
    cancelPresetEdit();
};

function renderPresetsList() {
    const list = document.getElementById('presets-list');
    if (!list) return;
    list.innerHTML = '';

    AppState.presets.forEach(p => {
        const tr = document.createElement('tr');
        const time = `${String(p.horas || 0).padStart(2, '0')}:${String(p.minutos || 0).padStart(2, '0')}:${String(p.segundos || 0).padStart(2, '0')}`;
        
        tr.innerHTML = `
            <td><strong>${p.sigla}</strong></td>
            <td>${p.descripcion || '-'}</td>
            <td style="font-size: 0.8rem;">${p.tipo === 'duration' ? 'Regresiva' : 'Fija'}</td>
            <td style="font-family: monospace; font-size: 0.85rem;">${time}</td>
            <td style="text-align: center;"><span class="color-preview-circle" style="background-color: ${p.color || '#c20078'}"></span></td>
            <td>
                <div style="display: flex; gap: 5px;">
                    <button onclick="editPreset('${p.id}')" class="control-btn-compact control-btn-secondary-compact" style="padding: 4px 8px; flex: 1;" title="Editar">✏️</button>
                    <button onclick="deletePreset('${p.id}')" class="control-btn-compact control-btn-danger-compact" style="padding: 4px 8px; flex: 1;" title="Eliminar">🗑️</button>
                </div>
            </td>
        `;
        list.appendChild(tr);
    });
}

window.editPreset = (id) => {
    const p = AppState.presets.find(item => item.id === id);
    if (!p) return;

    document.getElementById('preset-id').value = p.id;
    document.getElementById('preset-sigla').value = p.sigla;
    document.getElementById('preset-desc').value = p.descripcion || '';
    document.getElementById('preset-tipo').value = p.tipo;
    document.getElementById('preset-h').value = p.horas || 0;
    document.getElementById('preset-m').value = p.minutos || 0;
    document.getElementById('preset-s').value = p.segundos || 0;
    document.getElementById('preset-color').value = p.color || '#c20078';

    document.getElementById('preset-submit-btn').textContent = 'Guardar';
    document.getElementById('preset-cancel-edit-btn').style.display = 'inline-block';
    document.getElementById('preset-sigla').focus();
};

window.cancelPresetEdit = () => {
    const form = document.getElementById('preset-form');
    if (form) form.reset();
    document.getElementById('preset-id').value = '';
    document.getElementById('preset-submit-btn').textContent = 'Añadir';
    document.getElementById('preset-cancel-edit-btn').style.display = 'none';
};

window.deletePreset = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este preajuste?')) return;
    try {
        const { error } = await sb.from('ajustes_tiempo').delete().eq('id', id);
        if (error) throw error;
        // La actualización vendrá vía Realtime o recargando
        loadPresets();
    } catch (err) {
        console.error('Error eliminando preajuste:', err);
        alert('Error al eliminar el preajuste');
    }
};
window.deletePreset = async (id) => {
    if (!confirm('¿Seguro que deseas eliminar este preajuste?')) return;
    try {
        const { error } = await sb.from('ajustes_tiempo').delete().eq('id', id);
        if (error) throw error;
        // La actualización vendrá vía Realtime o recargando
        loadPresets();
    } catch (err) {
        console.error('Error eliminando preajuste:', err);
        alert('Error al eliminar el preajuste');
    }
};

/* Cerrar elementos al clicar afuera */
document.addEventListener('click', (e) => {
    // Menú de opciones (3 puntos)
    const optionsDropdown = document.getElementById('options-dropdown');
    const optionsBtn = document.getElementById('options-btn');
    if (optionsDropdown && optionsDropdown.style.display === 'block') {
        const isOutside = !optionsDropdown.contains(e.target) && (optionsBtn && !optionsBtn.contains(e.target));
        if (isOutside) {
            optionsDropdown.style.display = 'none';
        }
    }

    // Panel de Historial
    const historyPanel = document.getElementById('history-panel');
    const historyBtn = document.getElementById('toggle-history-btn');
    if (historyPanel && historyPanel.classList.contains('visible')) {
        const isOutside = !historyPanel.contains(e.target) && (historyBtn && !historyBtn.contains(e.target));
        if (isOutside) {
            historyPanel.classList.remove('visible');
        }
    }
});

function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
