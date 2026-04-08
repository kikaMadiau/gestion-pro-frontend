# Hybrid routing et sécurité

Ce projet expose une **double couche de routage** :

1. **Réécriture serveur** : les URLs “propres” (`/dashboard`, `/visites`, `/users`, `/login`, `/verification`) sont recadrées vers les fichiers HTML existants par les règles de `.htaccess`, `_redirects` (Netlify) et `vercel.json`. Si vous hébergez ailleurs, reproduisez simplement ces redirections dans la configuration de votre serveur ou CDN.

2. **Router client léger** : `js/router.js` isole toutes les redirections internes en utilisant des attributs `data-route` / `data-target`. Lorsqu’un utilisateur clique sur un lien, le script charge le `.html` réel tout en mettant à jour l’URL affichée (`history.replaceState`). Chaque page contient un `data-route-page` (ex. `home.html`) qui permet au script de savoir quel chemin propre doit être affiché.

## En résumé

- Les ancres de navigation (`logo`, menu, breadcrumbs, boutons “Voir plus”, le bouton “Déconnexion”…) utilisent désormais `href="/chemin"` et `data-target="fichier.html"`.
- Chaque page qui nécessite une session active (`home.html`, `users.html`, `visites.html`, `all-visites.html`) inclut `js/auth-guard.js` et définit `data-protected="true"` sur `<body>` ; sans `authToken`, l’utilisateur est redirigé sur `/login`.
- `js/router.js` veille à ce que la navigation reste fluide, que l’URL affichée soit claire et que les liens fonctionnent même en cas de rafraîchissement.

## Que faire en production ?

1. Activez la configuration adaptée à votre hébergeur (Apache/Nginx, Netlify, Vercel, etc.).
2. Servez toujours le dossier racine via HTTPS et ajoutez les en-têtes de sécurité recommandés (CSP, HSTS, SameSite=strict pour les cookies).
3. Pensez à purger le cache des navigateurs CDN si vous déployez les nouveaux fichiers JS.
