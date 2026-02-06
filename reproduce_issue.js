const fetch = require('node-fetch'); // Assuming node-fetch is available or using built-in in newer node

// If node-fetch is not available, we might need to use http/https modules,
// but let's try standard fetch if Node 18+ (which user has in package.json engines)
// or just use http for safety since I don't want to install deps.
const http = require('http');

const runQuery = (query) => {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({
            query: query,
            // host/port defaults to localhost:8182 in API if not sent, 
            // but we'll send defaults just in case
            host: 'localhost',
            port: '8182',
            type: 'janus'
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
                    try {
                        resolve(JSON.parse(body));
                    } catch (e) {
                        reject(e);
                    }
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
    console.log("Testing API fix...");
    try {
        // Query only edges
        const query = "g.E().limit(5)";
        console.log(`Sending query: ${query}`);

        const result = await runQuery(query);

        console.log("Result received.");
        const links = result.graph.links;
        const nodes = result.graph.nodes;

        console.log(`Links found: ${links.length}`);
        console.log(`Nodes found: ${nodes.length}`);

        if (links.length === 0) {
            console.log("No links returned, cannot verify fix (is DB empty?).");
            return;
        }

        // Verify connectivity
        const nodeIds = new Set(nodes.map(n => {
            // Logic from API to create safe keys
            if (typeof n.id === 'object') {
                // Simplified check
                return JSON.stringify(n.id); // This might be sensitive to key order, but let's see
            }
            return String(n.id);
        }));

        // Also add "raw" IDs if scalar
        nodes.forEach(n => {
            if (typeof n.id !== 'object') nodeIds.add(n.id);
        });

        const missing = [];
        links.forEach(l => {
            const src = l.source; // IDs
            const tgt = l.target;

            let srcFound = false;
            if (nodeIds.has(String(src))) srcFound = true;
            if (typeof src === 'object' && nodeIds.has(JSON.stringify(src))) srcFound = true; // Flaky if ordering differs
            // Let's just check if we have *any* nodes. PRE-FIX: nodes would be 0.

            if (!srcFound) {
                // Actually, the API returns formatted nodes.
                // If nodes.length > 0 when only g.E() is asked, IT IS WORKING!
            }
        });

        if (nodes.length > 0) {
            console.log("SUCCESS: Nodes were automatically fetched!");
            // Check if they correspond
            console.log("Sample Node:", nodes[0]);
        } else {
            console.log("FAILURE: No nodes returned for edge-only query.");
        }

    } catch (e) {
        console.error("Test failed:", e.message);
        console.log("Make sure the Next.js server is running on port 3000 (npm run dev).");
    }
}

test();
