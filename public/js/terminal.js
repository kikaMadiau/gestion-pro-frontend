// terminal.js - Gestion des visites du jour pour le terminal de réception

const TERMINAL_API = {
  todayVisits: 'http://127.0.0.1:8000/api/audiences/dashboard/today',
  receptionVisits: 'http://127.0.0.1:8000/api/audiences/dashboard/reception',
  baseUrl: 'http://127.0.0.1:8000',
};

/** Dernières visites chargées (pour préremplir le modal « Compléter formulaire »). */
let cachedTodayVisits = [];

/**
 * Identifiant audience dans l’URL de mise à jour : 0x + UUID sans tirets (ex. 0xAD4E54E5…).
 */
function toAudienceUpdatePathId(rawId) {
  if (!rawId) return '';
  const s = String(rawId).trim();
  if (/^0x[0-9a-fA-F]+$/i.test(s)) return s;
  const hex = s.replace(/-/g, '');
  if (/^[0-9a-fA-F]{32}$/i.test(hex)) return `0x${hex.toUpperCase()}`;
  return encodeURIComponent(s);
}

function audienceUpdateUrl(audienceId) {
  return `${TERMINAL_API.baseUrl}/audiences/${toAudienceUpdatePathId(audienceId)}/update`;
}

function audienceVerifyUrl(audienceId) {
  return `${TERMINAL_API.baseUrl}/audiences/${toAudienceUpdatePathId(audienceId)}/verify`;
}

const ALLOWED_TERMINAL_ROLES = ['ROLE_RECEPTION', 'ROLE_TERMINAL'];

/** Chaîne comparable pour un rôle (string ou objet API / Symfony). */
function roleToComparableString(role) {
  if (role == null) return '';
  if (typeof role === 'string') return role.trim().toUpperCase();
  if (typeof role === 'object') {
    const s =
      role.authority ??
      role.name ??
      role.role ??
      role.key ??
      role.direction ??
      '';
    return String(s).trim().toUpperCase();
  }
  return String(role).trim().toUpperCase();
}

/** Réception / accueil : seuls ces profils appellent « Valider l'entrée » → /verify. */
function roleAllowsReceptionValidateEntry(role) {
  const r = roleToComparableString(role);
  if (!r) return false;
  return r.includes('RECEPTION') || r.includes('ACCUEIL');
}

function canReceptionValidateEntry() {
  return readRolesWithFallback().some(roleAllowsReceptionValidateEntry);
}

/** Rôles bruts (session / profil) pour décisions UI terminal. */
function readRolesWithFallback() {
  let roles = [];
  if (typeof window.readStoredRoles === 'function') {
    roles = window.readStoredRoles() || [];
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    const sessionRoles = sessionStorage.getItem('currentUserRoles');
    if (sessionRoles) {
      try {
        roles = JSON.parse(sessionRoles);
      } catch (_) {
        roles = [];
      }
    }
  }
  if (!Array.isArray(roles) || roles.length === 0) {
    const profileJson = localStorage.getItem('currentUserProfile');
    if (profileJson) {
      try {
        const profile = JSON.parse(profileJson);
        roles = profile.roles || [];
      } catch (_) {
        roles = [];
      }
    }
  }
  return Array.isArray(roles) ? roles : [];
}

/** Liste des visites : réception → /reception, sinon /today (poste terminal). La sécurité utilise /security. */
function getTerminalVisitsDashboardUrl() {
  const roles = readRolesWithFallback();
  const hasReceptionRole = roles.some((role) => roleToComparableString(role).includes('RECEPTION'));
  if (hasReceptionRole) return TERMINAL_API.receptionVisits;
  return TERMINAL_API.todayVisits;
}

// Vérifier si l'utilisateur a les rôles autorisés
function hasTerminalAccess() {
  // D'abord vérifier avec session-user.js si disponible
  if (typeof window.readStoredRoles === 'function') {
    const roles = window.readStoredRoles();
    console.log('Vérification avec readStoredRoles():', roles);
    
    const hasAccess = roles.some(role => {
      const normalized = (role || '').toString().toUpperCase();
      const match = ALLOWED_TERMINAL_ROLES.includes(normalized);
      console.log(`  - Vérification "${role}" → "${normalized}" → ${match}`);
      return match;
    });
    
    if (!hasAccess && roles.length > 0) {
      console.warn('Accès refusé - Rôles insuffisants');
      console.warn('Rôles utilisateur:', roles);
      console.warn('Rôles autorisés:', ALLOWED_TERMINAL_ROLES);
    }
    
    return hasAccess;
  }
  
  // Fallback: essayer de lire directement depuis le storage
  console.warn('window.readStoredRoles() non disponible, lecture directe du storage');
  
  // Vérifier sessionStorage
  const sessionRoles = sessionStorage.getItem('currentUserRoles');
  if (sessionRoles) {
    try {
      const roles = JSON.parse(sessionRoles);
      console.log('Rôles trouvés dans sessionStorage:', roles);
      const hasAccess = roles.some(role => ALLOWED_TERMINAL_ROLES.includes((role || '').toUpperCase()));
      return hasAccess;
    } catch (e) {
      console.error('Erreur parsing sessionStorage:', e);
    }
  }
  
  // Vérifier localStorage
  const profileJson = localStorage.getItem('currentUserProfile');
  if (profileJson) {
    try {
      const profile = JSON.parse(profileJson);
      if (profile.roles) {
        console.log('Rôles trouvés dans localStorage:', profile.roles);
        const hasAccess = profile.roles.some(role => ALLOWED_TERMINAL_ROLES.includes((role || '').toUpperCase()));
        return hasAccess;
      }
    } catch (e) {
      console.error('Erreur parsing localStorage:', e);
    }
  }
  
  console.warn('Aucun rôle trouvé dans le storage');
  return false;
}

// Afficher un message d'accès refusé
function showAccessDenied() {
  const tbody = document.getElementById('terminal-visits-tbody');
  if (tbody) {
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-danger py-4">🔒 Accès refusé - Vous n\'avez pas les permissions nécessaires pour accéder à cette page.</td></tr>';
  }
}

// Formater une date
function formatDate(dateString) {
  if (!dateString) return '—';
  try {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('fr-FR', {
      day: '2-digit',
      month: '2-digit',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  } catch {
    return '—';
  }
}

// Extraire le prénom et le nom du visitor_name
function extractNames(fullName) {
  if (!fullName) return { firstName: '—', lastName: '—' };
  
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '—', lastName: '—' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '—' };
  
  // Prendre le premier mot comme prénom et le reste comme nom
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
}

// Déterminer la couleur du badge de priorité
function getPriorityBadge(status) {
  const statusMap = {
    'REGISTERED': { label: 'Enregistré', color: 'bg-info' },
    'PENDING': { label: 'En attente', color: 'bg-warning text-dark' },
    'CONFIRMED': { label: 'Confirmé', color: 'bg-success' },
    'VERIFIED': { label: 'Vérifié', color: 'bg-success' },
    'CHECKED': { label: 'Contrôlé', color: 'bg-primary' },
    'DELAYED': { label: 'Retardé', color: 'bg-danger' },
    'COMPLETED': { label: 'Complété', color: 'bg-success' },
    'CANCELLED': { label: 'Annulé', color: 'bg-secondary text-dark' },
  };
  
  const config = statusMap[status] || { label: status || 'Inconnu', color: 'bg-secondary' };
  return `<span class="badge ${config.color}">${config.label}</span>`;
}

// Echapper les caractères HTML
function escapeHtml(text) {
  if (!text) return '—';
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Générer une ligne du tableau
function renderVisitRow(visit, index) {
  const { firstName, lastName } = extractNames(visit.visitor_name);
  const scheduledDate = formatDate(visit.scheduled_at);
  const statusBadge = getPriorityBadge(visit.status);
  const email = escapeHtml(visit.employee || visit.employee_email || '—');
  // L'API peut renvoyer visitor_phone ou phone
  const phone = escapeHtml(visit.visitor_phone || visit.phone || '—');
  const direction = escapeHtml(visit.direction || '—');
  const purpose = escapeHtml(visit.purpose || '—');
  
  // Placeholder avatar (on peut améliorer ça plus tard)
  const avatarIndex = (index % 8) + 1;
  
  const showValidateEntry = canReceptionValidateEntry();

  return `
    <tr data-visit-id="${visit.id}">
      <td class="col-auto">
        <div class="avatar avatar-md">
          <img src="/public/images/faces/${avatarIndex}.jpg" alt="Avatar">
        </div>
      </td>
      <td class="col-auto">
        <p class="mb-0">${escapeHtml(firstName)}</p>
      </td>
      <td class="col-auto">
        <p class="mb-0">${escapeHtml(lastName)}</p>
      </td>
      <td class="col-auto">
        <p class="mb-0">${email}</p>
      </td>
      <td class="col-auto">
        <p class="mb-0">${phone}</p>
      </td>
      <td class="col-auto">
        <p class="mb-0 text-center">${scheduledDate}</p>
      </td>
      <td class="col-auto text-center">
        ${statusBadge}
      </td>
      <td class="col-auto">
        <p class="mb-0">—</p>
      </td>
      <td class="col-auto">
        <p class="mb-0">—</p>
      </td>
      <td class="col-auto">
        <p class="mb-0">—</p>
      </td>
      <td class="col-auto text-center action-button-custom">
        <div class="dropdown">
          <button class="btn btn-outline-primary dropdown-toggle me-1" type="button" id="dropdownMenuButton_${visit.id}" data-bs-toggle="dropdown"
            aria-haspopup="true" aria-expanded="false">
            Actions <i class="bi bi-caret-down-fill"></i>
          </button>
          <div class="dropdown-menu" aria-labelledby="dropdownMenuButton_${visit.id}">
            <a class="dropdown-item complete-visitor-btn" href="#" data-visit-id="${visit.id}" title="Compléter formulaire visiteur"><i class="bi bi-pencil-square"></i> Compléter formulaire</a>
            ${showValidateEntry ? `<a class="dropdown-item validate-entry-btn" href="#" data-visit-id="${visit.id}" title="Valider l'entrée du visiteur"><i class="bi bi-check-circle"></i> Valider Entrée</a>` : ''}
          </div>
        </div>
      </td>
    </tr>
  `;
}

// Charger les visites du jour
async function loadTodayVisits() {
  // Vérifier les rôles en premier
  if (!hasTerminalAccess()) {
    showAccessDenied();
    return;
  }

  const token = localStorage.getItem('authToken');
  if (!token) {
    console.error('Authentification requise');
    showAccessDenied();
    return;
  }

  const tbody = document.getElementById('terminal-visits-tbody');
  if (!tbody) {
    console.error('Element tbody non trouvé');
    return;
  }

  // Afficher le loader
  tbody.innerHTML = '<tr><td colspan="11" class="text-center py-4"><div class="spinner-border text-primary"></div><br>Chargement des visites...</td></tr>';

  try {
    const response = await fetch(getTerminalVisitsDashboardUrl(), {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.status === 401 || response.status === 403) {
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-danger py-4">Session expirée. Veuillez vous reconnecter.</td></tr>';
      console.error('Authentification invalide');
      return;
    }

    if (!response.ok) {
      throw new Error(`Erreur HTTP ${response.status}`);
    }

    const data = await response.json();
    console.log('Données reçues:', data);

    // Récupérer les visites (priorité: data > audiences)
    const visits = data.data || data.audiences || [];

    if (!Array.isArray(visits) || visits.length === 0) {
      cachedTodayVisits = [];
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">Aucune visite enregistrée pour aujourd\'hui.</td></tr>';
      return;
    }

    cachedTodayVisits = visits;

    // Rendre les lignes
    tbody.innerHTML = visits
      .map((visit, index) => renderVisitRow(visit, index))
      .join('');

  } catch (error) {
    console.error('Erreur lors du chargement des visites:', error);
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-danger py-4">Erreur lors du chargement des données.</td></tr>';
  }
}

function openCompleteVisitorModal(visit) {
  const idInput = document.getElementById('form-visit-id');
  const purposeInput = document.getElementById('form-purpose');
  const addressInput = document.getElementById('form-address');
  const idTypeInput = document.getElementById('form-id-type');
  const idNumberInput = document.getElementById('form-id-number');
  if (!idInput || !purposeInput || !addressInput || !idTypeInput || !idNumberInput) return;

  const details = visit.visitor_details || {};
  idInput.value = visit.id || '';
  purposeInput.value = visit.purpose || '';
  addressInput.value = details.address || '';
  const idTypeVal = details.id_type || details.identity_document_type || '';
  if (idTypeInput.tagName === 'SELECT') {
    idTypeInput.querySelectorAll('option.js-dynamic-id-type').forEach(o => o.remove());
    if (idTypeVal) {
      const hasOption = Array.from(idTypeInput.options).some(o => o.value === idTypeVal);
      if (!hasOption) {
        const opt = document.createElement('option');
        opt.value = idTypeVal;
        opt.textContent = idTypeVal;
        opt.className = 'js-dynamic-id-type';
        idTypeInput.appendChild(opt);
      }
    }
  }
  idTypeInput.value = idTypeVal;
  idNumberInput.value = details.id_number || details.identity_document_number || '';

  const modalEl = document.getElementById('completeVISITOR');
  if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
  } else {
    console.error('Modal #completeVISITOR ou Bootstrap indisponible');
    alert('Impossible d’ouvrir le formulaire (Bootstrap non chargé).');
  }
}

function hideBootstrapDropdownFromAction(anchor) {
  const toggle = anchor?.closest?.('.dropdown')?.querySelector?.('[data-bs-toggle="dropdown"]');
  if (!toggle || typeof bootstrap === 'undefined' || !bootstrap.Dropdown) return;
  const inst = bootstrap.Dropdown.getInstance(toggle) || bootstrap.Dropdown.getOrCreateInstance(toggle);
  inst.hide();
}

/** Un seul listener (délégation) : évite pertes de clic / Bootstrap absent après reload du tbody. */
function setupTerminalActionDelegation() {
  if (window.__terminalActionDelegationBound) return;
  window.__terminalActionDelegationBound = true;

  document.body.addEventListener('click', (e) => {
    const completeBtn = e.target.closest('.complete-visitor-btn');
    if (completeBtn) {
      e.preventDefault();
      e.stopPropagation();
      hideBootstrapDropdownFromAction(completeBtn);
      const visitId = completeBtn.dataset.visitId;
      const visit = cachedTodayVisits.find((v) => String(v.id) === String(visitId));
      if (!visit) {
        console.warn('Visite introuvable dans le cache:', visitId, cachedTodayVisits?.length);
        alert('Visite introuvable. Réessayez après rechargement de la liste.');
        return;
      }
      openCompleteVisitorModal(visit);
      return;
    }

    const validateBtn = e.target.closest('.validate-entry-btn');
    if (validateBtn) {
      e.preventDefault();
      e.stopPropagation();
      hideBootstrapDropdownFromAction(validateBtn);
      const visitId = validateBtn.dataset.visitId;
      const hidden = document.getElementById('validation-visit-id');
      if (hidden) hidden.value = visitId || '';
      const modalEl = document.getElementById('validation-modal');
      if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
        bootstrap.Modal.getOrCreateInstance(modalEl).show();
      } else {
        alert('Interface modale indisponible (Bootstrap non chargé). Vérifiez les chemins des scripts.');
      }
    }
  });
}

let completeVisitorFormBound = false;

function setupCompleteVisitorForm() {
  const form = document.getElementById('complete-visitor-form');
  if (!form || completeVisitorFormBound) return;
  completeVisitorFormBound = true;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('form-visit-id')?.value;
    const purpose = document.getElementById('form-purpose')?.value?.trim() || '';
    const address = document.getElementById('form-address')?.value?.trim() || '';
    const identity_document_type = document.getElementById('form-id-type')?.value?.trim() || '';
    const identity_document_number = document.getElementById('form-id-number')?.value?.trim() || '';

    if (!id) {
      alert('Identifiant de visite manquant.');
      return;
    }

    const payload = {
      purpose,
      address,
      identity_document_type,
      identity_document_number,
    };

    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const res = await fetch(audienceUpdateUrl(id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      let data = {};
      try {
        data = await res.json();
      } catch (_) {
        /* corps non JSON */
      }

      if (res.ok) {
        alert(data.message || 'Audience mise à jour avec succès.');
        const modalEl = document.getElementById('completeVISITOR');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const inst = bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        }
        loadTodayVisits();
      } else {
        const msg = data.message || data.detail || `Erreur (${res.status})`;
        alert(msg);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau ou serveur.');
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

let validationModalBound = false;

function setupValidationModal() {
  const yesBtn = document.getElementById('validation-confirm-yes');
  if (!yesBtn || validationModalBound) return;
  validationModalBound = true;

  yesBtn.addEventListener('click', async () => {
    const id = document.getElementById('validation-visit-id')?.value?.trim();
    if (!id) {
      alert('Identifiant de visite manquant.');
      return;
    }
    if (!canReceptionValidateEntry()) {
      alert('Action réservée à la réception.');
      return;
    }
    const token = localStorage.getItem('authToken');
    if (!token) {
      alert('Session expirée. Veuillez vous reconnecter.');
      return;
    }

    yesBtn.disabled = true;
    try {
      const res = await fetch(audienceVerifyUrl(id), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: '{}',
      });
      let data = {};
      try {
        data = await res.json();
      } catch (_) {}
      if (res.ok) {
        alert(data.message || 'Visite vérifiée avec succès.');
        const modalEl = document.getElementById('validation-modal');
        if (modalEl && typeof bootstrap !== 'undefined' && bootstrap.Modal) {
          const inst = bootstrap.Modal.getInstance(modalEl);
          if (inst) inst.hide();
        }
        loadTodayVisits();
      } else {
        alert(data.message || data.detail || `Erreur (${res.status})`);
      }
    } catch (err) {
      console.error(err);
      alert('Erreur réseau ou serveur.');
    } finally {
      yesBtn.disabled = false;
    }
  });
}

// Initialiser au chargement de la page
function initializeTerminal() {
  console.log('Initialisation du terminal de réception...');
  
  console.log('Vérification des rôles...');
  console.log('Rôles disponibles:', window.readStoredRoles?.());
  
  // Vérifier les rôles au chargement
  if (!hasTerminalAccess()) {
    console.error('Accès refusé - Rôles insuffisants');
    showAccessDenied();
    return;
  }
  
  console.log('Accès autorisé - Chargement des visites');
  setupTerminalActionDelegation();
  setupCompleteVisitorForm();
  setupValidationModal();
  loadTodayVisits();

  // Rechargement automatique toutes les 30 secondes
  setInterval(loadTodayVisits, 30000);

  // Écouter les mises à jour du profil pour recharger
  window.addEventListener('currentUserProfileUpdated', () => {
    console.log('🔄 Profil mis à jour - Rechargement des visites');
    if (hasTerminalAccess()) {
      loadTodayVisits();
    } else {
      showAccessDenied();
    }
  });
}

// Attendre que le DOM ET les rôles soient prêts
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // Attendre que session-user.js se charge et lise le storage
    console.log('⏳ Attendre 500ms pour laisser session-user.js charger les rôles...');
    setTimeout(initializeTerminal, 500);
  });
} else {
  // DOM déjà chargé
  console.log('⏳ Attendre 500ms pour laisser session-user.js charger les rôles...');
  setTimeout(initializeTerminal, 500);
}

// Exporter les fonctions pour le débogage
window.debugTerminal = {
  loadTodayVisits,
  formatDate,
  extractNames,
  get cachedVisits() {
    return cachedTodayVisits;
  },
  audienceUpdateUrl,
  audienceVerifyUrl,
  toAudienceUpdatePathId,
};
