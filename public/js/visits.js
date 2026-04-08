const VISITS_TODAY_URL = 'http://127.0.0.1:8000/api/audiences/dashboard/my/today';

const STATUS_BADGES = {
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

function getPriorityBadge(score) {
  if (score >= 70) return { label: 'Urgent', className: 'badge bg-danger' };
  if (score >= 40) return { label: 'Normal', className: 'badge bg-primary' };
  if (score >= 10) return { label: 'Modéré', className: 'badge bg-warning text-dark' };
  return { label: 'Faible', className: 'badge bg-secondary text-dark' };
}

function showVisitsError(message) {
  const alert = document.getElementById('visits-error');
  if (!alert) return;
  alert.textContent = message;
  alert.classList.remove('d-none');
}

function hideVisitsError() {
  const alert = document.getElementById('visits-error');
  if (!alert) return;
  alert.textContent = '';
  alert.classList.add('d-none');
}

document.addEventListener('DOMContentLoaded', () => {
  const tableBody = document.getElementById('visits-today-body');
  if (!tableBody) return;

  const token = localStorage.getItem('authToken');
  if (!token) {
    showVisitsError('Connecte-toi pour consulter tes visites du jour.');
    tableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">Authentification requise.</td></tr>';
    return;
  }

  const loadVisits = async () => {
    hideVisitsError();
    tableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">Chargement des visites du jour…</td></tr>';

    try {
      const response = await fetch(VISITS_TODAY_URL, {
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
      const visits = (payload.data ?? []).slice();
      if (!visits.length) {
        tableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">Aucune visite planifiée aujourd\'hui.</td></tr>';
        return;
      }

      visits.sort((a, b) => {
        const dateA = new Date(a.scheduled_at ?? '');
        const dateB = new Date(b.scheduled_at ?? '');
        return dateB - dateA;
      });

      tableBody.innerHTML = visits
        .map((visit, index) => {
          const [firstName, ...rest] = (visit.visitor_name ?? '').split(/\s+/).filter(Boolean);
          const lastName = rest.join(' ') || '—';
          const email = visit.visitor_details?.email ?? '—';
          const priority = getPriorityBadge(visit.priority_score ?? 0);
          const status = STATUS_BADGES[visit.status] ?? { label: visit.status ?? 'Inconnu', className: 'badge bg-secondary' };
          return `
            <tr>
              <td class="col-auto">
                <div class="avatar avatar-md">
                  <img src="images/faces/5.jpg" alt="avatar">
                </div>
              </td>
              <td class="col-auto">
                <p class="mb-0">${firstName ?? '—'}</p>
              </td>
              <td class="col-auto">
                <p class="mb-0">${lastName}</p>
              </td>
              <td class="col-auto">
                <p class="mb-0">${email}</p>
              </td>
              <td class="col-auto">
                <p class="mb-0">${visit.visitor_phone ?? '—'}</p>
              </td>
              <td class="col-auto">
                <p class="mb-0 text-center">${formatDate(visit.scheduled_at)}</p>
              </td>
              <td class="col-auto text-center">
                <span class="${priority.className}">${priority.label}</span>
              </td>
              <td class="col-auto">
                <p class="mb-0 text-center">${formatDate(visit.scheduled_at)}</p>
              </td>
              <td class="col-auto">
                <p class="mb-0 text-center">—</p>
              </td>
              <td class="col-auto">
                <p class="mb-0 text-center">—</p>
              </td>
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
    } catch (error) {
      showVisitsError(error?.message || 'Impossible de charger les visites.');
      tableBody.innerHTML = '<tr><td colspan="11" class="text-center text-muted py-4">Impossible de récupérer les visites.</td></tr>';
    }
  };

  loadVisits();
  window.reloadTodayVisits = loadVisits;
});
