((window) => {
  'use strict';

  const ADMIN_ROLES = ['ROLE_SUPER_ADMIN', 'ROLE_ADMIN', 'ROLE_DIRECTOR'];
  const TERMINAL_ROLES = ['ROLE_RECEPTION', 'ROLE_TERMINAL', 'ROLE_ACCUEIL'];

  const ROUTES = [
    { path: '/login', file: 'index.html', title: 'Connexion' },
    { path: '/dashboard', file: 'home.html', protected: true },
    { path: '/users', file: 'users.html', protected: true, allowedRoles: ADMIN_ROLES },
    { path: '/visites', file: 'visites.html', protected: true },
    { path: '/visites/toutes', file: 'all-visites.html', protected: true },
    { path: '/verification', file: 'verification.html' },
    { path: `/security`, file: `page-security.html`, protected: true },
    { path: `/terminal`, file: `page-terminal.html`, protected: true, allowedRoles: TERMINAL_ROLES },
  ];

  const routeMap = new Map();
  ROUTES.forEach((route) => routeMap.set(route.path, route));

  const normalize = (url) => {
    if (!url) return '/';
    return url.split('?')[0].split('#')[0].replace(/\/+$/, '') || '/';
  };

  const getRoute = (path) => routeMap.get(normalize(path));

  const getDefaultAuthorizedRoute = () => {
    if (hasReceptionRole()) {
      return (
        routeMap.get('/terminal') ||
        routeMap.get('/visites') ||
        routeMap.get('/dashboard') ||
        routeMap.get('/login')
      );
    }
    return routeMap.get('/visites') || routeMap.get('/dashboard') || routeMap.get('/login');
  };

  const isAuthenticated = () => {
    return !!localStorage.getItem('authToken');
  };

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
    const rolesJson = sessionStorage.getItem('currentUserRoles');
    if (rolesJson) {
      try {
        const parsed = JSON.parse(rolesJson);
        if (Array.isArray(parsed)) {
          return parsed.map(normalizeRole).filter((role) => typeof role === 'string' && role);
        }
      } catch (error) {
        console.error('Impossible de parser les rôles utilisateur', error);
      }
    }

    const profileJson = localStorage.getItem('currentUserProfile');
    if (profileJson) {
      try {
        const parsedProfile = JSON.parse(profileJson);
        if (Array.isArray(parsedProfile?.roles)) {
          return parsedProfile.roles.map(normalizeRole).filter((role) => typeof role === 'string' && role);
        }
      } catch (error) {
        console.error('Impossible de parser le profil utilisateur', error);
      }
    }

    return [];
  };

  const isReceptionRole = (role) => {
    if (typeof role !== 'string') return false;
    return role.includes('RECEPTION') || role.includes('TERMINAL') || role.includes('ACCUEIL');
  };

  const hasReceptionRole = () => getStoredRoles().some(isReceptionRole);

  const normalizeAllowedRoles = (roles) => {
    if (!Array.isArray(roles) || !roles.length) {
      return [];
    }
    return roles
      .map(normalizeRole)
      .filter((role) => typeof role === 'string' && role);
  };

  const guardRoute = (route, options = {}) => {
    if (!route) return null;
    const { allowOptimistic = true } = options;

    const storedRoles = getStoredRoles();
    const rolesKnown = storedRoles.length > 0;

    if (route.protected && !isAuthenticated()) {
      console.warn('Accès refusé → redirect login');
      return routeMap.get('/login');
    }

    if (route.allowedRoles) {
      const normalizedAllowed = normalizeAllowedRoles(route.allowedRoles);
      const hasAllowedRole = storedRoles.some((role) => normalizedAllowed.includes(role));
      if (hasAllowedRole) return route;
      if (!rolesKnown && allowOptimistic) return route;
      console.warn(`Accès restreint → redirection vers ${getDefaultAuthorizedRoute()?.path}`);
      return getDefaultAuthorizedRoute();
    }

    return route;
  };

  const navigate = (path, options = {}) => {
    const { hash } = options;
    const requestedRoute = getRoute(path);

    if (!requestedRoute) {
      console.error('Route inconnue:', path);
      return;
    }

    let route = guardRoute(requestedRoute);
    if (!route) {
      console.error('Aucune route disponible pour cette destination:', path);
      return;
    }

    const shouldAppendHash = hash && route && requestedRoute.path === route.path;
    const finalPath = shouldAppendHash ? `${route.path}#${hash}` : route.path;
    history.pushState({}, '', finalPath);
    window.location.reload();
  };

  const handleLink = (e) => {
    const route = e.currentTarget.dataset.route;
    if (!route) return;

    e.preventDefault();
    const anchor = e.currentTarget.dataset.anchor;
    navigate(route, { hash: anchor });
  };

  const bindLinks = () => {
    document.querySelectorAll('[data-route]').forEach((el) => {
      el.removeEventListener('click', handleLink);
      el.addEventListener('click', handleLink);
    });
  };

  document.addEventListener('DOMContentLoaded', () => {
    const currentPath = normalize(window.location.pathname);
    let route = getRoute(currentPath);

    route = guardRoute(route);

    if (!route) {
      console.warn('fallback → login');
      route = routeMap.get('/login');
      if (route) {
        history.replaceState({}, '', route.path);
      }
    }

    if (route && route.path !== currentPath) {
      history.replaceState({}, '', route.path);
      window.location.reload();
      return;
    }

    if (route?.title) {
      document.title = route.title;
    }

    bindLinks();

    console.log('Route active:', route?.path);
  });

  const evaluateCurrentRoute = () => {
    const currentPath = normalize(window.location.pathname);
    const currentRoute = getRoute(currentPath);
    const guardedRoute = guardRoute(currentRoute, { allowOptimistic: false });

    if (guardedRoute && currentRoute && guardedRoute.path !== currentRoute.path) {
      history.replaceState({}, '', guardedRoute.path);
      window.location.reload();
    }
  };

  window.addEventListener('currentUserProfileUpdated', evaluateCurrentRoute);

  window.addEventListener('popstate', () => {
    window.location.reload();
  });
})(window);
