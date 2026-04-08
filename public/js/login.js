const API_URL = 'http://127.0.0.1:8000/auth/login';

function setError(message) {
  const errorBox = document.getElementById('login-error');
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('d-none');
}

function clearError() {
  const errorBox = document.getElementById('login-error');
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.add('d-none');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const emailInput = document.getElementById('login-email');
  const passwordInput = document.getElementById('login-password');
  if (!form || !emailInput || !passwordInput) return;
  const submitButton = form.querySelector('button[type="submit"]');

  form.addEventListener('submit', async event => {
    event.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value;
    if (!email || !password) {
      setError('Veuillez renseigner votre email et votre mot de passe.');
      return;
    }

    clearError();
    submitButton?.setAttribute('disabled', '');
    submitButton?.classList.add('opacity-75');

    try {
      console.log('Login attempt', { email, channel: 'sms' });
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          password,
          channel: 'sms',
        }),
      });
      console.log('Raw response', response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.message || errorData?.detail || 'Identifiants invalides.';
        throw new Error(message);
      }

      const data = await response.json();
      console.log('Login response payload', data);
      console.log('🔍 Structure complète de data:', JSON.stringify(data, null, 2));
      
      const token = data.token ?? data.access_token ?? data.data?.token;
      const otp = data.otp ?? data.code ?? data.verificationCode ?? data.data?.otp;
      const twoFactorRequestId =
        data.two_factor_request_id ??
        data.data?.two_factor_request_id ??
        data.twoFactorRequestId;

      if (token) {
        localStorage.setItem('authToken', token);
        console.log('Token stored', token);
        sessionStorage.removeItem('two_factor_request_id');
      }

      if (twoFactorRequestId) {
        sessionStorage.setItem('two_factor_request_id', twoFactorRequestId);
        console.log('2FA request id stocké', twoFactorRequestId);
      }

      if (otp) {
        sessionStorage.setItem('two_factor_otp', otp);
        console.log('OTP simulé (extrait de la réponse)', otp);
      }

      console.log('✅ Profil utilisateur stocké');
      console.log('🔍 window.storeCurrentUserFromPayload type:', typeof window.storeCurrentUserFromPayload);
      
      // Vérifier que storeCurrentUserFromPayload est disponible
      let profileStored = false;
      if (typeof window.storeCurrentUserFromPayload === 'function') {
        console.log('🔄 Appel de window.storeCurrentUserFromPayload...');
        try {
          window.storeCurrentUserFromPayload(data);
          profileStored = true;
          console.log('✅ storeCurrentUserFromPayload exécuté avec succès');
        } catch (err) {
          console.error('❌ Erreur lors de storeCurrentUserFromPayload:', err);
        }
      } else {
        console.warn('⚠️  window.storeCurrentUserFromPayload NON disponible');
      }
      
      // Fallback: s'assurer que les rôles sont TOUJOURS stockés, même si storeCurrentUserFromPayload échoue
      console.log('📦 Fallback: Stockage direct des données...');
      if (data.roles && Array.isArray(data.roles)) {
        console.log('💾 Stockage des rôles dans sessionStorage:', data.roles);
        sessionStorage.setItem('currentUserRoles', JSON.stringify(data.roles));
        
        // AUSSI dans localStorage comme backup
        const profile = {
          roles: data.roles,
          name: data.full_name || data.name || data.email,
          email: data.email
        };
        localStorage.setItem('currentUserProfile', JSON.stringify(profile));
        console.log('💾 Profil stocké dans localStorage:', profile);
      } else {
        console.warn('⚠️  Pas de rôles trouvés dans data.roles');
        console.log('📋 Structure de data:', Object.keys(data));
      }

      if (twoFactorRequestId) {
        window.location.href = '/verification';
        return;
      }

      // Attendre un bit longer pour s'assurer que tout est écrit
      setTimeout(() => {
        const sessionRoles = sessionStorage.getItem('currentUserRoles');
        const localProfile = localStorage.getItem('currentUserProfile');
        console.log('📋 Vérification avant redirection:');
        console.log('  - sessionStorage.currentUserRoles:', sessionRoles);
        console.log('  - localStorage.currentUserProfile:', localProfile);
        
        const landingPath = window.getLandingPathForUser?.() ?? '/dashboard';
        console.log('🚀 Login: Redirection vers:', landingPath);
        console.log('🔍 Rôles détectés:', window.readStoredRoles?.());
        window.location.href = landingPath;
      }, 200);
    } catch (error) {
      setError(error?.message || 'Impossible de joindre le serveur.');
      console.error('Login failed', error);
    } finally {
      submitButton?.removeAttribute('disabled');
      submitButton?.classList.remove('opacity-75');
    }
  });
});
