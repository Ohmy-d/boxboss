<?php
date_default_timezone_set("UTC");
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");

// ── Real client IP: behind a tunnel (ngrok, Cloudflare) REMOTE_ADDR is the
//    tunnel agent's own loopback address (127.0.0.1), not the visitor's IP.
//    The actual IP is forwarded in a header instead. ─────────────────────
function get_client_ip() {
    $candidates = ['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR'];
    foreach ($candidates as $header) {
        if (!empty($_SERVER[$header])) {
            $ip = trim(explode(',', $_SERVER[$header])[0]); // XFF may be a chain; first = original client
            if (filter_var($ip, FILTER_VALIDATE_IP)) return $ip;
        }
    }
    return $_SERVER['REMOTE_ADDR'] ?? 'Unknown';
}

$data = json_decode(file_get_contents("php://input"), true);
$file = "logs.json";
$logs = file_exists($file) ? (json_decode(file_get_contents($file), true) ?: []) : [];

$ip         = get_client_ip();
$visitor_id = $data['visitor_id'] ?? uniqid('v_');
$session_id = $data['session_id'] ?? uniqid('s_');
$device     = $data['device'] ?? "Unknown";
$type       = $data['type'] ?? "ping";

$latitude  = isset($data['latitude'])  ? floatval($data['latitude'])  : null;
$longitude = isset($data['longitude']) ? floatval($data['longitude']) : null;

// ── Blank location template ───────────────────────────────────────────────
$location = [
    "country"      => "Unknown",
    "region"       => "Unknown",   // e.g. Western Region
    "district"     => "Unknown",   // e.g. Mpohor District
    "city"         => "Unknown",   // nearest city
    "town"         => "Unknown",   // town
    "village"      => "Unknown",   // village / hamlet
    "suburb"       => "Unknown",   // suburb / neighbourhood
    "road"         => "Unknown",   // street / road name
    "place_name"   => "Unknown",   // exact named place e.g. Kikam Technical Institute
    "display_name" => "Unknown",   // full Nominatim address string
    "isp"          => "Unknown",   // e.g. MTN Ghana, Vodafone Ghana, Surfline
    "org"          => "Unknown",   // registered organization for the IP block
    "asn"          => "Unknown",   // Autonomous System Number + name
    "network_type" => "Unknown",   // Mobile Carrier / Fixed-Line ISP
    "source"       => "none"
];

// ── HTTP GET helper: tries cURL first (works regardless of allow_url_fopen,
//    which is frequently disabled on Termux/Android PHP builds and silently
//    breaks file_get_contents() on remote URLs), falls back to
//    file_get_contents() if the curl extension isn't available ─────────────
function http_get($url, $userAgent, $timeout) {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => true,
            CURLOPT_TIMEOUT        => $timeout,
            CURLOPT_CONNECTTIMEOUT => $timeout,
            CURLOPT_USERAGENT      => $userAgent,
            CURLOPT_HTTPHEADER     => ["User-Agent: $userAgent"],
        ]);
        $result = curl_exec($ch);
        $ok = $result !== false && curl_errno($ch) === 0;
        curl_close($ch);
        if ($ok) return $result;
        // fall through to file_get_contents as a second attempt
    }

    $ctx = stream_context_create([
        "http" => ["header" => "User-Agent: $userAgent\r\n", "timeout" => $timeout]
    ]);
    $result = @file_get_contents($url, false, $ctx);
    return $result !== false ? $result : null;
}

// ── Nominatim reverse geocode: GPS coords -> rich address ─────────────────
function nominatim_reverse($lat, $lon) {
    $url = "https://nominatim.openstreetmap.org/reverse"
         . "?format=jsonv2&lat=" . urlencode($lat)
         . "&lon=" . urlencode($lon)
         . "&zoom=18&addressdetails=1&namedetails=1";
    $raw = http_get($url, "SentinelTracker/2.0", 6);
    return $raw ? json_decode($raw, true) : null;
}

// ── ip-api lookup: IP -> coarse location + coords + ISP/network info ──────
// Cached per-IP so repeat visits (or rapid testing) don't burn through
// ip-api's free-tier rate limit (45 req/min) -- all lookups come from this
// server's single outbound IP, shared across every visitor. A rate-limited
// response falls back to the last known-good cached entry instead of
// discarding everything as "Unknown".
function ipapi_lookup($ip) {
    $cacheFile = __DIR__ . "/geo_cache.json";
    $ttl = 3600; // re-check each IP hourly

    $cache = file_exists($cacheFile) ? (json_decode(file_get_contents($cacheFile), true) ?: []) : [];

    if (isset($cache[$ip]) && (time() - $cache[$ip]['_ts']) < $ttl) {
        return $cache[$ip]['data'];
    }

    $raw = http_get(
        "http://ip-api.com/json/{$ip}?fields=status,country,regionName,city,lat,lon,isp,org,as,mobile,proxy,hosting",
        "SentinelTracker/2.0", 5
    );
    $d = $raw ? json_decode($raw, true) : null;

    if ($d && $d['status'] === 'success') {
        $cache[$ip] = ["data" => $d, "_ts" => time()];
        file_put_contents($cacheFile, json_encode($cache, JSON_PRETTY_PRINT));
        return $d;
    }

    // Fresh lookup failed (network error or rate-limited) -> reuse a stale
    // cached entry for this IP if we have one, rather than reporting Unknown.
    return isset($cache[$ip]) ? $cache[$ip]['data'] : null;
}

// ── Parse a Nominatim response into our location fields ──────────────────
function parse_nominatim($nom) {
    if (!$nom || !isset($nom['address'])) return null;
    $a = $nom['address'];

    // Named place: building/amenity/institution name
    $place = $a['amenity']  ?? $a['tourism']   ?? $a['building']
          ?? $a['leisure']  ?? $a['shop']       ?? $a['office']
          ?? $a['historic'] ?? $a['man_made']   ?? $a['aeroway']
          ?? ($nom['name'] ?? "");

    // Settlement: village > hamlet > locality > suburb > town > city
    $village  = $a['village'] ?? $a['hamlet']   ?? $a['locality'] ?? "";
    $town     = $a['town']    ?? $a['suburb']   ?? $a['quarter']  ?? "";
    $city     = $a['city']    ?? $a['municipality'] ?? $town ?? $village;

    // District: county > district > state_district
    $district = $a['county'] ?? $a['district'] ?? $a['state_district'] ?? "";

    return [
        "country"      => $a['country']      ?? "Unknown",
        "region"       => $a['state']        ?? "Unknown",
        "district"     => $district          ?: "Unknown",
        "city"         => $city              ?: "Unknown",
        "town"         => $town              ?: "Unknown",
        "village"      => $village           ?: "Unknown",
        "suburb"       => $a['suburb']       ?? $a['neighbourhood'] ?? "Unknown",
        "road"         => $a['road']         ?? $a['pedestrian'] ?? $a['path'] ?? "Unknown",
        "place_name"   => $place             ?: "Unknown",
        "display_name" => $nom['display_name'] ?? "Unknown",
    ];
}

$isLocal = (bool) preg_match(
    "/^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))/",
    $ip
);

// Fetched once and reused everywhere below -- ISP/network info comes from the
// IP regardless of which path resolves the address, so no need to call this
// twice just because GPS also happened to be available.
$ispGeo = $isLocal ? null : ipapi_lookup($ip);

// ── Resolve location ──────────────────────────────────────────────────────
// GPS is checked first: it comes straight from the visitor's browser and is
// unaffected by the IP the server sees, so it must take priority over the
// local-IP check below (which otherwise misfires for anyone behind a tunnel
// like ngrok/Cloudflare, since the tunnel agent connects over 127.0.0.1).
if ($latitude !== null && $longitude !== null) {
    // GPS available -> Nominatim gives best accuracy
    $nom = nominatim_reverse($latitude, $longitude);
    $parsed = parse_nominatim($nom);
    if ($parsed) {
        $location = array_merge($location, $parsed, ["source" => "gps+nominatim"]);
    } else {
        // Nominatim failed -> fall back to ip-api for country at minimum
        if ($ispGeo) {
            $location['country'] = $ispGeo['country']    ?? "Unknown";
            $location['region']  = $ispGeo['regionName'] ?? "Unknown";
            $location['city']    = $ispGeo['city']        ?? "Unknown";
        }
        $location['source'] = "gps+ipapi-fallback";
    }

} elseif ($isLocal) {
    $location['country']      = "Local Network";
    $location['city']         = "Localhost";
    $location['display_name'] = "Local Network";
    $location['source']       = "local";
    if ($latitude === null)  $latitude  = 0;
    if ($longitude === null) $longitude = 0;

} else {
    // No GPS -> ip-api for coarse location + coords, then Nominatim on those coords
    if ($ispGeo) {
        $latitude  = $ispGeo['lat'] ?? 0;
        $longitude = $ispGeo['lon'] ?? 0;
        $location['country'] = $ispGeo['country']    ?? "Unknown";
        $location['region']  = $ispGeo['regionName'] ?? "Unknown";
        $location['city']    = $ispGeo['city']        ?? "Unknown";

        // Enrich with Nominatim even on IP-derived coords
        $nom = nominatim_reverse($latitude, $longitude);
        $parsed = parse_nominatim($nom);
        if ($parsed) {
            // Keep ip-api country/region (more reliable for IP) but take OSM detail
            $parsed['country'] = $location['country'];
            $parsed['region']  = $location['region'];
            $location = array_merge($location, $parsed, ["source" => "ipapi+nominatim"]);
        } else {
            $location['source'] = "ipapi";
        }
    }
}

// ── Network / ISP / carrier info -- applies regardless of which path above
//    resolved the physical address, since it's derived from the IP itself ──
if ($ispGeo) {
    $location['isp']          = $ispGeo['isp'] ?? "Unknown";
    $location['org']          = $ispGeo['org'] ?? "Unknown";
    $location['asn']          = $ispGeo['as']  ?? "Unknown";
    $location['network_type'] = !empty($ispGeo['mobile'])
        ? "Mobile Carrier"
        : (!empty($ispGeo['hosting']) ? "Hosting/Datacenter" : "Fixed-Line ISP");
    if (!empty($ispGeo['proxy'])) {
        $location['network_type'] .= " (VPN/Proxy detected)";
    }
} elseif ($isLocal) {
    $location['isp'] = $location['org'] = $location['asn'] = "Local Network";
    $location['network_type'] = "Local Network";
}

// ── Build a fresh session entry ───────────────────────────────────────────
function new_session($sid, $vid, $ip, $loc, $device, $lat, $lon, $dur = 0) {
    return array_merge([
        "session_id" => $sid,
        "visitor_id" => $vid,
        "ip"         => $ip,
        "device"     => $device,
        "latitude"   => $lat,
        "longitude"  => $lon,
        "open_time"  => date("Y-m-d H:i:s"),
        "last_seen"  => date("Y-m-d H:i:s"),
        "duration"   => $dur,
        "pings"      => 1,
        "status"     => "active"
    ], $loc);
}

// ── START: always a new row ───────────────────────────────────────────────
if ($type === "start") {
    $logs[] = new_session($session_id, $visitor_id, $ip, $location, $device, $latitude, $longitude);
}

// ── PING: refresh existing session ───────────────────────────────────────
if ($type === "ping") {
    $found = false;
    foreach ($logs as &$log) {
        if ($log["session_id"] === $session_id) {
            $log["last_seen"] = date("Y-m-d H:i:s");
            $log["duration"]  = intval($data["duration"] ?? $log["duration"]);
            $log["pings"]     = ($log["pings"] ?? 0) + 1;
            $log["status"]    = "active";
            if ($latitude  !== null) $log["latitude"]  = $latitude;
            if ($longitude !== null) $log["longitude"] = $longitude;
            // Upgrade any "Unknown" location fields with fresher data
            if ($location['source'] !== 'none') {
                foreach ($location as $k => $v) {
                    if ($v !== "Unknown") $log[$k] = $v;
                }
            }
            $found = true;
            break;
        }
    }
    unset($log);
    if (!$found) {
        // Orphan ping after server restart -> recreate
        $logs[] = new_session($session_id, $visitor_id, $ip, $location, $device, $latitude, $longitude,
            intval($data["duration"] ?? 0));
    }
}

// ── END ───────────────────────────────────────────────────────────────────
if ($type === "end") {
    foreach ($logs as &$log) {
        if ($log["session_id"] === $session_id) {
            $log["duration"]  = intval($data["duration"] ?? $log["duration"]);
            $log["status"]    = "ended";
            $log["last_seen"] = date("Y-m-d H:i:s");
            break;
        }
    }
    unset($log);
}

// ── Auto-idle: active sessions with no ping for > 60s ────────────────────
foreach ($logs as &$log) {
    if (($log["status"] ?? '') === "active") {
        if ((time() - strtotime($log["last_seen"])) > 60) {
            $log["status"] = "idle";
        }
    }
}
unset($log);

// ── Cap at 1000 sessions ──────────────────────────────────────────────────
if (count($logs) > 1000) $logs = array_slice($logs, -1000);

file_put_contents($file, json_encode($logs, JSON_PRETTY_PRINT));
echo json_encode(["status" => "OK", "session_id" => $session_id]);
?>
