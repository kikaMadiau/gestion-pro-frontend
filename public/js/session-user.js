// session-user.js - Gestion des données utilisateur en session
console.log('📂 session-user.js chargé');

// Log initial du storage
console.log('🔍 Storage au chargement:');
console.log('  sessionStorage.currentUserRoles:', sessionStorage.getItem('currentUserRoles'));
console.log('  localStorage.currentUserProfile:', localStorage.getItem('currentUserProfile'));

const ROLE_LABELS = {
  ROLE_SUPER_ADMIN: 'Super Admin',
  ROLE_ADMIN: 'Administrateur',
  ROLE_DIRECTOR: 'Directeur',
  ROLE_USER: 'Utilisateur',
  ROLE_EMPLOYEE: 'Employé',
  ROLE_SECURITY: 'Sécurité',
  ROLE_RECEPTION: 'Réception',
  ROLE_TERMINAL: 'Terminal',
  ROLE_ACCUEIL: 'Accueil',
};

const normalizeRoleForComparison = (value) => {
  if (!value) return null;
  if (typeof value === 'string') {
    return value.trim().toUpperCase();
  }
  if (typeof value === 'object') {
    const candidate = value.name ?? value.role ?? value.key ?? value.direction ?? '';
    if (!candidate) return null;
    return candidate.toString().trim().toUpperCase() || null;
  }
  return null;
};

const readStoredRoles = () => {
  const roles = [];

  const sessionRoles = sessionStorage.getItem('currentUserRoles');
  if (sessionRoles) {
    try {
      const parsedRoles = JSON.parse(sessionRoles);
      console.log('📦 currentUserRoles trouvé dans sessionStorage:', parsedRoles);
      if (Array.isArray(parsedRoles)) {
        parsedRoles.forEach((role) => {
          const normalized = normalizeRoleForComparison(role);
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
        const parsedProfile = JSON.parse(profileJson);
        console.log('📦 currentUserProfile trouvé dans localStorage:', parsedProfile);
        if (Array.isArray(parsedProfile?.roles)) {
          parsedProfile.roles.forEach((role) => {
            const normalized = normalizeRoleForComparison(role);
            if (normalized) roles.push(normalized);
          });
        }
      } catch (error) {
        console.error('Impossible de parser currentUserProfile pour les rôles', error);
      }
    }
  }

  if (roles.length > 0) {
    console.log('✅ readStoredRoles() retourne:', roles);
  } else {
    console.log('⚠️  readStoredRoles() - Aucun rôle trouvé');
  }

  return roles;
};

const isReceptionRole = (role) => {
  if (typeof role !== 'string') return false;
  const upperRole = role.toUpperCase();
  const isReception = upperRole.includes('RECEPTION') || upperRole.includes('TERMINAL') || upperRole.includes('ACCUEIL');
  console.log(`🔎 isReceptionRole("${role}") = ${isReception}`);
  return isReception;
};

const isReceptionUser = () => {
  const roles = readStoredRoles();
  const hasReception = roles.some(isReceptionRole);
  console.log('� isReceptionUser():', { roles, hasReception });
  return hasReception;
};

const getLandingPathForUser = () => {
  const isReception = isReceptionUser();
  const path = isReception ? '/terminal' : '/dashboard';
  console.log('🎯 getLandingPathForUser():', { isReception, path });
  return path;
};

window.isReceptionUser = isReceptionUser;
window.getLandingPathForUser = getLandingPathForUser;

function resolveFriendlyRole(roles) {
  if (!Array.isArray(roles)) return null;
  for (const role of roles) {
    const normalized = (role ?? '').toString().toUpperCase();
    if (ROLE_LABELS[normalized]) {
      return ROLE_LABELS[normalized];
    }
  }
  return null;
}

function storeCurrentUserFromPayload(data) {
  console.log('🎯 storeCurrentUserFromPayload() appelé avec:', data);
  
  if (!data || typeof data !== 'object') {
    console.warn('⚠️  Data invalide ou non-objet');
    return;
  }

  const userInfo =
    data.user ??
    data.data?.user ??
    data.profile ??
    data.employee ??
    data.auth?.user ??
    data;
  
  console.log('👤 userInfo extrait:', userInfo);
  
  if (!userInfo || typeof userInfo !== 'object') {
    console.warn('⚠️  userInfo invalide');
    return;
  }

  const name =
    userInfo.name ||
    userInfo.full_name ||
    userInfo.fullName ||
    `${userInfo.first_name ?? ''} ${userInfo.last_name ?? ''}`.trim() ||
    userInfo.email;
  const direction =
    userInfo.direction ||
    userInfo.department ||
    userInfo.position ||
    userInfo.job_title ||
    userInfo.role;
  if (name) sessionStorage.setItem('currentUserName', name);
  if (direction) sessionStorage.setItem('currentUserDirection', direction);

  const rolesCandidate =
    userInfo.roles ??
    data.roles ??
    userInfo.role ??
    userInfo.role_name ??
    userInfo.direction_roles ??
    userInfo.directionRoles;

  const normalizeRole = (role) => {
    if (!role) return null;
    if (typeof role === 'string') return role;
    if (typeof role === 'object') {
      return role.name ?? role.key ?? role.role ?? null;
    }
    return null;
  };

  console.log('🔍 Extraction des rôles - rolesCandidate:', rolesCandidate);

  let normalizedRoles = [];
  if (Array.isArray(rolesCandidate)) {
    console.log('📦 rolesCandidate est un tableau:', rolesCandidate);
    normalizedRoles = rolesCandidate
      .map(normalizeRole)
      .filter((value) => typeof value === 'string' && value.trim() !== '');
  } else if (rolesCandidate) {
    console.log('⚠️  rolesCandidate n\'est pas un tableau:', typeof rolesCandidate, rolesCandidate);
    const singleRole = normalizeRole(rolesCandidate);
    if (typeof singleRole === 'string') {
      normalizedRoles = [singleRole];
    }
  } else {
    console.log('⚠️  rolesCandidate est undefined/null');
  }

  console.log('✅ Rôles extraits après normalisation:', normalizedRoles);

  if (normalizedRoles.length) {
    sessionStorage.setItem('currentUserRoles', JSON.stringify(normalizedRoles));
    console.log('✅ Rôles stockés dans sessionStorage:', normalizedRoles);
  } else {
    sessionStorage.removeItem('currentUserRoles');
    console.log('⚠️  Aucun rôle trouvé dans la réponse de connexion');
  }

  const profilePayload = {
    name,
    direction,
    roles: normalizedRoles,
    email: userInfo.email ?? null,
    friendlyRole: resolveFriendlyRole(normalizedRoles),
  };

  if (name || direction || normalizedRoles.length) {
    localStorage.setItem('currentUserProfile', JSON.stringify(profilePayload));
  } else {
    localStorage.removeItem('currentUserProfile');
  }

  const dispatchProfileUpdate = () => {
    try {
      window.dispatchEvent(new Event('currentUserProfileUpdated'));
    } catch (error) {
      console.error("Impossible d'émettre l'événement de profil utilisateur", error);
    }
  };

  dispatchProfileUpdate();
}

window.storeCurrentUserFromPayload = storeCurrentUserFromPayload;
console.log('✅ window.storeCurrentUserFromPayload disponible');

const clearAuthState = () => {
  localStorage.removeItem('authToken');
  sessionStorage.removeItem('currentUserName');
  sessionStorage.removeItem('currentUserDirection');
  sessionStorage.removeItem('currentUserRoles');
  localStorage.removeItem('currentUserProfile');
};

const redirectToHome = () => {
  clearAuthState();
  window.location.replace('/');
};

const handleUnauthorizedResponseStatus = (status) => {
  if (status === 401) {
    redirectToHome();
    return true;
  }
  return false;
};

window.handleUnauthorizedResponseStatus = handleUnauthorizedResponseStatus;
window.readStoredRoles = readStoredRoles;
