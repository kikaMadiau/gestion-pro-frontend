// security-dashboard.js — liste des visites pour le poste sécurité (/security)

const SECURITY_API = {
  dashboardVisits: 'http://127.0.0.1:8000/api/audiences/dashboard/security',
  baseUrl: 'http://127.0.0.1:8000',
};

function toAudienceCheckinPathId(rawId) {
  if (!rawId) return '';
  const s = String(rawId).trim();
  if (/^0x[0-9a-fA-F]+$/i.test(s)) return s;
  const hex = s.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/i.test(hex)) return `0x${hex.toUpperCase()}`;
  return encodeURIComponent(s);
}

function audienceCheckinUrl(audienceId) {
  return `${SECURITY_API.baseUrl}/audiences/${toAudienceCheckinPathId(audienceId)}/checkin`;
}

/** Flux « Compléter formulaire » → POST multipart /audiences/…/checkin */
let visitorPhotoBlob = null;
let identityPhotoBlob = null;
let captureTarget = null;

function getSecurityCheckinVisitId() {
  return document.getElementById('security-checkin-visit-id')?.value?.trim() || '';
}

function hasSecurityPageAccess() {
  if (typeof window.isSecurityUser === 'function') return window.isSecurityUser();
  if (typeof window.readStoredRoles !== 'function') return false;
  const roles = window.readStoredRoles();
  return (
    Array.isArray(roles) &&
    roles.some((r) => (r || '').toString().toUpperCase().includes('SECURITY'))
  );
}

function showSecurityAccessDenied() {
  const tbody = document.getElementById('security-visits-tbody');
  if (tbody) {
    tbody.innerHTML =
      '<tr><td colspan="11" class="text-center text-danger py-4">Accès refusé — rôle sécurité requis.</td></tr>';
  }
}

function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  } catch {
    return '—';
  }
}

function extractNames(fullName) {
  if (!fullName) return { firstName: '—', lastName: '—' };
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '—', lastName: '—' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

function getPriorityBadge(status) {
  const statusMap = {
    REGISTERED: { label: 'Enregistré', color: 'bg-info' },
    PENDING: { label: 'En attente', color: 'bg-warning text-dark' },
    CONFIRMED: { label: 'Confirmé', color: 'bg-success' },
    VERIFIED: { label: 'Vérifié', color: 'bg-success' },
    CHECKED: { label: 'Contrôlé', color: 'bg-primary' },
    APPROVED: { label: 'Approuvé', color: 'bg-success' },
    DELAYED: { label: 'Retardé', color: 'bg-danger' },
    COMPLETED: { label: 'Complété', color: 'bg-success' },
    CANCELLED: { label: 'Annulé', color: 'bg-secondary text-dark' },
  };
  const config = statusMap[status] || { label: status || 'Inconnu', color: 'bg-secondary' };
  return `<span class="badge ${config.color}">${config.label}</span>`;
}

function escapeHtml(text) {
  if (!text) return '—';
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(text).replace(/[&<>"']/g, (m) => map[m]);
}

function renderSecurityVisitRow(visit, index) {
  const { firstName, lastName } = extractNames(visit.visitor_name);
  const scheduledDate = formatDate(visit.scheduled_at);
  const statusBadge = getPriorityBadge(visit.status);
  const email = escapeHtml(visit.employee || visit.employee_email || '—');
  const phone = escapeHtml(visit.visitor_phone || visit.phone || '—');
  const avatarIndex = (index % 8) + 1;
  const vid = escapeHtml(String(visit.id || ''));

  return `
    <tr data-visit-id="${vid}">
      <td class="col-auto">
        <div class="avatar avatar-md">
          <img src="/public/images/faces/${avatarIndex}.jpg" alt="Avatar">
        </div>
      </td>
      <td class="col-auto"><p class="mb-0">${escapeHtml(firstName)}</p></td>
      <td class="col-auto"><p class="mb-0">${escapeHtml(lastName)}</p></td>
      <td class="col-auto"><p class="mb-0">${email}</p></td>
      <td class="col-auto"><p class="mb-0">${phone}</p></td>
      <td class="col-auto"><p class="mb-0 text-center">${scheduledDate}</p></td>
      <td class="col-auto text-center">${statusBadge}</td>
      <td class="col-auto"><p class="mb-0">—</p></td>
      <td class="col-auto"><p class="mb-0">—</p></td>
      <td class="col-auto"><p class="mb-0">—</p></td>
      <td class="col-auto text-center action-button-custom">
        <div class="dropdown">
          <button class="btn btn-outline-primary dropdown-toggle me-1" type="button" id="secDropdown_${vid}" data-bs-toggle="dropdown" aria-expanded="false">
            Actions <i class="bi bi-caret-down-fill"></i>
          </button>
          <div class="dropdown-menu" aria-labelledby="secDropdown_${vid}">
            <a class="dropdown-item security-complete-form-btn" href="#" data-visit-id="${vid}"><i class="bi bi-pencil-square"></i> Compléter formulaire</a>
            <a class="dropdown-item" href="#" data-bs-toggle="modal" data-bs-target="#validation-security-modal" data-visit-id="${vid}"><i class="bi bi-check-circle"></i> Valider Sécurité</a>
          </div>
        </div>
      </td>
    </tr>
  `;
}

async function loadSecurityVisits() {
  if (!hasSecurityPageAccess()) {
    showSecurityAccessDenied();
    return;
  }

  const token = localStorage.getItem('authToken');
  if (!token) {
    showSecurityAccessDenied();
    return;
  }

  const tbody = document.getElementById('security-visits-tbody');
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="11" class="text-center py-4"><div class="spinner-border text-primary"></div><br>Chargement…</td></tr>';

  try {
    const response = await fetch(SECURITY_API.dashboardVisits, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      tbody.innerHTML =
        '<tr><td colspan="11" class="text-center text-danger py-4">Session expirée. Reconnectez-vous.</td></tr>';
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const data = await response.json();
    const visits = data.data || data.audiences || [];

    if (!Array.isArray(visits) || visits.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="11" class="text-center text-muted py-4">Aucune visite pour ce poste.</td></tr>';
      return;
    }

    tbody.innerHTML = visits.map((v, i) => renderSecurityVisitRow(v, i)).join('');
  } catch (e) {
    console.error(e);
    tbody.innerHTML =
      '<tr><td colspan="11" class="text-center text-danger py-4">Erreur lors du chargement des données.</td></tr>';
  }
}

function resetSecurityCheckinState() {
  visitorPhotoBlob = null;
  identityPhotoBlob = null;
  captureTarget = null;
  const pv = document.getElementById('security-checkin-preview-visitor');
  const pi = document.getElementById('security-checkin-preview-identity');
  const plv = document.getElementById('security-checkin-placeholder-visitor');
  const pli = document.getElementById('security-checkin-placeholder-identity');
  if (pv) {
    if (pv.src && pv.src.startsWith('blob:')) URL.revokeObjectURL(pv.src);
    pv.src = '';
    pv.classList.add('d-none');
  }
  if (pi) {
    if (pi.src && pi.src.startsWith('blob:')) URL.revokeObjectURL(pi.src);
    pi.src = '';
    pi.classList.add('d-none');
  }
  if (plv) plv.classList.remove('d-none');
  if (pli) pli.classList.remove('d-none');
  const err = document.getElementById('security-checkin-error');
  if (err) {
    err.textContent = '';
    err.classList.add('d-none');
  }
  const sub = document.getElementById('security-checkin-submit');
  if (sub) sub.disabled = true;
}

function updateSecurityCheckinPreviews() {
  const pv = document.getElementById('security-checkin-preview-visitor');
  const plv = document.getElementById('security-checkin-placeholder-visitor');
  if (pv && visitorPhotoBlob) {
    if (pv.src && pv.src.startsWith('blob:')) URL.revokeObjectURL(pv.src);
    pv.src = URL.createObjectURL(visitorPhotoBlob);
    pv.classList.remove('d-none');
    plv?.classList.add('d-none');
  }
  const pi = document.getElementById('security-checkin-preview-identity');
  const pli = document.getElementById('security-checkin-placeholder-identity');
  if (pi && identityPhotoBlob) {
    if (pi.src && pi.src.startsWith('blob:')) URL.revokeObjectURL(pi.src);
    pi.src = URL.createObjectURL(identityPhotoBlob);
    pi.classList.remove('d-none');
    pli?.classList.add('d-none');
  }
  const sub = document.getElementById('security-checkin-submit');
  if (sub) sub.disabled = !(visitorPhotoBlob && identityPhotoBlob);
}

function openSecurityCheckinModal(visitId) {
  const modalEl = document.getElementById('security-checkin-modal');
  const hidden = document.getElementById('security-checkin-visit-id');
  if (!modalEl || !hidden || typeof bootstrap === 'undefined') return;
  resetSecurityCheckinState();
  hidden.value = visitId || '';
  bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

async function submitSecurityCheckin() {
  const errEl = document.getElementById('security-checkin-error');
  const sub = document.getElementById('security-checkin-submit');
  const visitId = document.getElementById('security-checkin-visit-id')?.value;
  if (!visitId || !visitorPhotoBlob || !identityPhotoBlob) {
    if (errEl) {
      errEl.textContent = 'Les deux photos sont requises.';
      errEl.classList.remove('d-none');
    }
    return;
  }
  const token = localStorage.getItem('authToken');
  if (!token) {
    if (errEl) {
      errEl.textContent = 'Session expirée.';
      errEl.classList.remove('d-none');
    }
    return;
  }
  if (errEl) errEl.classList.add('d-none');
  if (sub) sub.disabled = true;

  const fd = new FormData();
  fd.append('visitor_photo', visitorPhotoBlob, 'visitor.jpg');
  fd.append('identity_document_photo', identityPhotoBlob, 'identity.png');

  try {
    const res = await fetch(audienceCheckinUrl(visitId), {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: fd,
    });
    let data = {};
    try {
      data = await res.json();
    } catch (_) {}
    if (res.ok) {
      alert(data.message || 'Photos enregistrées avec succès.');
      const hid = document.getElementById('security-checkin-visit-id');
      if (hid) hid.value = '';
      bootstrap.Modal.getInstance(document.getElementById('security-checkin-modal'))?.hide();
      loadSecurityVisits();
    } else {
      const msg = data.message || data.detail || `Erreur (${res.status})`;
      if (errEl) {
        errEl.textContent = msg;
        errEl.classList.remove('d-none');
      } else {
        alert(msg);
      }
    }
  } catch (e) {
    console.error(e);
    if (errEl) {
      errEl.textContent = 'Erreur réseau ou serveur.';
      errEl.classList.remove('d-none');
    } else {
      alert('Erreur réseau ou serveur.');
    }
  } finally {
    if (sub) sub.disabled = !(visitorPhotoBlob && identityPhotoBlob);
  }
}

function wireSecurityCheckinUi() {
  const checkinModal = document.getElementById('security-checkin-modal');
  if (!checkinModal || window.__securityCheckinUiWired) return;
  window.__securityCheckinUiWired = true;

  document.body.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.security-complete-form-btn');
    if (!btn || !document.getElementById('security-checkin-modal')) return;
    e.preventDefault();
    const visitId = btn.getAttribute('data-visit-id');
    if (!visitId) return;
    openSecurityCheckinModal(visitId);
  });

  document.getElementById('security-checkin-open-visitor')?.addEventListener('click', () => {
    if (!getSecurityCheckinVisitId()) return;
    captureTarget = 'visitor';
    const m = document.getElementById('photo-capture-modal');
    if (m && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(m).show();
  });

  document.getElementById('security-checkin-open-identity')?.addEventListener('click', () => {
    if (!getSecurityCheckinVisitId()) return;
    captureTarget = 'identity';
    const m = document.getElementById('id-scan-modal');
    if (m && typeof bootstrap !== 'undefined') bootstrap.Modal.getOrCreateInstance(m).show();
  });

  document.getElementById('security-checkin-submit')?.addEventListener('click', () => {
    submitSecurityCheckin();
  });

  const saveBtn = document.getElementById('saveBtn');
  saveBtn?.addEventListener('click', () => {
    setTimeout(() => {
      if (!getSecurityCheckinVisitId() || captureTarget !== 'visitor') return;
      const canvas = document.getElementById('canvas');
      if (!canvas || canvas.classList.contains('d-none')) return;
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          visitorPhotoBlob = blob;
          updateSecurityCheckinPreviews();
          bootstrap.Modal.getInstance(document.getElementById('photo-capture-modal'))?.hide();
          captureTarget = null;
          bootstrap.Modal.getOrCreateInstance(document.getElementById('security-checkin-modal')).show();
        },
        'image/jpeg',
        0.92
      );
    }, 0);
  });

  const docSave = document.getElementById('docSave');
  if (docSave) docSave.onclick = null;
  docSave?.addEventListener('click', () => {
    setTimeout(() => {
      if (!getSecurityCheckinVisitId() || captureTarget !== 'identity') return;
      const canvas = document.getElementById('scannerCanvas');
      if (!canvas || canvas.classList.contains('d-none')) return;
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          identityPhotoBlob = blob;
          updateSecurityCheckinPreviews();
          bootstrap.Modal.getInstance(document.getElementById('id-scan-modal'))?.hide();
          captureTarget = null;
          bootstrap.Modal.getOrCreateInstance(document.getElementById('security-checkin-modal')).show();
        },
        'image/png',
        0.92
      );
    }, 0);
  });

  checkinModal.addEventListener('hidden.bs.modal', () => {
    captureTarget = null;
  });
}

function initSecurityDashboard() {
  if (!hasSecurityPageAccess()) {
    showSecurityAccessDenied();
    return;
  }
  wireSecurityCheckinUi();
  loadSecurityVisits();
  setInterval(loadSecurityVisits, 30000);
  window.addEventListener('currentUserProfileUpdated', () => {
    if (hasSecurityPageAccess()) loadSecurityVisits();
    else showSecurityAccessDenied();
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => setTimeout(initSecurityDashboard, 500));
} else {
  setTimeout(initSecurityDashboard, 500);
}

window.debugSecurityDashboard = {
  loadSecurityVisits,
  hasSecurityPageAccess,
  audienceCheckinUrl,
  toAudienceCheckinPathId,
};
