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

    if (labId === 'super-admin') {
        if (logoImg) {
            logoImg.src = 'logo.png';
            logoImg.style.display = 'block';
        }
        if (logoPlaceholder) logoPlaceholder.style.display = 'none';
    } else if (labLogo) {
        if (logoImg) {
            logoImg.src = labLogo;
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
    if (labId === 'super-admin') return;

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
    if (labId === 'super-admin' && logoContainer) {
        logoContainer.classList.remove('interactive-logo');
        logoContainer.style.cursor = 'default';
        logoContainer.onclick = null;
    }
    
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
});

// ==================== ESTADO GLOBAL LOCAL ====================
const AppState = {
    timers: [],
    activeAlarms: {}
};

const elements = {
    form: document.getElementById('timer-form'),
    patientNameInput: document.getElementById('patient-name'),
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
    const seconds = Math.floor(Math.max(0, totalSeconds) % 60);

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

// Desbloquear AudioContext con la primera interacción del usuario
document.addEventListener('click', () => {
    getAudioContext();
}, { once: true });

// Alarma
function startContinuousAlarm(timerId) {
    if (AppState.activeAlarms[timerId]) return;
    const card = document.getElementById(`timer-${timerId}`);
    if (card) card.classList.add('alarm-active');

    const alarmInterval = setInterval(() => {
        try {
            const audioContext = getAudioContext();
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
        } catch (e) { console.warn('Error de audio:', e); }
    }, 1500);

    AppState.activeAlarms[timerId] = alarmInterval;
}

function stopAlarm(timerId) {
    if (AppState.activeAlarms[timerId]) {
        clearInterval(AppState.activeAlarms[timerId]);
        delete AppState.activeAlarms[timerId];

        const card = document.getElementById(`timer-${timerId}`);
        if (card) {
            card.classList.remove('alarm-active');
            const stopBtn = card.querySelector('.control-btn-stop-compact');
            if (stopBtn) stopBtn.remove();
        }
    }
}

function showNotification(timer) {
    if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('⏱️ Temporizador Completado', {
            body: `${timer.patientName} - ${timer.studyType}`,
            icon: 'logo.png'
        });
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

    AppState.timers = timersData || [];
    renderTimers();

    // Cargar Historial
    const { data: historyData } = await sb
        .from('historial')
        .select('*')
        .eq('laboratorio_id', labId)
        .order('timestamp', { ascending: false })
        .limit(50);
    if (historyData) HistoryManager.loadList(historyData);

    // Suscribirse a cambios en DB REALTIME (Reemplazo Socket.io)
    // Cada lab suscripto únicamente a sus propios cambios para aislamiento total
    sb.channel('timers_channel')
    .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'timers', 
        filter: `laboratorio_id=eq.${labId}` 
    }, payload => {
        if (payload.eventType === 'INSERT') {
            // Solo agregar si no existe ya localmente
            if (!AppState.timers.find(t => t.id === payload.new.id)) {
                AppState.timers.push(payload.new);
                renderTimers();
            }
        } else if (payload.eventType === 'UPDATE') {
            const idx = AppState.timers.findIndex(t => t.id === payload.new.id);
            if (idx !== -1) {
                const wasNotCompleted = !AppState.timers[idx].isCompleted;
                AppState.timers[idx] = payload.new;
                
                if (payload.new.isCompleted && wasNotCompleted) {
                    startContinuousAlarm(payload.new.id);
                    showNotification(payload.new);
                } else if (!payload.new.isCompleted) {
                    // Si ya no está completado (se reinició o pausó), apagar alarma local
                    stopAlarm(payload.new.id);
                }
                updateTimerDisplay(payload.new.id);
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
        HistoryManager.addEvent(payload.new);
    })
    .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime conectado con éxito al lab:', labId);
        } else {
            console.error('⚠️ Realtime con problemas de conexión:', status);
        }
    });
}

async function logHistoryLocally(action, timer) {
    const historyEvent = {
        id: Date.now().toString(),
        laboratorio_id: timer.laboratorio_id,
        action: action,
        patientName: timer.patientName,
        studyType: timer.studyType,
        timestamp: new Date().toISOString()
    };
    await sb.from('historial').insert(historyEvent);
}

// MOTOR DEL RELOJ LOCAL
setInterval(async () => {
    let requiresRender = false;
    AppState.timers.forEach(t => {
        if (t.isRunning && !t.isPaused && !t.isCompleted && t.targetTime) {
            const target = new Date(t.targetTime).getTime();
            const now = Date.now();
            const diff = Math.floor((target - now) / 1000);
            
            t.remainingSeconds = Math.max(0, diff);

            if (t.remainingSeconds <= 0 && !t.isCompleted) {
                t.remainingSeconds = 0;
                t.isRunning = false;
                t.isCompleted = true;
                
                // Disparar alarma y notificación localmente
                startContinuousAlarm(t.id);
                showNotification(t);
                
                // Un cliente sube el cambio para evitar saturación
                sb.from('timers').update({ 
                    remainingSeconds: 0, 
                    isRunning: false, 
                    isCompleted: true 
                }).eq('id', t.id).then();
                
                logHistoryLocally('COMPLETADO', t);
            }
            updateTimerDisplay(t.id);
        }
    });
}, 1000);

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
    if (studyTypeUpper.includes('PLR')) card.classList.add('card-plr');
    else if (studyTypeUpper.includes('CTGN')) card.classList.add('card-ctgn');
    else if (studyTypeUpper.includes('CTM')) card.classList.add('card-ctm');
    else if (studyTypeUpper.includes('HPYLORI') || studyTypeUpper.includes('H PYLORI')) card.classList.add('card-hpylori');

    const buttonText = timer.isCompleted ? 'Completado' : (timer.isRunning ? 'Pausar' : 'Iniciar');
    const buttonIcon = timer.isCompleted ? '✓' : (timer.isRunning ? '⏸' : '▶');

    card.innerHTML = `
        <div class="timer-header-compact">
            <div class="patient-name-compact">${escapeHtml(timer.patientName)}</div>
            <div class="study-type-compact">
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
        </div>
    `;
    return card;
}

function updateTimerDisplay(timerId) {
    const timer = AppState.timers.find(t => t.id === timerId);
    if (!timer) return;

    const card = document.getElementById(`timer-${timerId}`);
    if (!card) return;

    const timeDisplay = card.querySelector(`.timer-time-compact[data-timer-id="${timerId}"]`);
    if (timeDisplay) timeDisplay.textContent = formatTime(timer.remainingSeconds);

    card.classList.toggle('paused', timer.isPaused);
    card.classList.toggle('completed', timer.isCompleted);

    const button = card.querySelector('.control-btn-primary-compact');
    if (button && !timer.isCompleted) {
        button.innerHTML = `${timer.isRunning ? '⏸' : '▶'} ${timer.isRunning ? 'Pausar' : 'Iniciar'}`;
        button.disabled = false;
    } else if (button && timer.isCompleted) {
        button.innerHTML = '✓ Completado';
        button.disabled = true;
    }

    let stopBtn = card.querySelector('.control-btn-stop-compact');
    if (timer.isCompleted && !stopBtn) {
        const controlsDiv = card.querySelector('.timer-controls-compact');
        const newBtn = document.createElement('button');
        newBtn.className = 'control-btn-compact control-btn-stop-compact';
        newBtn.innerHTML = '🔕 Detener Alarma';
        newBtn.onclick = () => handleStopAlarm(timer.id);
        controlsDiv.appendChild(newBtn);
    } else if (!timer.isCompleted && stopBtn) {
        stopBtn.remove();
    }
}

// ==================== ACCIONES DB MANUALES ====================
window.toggleTimer = async (id) => {
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
        logHistoryLocally('PAUSADO', timer);
    } else {
        // Iniciar - actualizar UI localmente primero
        const targetTime = new Date(Date.now() + (timer.remainingSeconds * 1000)).toISOString();
        timer.isRunning = true;
        timer.isPaused = false;
        timer.targetTime = targetTime;
        updateTimerDisplay(id);
        await sb.from('timers').update({
            isRunning: true,
            isPaused: false,
            targetTime: targetTime
        }).eq('id', id);
        logHistoryLocally('INICIADO', timer);
    }
};

window.resetTimer = async (id) => {
    const timer = AppState.timers.find(t => t.id === id);
    if (!timer) return;
    stopAlarm(id);
    // Actualizar UI localmente primero
    timer.remainingSeconds = timer.totalSeconds;
    timer.isRunning = false;
    timer.isPaused = false;
    timer.isCompleted = false;
    timer.targetTime = null;
    updateTimerDisplay(id);
    await sb.from('timers').update({
        remainingSeconds: timer.totalSeconds,
        isRunning: false,
        isPaused: false,
        isCompleted: false,
        targetTime: null
    }).eq('id', id);
    logHistoryLocally('REINICIADO', timer);
};

window.deleteTimer = async (id) => {
    if (confirm('¿Eliminar este temporizador?')) {
        const timer = AppState.timers.find(t => t.id === id);
        stopAlarm(id);
        // Actualizar UI localmente sin depender de Realtime
        AppState.timers = AppState.timers.filter(t => t.id !== id);
        renderTimers();
        await sb.from('timers').delete().eq('id', id);
        if(timer) logHistoryLocally('ELIMINADO', timer);
    }
};

window.handleStopAlarm = async (id) => {
    stopAlarm(id);
    // Para que se detenga el sonido en todas las PC al mismo tiempo,
    // actualizamos la DB poniendo isCompleted en false.
    try {
        await sb.from('timers').update({ 
            isCompleted: false,
            isRunning: false,
            isPaused: true 
        }).eq('id', id);
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

let currentMode = 'duration';
const STUDY_PRESETS = {
    'PLR': { mode: 'duration', hours: 0, minutes: 20 },
    'CORTISOL': { mode: 'fixed', time: '08:00' },
    'ACTH': { mode: 'fixed', time: '08:00' },
    'CTM': { mode: 'fixed', time: '08:00' },
    'CTGN': { mode: 'duration', hours: 2, minutes: 0 },
    'H.PYLORI': { mode: 'duration', hours: 0, minutes: 20 }
};

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
        if (!elements.studyTypeInput.value || !STUDY_PRESETS[elements.studyTypeInput.value.toUpperCase()]) {
            elements.hoursInput.value = '00';
            elements.minutesInput.value = '00';
        }
    }
};

elements.studyTypeInput.addEventListener('input', (e) => {
    const val = e.target.value.toUpperCase();
    const preset = STUDY_PRESETS[val];
    if (preset) {
        const modeRadio = document.querySelector(`input[name="timer-mode"][value="${preset.mode}"]`);
        if (modeRadio && !modeRadio.checked) {
            modeRadio.checked = true;
            toggleTimerMode();
        }
        if (preset.mode === 'duration') {
            elements.hoursInput.value = String(preset.hours).padStart(2, '0');
            elements.minutesInput.value = String(preset.minutes).padStart(2, '0');
            elements.secondsInput.value = '00';
        } else if (preset.mode === 'fixed') {
            const [pHours, pMinutes] = preset.time.split(':').map(Number);
            elements.hoursInput.value = String(pHours).padStart(2, '0');
            elements.minutesInput.value = String(pMinutes).padStart(2, '0');
            elements.secondsInput.value = '00';
        }
    }
});

elements.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const patientName = elements.patientNameInput.value.trim();
    const studyType = elements.studyTypeInput.value.trim();
    const hours = parseInt(elements.hoursInput.value) || 0;
    const minutes = parseInt(elements.minutesInput.value) || 0;
    let seconds = parseInt(elements.secondsInput.value) || 0;
    let totalSeconds = 0;
    
    if (currentMode === 'fixed') {
        seconds = 0;
        const now = new Date();
        const targetDate = new Date();
        targetDate.setHours(hours, minutes, 0, 0);
        if (targetDate <= now) targetDate.setDate(targetDate.getDate() + 1);
        totalSeconds = Math.floor((targetDate - now) / 1000);
    } else {
        totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
    }

    if (patientName && studyType && totalSeconds > 0) {
        const targetTimeIso = new Date(Date.now() + (totalSeconds * 1000)).toISOString();
        const newTimerId = Date.now().toString();
        const newTimerData = {
            id: newTimerId,
            laboratorio_id: labId,
            patientName,
            studyType,
            totalSeconds,
            remainingSeconds: totalSeconds,
            targetTime: targetTimeIso,
            isRunning: true,
            isPaused: false,
            isCompleted: false
        };

        // Actualizar localmente al instante para el creador
        AppState.timers.push(newTimerData);
        renderTimers();

        await sb.from('timers').insert(newTimerData);

        // Insert log
        logHistoryLocally('CREADO', { laboratorio_id: labId, patientName, studyType });

        elements.patientNameInput.value = '';
        elements.studyTypeInput.value = '';
        elements.hoursInput.value = '00';
        elements.minutesInput.value = '00';
        elements.secondsInput.value = '00';
        elements.patientNameInput.focus();
    }
});

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
            // Establecer fechas por defecto
            const now = new Date();
            const todayStr = now.toISOString().split('T')[0];
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
        
        if (start) query = query.gte('timestamp', new Date(start).toISOString());
        if (end) {
            const endDate = new Date(end);
            endDate.setHours(23, 59, 59, 999);
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
        const headers = ["Fecha", "Hora", "Acción", "Paciente", "Estudio"];
        const rows = data.map(ev => {
            const date = new Date(ev.timestamp);
            return [
                date.toLocaleDateString(),
                date.toLocaleTimeString(),
                ev.action,
                ev.patientName,
                ev.studyType
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
                <span>${event.action}</span>
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
