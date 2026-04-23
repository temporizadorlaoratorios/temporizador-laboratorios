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

    // Cargar Logo Extra desde Supabase (primero el específico del lab, luego el global)
    async function initExtraBranding() {
        const logoExtra = document.getElementById('app-extra-logo');
        if (!logoExtra) return;
        try {
            // 1. Buscar logo extra específico de este laboratorio
            const perLabId = `extra-logo-${labId}`;
            const { data: perLabData } = await sb.from('laboratorios').select('logo').eq('id', perLabId).single();
            if (perLabData && perLabData.logo) {
                logoExtra.src = perLabData.logo;
                return;
            }
            // 2. Fallback: buscar logo extra global del super admin
            const { data: globalData } = await sb.from('laboratorios').select('logo').eq('id', 'super-admin-extra-logo').single();
            logoExtra.src = (globalData && globalData.logo) ? globalData.logo : 'icono.ico';
        } catch (e) {
            logoExtra.src = 'icono.ico';
        }
    }
    initExtraBranding();

    loadInitialData();
    
    // Sincronización de Reloj Inicial y Periódica (Cada 10 segundos)
    syncTimeWithServer().then(() => {
        setInterval(syncTimeWithServer, 10000); 
    });

    // ========== OVERLAY DE ACTIVACIÓN OBLIGATORIA ==========
    // Muestra un botón grande que OBLIGA al usuario a hacer clic al abrir la app.
    // Ese clic desbloquea el audio del navegador para toda la sesión.
    showActivationOverlay();
});

// ==================== ESTADO GLOBAL LOCAL ====================
const AppState = {
    timers: [],
    presets: [],
    activeAlarms: {},
    serverTimeOffset: 0 // Diferencia entre servidor y PC local (ms)
};

let realtimeChannel = null;


// --- SISTEMA ANTI-THROTTLING ROBUSTO PARA PWA EN BACKGROUND ---

// Generador de WAV base64 en memoria (super liviano, onda cuadrada) para evadir bloqueo de AudioContext
function createWavFileBase64(freq, duration) {
    const sr = 8000; const volume = 127; const samples = Math.floor(duration * sr);
    const buf = new Uint8Array(44 + samples);
    const writeString = (o, str) => { for(let i=0; i<str.length; i++) buf[o+i] = str.charCodeAt(i); };
    const write32 = (o, val) => { buf[o] = val&255; buf[o+1] = (val>>8)&255; buf[o+2] = (val>>16)&255; buf[o+3] = (val>>24)&255; };
    const write16 = (o, val) => { buf[o] = val&255; buf[o+1] = (val>>8)&255; };
    
    writeString(0, 'RIFF'); write32(4, 36 + samples); writeString(8, 'WAVEfmt '); 
    write32(16, 16); write16(20, 1); write16(22, 1); write32(24, sr); write32(28, sr); write16(32, 1); write16(34, 8);
    writeString(36, 'data'); write32(40, samples);
    for (let i = 0; i < samples; i++) buf[44 + i] = (Math.sin(2 * Math.PI * freq * (i / sr)) > 0 ? 127 + volume : 127 - volume);
    
    let str = ""; for(let i=0; i<buf.length; i+=1000) str += String.fromCharCode.apply(null, buf.subarray(i, i+1000));
    return 'data:audio/wav;base64,' + btoa(str);
}

// Audio silencioso de keepalive (mantiene la sesión de audio viva)
const silentAudio = new Audio('data:audio/wav;base64,UklGRigAAABXQVZFZm10IBIAAAABAAEARKwAAIhYAQACABAAAABkYXRhAgAAAAEA');
silentAudio.loop = true;
silentAudio.volume = 0.01;

// Beep de emergencia como HTMLAudioElement puro (NO oscilador Web Audio API que se suspende)
let emergencyAudio = new Audio(createWavFileBase64(900, 0.4));
emergencyAudio.volume = 1.0;

// Segundo beep de respaldo (frecuencia diferente, por si el primero fue garbage-collected)
let backupAudio = new Audio(createWavFileBase64(1100, 0.3));
backupAudio.volume = 1.0;

let backgroundModeEnabled = false;
let audioKeepaliveInterval = null;

function enableBackgroundMode() {
    if (backgroundModeEnabled) return;
    
    silentAudio.play().then(() => {
        backgroundModeEnabled = true;
        console.log('🛡️ Protección anti-suspensión activada.');
        
        // Destrabar emergencyAudio y backupAudio (Play -> Pause rapidísimo)
        emergencyAudio.play().then(() => emergencyAudio.pause()).catch(e => console.warn(e));
        backupAudio.play().then(() => backupAudio.pause()).catch(e => console.warn(e));
        
        // Iniciar keepalive auto-reparable cada 25 segundos
        if (!audioKeepaliveInterval) {
            audioKeepaliveInterval = setInterval(repairAudioKeepalive, 25000);
        }
    }).catch(e => console.warn('No se pudo activar protección (requiere clic previo)', e));
}

// Auto-reparación: cada 25s verificar que el audio sigue vivo y reparar si Chrome lo mató
function repairAudioKeepalive() {
    // 1. Verificar silentAudio keepalive
    if (silentAudio.paused) {
        console.warn('⚠️ Audio keepalive fue pausado por el navegador. Re-activando...');
        silentAudio.play().catch(e => console.warn('No se pudo re-activar keepalive:', e));
    }
    
    // 2. Verificar AudioContext global
    if (globalAudioContext && globalAudioContext.state === 'suspended') {
        console.warn('⚠️ AudioContext suspendido. Intentando resume...');
        globalAudioContext.resume().catch(e => console.warn('Resume falló:', e));
    }
    
    // 3. Re-crear emergencyAudio si fue garbage-collected o dañado
    try {
        if (!emergencyAudio || emergencyAudio.error) {
            console.warn('⚠️ emergencyAudio dañado. Re-creando...');
            emergencyAudio = new Audio(createWavFileBase64(900, 0.4));
            emergencyAudio.volume = 1.0;
        }
        if (!backupAudio || backupAudio.error) {
            backupAudio = new Audio(createWavFileBase64(1100, 0.3));
            backupAudio.volume = 1.0;
        }
    } catch(e) {
        console.warn('Error re-creando audio:', e);
    }
    
    // 4. Si hay alarmas activas, re-destrabar el emergencyAudio preventivamente
    if (Object.keys(AppState?.activeAlarms || {}).length > 0) {
        emergencyAudio.play().then(() => emergencyAudio.pause()).catch(() => {});
    }
}

// La activación ahora se hace desde el overlay obligatorio (showActivationOverlay)
// Fallback: si por algún motivo el overlay no se mostró, activar con cualquier clic
document.addEventListener('click', enableBackgroundMode, { once: true });
document.addEventListener('touchstart', enableBackgroundMode, { once: true });

// ==================== OVERLAY DE ACTIVACIÓN OBLIGATORIA ====================
function showActivationOverlay() {
    // No mostrar si ya se activó el audio en esta sesión
    if (backgroundModeEnabled) return;
    
    // No mostrar si la PWA está bloqueada por otra instancia
    if (document.getElementById('pwa-block-overlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'activation-overlay';
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100%; height: 100%;
        background: rgba(10, 10, 30, 0.97);
        z-index: 50000;
        display: flex; flex-direction: column; justify-content: center; align-items: center;
        text-align: center; padding: 20px; box-sizing: border-box;
        backdrop-filter: blur(15px);
        animation: fadeIn 0.3s ease;
    `;
    overlay.innerHTML = `
        <div style="font-size:5rem; margin-bottom:20px; animation: pulse 2s infinite;">🔔</div>
        <h2 style="color:#ffb347; font-family:Inter,sans-serif; font-size:1.8rem; margin-bottom:15px; font-weight:800;">
            ACTIVAR SISTEMA DE ALARMAS
        </h2>
        <p style="color:#ccc; font-family:Inter,sans-serif; font-size:1rem; max-width:450px; line-height:1.6; margin-bottom:30px;">
            Para que las alarmas suenen correctamente<br>
            (incluso con la ventana minimizada),<br>
            presioná el botón de abajo.
        </p>
        <button id="activate-audio-btn" style="
            background: linear-gradient(135deg, #ff6b35, #ff3366);
            color: white; border: none; padding: 18px 50px;
            border-radius: 12px; font-size: 1.3rem; font-weight: 800;
            cursor: pointer; font-family: Inter, sans-serif;
            box-shadow: 0 8px 30px rgba(255, 51, 102, 0.4);
            transition: transform 0.2s, box-shadow 0.2s;
            animation: pulseBtn 2s infinite;
            text-transform: uppercase; letter-spacing: 1px;
        ">▶ ACTIVAR ALARMAS</button>
        <p style="color:#666; font-family:Inter,sans-serif; font-size:0.8rem; margin-top:25px;">
            Solo es necesario una vez al abrir la aplicación
        </p>
        <style>
            @keyframes pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
            @keyframes pulseBtn { 0%,100% { box-shadow: 0 8px 30px rgba(255,51,102,0.4); } 50% { box-shadow: 0 8px 50px rgba(255,51,102,0.7); } }
            @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
            #activate-audio-btn:hover { transform: scale(1.05); }
        </style>
    `;
    document.body.appendChild(overlay);
    
    document.getElementById('activate-audio-btn').addEventListener('click', () => {
        // Este clic del usuario desbloquea el audio en Chrome
        enableBackgroundMode();
        
        // Solicitar permisos de notificación si no se pidieron aún
        if ('Notification' in window && Notification.permission === 'default') {
            Notification.requestPermission();
        }
        
        // Animar la salida y remover
        overlay.style.transition = 'opacity 0.4s ease';
        overlay.style.opacity = '0';
        setTimeout(() => overlay.remove(), 400);
    });
    
    // También activar si tocan cualquier parte del overlay (mobile)
    overlay.addEventListener('touchstart', (e) => {
        if (e.target !== document.getElementById('activate-audio-btn')) {
            document.getElementById('activate-audio-btn').click();
        }
    });
}

// TAMBIÉN re-activar cuando la ventana vuelve al foco (por si Chrome mató todo)
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        // Re-activar protección de audio
        if (backgroundModeEnabled) {
            repairAudioKeepalive();
        }
        console.log('🔄 Ventana maximizada: Forzando recarga de datos para evitar desincronización...');
        loadInitialData();
    }
});

// --- WEB LOCK API: Evitar que Chrome congele la pestaña/PWA ---
if (navigator.locks) {
    navigator.locks.request('timer-app-keepalive', { mode: 'exclusive' }, () => {
        // Este lock se mantiene mientras la app esté abierta.
        // Chrome no congelará un tab que tenga un Web Lock activo.
        console.log('🔒 Web Lock adquirido: Chrome no congelará esta pestaña.');
        return new Promise(() => {}); // Nunca resolver = lock permanente
    }).catch(e => console.warn('Web Lock no disponible:', e));
}

// --- TÍTULO PARPADEANTE DURANTE ALARMA ---
const originalTitle = document.title;
let titleBlinkInterval = null;

function startTitleBlink() {
    if (titleBlinkInterval) return;
    let toggle = false;
    titleBlinkInterval = setInterval(() => {
        toggle = !toggle;
        document.title = toggle ? '⏰ ¡¡ ALARMA !!' : originalTitle;
    }, 800);
}

function stopTitleBlink() {
    if (titleBlinkInterval) {
        clearInterval(titleBlinkInterval);
        titleBlinkInterval = null;
        document.title = originalTitle;
    }
}
// -----------------------------------------------

// MOTOR DE BACKGROUND CON WEB WORKER (Anti-Throttling)
const workerCode = `
    let interval;
    let alarms = {}; // Almacena los contadores para cada alarma activa
    let ticks = 0;
    self.onmessage = function(e) {
        if (e.data.type === 'start_engine') {
            interval = setInterval(() => { 
                self.postMessage({ type: 'tick' }); 
                
                ticks++;
                if (ticks >= 50) { // 5 segundos (50 * 100ms)
                    ticks = 0;
                    if (Object.keys(alarms).length > 0) {
                        // Solicitar validación a la base de datos por si el websocket está suspendido
                        self.postMessage({ type: 'sync_check' });
                    }
                }

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
    
    // Activar título parpadeante
    startTitleBlink();
    
    // Intentar despertar el audio proactivamente
    repairAudioKeepalive();
}

function playBeepTone() {
    let audioPlayed = false;
    
    try {
        // === CAPA 1: Audio HTML5 directo (MÁS ROBUSTO en background profundo) ===
        if (emergencyAudio) {
            emergencyAudio.currentTime = 0;
            emergencyAudio.play().then(() => { audioPlayed = true; }).catch(e => {
                console.warn('emergencyAudio bloqueado, usando backup:', e);
                // Re-crear emergencyAudio por si fue garbage-collected
                emergencyAudio = new Audio(createWavFileBase64(900, 0.4));
                emergencyAudio.volume = 1.0;
                
                // === CAPA 2: Audio de respaldo SOLO si el principal falló ===
                if (backupAudio) {
                    backupAudio.currentTime = 0;
                    backupAudio.play().catch(() => {
                        backupAudio = new Audio(createWavFileBase64(1100, 0.3));
                        backupAudio.volume = 1.0;
                    });
                }
            });
        }

        // === CAPA 3: Web Audio API Oscillator (funciona mejor en foreground) ===
        const audioContext = getAudioContext();
        if (audioContext.state === 'suspended') {
            audioContext.resume();
        }
        
        if (audioContext.state === 'running') {
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
        }
    } catch (e) {
        console.warn('Error reproduciendo audio en background:', e);
    }
    
    // === CAPA 4: Web Notification con sonido (ÚLTIMO RECURSO, funciona SIEMPRE) ===
    // Las notificaciones del sistema operativo SIEMPRE suenan, incluso con app minimizada toda la noche
    if (document.visibilityState !== 'visible') {
        try {
            if ('Notification' in window && Notification.permission === 'granted') {
                const alarmIds = Object.keys(AppState.activeAlarms);
                const firstAlarmTimer = alarmIds.length > 0 ? AppState.timers.find(t => t.id === alarmIds[0]) : null;
                const body = firstAlarmTimer 
                    ? `${firstAlarmTimer.patientName} - ${firstAlarmTimer.studyType}` 
                    : 'Un temporizador ha finalizado';
                
                if (navigator.serviceWorker && navigator.serviceWorker.controller) {
                    navigator.serviceWorker.ready.then(reg => {
                        reg.showNotification('⏰ ¡ALARMA ACTIVA!', {
                            body: body,
                            icon: 'icon_transparente.png',
                            badge: 'icon_transparente.png',
                            requireInteraction: true,
                            silent: false,
                            vibrate: [500, 200, 500, 200, 500],
                            tag: 'timer-alarm-sound', // Reemplaza notificaciones anteriores (no spam)
                            renotify: true // Fuerza sonido aunque el tag sea el mismo
                        });
                    }).catch(() => {});
                }
            }
        } catch(e) {
            console.warn('Notification fallback error:', e);
        }
    }
}

function stopAlarm(timerId) {
    if (AppState.activeAlarms[timerId]) {
        backgroundWorker.postMessage({ type: 'stop_alarm', id: timerId });
        delete AppState.activeAlarms[timerId];
    }

    // Si no quedan alarmas activas, detener el título parpadeante
    if (Object.keys(AppState.activeAlarms).length === 0) {
        stopTitleBlink();
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
    if (timer.hasNotifiedLocally) return;
    timer.hasNotifiedLocally = true;
    
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

// Nueva función de validación interactiva asíncrona (Modal HTML para NO bloquear el hilo principal)
function validateOperatorAsync(isModification = false) {
    return new Promise((resolve) => {
        let op = document.getElementById('operator-name');
        let operatorName = op ? op.value.trim() : "";

        // REGLA: Si es modificación, SIEMPRE pedir prompt ignorando el panel central.
        // Si es creación, solo pedir prompt si el panel central está vacío.
        if (isModification || !operatorName) {
            
            const modal = document.getElementById('operator-modal');
            const input = document.getElementById('operator-modal-input');
            const title = document.getElementById('operator-modal-title');
            const form = document.getElementById('operator-form');
            const cancelBtn = document.getElementById('operator-modal-cancel');
            
            if (!modal) {
                // Fallback de ultra emergencia si el HTML no existe
                const fallbackRes = prompt("Ingrese su nombre:");
                return resolve(fallbackRes ? fallbackRes.trim() : false);
            }

            title.textContent = isModification ? "⚠️ MODIFICACIÓN" : "⚠️ ACCIÓN REQUERIDA";
            input.value = '';
            modal.style.display = 'flex';
            setTimeout(() => input.focus(), 50);

            // Evitar duplicar event listeners
            const cleanup = () => {
                form.onsubmit = null;
                cancelBtn.onclick = null;
                modal.style.display = 'none';
            };

            form.onsubmit = (e) => {
                e.preventDefault();
                const val = input.value.trim();
                if (val) {
                    if (!isModification && op) op.value = val;
                    cleanup();
                    resolve(val);
                }
            };

            cancelBtn.onclick = () => {
                if (!isModification && op && !operatorName) {
                    op.classList.add('input-error');
                    op.focus();
                    setTimeout(() => op.classList.remove('input-error'), 1000);
                }
                cleanup();
                resolve(false);
            };
        } else {
            resolve(operatorName); // Retornamos el nombre del panel central (para creación)
        }
    });
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
        if (!AppState.activeAlarms[e.data.id]) return; // Prevenir que beeps encolados suenen si la alarma ya fue detenida
        playBeepTone(); // playBeepTone ahora incluye notificación como capa 4 interna
    } else if (e.data.type === 'sync_check') {
        const activeIds = Object.keys(AppState.activeAlarms);
        if (activeIds.length > 0) {
            sb.from('timers').select('id, isAcknowledged, isCompleted, isRunning')
                .in('id', activeIds)
                .then(({ data, error }) => {
                    if (!error && data) {
                        data.forEach(t => {
                            if (t.isAcknowledged === true || t.isRunning === true || t.isCompleted === false) {
                                // La alarma ya fue detenida o reiniciada remotamente
                                stopAlarm(t.id);
                                const localTimer = AppState.timers.find(local => local.id === t.id);
                                if (localTimer) {
                                    localTimer.isAcknowledged = t.isAcknowledged;
                                    localTimer.isRunning = t.isRunning;
                                    localTimer.isCompleted = t.isCompleted;
                                    updateTimerDisplay(t.id);
                                }
                            }
                        });
                        
                        // Si un ID ya no se devolvió (fue borrado de la DB), lo paramos.
                        activeIds.forEach(id => {
                            if (!data.find(d => d.id === id)) {
                                stopAlarm(id);
                                AppState.timers = AppState.timers.filter(l => l.id !== id);
                                renderTimers();
                            }
                        });
                    }
                }).catch(err => console.log('Silenced sync check error', err));
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
    const op = await validateOperatorAsync(true); // Siempre pedir en modificaciones
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
    const op = await validateOperatorAsync(true); // Siempre pedir en modificaciones
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
    const op = await validateOperatorAsync(true); // Siempre pedir en modificaciones
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
    const timer = AppState.timers.find(t => t.id == id);
    if (!timer) return;

    // Validar el operador ANTES de detener el sonido (No bloquea el Worker)
    const op = await validateOperatorAsync(true); 
    if (!op) {
        // El usuario canceló o dejó vacío, la alarma SIGUE sonando
        return;
    }
    
    // Si la clave es válida, 1. Detenemos sonido local y actualizamos UI
    stopAlarm(id);
    timer.isAcknowledged = true;
    updateTimerDisplay(id);

    // 2. Enviar broadcast para apagar en otras PCs
    if (realtimeChannel) {
        realtimeChannel.send({
            type: 'broadcast',
            event: 'stop_alarm',
            payload: { id: id }
        }).catch(e => console.error('Error enviando broadcast:', e));
    }

    // 3. Sincronizar estado final a DB
    try {
        await sb.from('timers').update({ 
            isAcknowledged: true,
            isCompleted: true,
            isRunning: false,
            remainingSeconds: 0
        }).eq('id', id);
        
        logHistoryLocally('ALARMA DETENIDA', timer, op);
    } catch (e) {
        console.error('Error al silenciar alarma globalmente:', e);
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

// Dar formato igual al de los preset inputs
function setupPresetInput(id) {
    const el = document.getElementById(id);
    if (!el) return;
    el.addEventListener('change', () => formatInputValue(el));
    el.addEventListener('blur', () => formatInputValue(el));
}
setupPresetInput('preset-h');
setupPresetInput('preset-m');
setupPresetInput('preset-s');

window.adjustTime = (type, amt) => {
    let input = type === 'hours' ? elements.hoursInput : (type === 'minutes' ? elements.minutesInput : elements.secondsInput);
    let max = type === 'hours' ? 23 : 59;
    let val = parseInt(input.value) || 0;
    val += amt;
    if (val > max) val = max;
    if (val < 0) val = 0;
    input.value = String(val).padStart(2, '0');
};

window.adjustPresetTime = (id, amt) => {
    let input = document.getElementById(id);
    if (!input) return;
    let max = id === 'preset-h' ? 23 : 59;
    let val = parseInt(input.value) || 0;
    val += amt;
    if (val > max) val = max;
    if (val < 0) val = 0;
    input.value = String(val).padStart(2, '0');
};

let currentMode = 'duration';

window.clearForm = () => {
    const opNav = document.getElementById('operator-name');
    if (opNav) opNav.value = '';
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

// Limpiar el input al recibir foco/clic para que el datalist muestre todas las sugerencias sin filtrar
elements.studyTypeInput.addEventListener('focus', function(e) {
    this.value = '';
});
elements.studyTypeInput.addEventListener('click', function(e) {
    this.value = '';
});

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
    const op = await validateOperatorAsync(false); // Creación: usar panel central si tiene valor
    if (!op) return; 
    
    // No persistimos el usuario para forzar una carga limpia cada vez
    // localStorage.setItem('last-operator', document.getElementById('operator-name').value);

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

        let finalStudyType = presetMatch ? presetMatch.sigla : studyType;
        if (currentMode === 'fixed') {
            finalStudyType += ` (🔔 ${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')})`;
        }

        const newTimerData = {
            id: newTimerId,
            laboratorio_id: labId,
            patientName,
            studyType: finalStudyType,
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

        logHistoryLocally('CREADO', { laboratorio_id: labId, patientName, studyType: finalStudyType }, op);

        const opNav = document.getElementById('operator-name');
        if (opNav) opNav.value = '';

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
        const tipoInput = document.querySelector('input[name="preset-tipo"]:checked');
        const tipo = tipoInput ? tipoInput.value : 'duration';
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
        const justLeft = (val) => `="${(val || '').toString().replace(/"/g, '""')}"`;
        const headers = ["Fecha", "Hora", "Acción", "Paciente", "Estudio", "Hora Fija", "Cuenta Regresiva", "Operador"].map(justLeft);
        const rows = data.map(ev => {
            const date = new Date(ev.timestamp);
            let rawStudy = ev.studyType || '';
            let estudioPuro = rawStudy.toUpperCase();
            let horaFija = '';
            let cuentaRegresiva = '';

            const campanaMatch = rawStudy.match(/(.*?)\s*\(\s*🔔\s*([\d:]+)\s*\)/);
            if (campanaMatch) {
                estudioPuro = campanaMatch[1].trim().toUpperCase();
                horaFija = campanaMatch[2].trim();
            } else {
                const preset = AppState.presets.find(p => p.sigla.toUpperCase() === rawStudy.toUpperCase());
                if (preset) {
                    const h = String(preset.horas || 0).padStart(2, '0');
                    const m = String(preset.minutos || 0).padStart(2, '0');
                    const s = String(preset.segundos || 0).padStart(2, '0');
                    cuentaRegresiva = (h !== '00' ? h + ':' : '') + m + ':' + s; 
                }
            }

            return [
                justLeft(date.toLocaleDateString()),
                justLeft(date.toLocaleTimeString()),
                justLeft(ev.action),
                justLeft(ev.patientName),
                justLeft(estudioPuro),
                justLeft(horaFija),
                justLeft(cuentaRegresiva),
                justLeft(ev.operador || '-')
            ];
        });

        let csvContent = headers.join(";") + "\n" + rows.map(r => r.join(";")).join("\n");
        const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
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
    document.getElementById('preset-desc').value = p.descripcion || '';
    
    // Asignar el tipo con selector de radio
    const tipoRadio = document.querySelector(`input[name="preset-tipo"][value="${p.tipo || 'duration'}"]`);
    if (tipoRadio) tipoRadio.checked = true;

    document.getElementById('preset-h').value = String(p.horas || 0).padStart(2, '0');
    document.getElementById('preset-m').value = String(p.minutos || 0).padStart(2, '0');
    document.getElementById('preset-s').value = String(p.segundos || 0).padStart(2, '0');
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
