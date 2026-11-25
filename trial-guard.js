// ==================== CONTROL AISLADO DE PRUEBA DE 30 DÍAS ====================
// Nota: Este módulo NO modifica ni interfiere con script.js ni con los cronómetros.
// Para cuentas permanentes (como INDABI) no existe fila plan-meta-* y sale de inmediato.
(function () {
    try {
        const currentLabId = localStorage.getItem('lab-id');
        if (!currentLabId || currentLabId === 'super-admin') return;

        const client = (typeof sb !== 'undefined' && sb)
            ? sb
            : (window.supabase ? window.supabase.createClient(
                'https://qhjrqfrsphctbdjubxpv.supabase.co',
                'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFoanJxZnJzcGhjdGJkanVieHB2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUyMjg5NzAsImV4cCI6MjA5MDgwNDk3MH0.fLF8SGXXE7BdbdzUHo7GiBM58BbZkUN89N8Cl1KnEHk'
            ) : null);

        if (!client) return;

        function buildUpgradeUrl(baseUrl, labName, email) {
            const fallback = baseUrl || 'http://localhost:3010/#planes';
            try {
                const hashIdx = fallback.indexOf('#');
                const clean = hashIdx > -1 ? fallback.slice(0, hashIdx) : fallback;
                const hash = hashIdx > -1 ? fallback.slice(hashIdx) : '#planes';
                const u = new URL(clean);
                if (labName) u.searchParams.set('upgrade_lab', labName);
                if (email) u.searchParams.set('upgrade_email', email);
                return u.toString() + hash;
            } catch (e) {
                return fallback;
            }
        }

        function renderTrialBanner(daysLeft, upgradeHref) {
            let bar = document.getElementById('bendark-trial-top-bar');
            if (!bar) {
                bar = document.createElement('div');
                bar.id = 'bendark-trial-top-bar';
                bar.style.cssText = 'width:100%;background:linear-gradient(90deg,rgba(15,23,42,0.96),rgba(8,51,68,0.96));border-bottom:1px solid rgba(34,211,238,0.35);color:#e2e8f0;font-family:Inter,sans-serif;font-size:12px;padding:7px 14px;display:flex;flex-wrap:wrap;align-items:center;justify-content:center;gap:10px;z-index:2500;position:relative;box-sizing:border-box;';
                document.body.insertBefore(bar, document.body.firstChild);
            }
            const urgencyColor = daysLeft <= 5 ? '#fbbf24' : '#67e8f9';
            const dayWord = daysLeft === 1 ? 'día restante' : 'días restantes';
            bar.innerHTML = `
                <span>🎁 <strong style="color:${urgencyColor};">Prueba Gratuita:</strong> ${daysLeft} ${dayWord}</span>
                <a href="${upgradeHref}" target="_blank" rel="noreferrer" style="padding:4px 11px;border-radius:999px;background:linear-gradient(90deg,#0891b2,#0d9488);color:#fff;font-weight:700;font-size:11px;text-decoration:none;">
                    💳 Adquirir Plan Definitivo (mismo usuario) →
                </a>
            `;
        }

        function renderExpiredOverlay(labName, email, upgradeHref, waHref) {
            if (document.getElementById('bendark-trial-expired-overlay')) return;
            const overlay = document.createElement('div');
            overlay.id = 'bendark-trial-expired-overlay';
            overlay.style.cssText = 'position:fixed;inset:0;background:rgba(5,10,20,0.97);backdrop-filter:blur(12px);z-index:100001;display:flex;align-items:center;justify-content:center;padding:20px;box-sizing:border-box;font-family:Inter,sans-serif;';
            overlay.innerHTML = `
                <div style="background:#141629;border:1px solid rgba(34,211,238,0.4);border-radius:18px;max-width:440px;width:100%;padding:32px 26px;text-align:center;box-shadow:0 20px 60px rgba(0,0,0,0.85);">
                    <div style="display:inline-block;padding:6px 14px;border-radius:999px;background:rgba(239,68,68,0.15);border:1px solid rgba(239,68,68,0.4);color:#fca5a5;font-size:12px;font-weight:700;margin-bottom:14px;text-transform:uppercase;">
                        ⏳ Prueba de 30 Días Finalizada
                    </div>
                    <h2 style="color:#ffffff;font-size:22px;margin:0 0 10px 0;font-weight:800;">
                        Activá tu Suscripción Permanente
                    </h2>
                    <p style="color:#cbd5e1;font-size:14px;line-height:1.55;margin:0 0 16px 0;">
                        El período gratuito para <strong>${labName}</strong> ${email ? `(<span style="font-family:monospace;color:#67e8f9;">${email}</span>)` : ''} finalizó.
                        Tu usuario, tiempos predefinidos e historial siguen guardados.
                    </p>
                    <a href="${upgradeHref}" style="display:block;width:100%;padding:14px;border-radius:10px;background:linear-gradient(90deg,#0891b2,#0d9488);color:#ffffff;font-weight:700;font-size:15px;text-decoration:none;box-sizing:border-box;margin-bottom:10px;">
                        💳 Ir a Planes y Pagos para Abonar →
                    </a>
                    <a href="${waHref}" target="_blank" rel="noreferrer" style="display:block;width:100%;padding:11px;border-radius:10px;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);color:#e2e8f0;font-weight:600;font-size:13px;text-decoration:none;box-sizing:border-box;margin-bottom:14px;">
                        💬 Ya aboné / Enviar comprobante por WhatsApp
                    </a>
                    <button type="button" id="bendark-expired-logout-btn" style="background:none;border:none;color:#94a3b8;font-size:12px;text-decoration:underline;cursor:pointer;">
                        Cerrar sesión y volver al login
                    </button>
                </div>
            `;
            document.body.appendChild(overlay);
            const outBtn = document.getElementById('bendark-expired-logout-btn');
            if (outBtn) {
                outBtn.onclick = function () {
                    if (typeof logout === 'function') {
                        logout();
                    } else {
                        localStorage.removeItem('sb-token');
                        localStorage.removeItem('lab-id');
                        window.location.href = 'login.html';
                    }
                };
            }
        }

        async function checkTrialState() {
            try {
                const { data: rows } = await client
                    .from('laboratorios')
                    .select('id, logo')
                    .in('id', [`plan-meta-${currentLabId}`, 'bendark-billing-config']);

                if (!rows || rows.length === 0) return;

                const metaRow = rows.find(r => r.id === `plan-meta-${currentLabId}`);
                if (!metaRow || !metaRow.logo) return; // Laboratorio permanente (ej: INDABI): no tocar nada

                const cfgRow = rows.find(r => r.id === 'bendark-billing-config');
                let globalCfg = { planesUrl: 'http://localhost:3010/#planes', whatsappNumber: '5491100000000' };
                if (cfgRow && cfgRow.logo) {
                    try { globalCfg = { ...globalCfg, ...JSON.parse(cfgRow.logo) }; } catch (e) {}
                }

                const meta = JSON.parse(metaRow.logo);
                if (meta.planType !== 'trial' || !meta.trialEndsAt) {
                    const oldBar = document.getElementById('bendark-trial-top-bar');
                    if (oldBar) oldBar.remove();
                    const oldOv = document.getElementById('bendark-trial-expired-overlay');
                    if (oldOv) oldOv.remove();
                    return;
                }

                const labName = localStorage.getItem('lab-nombre') || 'tu laboratorio';
                const email = meta.email || localStorage.getItem('lab-email') || '';
                const basePlanesUrl = globalCfg.planesUrl || meta.planesUrl || 'http://localhost:3010/#planes';
                const upgradeHref = buildUpgradeUrl(basePlanesUrl, labName, email);
                const waMsg = `Hola BENDARK, quiero activar el plan definitivo del Temporizador Sincronizado manteniendo mi usuario (${labName} - ${email}).`;
                const waHref = `https://wa.me/${globalCfg.whatsappNumber}?text=${encodeURIComponent(waMsg)}`;

                const remainingMs = new Date(meta.trialEndsAt).getTime() - Date.now();
                if (remainingMs <= 0) {
                    renderExpiredOverlay(labName, email, upgradeHref, waHref);
                } else {
                    const daysLeft = Math.max(1, Math.ceil(remainingMs / (24 * 60 * 60 * 1000)));
                    renderTrialBanner(daysLeft, upgradeHref);
                }
            } catch (e) {
                // Silencioso para no afectar jamás el uso normal
            }
        }

        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', checkTrialState);
        } else {
            checkTrialState();
        }
        // Re-chequear cada 30 minutos por si la pestaña queda abierta varios días
        setInterval(checkTrialState, 30 * 60 * 1000);
    } catch (err) {}
})();
