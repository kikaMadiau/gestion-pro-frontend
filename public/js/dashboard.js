// dashboard.js - Version corrigée

const DASHBOARD_ENDPOINTS = {
  admin: 'http://127.0.0.1:8000/api/audiences/dashboard/admin',
  superAdmin: 'http://127.0.0.1:8000/api/audiences/dashboard/super-admin',
  employee: 'http://127.0.0.1:8000/api/audiences/dashboard/employee',
};

const ADMIN_ROLE_SET = new Set(['ROLE_ADMIN', 'ROLE_DIRECTOR']);
const SUPER_ADMIN_ROLE_SET = new Set(['ROLE_SUPER_ADMIN']);

function escapeHtml(text) {
  if (!text) return '—';
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showDashboardError(message) {
  const container = document.getElementById('dashboard-error');
  if (!container) return;
  container.textContent = message;
  container.classList.remove('d-none');
}

function hideDashboardError() {
  const container = document.getElementById('dashboard-error');
  if (!container) return;
  container.textContent = '';
  container.classList.add('d-none');
}

function getStatusConfig(status) {
  const map = {
    'PENDING': { label: 'En attente', className: 'badge bg-warning text-dark' },
    'DELAYED': { label: 'Retardé', className: 'badge bg-danger' },
    'CONFIRMED': { label: 'Confirmé', className: 'badge bg-success' },
    'COMPLETED': { label: 'Terminée', className: 'badge bg-success' },
    'CANCELLED': { label: 'Annulé', className: 'badge bg-secondary text-dark' },
    'CLOSED': { label: 'Clôturé', className: 'badge bg-info' },
    'CANCELED': { label: 'Annulé', className: 'badge bg-secondary text-dark' },
    'REGISTERED': { label: 'Enregistré', className: 'badge bg-primary' },
  };
  return map[status] || { label: status ?? 'Inconnu', className: 'badge bg-secondary' };
}

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

const normalizeRoleValue = (value) => {
  if (!value) return null;
  if (typeof value === 'string') return value.trim().toUpperCase();
  if (typeof value === 'object') {
    const candidate = value.name ?? value.role ?? value.key ?? value.direction ?? value.role_name ?? '';
    if (!candidate) return null;
    return candidate.toString().trim().toUpperCase() || null;
  }
  return null;
};

const readRolesFromStorage = () => {
  const roles = [];
  const storedRoles = sessionStorage.getItem('currentUserRoles');
  if (storedRoles) {
    try {
      const parsed = JSON.parse(storedRoles);
      if (Array.isArray(parsed)) {
        parsed.forEach((role) => {
          const normalized = normalizeRoleValue(role);
          if (normalized) roles.push(normalized);
        });
      }
    } catch (error) {
      console.error('Impossible de parser currentUserRoles', error);
    }
  }

  if (!roles.length) {
    const profileJson = localStorage.getItem('currentUserProfile');
    if (profileJson) {
      try {
        const profile = JSON.parse(profileJson);
        if (Array.isArray(profile?.roles)) {
          profile.roles.forEach((role) => {
            const normalized = normalizeRoleValue(role);
            if (normalized) roles.push(normalized);
          });
        }
      } catch (error) {
        console.error('Impossible de parser currentUserProfile pour les rôles', error);
      }
    }
  }

  return roles;
};

const getStoredRoles = () => {
  if (typeof window.readStoredRoles === 'function') {
    return window.readStoredRoles();
  }
  return readRolesFromStorage();
};

const isSuperAdminUser = () => {
  const roles = getStoredRoles();
  const isSuperAdmin = roles.includes('ROLE_SUPER_ADMIN');
  console.log('🔍 isSuperAdminUser:', isSuperAdmin, 'Rôles:', roles);
  return isSuperAdmin;
};

const isAdminUser = () => {
  const roles = getStoredRoles();
  const isAdmin = roles.some((role) => ADMIN_ROLE_SET.has(role));
  console.log('🔍 isAdminUser:', isAdmin);
  return isAdmin;
};

const determineEndpoint = () => {
  if (isSuperAdminUser()) {
    console.log('🎯 Utilisateur SUPER ADMIN - Endpoint super-admin');
    return DASHBOARD_ENDPOINTS.superAdmin;
  } else if (isAdminUser()) {
    console.log('🎯 Utilisateur ADMIN - Endpoint admin');
    return DASHBOARD_ENDPOINTS.admin;
  } else {
    console.log('🎯 Utilisateur EMPLOYEE - Endpoint employee');
    return DASHBOARD_ENDPOINTS.employee;
  }
};

document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Dashboard chargé - Vérification des rôles...');
  console.log('Roles:', getStoredRoles());
  console.log('Is Super Admin:', isSuperAdminUser());
  
  const statDaily = document.getElementById('stat-daily-value');
  const statMonthly = document.getElementById('stat-monthly-value');
  const statWeeklyLabel = document.getElementById('stat-weekly-label');
  const statCancelled = document.getElementById('stat-cancelled-value');
  const statTotal = document.getElementById('stat-total-value');
  const tableBody = document.getElementById('dashboard-visits-body');
  const prevPageButton = document.getElementById('dashboard-prev-page');
  const nextPageButton = document.getElementById('dashboard-next-page');
  const pageInfo = document.getElementById('dashboard-page-info');
  const directionStatsList = document.getElementById('direction-stats-list');
  const directionStatsSection = document.getElementById('direction-stats-section');

  if (!tableBody) return;

  const token = localStorage.getItem('authToken');
  if (!token) {
    showDashboardError('Impossible de charger le tableau de bord : authentification manquante.');
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Connecte-toi pour récupérer tes visites.</td></tr>';
    return;
  }

  const pagination = {
    page: 1,
    limit: 10,
    pages: 1,
    total: 0
  };
  let isLoading = false;
  let currentEndpoint = determineEndpoint();

  const updatePaginationUI = () => {
    const totalPages = Math.max(pagination.pages, 1);
    if (pageInfo) {
      pageInfo.textContent = `Page ${pagination.page} / ${totalPages} (Total: ${pagination.total})`;
    }
    if (prevPageButton) {
      prevPageButton.disabled = pagination.page <= 1 || isLoading;
    }
    if (nextPageButton) {
      nextPageButton.disabled = pagination.page >= totalPages || isLoading;
    }
  };

  if (prevPageButton) {
    prevPageButton.addEventListener('click', () => {
      if (pagination.page > 1 && !isLoading) {
        loadDashboard(pagination.page - 1);
      }
    });
  }

  if (nextPageButton) {
    nextPageButton.addEventListener('click', () => {
      if (pagination.page < pagination.pages && !isLoading) {
        loadDashboard(pagination.page + 1);
      }
    });
  }

  const renderVisits = (visits) => {
    if (!visits || visits.length === 0) {
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Pas de visites enregistrées.</td></tr>';
      return;
    }

    tableBody.innerHTML = visits
      .map(visit => {
        const statusConfig = getStatusConfig(visit.status);
        const scheduledDate = formatDateTime(visit.scheduled_at);

        return `
          <tr>
            <td>
              <p class="font-bold mb-0">${escapeHtml(visit.visitor_name ?? '—')}</p>
              <small class="text-muted d-block">${escapeHtml(visit.visitor_phone ?? '—')}</small>
            </div>
            <td>
              <span class="${statusConfig.className}">${statusConfig.label}</span>
            </div>
            <td>
              <p class="mb-0">${scheduledDate}</p>
              <small class="text-muted d-block">${escapeHtml(visit.employee ?? '—')}</small>
            </div>
            <td>
              <p class="mb-0">${escapeHtml(visit.direction ?? '—')}</p>
              <small class="text-muted d-block">${escapeHtml(visit.purpose ?? '—')}</small>
            </div>
            <td class="text-end">
              <h6 class="mb-0">${visit.priority_score ?? '—'}</h6>
              <small class="text-muted">score</small>
            </div>
          </tr>
        `;
      })
      .join('');
  };

  const renderDirectionStats = (visitCounts = []) => {
    if (!directionStatsList) return;

    if (!Array.isArray(visitCounts) || visitCounts.length === 0) {
      directionStatsList.innerHTML = '<p class="text-muted text-center mb-0">Aucune statistique disponible.</p>';
      return;
    }

    const maxVisits = Math.max(...visitCounts.map(d => d.visit_count || 0), 1);
    
    let html = '';
    for (const dir of visitCounts) {
      const name = dir.direction_name || dir.directionName || 'Direction';
      const count = dir.visit_count || dir.count || 0;
      const percentage = (count / maxVisits) * 100;
      
      html += `
        <div class="mb-3">
          <div class="d-flex justify-content-between align-items-center mb-1">
            <span class="fw-semibold">${escapeHtml(name)}</span>
            <span class="badge bg-primary">${count} visite${count > 1 ? 's' : ''}</span>
          </div>
          <div class="progress" style="height: 8px;">
            <div class="progress-bar bg-primary" role="progressbar" style="width: ${percentage}%"></div>
          </div>
        </div>
      `;
    }
    
    directionStatsList.innerHTML = html;
    console.log('✅ Statistiques par direction affichées:', visitCounts.length, 'directions');
  };

  const loadDashboard = async (page = pagination.page) => {
    if (isLoading) return;

    currentEndpoint = determineEndpoint();
    pagination.page = Math.max(1, page);
    updatePaginationUI();
    hideDashboardError();
    tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4"><div class="spinner-border text-primary" role="status"></div></div></div>';
    isLoading = true;

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });

      const url = `${currentEndpoint}?${params}`;
      console.log('📡 Chargement dashboard depuis:', url);

      const response = await fetch(url, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (window.handleUnauthorizedResponseStatus?.(response.status)) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Échec (${response.status})`);
      }

      const payload = await response.json();
      console.log('✅ Données reçues:', payload);

      const statistics = payload.statistics ?? {};
      const total = payload.total ?? payload.data?.length ?? 0;
      pagination.total = total;
      pagination.pages = payload.pages ?? Math.max(1, Math.ceil(total / pagination.limit));

      if (statDaily) statDaily.textContent = statistics.today ?? statistics.daily ?? 0;
      if (statMonthly) statMonthly.textContent = statistics.month ?? statistics.monthly ?? 0;
      if (statWeeklyLabel) {
        statWeeklyLabel.textContent = statistics.weekly ? `Cette semaine : ${statistics.weekly}` : '';
      }

      const cancelled = statistics.cancelled ?? 0;
      const statTotalValue = statistics.total ?? total;
      const percentCancelled = statTotalValue > 0 ? Math.round((cancelled / statTotalValue) * 100) : 0;
      if (statCancelled) statCancelled.textContent = `${percentCancelled}%`;
      if (statTotal) statTotal.textContent = statTotalValue;

      let visits = payload.data ?? payload.audiences ?? [];
      visits.sort((a, b) => {
        const dateA = new Date(a.scheduled_at ?? '');
        const dateB = new Date(b.scheduled_at ?? '');
        return dateB - dateA;
      });
      renderVisits(visits);

      // GESTION SUPER ADMIN - Visites par direction
      const isSuperAdmin = isSuperAdminUser();
      console.log('👑 Affichage section super admin?', isSuperAdmin);
      
      if (directionStatsSection) {
        if (isSuperAdmin) {
          directionStatsSection.style.display = 'block';
          const directionCounts = Array.isArray(payload.visit_counts_per_direction)
            ? payload.visit_counts_per_direction : [];
          console.log('📊 Données visit_counts_per_direction:', directionCounts);
          renderDirectionStats(directionCounts);
        } else {
          directionStatsSection.style.display = 'none';
        }
      }

      updatePaginationUI();

    } catch (error) {
      console.error('❌ Erreur chargement dashboard:', error);
      showDashboardError(error?.message || 'Impossible de charger les visites.');
      tableBody.innerHTML = '<tr><td colspan="5" class="text-center text-muted py-4">Impossible de récupérer les visites.</div></div>';
    } finally {
      isLoading = false;
      updatePaginationUI();
    }
  };

  // Chargement initial
  loadDashboard();

  // Écouter les mises à jour de profil
  window.addEventListener('currentUserProfileUpdated', () => {
    console.log('🔄 Profil mis à jour, rechargement du dashboard...');
    pagination.page = 1;
    loadDashboard(1);
  });
});