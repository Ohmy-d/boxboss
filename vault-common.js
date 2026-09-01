/* ============================================================
   VAULT COMMON — shared helpers for index.html + setup.html
   Secrets and lockout state now live server-side (api.php).
   This file only holds things that must run in the browser:
   camera/face capture, WebAuthn, speech normalization, and a
   thin wrapper around the API.
   ============================================================ */

/* ---------- API client ---------- */
async function vaultFetch(url, opts) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);
  let res;
  try {
    res = await fetch(url, { credentials: "same-origin", cache: "no-store", signal: controller.signal, ...opts });
  } catch (e) {
    clearTimeout(timeoutId);
    if (e.name === "AbortError") {
      throw new Error("Request to the server timed out. Check that the PHP server is running.");
    }
    throw new Error("Could not reach " + url + ". Check that this page is being served by a running PHP server (not opened as a local file), and that api.php is in the same folder.");
  }
  clearTimeout(timeoutId);
  let data;
  try {
    data = await res.json();
  } catch (e) {
    throw new Error("Server responded with status " + res.status + " but not valid JSON — PHP may not be executing api.php on this server (check it isn't being served as plain text).");
  }
  return data;
}

const VaultApi = {
  async get(action) {
    return vaultFetch(`api.php?action=${action}`, { method: "GET" });
  },
  async post(action, body) {
    return vaultFetch(`api.php?action=${action}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    });
  }
};

/* ---------- base64 <-> ArrayBuffer (for WebAuthn credential ids) ---------- */
function bufToB64(buf) {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
function b64ToBuf(b64) {
  b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
  while (b64.length % 4) b64 += "=";
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/* ---------- face-api.js loader (CDN, cached) ---------- */
let _faceApiPromise = null;
function loadFaceApi() {
  if (_faceApiPromise) return _faceApiPromise;
  _faceApiPromise = new Promise((resolve, reject) => {
    if (window.faceapi) { primeModels().then(resolve).catch(reject); return; }
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js";
    s.onload = () => primeModels().then(resolve).catch(reject);
    s.onerror = () => reject(new Error("Could not load face recognition library. Check your connection."));
    document.head.appendChild(s);
  });
  return _faceApiPromise;

  async function primeModels() {
    const MODEL_URL = "https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights";
    await Promise.all([
      faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
      faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
      faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
    ]);
    return true;
  }
}

async function detectFaceDescriptor(videoEl) {
  const result = await faceapi
    .detectSingleFace(videoEl, new faceapi.TinyFaceDetectorOptions())
    .withFaceLandmarks()
    .withFaceDescriptor();
  return result ? Array.from(result.descriptor) : null;
}

/* ---------- WebAuthn (platform fingerprint / biometric) ---------- */
function webauthnSupported() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

async function registerFingerprintCredential() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const userId = crypto.getRandomValues(new Uint8Array(16));
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: "Vault" },
      user: { id: userId, name: "vault-user", displayName: "Vault User" },
      pubKeyCredParams: [{ type: "public-key", alg: -7 }, { type: "public-key", alg: -257 }],
      authenticatorSelection: {
        authenticatorAttachment: "platform",
        residentKey: "required",
        requireResidentKey: true,
        userVerification: "required"
      },
      timeout: 60000,
      attestation: "none"
    }
  });
  return bufToB64(cred.rawId);
}

/* Discoverable-credential ("usernameless") verification: the browser prompts
   the platform authenticator directly, without the server needing to hand
   back a credential id first. Works on modern Android/Chrome + iOS/Safari. */
async function verifyFingerprintDiscoverable() {
  const challenge = crypto.getRandomValues(new Uint8Array(32));
  const cred = await navigator.credentials.get({
    publicKey: { challenge, userVerification: "required", timeout: 60000 }
  });
  return !!cred;
}

/* ---------- normalize a spoken phrase before sending it to the server ---------- */
function normalizePhrase(text) {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}
