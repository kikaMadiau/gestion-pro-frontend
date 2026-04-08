(() => {
  const ROLE_LABELS = {
    ROLE_SUPER_ADMIN: 'Super Admin',
    ROLE_ADMIN: 'Administrateur',
    ROLE_DIRECTOR: 'Directeur',
    ROLE_USER: 'Utilisateur',
    ROLE_EMPLOYEE: 'Employé',
    ROLE_SECURITY: 'Sécurité',
  };

  const toFriendlyRole = (value) => {
    if (!value) return null;
    if (Array.isArray(value)) {
      for (const role of value) {
        const normalized = (role ?? '').toString().toUpperCase();
        if (ROLE_LABELS[normalized]) {
          return ROLE_LABELS[normalized];
        }
      }
      return null;
    }
    const normalized = value.toString().toUpperCase();
    return ROLE_LABELS[normalized] ?? null;
  };
  const populateMenu = (name, direction) => {
    const nameElements = document.querySelectorAll('.user-name-value');
    const directionElements = document.querySelectorAll('.user-direction-value');

    if (name) {
      nameElements.forEach(el => {
        el.textContent = name;
      });
    }

    if (direction) {
      directionElements.forEach(el => {
        el.textContent = direction;
      });
    }
  };

  const decodeJwt = (token) => {
    if (!token) return {};
    const [, payloadEncoded] = token.split('.');
    if (!payloadEncoded) return {};
    try {
      const jsonPayload = decodeURIComponent(
        atob(payloadEncoded.replace(/-/g, '+').replace(/_/g, '/'))
          .split('')
          .map(c => `%${('00' + c.charCodeAt(0).toString(16)).slice(-2)}`)
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (error) {
      console.error('Impossible de parser le JWT', error);
      return {};
    }
  };

  const hydrateFromStorage = () => {
    let name = sessionStorage.getItem('currentUserName');
    let direction = sessionStorage.getItem('currentUserDirection');

    if (!name || !direction) {
      const profileJson = localStorage.getItem('currentUserProfile');
      if (profileJson) {
        try {
          const parsed = JSON.parse(profileJson);
          if (!name) name = parsed?.name ?? null;
          if (!direction) direction = parsed?.direction ?? parsed?.friendlyRole ?? null;
        } catch (error) {
          console.error('Impossible de parser currentUserProfile', error);
        }
      }
    }

    if (!name || !direction) {
      const jwtPayload = decodeJwt(localStorage.getItem('authToken'));
      if (!name) {
        name = jwtPayload?.name ?? jwtPayload?.full_name ?? jwtPayload?.email ?? null;
      }
      if (!direction) {
        const friendlyFromJwt = toFriendlyRole(jwtPayload?.roles ?? jwtPayload?.role ?? jwtPayload?.direction_roles);
        direction = friendlyFromJwt ?? jwtPayload?.position ?? jwtPayload?.job_title ?? jwtPayload?.role ?? null;
      }
    }

    if (name || direction) {
      populateMenu(name, direction);
      return true;
    }
    return false;
  };

  const PROFILE_ENDPOINTS = [
    'http://127.0.0.1:8000/auth/me',
    'http://127.0.0.1:8000/user/me',
    'http://127.0.0.1:8000/users/me',
    'http://127.0.0.1:8000/me',
  ];

  const fetchServerProfile = async () => {
    const token = localStorage.getItem('authToken');
    if (!token) return;
    for (const path of PROFILE_ENDPOINTS) {
      try {
        const response = await fetch(path, {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (window.handleUnauthorizedResponseStatus?.(response.status)) {
          return;
        }

        if (!response.ok) {
          continue;
        }
        const data = await response.json();
        window.storeCurrentUserFromPayload?.(data);
        return;
      } catch (error) {
        continue;
      }
    }
  };

  const ensureProfile = async () => {
    if (hydrateFromStorage()) return;
    await fetchServerProfile();
    hydrateFromStorage();
  };

  document.addEventListener('DOMContentLoaded', () => {
    hydrateFromStorage();
    ensureProfile();
  });
  ensureProfile();
  window.addEventListener('currentUserProfileUpdated', () => {
    hydrateFromStorage();
  });
})();
