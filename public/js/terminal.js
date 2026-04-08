// terminal.js - Gestion des visites du jour pour le terminal de réception

const TERMINAL_API = {
  todayVisits: 'http://127.0.0.1:8000/api/audiences/dashboard/today',
};

const ALLOWED_TERMINAL_ROLES = ['ROLE_RECEPTION', 'ROLE_TERMINAL', 'ROLE_ACCUEIL'];

// Vérifier si l'utilisateur a les rôles autorisés
function hasTerminalAccess() {
  // D'abord vérifier avec session-user.js si disponible
  if (typeof window.readStoredRoles === 'function') {
    const roles = window.readStoredRoles();
    console.log('📋 Vérification avec readStoredRoles():', roles);
    
    const hasAccess = roles.some(role => {
      const normalized = (role || '').toString().toUpperCase();
      const match = ALLOWED_TERMINAL_ROLES.includes(normalized);
      console.log(`  - Vérification "${role}" → "${normalized}" → ${match}`);
      return match;
    });
    
    if (!hasAccess && roles.length > 0) {
      console.warn('❌ Accès refusé - Rôles insuffisants');
      console.warn('Rôles utilisateur:', roles);
      console.warn('Rôles autorisés:', ALLOWED_TERMINAL_ROLES);
    }
    
    return hasAccess;
  }
  
  // Fallback: essayer de lire directement depuis le storage
  console.warn('⚠️  window.readStoredRoles() non disponible, lecture directe du storage');
  
  // Vérifier sessionStorage
  const sessionRoles = sessionStorage.getItem('currentUserRoles');
  if (sessionRoles) {
    try {
      const roles = JSON.parse(sessionRoles);
      console.log('📋 Rôles trouvés dans sessionStorage:', roles);
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
        console.log('📋 Rôles trouvés dans localStorage:', profile.roles);
        const hasAccess = profile.roles.some(role => ALLOWED_TERMINAL_ROLES.includes((role || '').toUpperCase()));
        return hasAccess;
      }
    } catch (e) {
      console.error('Erreur parsing localStorage:', e);
    }
  }
  
  console.warn('⚠️  Aucun rôle trouvé dans le storage');
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
  const email = escapeHtml(visit.employee || '—');
  const phone = escapeHtml(visit.phone || '—');
  const direction = escapeHtml(visit.direction || '—');
  const purpose = escapeHtml(visit.purpose || '—');
  
  // Placeholder avatar (on peut améliorer ça plus tard)
  const avatarIndex = (index % 8) + 1;
  
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
            <a class="dropdown-item complete-visitor-btn" href="#" data-bs-target="#completeVISITOR" data-bs-toggle="modal" data-visit-id="${visit.id}" title="Compléter formulaire visiteur"><i class="bi bi-pencil-square"></i> Compléter formulaire</a>
            <a class="dropdown-item validate-entry-btn" href="#" data-bs-target="#validation-modal" data-bs-toggle="modal" data-visit-id="${visit.id}" title="Valider formulaire visiteur"><i class="bi bi-check-circle"></i> Valider Entrée</a>
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
    const response = await fetch(TERMINAL_API.todayVisits, {
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
      tbody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">Aucune visite enregistrée pour aujourd\'hui.</td></tr>';
      return;
    }

    // Rendre les lignes
    tbody.innerHTML = visits
      .map((visit, index) => renderVisitRow(visit, index))
      .join('');

    // Ajouter les événements aux boutons
    attachActionListeners();

  } catch (error) {
    console.error('Erreur lors du chargement des visites:', error);
    tbody.innerHTML = '<tr><td colspan="11" class="text-center text-danger py-4">Erreur lors du chargement des données.</td></tr>';
  }
}

// Attacher les écouteurs aux boutons d'action
function attachActionListeners() {
  // Boutons "Compléter formulaire"
  document.querySelectorAll('.complete-visitor-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const visitId = btn.dataset.visitId;
      console.log('Compléter formulaire pour la visite:', visitId);
      // TODO: Implémenter la logique pour ouvrir le modal et charger les données
    });
  });

  // Boutons "Valider Entrée"
  document.querySelectorAll('.validate-entry-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const visitId = btn.dataset.visitId;
      console.log('Valider l\'entrée pour la visite:', visitId);
      // TODO: Implémenter la logique de validation
    });
  });
}

// Initialiser au chargement de la page
function initializeTerminal() {
  console.log('🚀 Initialisation du terminal de réception...');
  
  console.log('🔍 Vérification des rôles...');
  console.log('Rôles disponibles:', window.readStoredRoles?.());
  
  // Vérifier les rôles au chargement
  if (!hasTerminalAccess()) {
    console.error('❌ Accès refusé - Rôles insuffisants');
    showAccessDenied();
    return;
  }
  
  console.log('✅ Accès autorisé - Chargement des visites');
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
};
