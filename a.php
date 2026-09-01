<?php
date_default_timezone_set("UTC");

$data = json_decode(file_get_contents("php://input"), true);
$file = "logs.json";
$logs = json_decode(file_get_contents($file), true) ?: [];

$ip = $_SERVER['REMOTE_ADDR'];
$visitor_id = $data['visitor_id'] ?? uniqid();
$device = $data['device'] ?? "Unknown";

// Take GPS from client if available
$latitude = $data['latitude'] ?? null;
$longitude = $data['longitude'] ?? null;

// Determine country and fallback coordinates
$country = "Unknown";
if ($latitude === null || $longitude === null) {
    // Only try for public IPs
    if (!preg_match("/^(127\.|192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[0-1]))/", $ip)) {
        $geo = @file_get_contents("http://ip-api.com/json/$ip");
        if ($geo) {
            $geoData = json_decode($geo, true);
            if ($geoData && $geoData['status'] === 'success') {
                $country = $geoData['country'];
                $latitude = $latitude ?? $geoData['lat'];
                $longitude = $longitude ?? $geoData['lon'];
            }
        }
    } else {
        $country = "Local Network";
        $latitude = $latitude ?? 0;
        $longitude = $longitude ?? 0;
    }
} else {
    $country = "GPS Provided";
}

// Handle start
if ($data['type'] === "start") {
    $exists = false;
    foreach ($logs as $log) { if ($log["visitor_id"] === $visitor_id) $exists = true; }
    if (!$exists) {
        $logs[] = [
            "visitor_id" => $visitor_id,
            "ip" => $ip,
            "country" => $country,
            "device" => $device,
            "latitude" => $latitude,
            "longitude" => $longitude,
            "open_time" => date("Y-m-d H:i:s"),
            "duration" => 0
        ];
    }
}

// Handle end
if ($data['type'] === "end") {
    foreach ($logs as &$log) {
        if ($log["visitor_id"] === $visitor_id) {
            $log["duration"] = intval($data["duration"]);
        }
    }
}

// Save logs
file_put_contents($file, json_encode($logs, JSON_PRETTY_PRINT));
echo "OK";
?>
