const gremlin = require('gremlin');

async function test() {
    console.log("Connecting...");
    const client = new gremlin.driver.Client('ws://localhost:8182/gremlin', {
        traversalSource: 'g',
        mimeType: 'application/vnd.gremlin-v3.0+json'
    });

    await client.open();

    try {
        console.log("Fetching 10 nodes...");
        const result = await client.submit("g.V().limit(10)");

        let items = [];
        if (result && typeof result.toArray === 'function') {
            items = result.toArray();
        } else if (result && result._items) {
            items = result._items;
        }

        console.log(`Found ${items.length} nodes.`);
        if (items.length === 0) {
            console.log("No nodes found, cannot test edges.");
            return;
        }

        const nodes = items;
        const nodeIds = nodes.map(n => n.id);

        console.log("Node IDs:", nodeIds);
        console.log("Sample ID Type:", typeof nodeIds[0]);

        // Mimic the API logic
        const idList = nodeIds.map(id => {
            if (typeof id === 'number') return id;
            // If it's an object (like sometimes Gremlin returns for Longs), we need to handle it.
            return `'${id}'`;
        }).join(',');

        console.log("Constructed ID List for Query:", idList);

        const edgeQuery = `g.V(${idList}).bothE().where(__.otherV().hasId(${idList})).dedup()`;
        console.log("Running Edge Query:", edgeQuery);

        const edgeResult = await client.submit(edgeQuery);
        let edges = [];
        if (edgeResult && typeof edgeResult.toArray === 'function') {
            edges = edgeResult.toArray();
        } else if (edgeResult && edgeResult._items) {
            edges = edgeResult._items;
        }

        console.log(`Found ${edges.length} edges.`);
        console.log("Edges:", edges);

    } catch (e) {
        console.error("Error:", e);
    } finally {
        await client.close();
    }
}

test();
