// ==================== CONEXIÓN SUPABASE ====================
// Protección de ruta
const token = localStorage.getItem('sb-token');
const labId = localStorage.getItem('lab-id');

if (!token || !labId) {
    window.location.href = 'login.html';
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
    
    // (Omitimos subida de imagen logo por ahora ya que en Vercel necesitamos Supabase Storage)
    // Se recomienda hacerlo vía Supabase Storage posteriormente. Dejaremos este manejador sin efecto funcional complejo.
    const logoUpload = document.getElementById('logo-upload');
    if (logoUpload) {
        logoUpload.addEventListener('change', async (e) => {
            alert("En la versión Vercel, la subida de logos requiere configuración de Supabase Storage. Comunícate con soporte.");
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

// Alarma
function startContinuousAlarm(timerId) {
    if (AppState.activeAlarms[timerId]) return;
    const card = document.getElementById(`timer-${timerId}`);
    if (card) card.classList.add('alarm-active');

    const alarmInterval = setInterval(() => {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
        } catch (e) {}
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
    // Cargar Timers
    const { data: timersData } = await supabase
        .from('timers')
        .select('*')
        .eq('laboratorio_id', labId === 'super-admin' ? null : labId); // SuperAdmin puede ver todos ajustando filtro si es necesario, pero labId manda
    
    const { data: adminTimers } = await sb.from('timers').select('*');    

    if (labId === 'super-admin') {
        AppState.timers = adminTimers || [];
    } else {
        AppState.timers = timersData || [];
    }

    renderTimers();

    // Cargar Historial
    const { data: historyData } = await supabase
        .from('historial')
        .select('*')
        .eq('laboratorio_id', labId)
        .order('timestamp', { ascending: false })
        .limit(50);
    if (historyData) HistoryManager.loadList(historyData);

    // Suscribirse a cambios en DB REALTIME (Reemplazo Socket.io)
    sb.channel('timers_channel')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'timers', filter: labId !== 'super-admin' ? `laboratorio_id=eq.${labId}` : undefined }, payload => {
        if (payload.eventType === 'INSERT') {
            AppState.timers.push(payload.new);
            renderTimers();
        } else if (payload.eventType === 'UPDATE') {
            const idx = AppState.timers.findIndex(t => t.id === payload.new.id);
            if (idx !== -1) {
                const wasNotCompleted = !AppState.timers[idx].isCompleted;
                AppState.timers[idx] = payload.new;
                
                if (payload.new.isCompleted && wasNotCompleted) {
                    startContinuousAlarm(payload.new.id);
                    showNotification(payload.new);
                }
                updateTimerDisplay(payload.new.id);
            }
        } else if (payload.eventType === 'DELETE') {
            stopAlarm(payload.old.id);
            AppState.timers = AppState.timers.filter(t => t.id !== payload.old.id);
            renderTimers();
        }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'historial', filter: labId !== 'super-admin' ? `laboratorio_id=eq.${labId}` : undefined }, payload => {
        HistoryManager.addEvent(payload.new);
    })
    .subscribe();
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
        // Pausar
        await sb.from('timers').update({
            isRunning: false,
            isPaused: true,
            remainingSeconds: timer.remainingSeconds,
            targetTime: null
        }).eq('id', id);
        logHistoryLocally('PAUSADO', timer);
    } else {
        // Iniciar
        const targetTime = new Date(Date.now() + (timer.remainingSeconds * 1000)).toISOString();
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
    stopAlarm(id);
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
        await sb.from('timers').delete().eq('id', id);
        if(timer) logHistoryLocally('ELIMINADO', timer);
    }
};

window.handleStopAlarm = (id) => stopAlarm(id);

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
        
        await sb.from('timers').insert({
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
        });

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
    panel: document.getElementById('history-panel'),
    list: document.getElementById('history-list'),
    toggleBtn: document.getElementById('toggle-history-btn'),
    closeBtn: document.getElementById('close-history-btn'),

    init() {
        this.toggleBtn.addEventListener('click', () => this.togglePanel());
        this.closeBtn.addEventListener('click', () => this.togglePanel());
    },
    togglePanel() {
        this.panel.classList.toggle('hidden');
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
        window.location.href = 'login.html';
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
