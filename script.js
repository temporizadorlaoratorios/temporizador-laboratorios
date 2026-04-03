// ==================== CONEXIÓN SOCKET.IO ====================
// Protección de ruta
const token = localStorage.getItem('sb-token');
const labId = localStorage.getItem('lab-id');

if (!token || !labId) {
    window.location.href = 'login.html';
}

// Conectar con el servidor usando autenticación
const socket = io({
    auth: {
        token: token,
        labId: labId
    }
});

// Inicialización de Logo y Título
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

// Funciones para el Menú de Logo
function handleLogoClick(event) {
    if (event) {
        event.preventDefault();
        event.stopPropagation();
    }
    
    if (labId === 'super-admin') return; // Super admin no puede cambiar su logo aquí

    const logoImg = document.getElementById('app-logo');
    const logoMenu = document.getElementById('logo-options-menu');
    
    // Si no hay logo (está visible el placeholder de cargar), abrir dialogo de archivo directo
    if (logoImg.style.display === 'none') {
        document.getElementById('logo-upload').click();
    } else {
        // Si hay logo, alternar el menú
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

// Cerrar menú al hacer clic fuera
document.addEventListener('click', (e) => {
    const logoContainer = document.getElementById('logo-container');
    const logoMenu = document.getElementById('logo-options-menu');
    
    if (logoMenu && logoMenu.style.display === 'flex') {
        if (!logoContainer.contains(e.target)) {
            closeLogoMenu();
        }
    }
});

async function deleteLogo() {
    if (!confirm('¿Seguro que deseas eliminar el logo de tu laboratorio?')) return;

    try {
        const response = await fetch('/api/delete-logo', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labId: labId })
        });
        
        const data = await response.json();
        if (data.success) {
            localStorage.removeItem('lab-logo');
            initLabBranding(); // Volver a mostrar el placeholder
            alert('Logo eliminado correctamente');
        } else {
            alert('Error al eliminar logo: ' + data.error);
        }
    } catch (err) {
        console.error(err);
        alert('Error de conexión al eliminar logo');
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initLabBranding();
    
    // Actualizar contenedor principal visualmente si es super admin para no mostrar hover
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

            const reader = new FileReader();
            reader.onload = async (event) => {
                const base64 = event.target.result;
                try {
                    const response = await fetch('/api/upload-logo', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            labId: labId,
                            image: base64,
                            fileName: file.name
                        })
                    });
                    const data = await response.json();
                    if (data.success) {
                        const newLogoPath = `${data.logo}?v=${new Date().getTime()}`;
                        localStorage.setItem('lab-logo', newLogoPath);
                        initLabBranding();
                        alert('Logo actualizado correctamente');
                    } else {
                        alert('Error al subir logo: ' + data.error);
                    }
                } catch (err) {
                    console.error(err);
                    alert('Error de conexión al subir logo');
                }
            };
            reader.readAsDataURL(file);
        });
    }
});

// ==================== ESTADO GLOBAL ====================
const AppState = {
    timers: [],
    activeAlarms: {} // Para manejar alarmas activas por timer ID
};

// ==================== ELEMENTOS DEL DOM ====================
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
socket.on('error_limit', (msg) => {
    alert(msg);
    localStorage.clear();
    window.location.href = 'login.html';
});

function formatTime(totalSeconds) {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    if (hours > 0) {
        return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
    }
    return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

// Función para ajustar tiempo con flechas
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

// Función para presets rápidos
function setPreset(hours, minutes) {
    elements.hoursInput.value = String(hours).padStart(2, '0');
    elements.minutesInput.value = String(minutes).padStart(2, '0');
    elements.secondsInput.value = '00';
}

// Alarma continua mejorada
function startContinuousAlarm(timerId) {
    if (AppState.activeAlarms[timerId]) return; // Ya está sonando

    // Agregar clase visual al timer
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
        } catch (e) {
            console.log('Audio not supported');
        }
    }, 1500); // Repetir cada 1.5 segundos

    AppState.activeAlarms[timerId] = alarmInterval;
}

function stopAlarm(timerId) {
    if (AppState.activeAlarms[timerId]) {
        clearInterval(AppState.activeAlarms[timerId]);
        delete AppState.activeAlarms[timerId];

        // Quitar clase visual y botón
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

// ==================== SOCKET.IO EVENTOS ====================

socket.on('timersList', (timersList) => {
    AppState.timers = timersList;
    renderTimers();
});

socket.on('timerAdded', (timer) => {
    AppState.timers.push(timer);
    renderTimers();
});

socket.on('timerUpdate', (updatedTimer) => {
    const index = AppState.timers.findIndex(t => t.id === updatedTimer.id);
    if (index !== -1) {
        const wasNotCompleted = !AppState.timers[index].isCompleted;
        AppState.timers[index] = updatedTimer;

        if (updatedTimer.isCompleted && wasNotCompleted) {
            startContinuousAlarm(updatedTimer.id);
            showNotification(updatedTimer);
        }

        updateTimerDisplay(updatedTimer.id);
    }
});

socket.on('timerDeleted', (id) => {
    stopAlarm(id);
    AppState.timers = AppState.timers.filter(t => t.id !== id);
    renderTimers();
});

// ==================== RENDERIZADO ====================
function renderTimers() {
    const activeTimers = AppState.timers;

    // Limpiar siempre el grid primero
    const cards = elements.timersGrid.querySelectorAll('.timer-card-compact');
    cards.forEach(card => card.remove());

    if (activeTimers.length === 0) {
        elements.emptyState.classList.remove('hidden');
        return;
    } else {
        elements.emptyState.classList.add('hidden');
    }

    activeTimers.forEach(timer => {
        const card = createTimerCard(timer);
        elements.timersGrid.appendChild(card);
    });
}

function createTimerCard(timer) {
    const card = document.createElement('div');
    card.className = 'timer-card-compact';
    card.id = `timer-${timer.id}`;

    if (timer.isPaused) card.classList.add('paused');
    if (timer.isCompleted) card.classList.add('completed');
    if (AppState.activeAlarms[timer.id]) card.classList.add('alarm-active');

    // Asignar color según determinación
    const studyTypeUpper = (timer.studyType || '').toUpperCase();
    if (studyTypeUpper.includes('PLR')) card.classList.add('card-plr');
    else if (studyTypeUpper.includes('CTGN')) card.classList.add('card-ctgn');
    else if (studyTypeUpper.includes('CTM')) card.classList.add('card-ctm');
    else if (studyTypeUpper.includes('HPYLORI') || studyTypeUpper.includes('H.PYLORI') || studyTypeUpper.includes('H PYLORI')) card.classList.add('card-hpylori');

    const buttonText = timer.isCompleted ? 'Completado' : (timer.isRunning ? 'Pausar' : 'Iniciar');
    const buttonIcon = timer.isCompleted ? '✓' : (timer.isRunning ? '⏸' : '▶');

    // Botón detener alarma solo visible si está completado
    const showStopBtn = timer.isCompleted;
    const stopAlarmBtn = showStopBtn ? `
        <button 
            class="control-btn-compact control-btn-stop-compact" 
            onclick="handleStopAlarm(${timer.id})"
        >
            🔕 Detener Alarma
        </button>
    ` : '';

    card.innerHTML = `
        <div class="timer-header-compact">
            <div class="patient-name-compact">${escapeHtml(timer.patientName)}</div>
            <div class="study-type-compact">
                ${escapeHtml(timer.studyType)} 
                ${timer.targetTime ? `<span class="target-time-badge" title="Hora de alarma">🔔 ${timer.targetTime}</span>` : ''}
            </div>
        </div>
        
        <div class="timer-display-compact">
            <div class="timer-time-compact" data-timer-id="${timer.id}">
                ${formatTime(timer.remainingSeconds)}
            </div>
        </div>
        
        <div class="timer-controls-compact">
            <button 
                class="control-btn-compact control-btn-primary-compact" 
                onclick="toggleTimer(${timer.id})"
                ${timer.isCompleted ? 'disabled' : ''}
            >
                ${buttonIcon} ${buttonText}
            </button>
            <button 
                class="control-btn-compact control-btn-secondary-compact" 
                onclick="resetTimer(${timer.id})"
                title="Reiniciar"
            >
                ↻
            </button>
            <button 
                class="control-btn-compact control-btn-danger-compact" 
                onclick="deleteTimer(${timer.id})"
                title="Eliminar"
            >
                ×
            </button>
            ${stopAlarmBtn}
        </div>
    `;

    return card;
}

function updateTimerDisplay(timerId) {
    const strId = String(timerId);
    const timer = AppState.timers.find(t => t.id === strId);
    if (!timer) return;

    const card = document.getElementById(`timer-${strId}`);
    if (!card) return;

    const timeDisplay = card.querySelector(`.timer-time-compact[data-timer-id="${timerId}"]`);
    if (timeDisplay) {
        timeDisplay.textContent = formatTime(timer.remainingSeconds);
    }

    card.classList.toggle('paused', timer.isPaused);
    card.classList.toggle('completed', timer.isCompleted);

    const button = card.querySelector('.control-btn-primary-compact');
    if (button && !timer.isCompleted) {
        const buttonText = timer.isRunning ? 'Pausar' : 'Iniciar';
        const buttonIcon = timer.isRunning ? '⏸' : '▶';
        button.innerHTML = `${buttonIcon} ${buttonText}`;
        button.disabled = false;
    } else if (button && timer.isCompleted) {
        button.innerHTML = '✓ Completado';
        button.disabled = true;
    }

    // Manejar visibilidad del botón de detener alarma dinámicamente
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

// ==================== ACCIONES DE USUARIO ====================

function toggleTimer(id) {
    const strId = String(id);
    const timer = AppState.timers.find(t => t.id === strId);
    if (!timer) return;

    if (timer.isRunning) {
        socket.emit('stopTimer', strId);
    } else {
        socket.emit('startTimer', strId);
    }
}

function resetTimer(id) {
    const strId = String(id);
    stopAlarm(strId);
    socket.emit('resetTimer', strId);
}

function deleteTimer(id) {
    const strId = String(id);
    if (confirm('¿Eliminar este temporizador?')) {
        stopAlarm(strId);
        socket.emit('deleteTimer', strId);
    }
}

function handleStopAlarm(id) {
    stopAlarm(String(id));
}

// ==================== FORMULARIO ====================

// Formatear inputs a 2 dígitos
function formatInputValue(input) {
    let val = parseInt(input.value) || 0;
    input.value = String(val).padStart(2, '0');
}

[elements.hoursInput, elements.minutesInput, elements.secondsInput].forEach(input => {
    input.addEventListener('change', () => formatInputValue(input));
    input.addEventListener('blur', () => formatInputValue(input));
    // Formato inicial
    formatInputValue(input);
});

// ==================== MODO TEMPORIZADOR ====================
// ==================== MODO TEMPORIZADOR ====================
let currentMode = 'duration'; // 'duration' or 'fixed'

// Definición de Presets Inteligentes
const STUDY_PRESETS = {
    'PLR': { mode: 'duration', hours: 0, minutes: 20 },
    'CORTISOL': { mode: 'fixed', time: '08:00' },
    'ACTH': { mode: 'fixed', time: '08:00' },
    'CTM': { mode: 'fixed', time: '08:00' },
    'CTGN': { mode: 'duration', hours: 2, minutes: 0 },
    'H.PYLORI': { mode: 'duration', hours: 0, minutes: 20 } // Ejemplo
};

function clearForm() {
    elements.patientNameInput.value = '';
    elements.studyTypeInput.value = '';
    elements.hoursInput.value = '00';
    elements.minutesInput.value = '00';
    elements.secondsInput.value = '00';

    // Resetear a modo duración por defecto
    const durationRadio = document.querySelector('input[name="timer-mode"][value="duration"]');
    if (durationRadio) {
        durationRadio.checked = true;
        toggleTimerMode();
    }

    elements.patientNameInput.focus();
}

function toggleTimerMode() {
    const modes = document.getElementsByName('timer-mode');
    for (const mode of modes) {
        if (mode.checked) {
            currentMode = mode.value;
            break;
        }
    }

    const secondsWrapper = elements.secondsInput.closest('.time-control-wrapper');

    // Actualizar clases activas en botones
    document.querySelectorAll('.mode-option-btn').forEach(btn => {
        const input = btn.querySelector('input');
        if (input.checked) {
            btn.classList.add('active'); // Aunque :has(input:checked) lo maneja en CSS modernos, esto ayuda a compatibilidad o lógica extra
        } else {
            btn.classList.remove('active');
        }
    });

    if (currentMode === 'fixed') {
        // Modo Hora Fija
        if (secondsWrapper) secondsWrapper.style.display = 'none';

        // Solo setear hora actual si NO viene de un preset (o si está vacío/invalido el campo)
        // Pero para simplificar, si el usuario cambia manualmente a Hora Fija, ponemos la hora actual como default
        // Si viene del preset, los valores ya se habrán seteado antes de llamar a esta función o justo después.
        // Aquí validamos si ya tiene un valor lógico para no sobreescribir presets inmediatamente si se llama manual.

        // Estrategia: Esta función se llama al clickear los radio buttons.
        // Si es manual, ponemos hora actual.
        // Si es por preset, el preset seteará los valores.

        // Verificamos si la llamada fue manual (evento de usuario) o programática
        // Como es difícil saberlo aquí sin pasar params, asumimos comportamiento standard:
        // Si los inputs están en 00:00 (default de duration), ponemos hora actual.

        const h = parseInt(elements.hoursInput.value) || 0;
        const m = parseInt(elements.minutesInput.value) || 0;

        if (h === 0 && m === 0) {
            const now = new Date();
            elements.hoursInput.value = String(now.getHours()).padStart(2, '0');
            elements.minutesInput.value = String(now.getMinutes()).padStart(2, '0');
        }

    } else {
        // Modo Cuenta Regresiva
        if (secondsWrapper) secondsWrapper.style.display = 'flex';
        // No reseteamos a 00:00 forzosamente si ya tiene valores, para no borrar presets si el usuario cambia de modo accidentalmente?
        // Mejor comportamiento: Si cambiamos a duración, reseteamos a 00 para limpieza, salvo que sea preset.
        // Por ahora mantenemos comportamiento original de resetear a 00 si se cambia manualmente.
        if (!elements.studyTypeInput.value || !STUDY_PRESETS[elements.studyTypeInput.value.toUpperCase()]) {
            elements.hoursInput.value = '00';
            elements.minutesInput.value = '00';
        }
    }
}

// Listener para Presets
elements.studyTypeInput.addEventListener('input', (e) => {
    const val = e.target.value.toUpperCase();
    const preset = STUDY_PRESETS[val];

    if (preset) {
        // Aplicar Modo
        const modeRadio = document.querySelector(`input[name="timer-mode"][value="${preset.mode}"]`);
        if (modeRadio && !modeRadio.checked) {
            modeRadio.checked = true;
            toggleTimerMode(); // Actualizar UI del modo
        }

        // Aplicar Tiempos
        if (preset.mode === 'duration') {
            elements.hoursInput.value = String(preset.hours).padStart(2, '0');
            elements.minutesInput.value = String(preset.minutes).padStart(2, '0');
            elements.secondsInput.value = '00';
        } else if (preset.mode === 'fixed') {
            // Preset de Hora Fija (ej: "08:00")
            const [pHours, pMinutes] = preset.time.split(':').map(Number);
            elements.hoursInput.value = String(pHours).padStart(2, '0');
            elements.minutesInput.value = String(pMinutes).padStart(2, '0');
            elements.secondsInput.value = '00';
        }

        // Feedback visual temporal (opcional)
        elements.studyTypeInput.style.borderColor = 'var(--color-primary)';
        setTimeout(() => elements.studyTypeInput.style.borderColor = '', 500);
    }
});

elements.form.addEventListener('submit', (e) => {
    e.preventDefault();

    const patientName = elements.patientNameInput.value.trim();
    const studyType = elements.studyTypeInput.value.trim();
    const hours = parseInt(elements.hoursInput.value) || 0;
    const minutes = parseInt(elements.minutesInput.value) || 0;
    let seconds = parseInt(elements.secondsInput.value) || 0;

    let totalSeconds = 0;
    let targetTimeStr = null;

    if (currentMode === 'fixed') {
        seconds = 0; // Ignorar segundos en hora fija

        const now = new Date();
        const targetDate = new Date();
        targetDate.setHours(hours, minutes, 0, 0);

        // Si la hora ya pasó hoy, es para mañana
        if (targetDate <= now) {
            targetDate.setDate(targetDate.getDate() + 1);
        }

        const diffms = targetDate - now;
        totalSeconds = Math.floor(diffms / 1000);
        targetTimeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    } else {
        // Modo Duración
        totalSeconds = (hours * 3600) + (minutes * 60) + seconds;
    }

    if (patientName && studyType && totalSeconds > 0) {
        socket.emit('addTimer', {
            patientName,
            studyType,
            totalSeconds,
            targetTime: targetTimeStr
        });

        elements.patientNameInput.value = '';
        elements.studyTypeInput.value = '';

        // Reset steps
        if (currentMode === 'fixed') {
            const now = new Date();
            elements.hoursInput.value = String(now.getHours()).padStart(2, '0');
            elements.minutesInput.value = String(now.getMinutes()).padStart(2, '0');
        } else {
            elements.hoursInput.value = '00';
            elements.minutesInput.value = '00';
            elements.secondsInput.value = '00';
        }

        elements.patientNameInput.focus();
    } else {
        alert('Complete todos los campos y configure un tiempo válido');
    }
});

// Solicitar permiso de notificaciones
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// ==================== HISTORIAL DE EVENTOS ====================
const HistoryManager = {
    panel: document.getElementById('history-panel'),
    list: document.getElementById('history-list'),
    toggleBtn: document.getElementById('toggle-history-btn'),
    closeBtn: document.getElementById('close-history-btn'),
    exportBtn: document.getElementById('open-export-btn'),

    // Export Modal Elements
    modal: document.getElementById('export-modal'),
    closeModalBtn: document.getElementById('close-export-btn'),
    cancelExportBtn: document.getElementById('cancel-export-btn'),
    confirmExportBtn: document.getElementById('confirm-export-btn'),
    dateStart: document.getElementById('export-date-start'),
    dateEnd: document.getElementById('export-date-end'),
    chkAll: document.getElementById('chk-all'),
    chkEvents: document.querySelectorAll('.chk-event'),

    events: [], // Store raw events for export

    init() {
        this.toggleBtn.addEventListener('click', () => this.togglePanel());
        this.closeBtn.addEventListener('click', () => this.togglePanel());

        // Export handlers
        this.exportBtn.addEventListener('click', () => this.openExportModal());
        this.closeModalBtn.addEventListener('click', () => this.closeExportModal());
        this.cancelExportBtn.addEventListener('click', () => this.closeExportModal());
        this.confirmExportBtn.addEventListener('click', () => this.handleExport());

        // Checkbox logic
        this.chkAll.addEventListener('change', (e) => {
            if (e.target.checked) {
                // If All is checked, uncheck individual ones
                this.chkEvents.forEach(chk => chk.checked = false);
            }
        });

        this.chkEvents.forEach(chk => {
            chk.addEventListener('change', () => {
                // If any individual is checked, uncheck All
                if (chk.checked) {
                    this.chkAll.checked = false;
                }
            });
        });

        // Set default dates to TODAY
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        this.dateStart.value = todayStr;
        this.dateEnd.value = todayStr;
    },

    togglePanel() {
        this.panel.classList.toggle('visible');
        this.panel.classList.toggle('hidden');
    },

    openExportModal() {
        // Reset defaults when opening
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;

        this.dateStart.value = todayStr;
        this.dateEnd.value = todayStr;

        this.chkAll.checked = true;
        this.chkEvents.forEach(chk => chk.checked = false);

        this.modal.classList.remove('hidden');
    },

    closeExportModal() {
        this.modal.classList.add('hidden');
    },

    handleExport() {
        // Parse dates as LOCAL time start/end of day
        if (!this.dateStart.value || !this.dateEnd.value) {
            alert('Por favor selecciona un rango de fechas válido.');
            return;
        }

        const startDate = new Date(this.dateStart.value + 'T00:00:00');
        const endDate = new Date(this.dateEnd.value + 'T23:59:59.999');

        const includeAll = this.chkAll.checked;
        const selectedTypes = Array.from(this.chkEvents)
            .filter(chk => chk.checked)
            .map(chk => chk.value);

        if (!includeAll && selectedTypes.length === 0) {
            alert('Por favor selecciona al menos un tipo de evento o "Todos".');
            return;
        }

        const filteredEvents = this.events.filter(event => {
            const eventDate = new Date(event.timestamp);
            const isWithinDate = eventDate >= startDate && eventDate <= endDate;

            // Logic: If "Todos" is checked, accept all types. 
            // Else, check if action is in selectedTypes
            const isTypeSelected = includeAll || selectedTypes.includes(event.action);

            return isWithinDate && isTypeSelected;
        });

        if (filteredEvents.length === 0) {
            alert('No hay eventos que coincidan con los filtros seleccionados.');
            return;
        }

        this.downloadCSV(filteredEvents);
        this.closeExportModal();
    },

    downloadCSV(events) {
        // BOM for Excel to recognize UTF-8
        const BOM = '\uFEFF';
        const headers = ['Fecha', 'Hora', 'Accion', 'Nombre', 'Determinacion'];

        const rows = events.map(e => {
            const d = new Date(e.timestamp);
            const date = d.toLocaleDateString();
            const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });

            // Escape quotes for CSV
            const escape = (text) => `"${(text || '').replace(/"/g, '""')}"`;

            return [
                escape(date),
                escape(time),
                escape(e.action),
                escape(e.patientName),
                escape(e.studyType)
            ].join(';');
        });

        const csvContent = BOM + headers.join(';') + '\n' + rows.join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');

        const timestamp = new Date().toISOString().slice(0, 10);
        link.setAttribute('href', url);
        link.setAttribute('download', `historial_timer_${timestamp}.csv`);
        link.style.visibility = 'hidden';

        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    },

    renderItem(event) {
        const li = document.createElement('li');
        const actionClass = `action-${event.action.toLowerCase()}`;
        li.className = `history-item ${actionClass}`;

        const date = new Date(event.timestamp);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        const dateStr = date.toLocaleDateString();

        let icon = '•';
        switch (event.action) {
            case 'CREADO': icon = '➕'; break;
            case 'INICIADO': icon = '▶️'; break;
            case 'PAUSADO': icon = '⏸️'; break;
            case 'REINICIADO': icon = '🔄'; break;
            case 'ELIMINADO': icon = '🗑️'; break;
            case 'COMPLETADO': icon = '🏁'; break;
        }

        li.innerHTML = `
            <div class="history-item-header">
                <span>${icon} ${event.action}</span>
                <span>${dateStr} ${timeStr}</span>
            </div>
            <div class="history-item-content">
                ${escapeHtml(event.patientName)}
            </div>
            <div class="history-item-details">
                ${escapeHtml(event.studyType)}
            </div>
        `;
        return li;
    },

    addEvent(event) {
        this.events.unshift(event); // Add to local storage
        const item = this.renderItem(event);
        this.list.insertBefore(item, this.list.firstChild);
    },

    loadList(events) {
        this.events = events; // Store events
        this.list.innerHTML = '';
        events.forEach(event => {
            const item = this.renderItem(event);
            this.list.appendChild(item);
        });
    }
};

HistoryManager.init();

// Escuchar actualizaciones del historial
socket.on('historyList', (events) => {
    HistoryManager.loadList(events);
});

socket.on('historyUpdate', (event) => {
    HistoryManager.addEvent(event);
});

console.log('✅ Cliente de temporizadores conectado al servidor');

// ==================== CERRAR SESIÓN ====================
function logout() {
    if (confirm('¿Estás seguro que deseas cerrar sesión?')) {
        localStorage.clear();
        window.location.href = 'login.html';
    }
}

// ==================== MENÚ DE OPCIONES Y CONTRASEÑA ====================
function toggleOptionsMenu(e) {
    if (e) e.stopPropagation();
    const dropdown = document.getElementById('options-dropdown');
    if (dropdown) {
        dropdown.style.display = dropdown.style.display === 'none' ? 'block' : 'none';
    }
}

document.addEventListener('click', (e) => {
    const wrapper = document.querySelector('.options-wrapper');
    const dropdown = document.getElementById('options-dropdown');
    if (wrapper && !wrapper.contains(e.target) && dropdown) {
        dropdown.style.display = 'none';
    }
});

const eyeSvgCode = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/>
        <circle cx="12" cy="12" r="3"/>
    </svg>
`;
const eyeSlashSvgCode = `
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/>
        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/>
        <path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/>
        <line x1="2" x2="22" y1="2" y2="22"/>
    </svg>
`;

function togglePassVisibility(inputId, btnEl) {
    const passwordInput = document.getElementById(inputId);
    if (!passwordInput) return;
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        btnEl.innerHTML = eyeSlashSvgCode;
    } else {
        passwordInput.type = 'password';
        btnEl.innerHTML = eyeSvgCode;
    }
}

function openChangePasswordModal() {
    const dropdown = document.getElementById('options-dropdown');
    if (dropdown) dropdown.style.display = 'none';
    
    document.getElementById('modal-change-password').style.display = 'flex';
    
    const oldPassInput = document.getElementById('lab-old-password');
    const newPassInput = document.getElementById('lab-new-password');
    const oldToggleBtn = document.getElementById('toggle-lab-old-pass-btn');
    const newToggleBtn = document.getElementById('toggle-lab-pass-btn');

    if(oldPassInput && oldToggleBtn) {
        oldPassInput.value = '';
        oldPassInput.type = 'password';
        oldToggleBtn.innerHTML = eyeSvgCode;
    }
    
    if(newPassInput && newToggleBtn) {
        newPassInput.value = '';
        newPassInput.type = 'password';
        newToggleBtn.innerHTML = eyeSvgCode;
    }
}

function closeChangePasswordModal() {
    document.getElementById('modal-change-password').style.display = 'none';
}

const changePasswordForm = document.getElementById('change-password-form');
if (changePasswordForm) {
    changePasswordForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const oldPassword = document.getElementById('lab-old-password').value;
        const newPassword = document.getElementById('lab-new-password').value;
        if(confirm('¿Estás seguro de que deseas cambiar tu contraseña? La próxima vez deberás iniciar con esta nueva clave.')) {
            socket.emit('change_own_password', { oldPassword, newPassword });
        }
    });
}

socket.on('password_change_success', (msg) => {
    alert(msg);
    closeChangePasswordModal();
});

socket.on('password_change_error', (msg) => {
    alert("Error: " + msg);
});
