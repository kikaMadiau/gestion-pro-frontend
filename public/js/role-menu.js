(() => {
  const ADMIN_ROLES = new Set([
    'ROLE_SUPER_ADMIN',
    'ROLE_ADMIN',
    'ROLE_DIRECTOR',
  ]);

  const normalizeRole = (value) => {
    if (!value) return null;
    if (typeof value === 'string') {
      return value.trim().toUpperCase();
    }
    if (typeof value === 'object') {
      return (value.name ?? value.role ?? value.key ?? '').toString().trim().toUpperCase();
    }
    return null;
  };

  const getStoredRoles = () => {
    const storedRoles = sessionStorage.getItem('currentUserRoles');
    if (storedRoles) {
      try {
        const parsed = JSON.parse(storedRoles);
        if (Array.isArray(parsed)) {
          return parsed
            .map(normalizeRole)
            .filter((role) => typeof role === 'string' && role);
        }
      } catch (error) {
        console.error('Impossible de parser currentUserRoles', error);
      }
    }

    const profileJson = localStorage.getItem('currentUserProfile');
    if (profileJson) {
      try {
        const parsedProfile = JSON.parse(profileJson);
        if (Array.isArray(parsedProfile?.roles)) {
          return parsedProfile.roles
            .map(normalizeRole)
            .filter((role) => typeof role === 'string' && role);
        }
      } catch (error) {
        console.error('Impossible de parser currentUserProfile pour les rôles', error);
      }
    }

    return [];
  };

  const SIDEBAR_ITEMS = ['[data-route="/dashboard"]', '[data-route="/users"]'];
  const SIDEBAR_TITLES = ['gestion des utilisateur'];

  const setSidebarItemVisibility = (selector, visible) => {
    const anchor = document.querySelector(selector);
    if (!anchor) return;
    const item = anchor.closest('li');
    if (!item) return;
    if (visible) {
      item.classList.remove('d-none');
    } else {
      item.classList.add('d-none');
    }
  };

  const setSidebarTitleVisibility = (containsText, visible) => {
    document.querySelectorAll('.sidebar-title').forEach((title) => {
      if (title.textContent?.trim().toLowerCase().includes(containsText.toLowerCase())) {
        if (visible) {
          title.classList.remove('d-none');
        } else {
          title.classList.add('d-none');
        }
      }
    });
  };

  const applyRestrictions = () => {
    const roles = getStoredRoles();
    if (!roles.length) {
      return;
    }

    const isAdmin = roles.some((role) => ADMIN_ROLES.has(role));
    SIDEBAR_ITEMS.forEach((selector) => setSidebarItemVisibility(selector, isAdmin));
    SIDEBAR_TITLES.forEach((text) => setSidebarTitleVisibility(text, isAdmin));
  };

  document.addEventListener('DOMContentLoaded', () => {
    applyRestrictions();
    window.addEventListener('currentUserProfileUpdated', applyRestrictions);
  });
})();
