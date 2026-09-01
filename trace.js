// trace.js — drop this <script> tag on any page to report visits to trak.php
(function () {
    "use strict";

    const ENDPOINT = "trak.php"; // must match your actual backend filename
    const PING_INTERVAL_MS = 20000; // how often to refresh an active session

    // Persistent visitor id -- survives across visits/tabs
    let visitorId = localStorage.getItem("visitor_id");
    if (!visitorId) {
        visitorId = "v_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
        localStorage.setItem("visitor_id", visitorId);
    }

    // Session id -- one per tab/page-load, required so trak.php can match
    // "ping"/"end" events back to the "start" row they belong to. Without
    // this every request got a random server-generated id and ping/end
    // could never find their session, so duration and idle status never
    // updated after the initial "start".
    let sessionId = sessionStorage.getItem("session_id");
    if (!sessionId) {
        sessionId = "s_" + Date.now() + "_" + Math.floor(Math.random() * 1000000);
        sessionStorage.setItem("session_id", sessionId);
    }

    const startTime = Date.now();
    const device = navigator.userAgent;
    let started = false;
    let lastKnownLat = null;
    let lastKnownLng = null;
    let pingTimer = null;

    function sendVisit(type, duration = 0, latitude = null, longitude = null) {
        const payload = JSON.stringify({
            type, visitor_id: visitorId, session_id: sessionId,
            device, latitude, longitude, duration,
        });

        console.log("[trace.js] sending", type, "-> lat:", latitude, "lng:", longitude);

        if (type === "end" && navigator.sendBeacon) {
            navigator.sendBeacon(ENDPOINT, payload);
        } else {
            fetch(ENDPOINT, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: payload,
                keepalive: true,
            })
                .then((res) => res.json())
                .then((json) => console.log("[trace.js] " + ENDPOINT + " responded:", json))
                .catch((err) => console.warn("[trace.js] request to " + ENDPOINT + " failed:", err));
        }
    }

    function currentDuration() {
        return Math.floor((Date.now() - startTime) / 1000);
    }

    function startPingLoop() {
        if (pingTimer) return;
        pingTimer = setInterval(() => {
            if (document.visibilityState === "visible") {
                sendVisit("ping", currentDuration(), lastKnownLat, lastKnownLng);
            }
        }, PING_INTERVAL_MS);
    }

    function reportStart() {
        if (started) return; // avoid double-reporting from the geolocation callbacks
        started = true;

        if (!window.isSecureContext) {
            console.warn(
                "[trace.js] Not a secure context (page isn't served over HTTPS or localhost). " +
                "Browsers block navigator.geolocation entirely in this case -- GPS will silently " +
                "fail and every visit will fall back to IP-based location. Serve this page through " +
                "your Cloudflare/ngrok tunnel (https://...), not a plain http:// address, to fix this."
            );
        }

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    lastKnownLat = pos.coords.latitude;
                    lastKnownLng = pos.coords.longitude;
                    console.log(
                        "[trace.js] GPS position acquired:",
                        lastKnownLat, lastKnownLng,
                        "(±" + Math.round(pos.coords.accuracy) + "m)"
                    );
                    sendVisit("start", 0, lastKnownLat, lastKnownLng);
                    startPingLoop();
                },
                (err) => {
                    // err.code: 1 = PERMISSION_DENIED, 2 = POSITION_UNAVAILABLE, 3 = TIMEOUT
                    console.warn("[trace.js] GPS unavailable, falling back to IP:", err.code, err.message);
                    sendVisit("start");
                    startPingLoop();
                },
                { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
            );
        } else {
            console.warn("[trace.js] navigator.geolocation not supported by this browser.");
            sendVisit("start");
            startPingLoop();
        }
    }

    reportStart();

    window.addEventListener("beforeunload", () => {
        if (pingTimer) clearInterval(pingTimer);
        sendVisit("end", currentDuration(), lastKnownLat, lastKnownLng);
    });
})();
