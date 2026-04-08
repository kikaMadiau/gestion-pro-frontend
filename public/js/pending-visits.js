const PENDING_VISITS_URL = 'http://127.0.0.1:8000/api/audiences/dashboard/my/pending';

const formatRelativeProgress = (currentStep) => {
  if (!currentStep) return 'En attente';
  return currentStep.charAt(0).toUpperCase() + currentStep.slice(1);
};

const createVisitCard = (visit) => {
  const visitorName = visit.visitor_name ?? 'Visiteur inconnu';
  const status = visit.status?.toLowerCase() ?? 'pending';
  const statusLabel = status === 'registered' ? 'Enregistré' : status === 'delayed' ? 'Retardé' : status;
  const scheduledAt = new Date(visit.scheduled_at ?? '');
  const formattedDate = Number.isNaN(scheduledAt.getTime())
    ? 'Horaire non défini'
    : new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }).format(scheduledAt);

  return `
    <div class="recent-message d-flex px-4 py-3 relative-wrapper profile-card">
      <div class="body-upper-wrapper">
        <a href="#" class="btn btn-primary btn-sm" data-bs-toggle="modal" data-bs-target="#visitor-progression">
          <i class="icon dripicons-preview"></i>
        </a>
      </div>
      <div class="avatar avatar-lg">
        <img src="images/faces/4.jpg" alt="${visitorName}">
      </div>
      <div class="name ms-4">
        <h5 class="mb-1 txt-17">${visitorName}</h5>
        <h6 class="text-muted mb-0 txt-14">${statusLabel} • ${formatRelativeProgress(visit.current_step)} • ${formattedDate}</h6>
      </div>
    </div>
  `;
};

const showMessageInSection = (section, message) => {
  const list = section.querySelector('[data-pending-list]');
  if (!list) return;
  list.innerHTML = `
    <div class="recent-message d-flex px-4 py-3 relative-wrapper profile-card">
      <div class="name ms-4">
        <p class="text-muted mb-0 text-center w-100">${message}</p>
      </div>
    </div>
  `;
};

const populateSection = (section, visits, count) => {
  const list = section.querySelector('[data-pending-list]');
  const countBadge = section.querySelector('[data-pending-count]');
  if (countBadge) {
    countBadge.textContent = `${count ?? 0} en attente`;
  }
  if (!list) return;
  if (!visits.length) {
    showMessageInSection(section, 'Aucune visite en attente pour le moment.');
    return;
  }
  list.innerHTML = visits.map(createVisitCard).join('');
};

const sections = () => Array.from(document.querySelectorAll('[data-pending-section]'));

document.addEventListener('DOMContentLoaded', async () => {
  const sectionElements = sections();
  if (!sectionElements.length) return;

  const token = localStorage.getItem('authToken');
  if (!token) {
    sectionElements.forEach((section) => {
      showMessageInSection(section, 'Connecte-toi pour afficher les visites en attente.');
    });
    return;
  }

  try {
    const response = await fetch(`${PENDING_VISITS_URL}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (window.handleUnauthorizedResponseStatus?.(response.status)) {
      return;
    }

    if (!response.ok) {
      const err = await response.json().catch(() => null);
      throw new Error(err?.message || `Échec (${response.status})`);
    }

    const payload = await response.json();
    const visits = payload.pending_visits ?? [];
    const count = payload.count ?? visits.length ?? 0;

    sectionElements.forEach((section) => {
      populateSection(section, visits, count);
    });
  } catch (error) {
    const message = error?.message || 'Impossible de charger les visites en attente.';
    sectionElements.forEach((section) => {
      showMessageInSection(section, message);
    });
  }
});
