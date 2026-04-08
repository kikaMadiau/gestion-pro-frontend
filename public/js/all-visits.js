const ALL_VISITS_URL = 'http://127.0.0.1:8000/api/audiences/dashboard/my/visits';

const STATUS_TRANSLATIONS = {
  REGISTERED: { label: 'Enregistré', className: 'badge bg-primary' },
  PENDING: { label: 'En attente', className: 'badge bg-warning text-dark' },
  CONFIRMED: { label: 'Confirmé', className: 'badge bg-success' },
  DELAYED: { label: 'Retardé', className: 'badge bg-danger' },
  CANCELLED: { label: 'Annulé', className: 'badge bg-secondary text-dark' },
  COMPLETED: { label: 'Terminée', className: 'badge bg-success' },
};

function formatDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
}

function getPriorityBadge(priorityScore) {
  if (priorityScore >= 70) return { label: 'Urgent', className: 'badge bg-danger' };
  if (priorityScore >= 40) return { label: 'Normal', className: 'badge bg-primary' };
  if (priorityScore >= 10) return { label: 'Modéré', className: 'badge bg-warning text-dark' };
  return { label: 'Faible', className: 'badge bg-secondary text-dark' };
}

function showAllVisitsError(message) {
  const alert = document.getElementById('all-visits-error');
  if (!alert) return;
  alert.textContent = message;
  alert.classList.remove('d-none');
}

function hideAllVisitsError() {
  const alert = document.getElementById('all-visits-error');
  if (!alert) return;
  alert.textContent = '';
  alert.classList.add('d-none');
}

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('all-visits-body');
  const pageInfo = document.getElementById('all-visits-page-info');
  const prevButton = document.getElementById('all-visits-prev');
  const nextButton = document.getElementById('all-visits-next');
  if (!tableBody) return;

  const token = localStorage.getItem('authToken');
  if (!token) {
    showAllVisitsError('Connecte-toi pour consulter toutes tes visites.');
    tableBody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">Authentification requise.</td></tr>';
    return;
  }

  const pagination = {
    page: 1,
    limit: 10,
    pages: 1,
  };

  const updatePaginationUI = () => {
    if (pageInfo) {
      pageInfo.textContent = `Page ${pagination.page} / ${Math.max(pagination.pages, 1)}`;
    }
    if (prevButton) {
      prevButton.disabled = pagination.page <= 1;
    }
    if (nextButton) {
      nextButton.disabled = pagination.page >= pagination.pages;
    }
  };

  prevButton?.addEventListener('click', () => {
    if (pagination.page > 1) {
      loadPage(pagination.page - 1);
    }
  });

  nextButton?.addEventListener('click', () => {
    if (pagination.page < pagination.pages) {
      loadPage(pagination.page + 1);
    }
  });

  const renderVisits = visits => {
    if (!visits.length) {
      tableBody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">Aucune visite enregistrée.</td></tr>';
      return;
    }

    tableBody.innerHTML = visits
      .map((visit, index) => {
        const [firstName, ...rest] = (visit.visitor_name ?? '').split(/\s+/).filter(Boolean);
        const lastName = rest.join(' ') || '—';
        const email = visit.visitor_details?.email ?? '—';
        const state = visit.status?.toUpperCase?.() ?? 'INCONNU';
        const status = STATUS_TRANSLATIONS[state] ?? { label: visit.status ?? 'Inconnu', className: 'badge bg-secondary' };
        const rawPriority = visit.priority_score ?? visit.priority;
        const parsedPriority = Number(rawPriority);
        const priorityScore = Number.isFinite(parsedPriority) ? parsedPriority : 0;
        const priority = getPriorityBadge(priorityScore);

        return `
          <tr>
            <td class="col-auto">
              <div class="avatar avatar-md">
                <img src="images/faces/5.jpg" alt="avatar">
              </div>
            </td>
            <td class="col-auto"><p class="mb-0">${firstName ?? '—'}</p></td>
            <td class="col-auto"><p class="mb-0">${lastName}</p></td>
            <td class="col-auto"><p class="mb-0">${email}</p></td>
            <td class="col-auto"><p class="mb-0">${visit.visitor_phone ?? '—'}</p></td>
            <td class="col-auto text-center"><p class="mb-0">${formatDate(visit.scheduled_at)}</p></td>
            <td class="col-auto text-center"><span class="${priority.className}">${priority.label}</span></td>
            <td class="col-auto"><p class="mb-0 text-center">${formatDate(visit.scheduled_at)}</p></td>
            <td class="col-auto"><p class="mb-0 text-center">—</p></td>
            <td class="col-auto"><p class="mb-0 text-center">—</p></td>
            <td class="col-auto"><span class="${status.className}">${status.label}</span></td>
            <td class="col-auto text-center action-button-custom">
              <div class="dropdown">
                <button class="btn btn-outline-primary dropdown-toggle me-1" type="button" data-bs-toggle="dropdown">
                  Actions <i class="bi bi-caret-down-fill"></i>
                </button>
                <div class="dropdown-menu">
                  <a class="dropdown-item" href="#" data-bs-target="#visitor-progression" data-bs-toggle="modal" title="Voir évolution du visiteur" data-tooltip="true"><i class="bi bi-activity"></i> Evolution visiteur</a>
                  <a class="dropdown-item" href="#"><i class="bi bi-pen"></i> Changer priorite</a>
                  <a class="dropdown-item" href="#"><i class="bi bi-pencil-square"></i> Changer status</a>
                  <a class="dropdown-item" href="#" data-bs-target="#delete-modal" data-bs-toggle="modal"><i class="bi bi-x-octagon"></i> Annuler visite</a>
                </div>
              </div>
            </td>
          </tr>
        `;
      })
      .join('');
  };

  const loadPage = async page => {
    hideAllVisitsError();
    pagination.page = page;
    updatePaginationUI();
    tableBody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">Chargement...</td></tr>';

    try {
      const params = new URLSearchParams({
        page: pagination.page.toString(),
        limit: pagination.limit.toString(),
      });
      const response = await fetch(`${ALL_VISITS_URL}?${params}`, {
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
      pagination.pages = Math.max(1, payload.pages ?? Math.ceil((payload.total ?? 0) / pagination.limit));
      pagination.total = payload.total ?? pagination.total;
      pagination.page = payload.page ?? pagination.page;
      updatePaginationUI();

      const visits = (payload.data ?? payload.audiences ?? []).slice();
      visits.sort((a, b) => {
        const dateA = new Date(a.scheduled_at ?? '');
        const dateB = new Date(b.scheduled_at ?? '');
        return dateB - dateA;
      });
      renderVisits(visits);
    } catch (error) {
      showAllVisitsError(error?.message || 'Impossible de récupérer les visites.');
      tableBody.innerHTML = '<tr><td colspan="12" class="text-center text-muted py-4">Impossible de charger les visites.</td></tr>';
    }
  };

  loadPage(1);
});
