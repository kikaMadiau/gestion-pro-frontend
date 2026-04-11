// terminal.js - Gestion des visites du jour pour le terminal de réception

const TERMINAL_API = {
  todayVisits: 'http://127.0.0.1:8000/api/audiences/dashboard/today',
};

const ALLOWED_TERMINAL_ROLES = ['ROLE_RECEPTION', 'ROLE_TERMINAL', 'ROLE_SECURITY'];

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
  
  // Vérifier le rôle courant pour afficher le bouton "Valider l'entrée"
  let showValidateEntry = false;
  if (typeof window.readStoredRoles === 'function') {
    const roles = window.readStoredRoles();
    showValidateEntry = Array.isArray(roles) && roles.some(role => {
      const r = (role || '').toUpperCase();
      return ALLOWED_TERMINAL_ROLES.includes(r);
    });
  }

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
            ${showValidateEntry ? `<a class="dropdown-item validate-entry-btn" href="#" data-bs-target="#validation-modal" data-bs-toggle="modal" data-visit-id="${visit.id}" title="Valider formulaire visiteur"><i class="bi bi-check-circle"></i> Valider Entrée</a>` : ''}
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
      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        // Empêcher d'autres handlers/bootstrap d'ouvrir le modal avant le préremplissage
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        const visitId = btn.dataset.visitId;
        console.log('Compléter formulaire pour la visite:', visitId);

        // Ouvrir le modal (Bootstrap already handles via data-bs attributes)
        // Charger les données de l'audience depuis l'API pour préremplir le formulaire
        const token = localStorage.getItem('authToken');
        if (!token) {
          console.error('Token manquant, impossible de charger les détails.');
          return;
        }

        const modal = document.getElementById('completeVISITOR');
        if (!modal) return;

        // Indiquer l'id courant
        window.__currentCompleteAudienceId = visitId;

        let detail = null;
        try {
          const res = await fetch(`http://127.0.0.1:8000/audiences/${visitId}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!res.ok) {
            console.warn('Impossible de récupérer les détails de l\'audience', res.status);
          } else {
            detail = await res.json();
            console.log('Détails audience:', detail);
            // Préremplir quelques champs du modal si présents
            // Récupérer les inputs du modal par ordre (structure fixe dans le template)
            const inputs = modal.querySelectorAll('.modal-body input.form-control');
            // mapping approximatif basé sur l'ordre du template
            // 0: prénom, 1: nom, 2: post-nom, 3: téléphone, 4: rdvDate, 5: avenue, 6: numero, 7: quartier, 8: commune
            if (inputs.length) {
              // Use explicit IDs added to the modal for robust mapping
              const firstNameEl = document.getElementById('cv_first_name');
              const lastNameEl = document.getElementById('cv_last_name');
              const postNameEl = document.getElementById('cv_post_name');
              const phoneEl = document.getElementById('cv_phone');
              const rdvEl = document.getElementById('cv_rdvDate');
              const avenueEl = document.getElementById('cv_address_avenue');
              const numeroEl = document.getElementById('cv_address_numero');
              const quartierEl = document.getElementById('cv_address_quartier');
              const communeEl = document.getElementById('cv_address_commune');
              const purposeEl = document.getElementById('cv_purpose');
              const idTypeEl = document.getElementById('cv_identity_type');
              const idNumberEl = document.getElementById('cv_identity_number');

              const visitor = detail.visitor_name || '';
              const parts = visitor.split(/\s+/);
              if (firstNameEl) firstNameEl.value = parts[0] || '';
              if (lastNameEl) lastNameEl.value = parts[1] || '';
              if (postNameEl) postNameEl.value = parts.slice(2).join(' ') || '';
              if (phoneEl) phoneEl.value = detail.visitor_phone || detail.phone || '';

              if (rdvEl) {
                try {
                  const d = detail.scheduled_at ? new Date(detail.scheduled_at) : null;
                  if (d && !Number.isNaN(d.getTime())) {
                    const dd = String(d.getDate()).padStart(2,'0');
                    const mm = String(d.getMonth()+1).padStart(2,'0');
                    const yyyy = d.getFullYear();
                    rdvEl.value = `${dd}-${mm}-${yyyy}`;
                  }
                } catch {}
              }

              const visitorAddress = detail.visitor_details?.address || detail.address || '';
              // Try to split address into avenue/numero/quartier/commune heuristically
              if (avenueEl) avenueEl.value = visitorAddress;
              if (numeroEl) numeroEl.value = '';
              if (quartierEl) quartierEl.value = '';
              if (communeEl) communeEl.value = '';

              if (purposeEl) purposeEl.value = detail.purpose || '';
              if (idTypeEl) idTypeEl.value = detail.visitor_details?.id_type || '';
              if (idNumberEl) idNumberEl.value = detail.visitor_details?.id_number || '';
            }
          }
          // Une fois les champs préremplis, afficher le modal (au cas où Bootstrap ne l'aurait pas ouvert)
          try {
            const bsModal = bootstrap.Modal.getOrCreateInstance(modal);
            bsModal.show();
          } catch (err) {
            console.warn('Impossible de forcer l\'ouverture du modal via Bootstrap:', err);
          }
        } catch (err) {
          console.error('Erreur récupération audience:', err);
        }

        // Attacher un écouteur one-shot au bouton primaire du modal pour soumettre la mise à jour
        const confirmBtn = modal.querySelector('.modal-footer .btn.btn-primary');
        if (confirmBtn) {
          // enlever ancien listener si présent
          const newHandler = async (ev) => {
            ev.preventDefault();
            // construire payload minimal attendu par l'API
            // read values from explicit IDs
            const purpose = document.getElementById('cv_purpose')?.value || (detail && detail.purpose) || '';
            const avenue = document.getElementById('cv_address_avenue')?.value || '';
            const numero = document.getElementById('cv_address_numero')?.value || '';
            const quartier = document.getElementById('cv_address_quartier')?.value || '';
            const commune = document.getElementById('cv_address_commune')?.value || '';
            const address = [avenue, numero, quartier, commune].filter(Boolean).join(', ') || (detail && (detail.visitor_details?.address || detail.address)) || '';
            const identity_type = document.getElementById('cv_identity_type')?.value || (detail && detail.visitor_details?.id_type) || '';
            const identity_number = document.getElementById('cv_identity_number')?.value || (detail && detail.visitor_details?.id_number) || '';

            const payload = {
              purpose: purpose,
              address: address,
              identity_document_type: identity_type,
              identity_document_number: identity_number
            };

            try {
              const updateRes = await fetch(`http://127.0.0.1:8000/audiences/${visitId}/update`, {
                method: 'PUT',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
              });
              const updateData = await updateRes.json();
              if (!updateRes.ok) {
                console.error('Erreur update audience', updateRes.status, updateData);
                alert('Erreur lors de la mise à jour : ' + (updateData?.message || updateRes.status));
                return;
              }
              console.log('Audience mise à jour:', updateData);
              // Fermer modal et recharger la liste (plus simple et sûr)
              var bsModal = bootstrap.Modal.getInstance(modal);
              if (bsModal) bsModal.hide();
              loadTodayVisits();
            } catch (err) {
              console.error('Erreur envoi update:', err);
              alert('Erreur lors de la mise à jour.');
            }
          };
          // remove previous handlers by cloning node
          const cloned = confirmBtn.cloneNode(true);
          confirmBtn.parentNode.replaceChild(cloned, confirmBtn);
          cloned.addEventListener('click', newHandler);
        }
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
