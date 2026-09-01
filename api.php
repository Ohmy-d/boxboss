<?php
/**
 * Vault API — all secrets and lockout state live server-side in data/vault-data.json.
 * The browser never sees hashes, salts, or the fail/lockout counters directly.
 *
 * IMPORTANT (production hardening):
 *   Move DATA_FILE outside the web root if you can (e.g. one level above your
 *   public folder) so it can never be requested directly over HTTP, even by
 *   mistake. The data/.htaccess included here blocks direct access on Apache,
 *   but it does nothing on nginx or PHP's built-in server — moving the file
 *   is the only bulletproof option there.
 */

session_start();
header('Content-Type: application/json');

define('DATA_FILE', __DIR__ . '/data/vault-data.json');
define('REQUIRED_PASSES', 3);
define('METHODS', ['pin', 'fingerprint', 'face', 'voice', 'pattern']);
define('LOCK_THRESHOLD', 5);      // failed sessions before lockout starts
define('LOCK_STEP_SECONDS', 30);  // grows each additional failure
define('LOCK_MAX_SECONDS', 300);
define('RECONFIG_TTL', 300);      // seconds a "reconfigure" grant stays valid

function read_data() {
  if (!file_exists(DATA_FILE)) return null;
  $raw = @file_get_contents(DATA_FILE);
  if ($raw === false || $raw === '') return null;
  $data = json_decode($raw, true);
  return is_array($data) ? $data : null;
}

$GLOBALS['vault_write_error'] = '';

function write_data($data) {
  $dir = dirname(DATA_FILE);
  if (!is_dir($dir)) {
    if (!@mkdir($dir, 0755, true) && !is_dir($dir)) {
      $GLOBALS['vault_write_error'] = 'Could not create the data/ directory.';
      return false;
    }
  }
  $json = json_encode($data, JSON_PRETTY_PRINT);
  error_clear_last();
  $bytes = @file_put_contents(DATA_FILE, $json);
  if ($bytes === false) {
    $err = error_get_last();
    $GLOBALS['vault_write_error'] = $err ? $err['message'] : 'Unknown write error.';
    return false;
  }
  @chmod(DATA_FILE, 0600);
  return true;
}

function fail_state($data) {
  return isset($data['fail']) ? $data['fail'] : ['count' => 0, 'lockUntil' => 0];
}

function is_locked($data) {
  $f = fail_state($data);
  return $f['lockUntil'] > 0 && $f['lockUntil'] > time();
}

function register_failure(&$data) {
  $f = fail_state($data);
  $f['count'] = ($f['count'] ?? 0) + 1;
  if ($f['count'] >= LOCK_THRESHOLD) {
    $seconds = min(LOCK_STEP_SECONDS * ($f['count'] - LOCK_THRESHOLD + 1), LOCK_MAX_SECONDS);
    $f['lockUntil'] = time() + $seconds;
  }
  $data['fail'] = $f;
  write_data($data);
  return $f;
}

function register_success(&$data) {
  $data['fail'] = ['count' => 0, 'lockUntil' => 0];
  write_data($data);
}

function enabled_methods($data) {
  $out = [];
  foreach (METHODS as $m) {
    if (!empty($data[$m]) && !empty($data[$m]['enabled'])) $out[] = $m;
  }
  return $out;
}

function json_body() {
  $raw = file_get_contents('php://input');
  $parsed = json_decode($raw, true);
  return is_array($parsed) ? $parsed : [];
}

function respond($arr, $code = 200) {
  http_response_code($code);
  echo json_encode($arr);
  exit;
}

$action = $_GET['action'] ?? '';

/* ---------------------------------------------------------------- */
if ($action === 'status') {
  $data = read_data();
  if (!$data) { respond(['configured' => false]); }
  $locked = is_locked($data);
  $f = fail_state($data);
  respond([
    'configured' => count(enabled_methods($data)) >= REQUIRED_PASSES,
    'enabledMethods' => enabled_methods($data),
    'required' => REQUIRED_PASSES,
    'locked' => $locked,
    'lockUntil' => $locked ? $f['lockUntil'] : 0,
    'failCount' => $f['count'] ?? 0
  ]);
}

/* ---------------------------------------------------------------- */
if ($action === 'setup_status') {
  $data = read_data();
  $configured = $data && count(enabled_methods($data)) >= REQUIRED_PASSES;
  $reconfigOk = !empty($_SESSION['reconfig_until']) && $_SESSION['reconfig_until'] > time();
  respond([
    'configured' => $configured,
    'allowed' => (!$configured) || $reconfigOk
  ]);
}

/* ---------------------------------------------------------------- */
if ($action === 'request_reconfigure') {
  if (empty($_SESSION['unlocked'])) {
    respond(['ok' => false, 'error' => 'Unlock the vault first.'], 403);
  }
  $_SESSION['reconfig_until'] = time() + RECONFIG_TTL;
  respond(['ok' => true, 'expiresInSeconds' => RECONFIG_TTL]);
}

/* ---------------------------------------------------------------- */
if ($action === 'save' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $data = read_data();
  $configured = $data && count(enabled_methods($data)) >= REQUIRED_PASSES;
  $reconfigOk = !empty($_SESSION['reconfig_until']) && $_SESSION['reconfig_until'] > time();
  if ($configured && !$reconfigOk) {
    respond(['ok' => false, 'error' => 'Vault already configured. Unlock it to make changes.'], 403);
  }

  $body = json_body();
  $new = ['fail' => ['count' => 0, 'lockUntil' => 0]];

  if (!empty($body['pin']['value'])) {
    $salt = bin2hex(random_bytes(12));
    $new['pin'] = ['salt' => $salt, 'hash' => hash('sha256', $salt . $body['pin']['value']), 'enabled' => true];
  }
  if (!empty($body['fingerprint']['credentialId'])) {
    $new['fingerprint'] = ['credentialId' => $body['fingerprint']['credentialId'], 'enabled' => true];
  }
  if (!empty($body['face']['descriptor']) && is_array($body['face']['descriptor'])) {
    $new['face'] = ['descriptor' => $body['face']['descriptor'], 'enabled' => true];
  }
  if (!empty($body['voice']['phrase'])) {
    $new['voice'] = ['phraseHash' => hash('sha256', $body['voice']['phrase']), 'enabled' => true];
  }
  if (!empty($body['pattern']['sequence'])) {
    $new['pattern'] = ['hash' => hash('sha256', $body['pattern']['sequence']), 'enabled' => true];
  }

  if (count(enabled_methods($new)) < REQUIRED_PASSES) {
    respond(['ok' => false, 'error' => 'At least 3 methods are required.'], 400);
  }

  if (!write_data($new)) {
    $reason = $GLOBALS['vault_write_error'] ?: 'unknown reason';
    respond(['ok' => false, 'error' => 'Could not write vault data (' . $reason . '). Check the data/ folder\'s ownership and permissions.'], 500);
  }
  unset($_SESSION['reconfig_until'], $_SESSION['unlocked'], $_SESSION['attempt']);
  respond(['ok' => true]);
}

/* ---------------------------------------------------------------- */
if ($action === 'reset_attempt') {
  $_SESSION['attempt'] = [];
  respond(['ok' => true]);
}

/* ---------------------------------------------------------------- */
if ($action === 'verify' && $_SERVER['REQUEST_METHOD'] === 'POST') {
  $data = read_data();
  if (!$data || count(enabled_methods($data)) < REQUIRED_PASSES) {
    respond(['ok' => false, 'error' => 'Vault not configured.'], 400);
  }
  if (is_locked($data)) {
    $f = fail_state($data);
    respond(['ok' => false, 'locked' => true, 'lockUntil' => $f['lockUntil']], 423);
  }

  $body = json_body();
  $method = $body['method'] ?? '';
  $enabled = enabled_methods($data);
  if (!in_array($method, $enabled, true)) {
    respond(['ok' => false, 'error' => 'Unknown or disabled method.'], 400);
  }

  $pass = false;
  switch ($method) {
    case 'pin':
      $val = (string)($body['value'] ?? '');
      $pass = hash('sha256', $data['pin']['salt'] . $val) === $data['pin']['hash'];
      break;
    case 'fingerprint':
      // The actual biometric ceremony (navigator.credentials.get) already
      // happened client-side and is bound to the device's secure hardware;
      // this just records the client-reported outcome for the 3-of-5 tally.
      $pass = !empty($body['clientVerified']);
      break;
    case 'face':
      $desc = $body['descriptor'] ?? null;
      if (is_array($desc) && !empty($data['face']['descriptor'])) {
        $stored = $data['face']['descriptor'];
        $sum = 0.0;
        for ($i = 0; $i < min(count($desc), count($stored)); $i++) {
          $sum += ($desc[$i] - $stored[$i]) ** 2;
        }
        $pass = sqrt($sum) < 0.55;
      }
      break;
    case 'voice':
      $val = $body['phrase'] ?? '';
      $pass = hash('sha256', $val) === $data['voice']['phraseHash'];
      break;
    case 'pattern':
      $val = $body['sequence'] ?? '';
      $pass = hash('sha256', $val) === $data['pattern']['hash'];
      break;
  }

  if (!isset($_SESSION['attempt']) || !is_array($_SESSION['attempt'])) $_SESSION['attempt'] = [];
  $_SESSION['attempt'][$method] = $pass ? 'pass' : 'fail';

  $attemptState = [];
  foreach ($enabled as $m) $attemptState[$m] = $_SESSION['attempt'][$m] ?? 'idle';

  $passCount = count(array_filter($attemptState, fn($s) => $s === 'pass'));
  $attempted = count(array_filter($attemptState, fn($s) => $s !== 'idle'));
  $remaining = count($enabled) - $attempted;

  $sessionResult = 'pending';
  $lockUntil = 0;

  if ($passCount >= REQUIRED_PASSES) {
    $sessionResult = 'unlocked';
    register_success($data);
    $_SESSION['unlocked'] = true;
    $_SESSION['attempt'] = [];
  } elseif ($passCount + $remaining < REQUIRED_PASSES) {
    $sessionResult = 'denied';
    $f = register_failure($data);
    $lockUntil = $f['lockUntil'];
    $_SESSION['attempt'] = [];
  }

  respond([
    'ok' => $pass,
    'passCount' => $passCount,
    'attempted' => $attempted,
    'remaining' => $remaining,
    'required' => REQUIRED_PASSES,
    'sessionResult' => $sessionResult,
    'attemptState' => $sessionResult === 'pending' ? $attemptState : array_fill_keys($enabled, 'idle'),
    'lockUntil' => $lockUntil
  ]);
}

/* ---------------------------------------------------------------- */
respond(['ok' => false, 'error' => 'Unknown action.'], 404);
