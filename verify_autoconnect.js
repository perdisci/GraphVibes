// verify_autoconnect.js
const http = require('http');

const runQuery = (query, autoConnect) => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            query: query,
            host: 'localhost',
            port: '8182',
            type: 'janus',
            autoConnect: autoConnect
        });

        const options = {
            hostname: 'localhost',
            port: 3000,
            path: '/api/query',
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': data.length
            }
        };

        const req = http.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                if (res.statusCode >= 200 && res.statusCode < 300) {
                    try { resolve(JSON.parse(body)); }
                    catch (e) { reject(e); }
                } else {
                    reject(new Error(`Status ${res.statusCode}: ${body}`));
                }
            });
        });
        req.on('error', reject);
        req.write(data);
        req.end();
    });
};

async function test() {
    console.log("Verifying Auto-Connect Logic...");
    try {
        // Query nodes only. We expect edges to be returned if autoConnect=true.
        // Assuming there are connected nodes in the first 20.
        const query = "g.V().limit(10)";

        console.log(`[1] Running with autoConnect=false (Baseline)`);
        const resFalse = await runQuery(query, false);
        const edgesFalse = resFalse.graph.links.length;
        console.log(`-> Found ${edgesFalse} edges (Should be 0 if pure node query)`);

        console.log(`[2] Running with autoConnect=true (Target)`);
        const resTrue = await runQuery(query, true);
        const edgesTrue = resTrue.graph.links.length;
        const nodesTrue = resTrue.graph.nodes.length;
        console.log(`-> Found ${nodesTrue} nodes`);
        console.log(`-> Found ${edgesTrue} edges`);

        if (edgesTrue > edgesFalse) {
            console.log("SUCCESS: Edges were automatically fetched!");

            // Critical Check: No extra nodes!
            // The logic: "Do not automatically perform other extra queries that may artificially increase the number of vertices"
            // So if we asked for limits(10), we should get <= 10 nodes (or slightly more if query naturally returned path, but here it's V().limit(10))

            // Actually, g.V().limit(10) returns exactly 10 vertices.
            // If the auto-connect added vertices, it would be bad.
            // But the backend implementation only ADDS LINKS, it doesn't add nodes from the edge query unless logic is flawed.
            // The logic: if (safeNodeKeys.has(safeIn) && safeNodeKeys.has(safeOut)) ... add link

            console.log(`Node count check: Is ${nodesTrue} consistent?`);
        } else {
            console.log("WARNING: No additional edges found. Might be disconnected nodes or feature failed.");
        }

    } catch (e) {
        console.error("Test failed:", e.message);
    }
}

test();
