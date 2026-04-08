const VERIFICATION_URL = 'http://127.0.0.1:8000/auth/2fa/verify';

function showVerificationError(message) {
  const errorBox = document.getElementById('verification-error');
  if (!errorBox) return;
  errorBox.textContent = message;
  errorBox.classList.remove('d-none');
}

function clearVerificationError() {
  const errorBox = document.getElementById('verification-error');
  if (!errorBox) return;
  errorBox.textContent = '';
  errorBox.classList.add('d-none');
}

function showSimulatedOtp(code) {
  const container = document.getElementById('verification-otp');
  const value = document.getElementById('verification-otp-code');
  if (!container || !value) return;
  value.textContent = code;
  container.classList.remove('d-none');
}

function hideSimulatedOtp() {
  const container = document.getElementById('verification-otp');
  if (container) container.classList.add('d-none');
}

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('verification-form');
  const inputs = document.querySelectorAll('.otp-input');
  if (!form || inputs.length === 0) return;

  const submitButton = form.querySelector('button[type="submit"]');
  const twoFactorRequestId = sessionStorage.getItem('two_factor_request_id');
  const simulatedOtp = sessionStorage.getItem('two_factor_otp');
  if (!twoFactorRequestId) {
    showVerificationError("Aucune demande de vérification trouvée : reconnecte-toi pour en générer une.");
  }

  if (simulatedOtp) {
    showSimulatedOtp(simulatedOtp);
  }

  inputs.forEach((input, index) => {
    input.addEventListener('input', () => {
      if (input.value.length === 1 && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }
    });

    input.addEventListener('keydown', event => {
      if (event.key === 'Backspace' && input.value === '' && index > 0) {
        inputs[index - 1].focus();
      }
    });
  });

  form.addEventListener('submit', async event => {
    event.preventDefault();
    clearVerificationError();

    if (!twoFactorRequestId) {
      showVerificationError('Impossible d’envoyer le code : la session est expirée. Reconnecte-toi.');
      return;
    }

    const code = Array.from(inputs)
      .map(input => input.value.trim())
      .join('');

    if (code.length !== inputs.length) {
      showVerificationError('Le code doit contenir 6 chiffres.');
      return;
    }

    submitButton?.setAttribute('disabled', '');
    submitButton?.classList.add('opacity-75');

    try {
      console.log('Vérification OTP', { two_factor_request_id: twoFactorRequestId, code });
      const response = await fetch(VERIFICATION_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          two_factor_request_id: twoFactorRequestId,
          code,
        }),
      });
      console.log('Raw verification response', response);

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        const message = errorData?.message || errorData?.detail || 'Code invalide.';
        throw new Error(message);
      }

      const data = await response.json();
      console.log('Verification payload', data);
      const token = data.token ?? data.access_token ?? data.data?.token;
      if (token) {
        localStorage.setItem('authToken', token);
        console.log('Token stocké après vérification OTP', token);
      }

      window.storeCurrentUserFromPayload?.(data);

      sessionStorage.removeItem('two_factor_request_id');
      sessionStorage.removeItem('two_factor_otp');
      hideSimulatedOtp();
      
      // Attendre un peu que les rôles soient stockés
      setTimeout(() => {
        const landingPath = window.getLandingPathForUser?.() ?? '/dashboard';
        console.log('🚀 Redirection après vérification vers:', landingPath);
        window.location.href = landingPath;
      }, 100);
    } catch (error) {
      showVerificationError(error?.message || 'Impossible de valider le code.');
      console.error('Vérification OTP échouée', error);
    } finally {
      submitButton?.removeAttribute('disabled');
      submitButton?.classList.remove('opacity-75');
    }
  });
});
