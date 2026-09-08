function initLiveEncryptionDemo() {
  let ratchetCounter = 14;
  let isTampered = false;

  const demoInput = document.getElementById('demo-input') as HTMLTextAreaElement | null;
  const cipherOutput = document.getElementById('cipher-output');
  const bobOutput = document.getElementById('bob-output');
  const aliceCounter = document.getElementById('alice-counter');
  const bobCounter = document.getElementById('bob-counter');
  const aliceEph = document.getElementById('alice-eph');
  const aliceMsgKey = document.getElementById('alice-msg-key');
  const wireIv = document.getElementById('wire-iv');
  const wireTag = document.getElementById('wire-tag');
  const bobVerify = document.getElementById('bob-verify');
  const verifyPill = document.getElementById('verify-pill');
  const tamperAlert = document.getElementById('tamper-alert');
  const btnAdvance = document.getElementById('btn-advance-ratchet');
  const btnTamper = document.getElementById('btn-tamper');
  const copyBtn = document.getElementById('copy-cipher-btn');

  function simulateEncryption(text: string) {
    if (!text) {
      if (cipherOutput) cipherOutput.textContent = '--- [EMPTY PAYLOAD] ---';
      if (bobOutput) bobOutput.textContent = '--- [NO PAYLOAD RECEIVED] ---';
      return;
    }

    const pseudoIv = '0x' + Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + '...92';
    const pseudoTag = '0x' + Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('') + '...c1';

    const rawBytes = new TextEncoder().encode(text);
    let binary = '';
    rawBytes.forEach((b) => (binary += String.fromCharCode((b ^ (ratchetCounter & 0xff)) + 3)));
    const base64Cipher = btoa('E2EE-v4:' + binary + ':' + ratchetCounter);

    if (wireIv) wireIv.textContent = pseudoIv;

    if (isTampered) {
      const tamperedCipher = 'CORRUPTED_' + base64Cipher.slice(10);
      if (cipherOutput) cipherOutput.textContent = tamperedCipher;
      if (wireTag) wireTag.textContent = '0x0000...0000 (INVALID)';
      if (bobOutput) {
        bobOutput.textContent = '[DECRYPTION_ERROR: Poly1305 verification failed. Ciphertext dropped to prevent Chosen-Ciphertext Attack.]';
        bobOutput.style.color = '#ef4444';
      }
      if (bobVerify) {
        bobVerify.textContent = 'Auth Check Failed \u00D7';
        bobVerify.className = 'meta-val';
        bobVerify.style.color = '#ef4444';
      }
      if (verifyPill) {
        verifyPill.textContent = 'TAMPERED / DROPPED';
        verifyPill.style.color = '#ef4444';
      }
      tamperAlert?.classList.remove('hidden');
    } else {
      if (cipherOutput) cipherOutput.textContent = base64Cipher;
      if (wireTag) wireTag.textContent = pseudoTag + ' (VALID)';
      if (bobOutput) {
        bobOutput.textContent = text;
        bobOutput.style.color = 'var(--text-primary)';
      }
      if (bobVerify) {
        bobVerify.textContent = 'AEAD Integrity Verified \u2713';
        bobVerify.className = 'meta-val meta-success';
        bobVerify.style.color = '';
      }
      if (verifyPill) {
        verifyPill.textContent = '\u2713 HMAC MATCH';
        verifyPill.style.color = 'var(--accent-primary)';
      }
      tamperAlert?.classList.add('hidden');
    }
  }

  function advanceRatchet() {
    ratchetCounter++;
    if (aliceCounter) aliceCounter.textContent = `Ratchet #${ratchetCounter}`;
    if (bobCounter) bobCounter.textContent = `Ratchet #${ratchetCounter}`;

    const newEph = '0x' + Math.random().toString(16).slice(2, 6) + '...' + Math.random().toString(16).slice(2, 6) + ' (Ed25519)';
    const newMsgKey = '0x' + Math.random().toString(16).slice(2, 6) + '...' + Math.random().toString(16).slice(2, 6);

    if (aliceEph) aliceEph.textContent = newEph;
    if (aliceMsgKey) aliceMsgKey.textContent = newMsgKey;

    simulateEncryption(demoInput?.value || '');
  }

  demoInput?.addEventListener('input', () => {
    simulateEncryption(demoInput.value);
  });

  btnAdvance?.addEventListener('click', advanceRatchet);

  btnTamper?.addEventListener('click', () => {
    isTampered = !isTampered;
    if (btnTamper) {
      btnTamper.textContent = isTampered ? '\u2713 Restore Clean Ciphertext' : '\u0394 Simulate Ciphertext Tamper';
    }
    simulateEncryption(demoInput?.value || '');
  });

  copyBtn?.addEventListener('click', () => {
    if (cipherOutput?.textContent) {
      navigator.clipboard.writeText(cipherOutput.textContent);
      copyBtn.textContent = 'Copied!';
      setTimeout(() => {
        copyBtn.textContent = 'Copy';
      }, 1500);
    }
  });

  simulateEncryption(demoInput?.value || '');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initLiveEncryptionDemo);
} else {
  initLiveEncryptionDemo();
}
