function initDeleteUserFlow() {
  const pageEl = document.querySelector('.delete-page') as HTMLElement | null;
  const GOOGLE_CLIENT_ID = pageEl?.dataset.clientId || '715076094331-7mtbcp2hvd382r645ss6tsri18ekk6om.apps.googleusercontent.com';
  const API_URL = pageEl?.dataset.apiUrl || 'https://api.chatz.deez.in';

  // State storage
  let currentAuthUser: any = null;
  let countdownInterval: any = null;
  let remainingSeconds = 10;
  const TOTAL_SECONDS = 10;
  const CIRCUMFERENCE = 2 * Math.PI * 38; // ~238.76

  // DOM Elements
  const initialView = document.getElementById('initial-view');
  const confirmationView = document.getElementById('confirmation-view');
  const errorView = document.getElementById('error-view');
  const deletionModal = document.getElementById('deletion-modal');
  const modalCloseBtn = document.getElementById('modal-close-btn');
  const modalCancelBtn = document.getElementById('modal-cancel-btn');
  const modalConfirmBtn = document.getElementById('modal-confirm-delete-btn') as HTMLButtonElement | null;
  const deleteBtnLabel = document.getElementById('delete-btn-label');
  const countdownNumber = document.getElementById('countdown-number');
  const countdownProgress = document.getElementById('countdown-progress-circle') as SVGCircleElement | null;
  const countdownStatusText = document.getElementById('countdown-status-text');
  const modalLoadingState = document.getElementById('modal-loading-state');
  const modalUserEmail = document.getElementById('modal-user-email');
  const modalUserAvatar = document.getElementById('modal-user-avatar');
  const googleAuthBtn = document.getElementById('google-auth-btn');
  const retryBtn = document.getElementById('retry-deletion-btn');

  // Confirmed / Error fields
  const confirmedEmail = document.getElementById('confirmed-user-email');
  const confirmedTimestamp = document.getElementById('confirmed-timestamp');
  const errorMessageText = document.getElementById('error-message-text');
  const errorCodeBadge = document.getElementById('error-code-badge');

  // PKCE Utilities (Native Web Crypto)
  function base64UrlEncode(buffer: ArrayBuffer | Uint8Array): string {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  }

  function generateCodeVerifier(): string {
    const randomBytes = new Uint8Array(64);
    window.crypto.getRandomValues(randomBytes);
    return base64UrlEncode(randomBytes);
  }

  async function generateCodeChallenge(verifier: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(verifier);
    const digest = await window.crypto.subtle.digest('SHA-256', data);
    return base64UrlEncode(digest);
  }

  // Parse JWT token payload without external libraries
  function parseJwt(token: string): any {
    try {
      const base64Url = token.split('.')[1];
      if (!base64Url) return null;
      const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
      const jsonPayload = decodeURIComponent(
        atob(base64)
          .split('')
          .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
          .join('')
      );
      return JSON.parse(jsonPayload);
    } catch (e) {
      return null;
    }
  }

  // Process OAuth tokens and open confirmation modal
  function processAuthTokens(code: string | null, idToken: string | null) {
    const codeVerifier = sessionStorage.getItem('deez_pkce_verifier');
    const redirectUri = sessionStorage.getItem('deez_oauth_redirect_uri') || (window.location.origin + '/delete-user');

    const claims = idToken ? (parseJwt(idToken) || {}) : {};
    const email = claims.email || 'Authenticated Google User';
    const name = claims.name || 'Google User';
    const picture = claims.picture || null;
    const sub = claims.sub || 'user-sub';

    handleAuthSuccess({
      code,
      codeVerifier,
      redirectUri,
      idToken,
      email,
      name,
      picture,
      sub,
    });
  }

  // Check if redirected from Google OAuth with code / id_token in hash or search
  function checkOAuthRedirect() {
    let params: URLSearchParams | null = null;
    const hash = window.location.hash;
    const search = window.location.search;

    if (hash && (hash.includes('code=') || hash.includes('id_token='))) {
      params = new URLSearchParams(hash.substring(1));
    } else if (search && (search.includes('code=') || search.includes('id_token='))) {
      params = new URLSearchParams(search.substring(1));
    }

    if (!params) return;

    const code = params.get('code');
    const idToken = params.get('id_token');
    const error = params.get('error');

    if (error) {
      showErrorView(`Google authentication cancelled or failed: ${error}`, 401);
      return;
    }

    if (code || idToken) {
      // If in a popup, signal opener and close
      if (window.opener && !window.opener.closed) {
        try {
          window.opener.postMessage(
            { type: 'DEEZ_GOOGLE_AUTH_TOKEN', code, idToken },
            window.location.origin
          );
          window.close();
          return;
        } catch (e) {
          // Ignore cross-window communication errors
        }
      }

      // Clean the hash and query parameters from URL bar without page reload
      history.replaceState(null, '', window.location.pathname);

      processAuthTokens(code, idToken);
    }
  }

  // Listen for popup postMessage
  window.addEventListener('message', (event) => {
    if (event.origin !== window.location.origin) return;
    if (event.data && event.data.type === 'DEEZ_GOOGLE_AUTH_TOKEN') {
      const { code, idToken } = event.data;
      processAuthTokens(code, idToken);
    }
  });

  // Run redirect check on load
  checkOAuthRedirect();

  // Pure First-Party Google OAuth PKCE Trigger
  googleAuthBtn?.addEventListener('click', async () => {
    try {
      const redirectUri = window.location.origin + '/delete-user';
      const verifier = generateCodeVerifier();
      const challenge = await generateCodeChallenge(verifier);
      const nonce = Math.random().toString(36).substring(2) + Date.now().toString(36);
      const state = 'oauth_' + Date.now() + '_' + Math.random().toString(36).substring(2);

      // Store PKCE verifier and redirect URI in sessionStorage
      sessionStorage.setItem('deez_pkce_verifier', verifier);
      sessionStorage.setItem('deez_oauth_redirect_uri', redirectUri);
      sessionStorage.setItem('deez_oauth_state', state);

      // Request hybrid flow (code for PKCE exchange on backend, id_token for frontend email display)
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(
        GOOGLE_CLIENT_ID
      )}&redirect_uri=${encodeURIComponent(
        redirectUri
      )}&response_type=code%20id_token&scope=openid%20email%20profile&nonce=${nonce}&state=${state}&prompt=select_account&code_challenge=${encodeURIComponent(
        challenge
      )}&code_challenge_method=S256`;

      // Try opening in popup window first
      const width = 500;
      const height = 650;
      const left = Math.max(0, (window.innerWidth - width) / 2 + window.screenX);
      const top = Math.max(0, (window.innerHeight - height) / 2 + window.screenY);

      let popup: Window | null = null;
      try {
        popup = window.open(
          authUrl,
          'google_auth_window',
          `width=${width},height=${height},left=${left},top=${top},status=no,toolbar=no,menubar=no`
        );
      } catch (e) {
        popup = null;
      }

      // If popup is blocked by browser, redirect current window
      if (!popup || popup.closed || typeof popup.closed === 'undefined') {
        window.location.href = authUrl;
      }
    } catch (err: any) {
      showErrorView(`Failed to initiate Google OAuth PKCE flow: ${err?.message || err}`, 0);
    }
  });

  // Developer testing controls
  const devSimSuccess = document.getElementById('dev-sim-auth-success');
  const devSimError = document.getElementById('dev-sim-auth-error');

  devSimSuccess?.addEventListener('click', () => {
    handleAuthSuccess({
      code: 'mock_valid_pkce_code',
      codeVerifier: 'mock_code_verifier_alice',
      redirectUri: window.location.origin + '/delete-user',
      idToken: null,
      email: 'alice.tester@deez.in',
      name: 'Alice Tester',
      picture: null,
      sub: 'mock-user-123',
      is_simulation: true,
      simulate_error: false,
    });
  });

  devSimError?.addEventListener('click', () => {
    handleAuthSuccess({
      code: 'mock_error_pkce_code',
      codeVerifier: 'mock_code_verifier_bob',
      redirectUri: window.location.origin + '/delete-user',
      idToken: null,
      email: 'bob.error@deez.in',
      name: 'Bob Error',
      picture: null,
      sub: 'mock-user-456',
      is_simulation: true,
      simulate_error: true,
    });
  });

  // When authentication finishes (real or simulated)
  function handleAuthSuccess(user: any) {
    currentAuthUser = user;
    openDeletionModal();
  }

  // Modal Control: Open and start 10s countdown
  function openDeletionModal() {
    if (!currentAuthUser) return;

    // Populate user info
    if (modalUserEmail) modalUserEmail.textContent = currentAuthUser.email;
    if (modalUserAvatar) {
      if (currentAuthUser.picture) {
        modalUserAvatar.innerHTML = `<img src="${currentAuthUser.picture}" alt="User avatar" referrerpolicy="no-referrer" style="width:100%;height:100%;object-fit:cover;display:block;border-radius:50%;" />`;
      } else {
        const initial = (currentAuthUser.email[0] || '?').toUpperCase();
        modalUserAvatar.textContent = initial;
      }
    }

    // Reset button state
    remainingSeconds = TOTAL_SECONDS;
    if (modalConfirmBtn) {
      modalConfirmBtn.disabled = true;
      modalConfirmBtn.classList.add('disabled');
      modalConfirmBtn.querySelector('.btn-content-default')?.classList.remove('hidden');
      modalConfirmBtn.querySelector('.btn-content-loading')?.classList.add('hidden');
    }
    modalLoadingState?.classList.add('hidden');
    if (deleteBtnLabel) deleteBtnLabel.textContent = `Confirm Deletion (${remainingSeconds}s)`;

    // Reset circular progress
    updateProgressCircle(remainingSeconds);

    // Show modal
    deletionModal?.classList.remove('hidden');
    document.body.style.overflow = 'hidden';

    // Start 10-second countdown
    if (countdownInterval) clearInterval(countdownInterval);

    countdownInterval = setInterval(() => {
      remainingSeconds--;
      if (remainingSeconds > 0) {
        if (deleteBtnLabel) deleteBtnLabel.textContent = `Confirm Deletion (${remainingSeconds}s)`;
        if (countdownNumber) countdownNumber.textContent = String(remainingSeconds);
        if (countdownStatusText) countdownStatusText.textContent = `Safety delay active: ${remainingSeconds} seconds remaining`;
        updateProgressCircle(remainingSeconds);
      } else {
        // Timer finished: activate button!
        clearInterval(countdownInterval);
        countdownInterval = null;
        remainingSeconds = 0;
        if (countdownNumber) countdownNumber.textContent = '0';
        updateProgressCircle(0);
        if (countdownStatusText) countdownStatusText.textContent = 'Confirmation unlocked. You may now confirm deletion.';
        if (deleteBtnLabel) deleteBtnLabel.textContent = 'Permanently Delete Account';
        if (modalConfirmBtn) {
          modalConfirmBtn.disabled = false;
          modalConfirmBtn.classList.remove('disabled');
        }
      }
    }, 1000);
  }

  function updateProgressCircle(secondsLeft: number) {
    if (!countdownProgress) return;
    // Progress from 0 (at 10s) to CIRCUMFERENCE (at 0s)
    const fraction = (TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS;
    const offset = CIRCUMFERENCE * (1 - fraction);
    countdownProgress.style.strokeDashoffset = offset.toFixed(2);
  }

  function closeDeletionModal() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
    deletionModal?.classList.add('hidden');
    document.body.style.overflow = '';
  }

  modalCloseBtn?.addEventListener('click', closeDeletionModal);
  modalCancelBtn?.addEventListener('click', closeDeletionModal);

  // Escape key closes modal (only if not loading)
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && deletionModal && !deletionModal.classList.contains('hidden')) {
      if (modalConfirmBtn?.disabled && modalLoadingState && !modalLoadingState.classList.contains('hidden')) {
        return; // Don't allow cancel while in flight
      }
      closeDeletionModal();
    }
  });

  // Confirm Delete clicked (after 10s button becomes active)
  modalConfirmBtn?.addEventListener('click', async () => {
    if (!modalConfirmBtn || modalConfirmBtn.disabled || remainingSeconds > 0) return;

    // 1. Put button and modal in loading state
    modalConfirmBtn.disabled = true;
    modalConfirmBtn.querySelector('.btn-content-default')?.classList.add('hidden');
    modalConfirmBtn.querySelector('.btn-content-loading')?.classList.remove('hidden');
    modalLoadingState?.classList.remove('hidden');
    if (modalCancelBtn) (modalCancelBtn as HTMLButtonElement).disabled = true;
    if (modalCloseBtn) modalCloseBtn.style.display = 'none';

    // Simulation mode bypass (for developer testing controls)
    if (currentAuthUser.is_simulation) {
      await new Promise((r) => setTimeout(r, 900));
      closeDeletionModal();
      if (currentAuthUser.simulate_error) {
        showErrorView('Simulated error: Backend rejected account deletion request.', 500);
      } else {
        showConfirmationView();
      }
      if (modalCancelBtn) (modalCancelBtn as HTMLButtonElement).disabled = false;
      if (modalCloseBtn) modalCloseBtn.style.display = '';
      return;
    }

    // 2. Direct client-to-API call: DELETE /users/me/oauth
    try {
      const payload = {
        code: currentAuthUser.code,
        codeVerifier: currentAuthUser.codeVerifier,
        redirectUri: currentAuthUser.redirectUri,
        idToken: currentAuthUser.idToken,
        email: currentAuthUser.email,
      };

      const response = await fetch(`${API_URL}/users/me/oauth`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      closeDeletionModal();

      // 3. Evaluate response status: 200 OK -> show confirmation, else show error
      if (response.status === 200) {
        sessionStorage.removeItem('deez_pkce_verifier');
        sessionStorage.removeItem('deez_oauth_redirect_uri');
        sessionStorage.removeItem('deez_oauth_state');
        showConfirmationView();
      } else {
        const errorData = await response.json().catch(() => ({ error: `Status ${response.status}` }));
        const errorMsg = errorData?.error || errorData?.message || `Account deletion failed with status ${response.status}`;
        showErrorView(errorMsg, response.status);
      }
    } catch (err: any) {
      closeDeletionModal();
      showErrorView(
        err?.message || 'Network communication failure connecting directly to backend API. Please verify server connectivity and CORS policy.',
        0
      );
    } finally {
      if (modalCancelBtn) (modalCancelBtn as HTMLButtonElement).disabled = false;
      if (modalCloseBtn) modalCloseBtn.style.display = '';
    }
  });

  // View Switchers
  function showConfirmationView() {
    initialView?.classList.remove('active');
    initialView?.classList.add('hidden');
    errorView?.classList.remove('active');
    errorView?.classList.add('hidden');

    confirmationView?.classList.remove('hidden');
    confirmationView?.classList.add('active');

    if (confirmedEmail && currentAuthUser) {
      confirmedEmail.textContent = currentAuthUser.email;
    }
    if (confirmedTimestamp) {
      confirmedTimestamp.textContent = new Date().toUTCString();
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showErrorView(message: string, statusCode: number) {
    initialView?.classList.remove('active');
    initialView?.classList.add('hidden');
    confirmationView?.classList.remove('active');
    confirmationView?.classList.add('hidden');

    errorView?.classList.remove('hidden');
    errorView?.classList.add('active');

    if (errorMessageText) {
      errorMessageText.textContent = message || 'An unexpected error occurred during account deletion.';
    }
    if (errorCodeBadge) {
      errorCodeBadge.textContent = statusCode ? `HTTP STATUS: ${statusCode}` : 'NETWORK CONNECTION ERROR';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  // Retry Button
  retryBtn?.addEventListener('click', () => {
    errorView?.classList.remove('active');
    errorView?.classList.add('hidden');
    confirmationView?.classList.remove('active');
    confirmationView?.classList.add('hidden');

    initialView?.classList.remove('hidden');
    initialView?.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initDeleteUserFlow);
} else {
  initDeleteUserFlow();
}
