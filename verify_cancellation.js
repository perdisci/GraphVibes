// verify_cancellation.js
// Cancellation is hard to verify via script because it requires precise timing of AbortController.
// However, we can verify that:
// 1. The API still accepts requests (logic not broken).
// 2. We can simulate a client disconnect (close socket) and see if API survives.

const http = require('http');

async function test() {
    console.log("Verifying API Responsiveness...");

    // 1. Normal Query
    const query = "g.V().limit(1)";

    const req = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/query',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    }, (res) => {
        let body = '';
        res.on('data', c => body += c);
        res.on('end', () => {
            console.log("Normal Query Status:", res.statusCode);
            if (res.statusCode === 200) console.log("SUCCESS: API is working.");
            else console.log("FAILURE: API returned error", body);
        });
    });

    req.write(JSON.stringify({ query, host: 'localhost', port: '8182', type: 'janus' }));
    req.end();

    // 2. Aborted Query Simulation
    // We start a request and destroy it immediately.
    console.log("Simulating Abort...");
    const reqAbort = http.request({
        hostname: 'localhost',
        port: 3000,
        path: '/api/query',
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
    });

    reqAbort.on('error', (e) => {
        // Expected error on destroy
        console.log("Client aborted request (Expected).");
    });

    reqAbort.write(JSON.stringify({ query: "g.V().limit(1000)", host: 'localhost', port: '8182', type: 'janus' }));
    // Wait a tiny bit then kill it
    setTimeout(() => {
        reqAbort.destroy();
        console.log("Request destroyed. Check server logs for 'Client closed connection'.");
    }, 100);
}

test();
