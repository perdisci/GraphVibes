import { connect } from '../../lib/gremlinClient';

// Helper to serialize Gremlin results roughly to JSON
const formatResult = (item) => {
    // Basic simplification
    return JSON.parse(JSON.stringify(item));
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { query, host = 'localhost', port = '8182' } = req.body;

    if (!query) {
        return res.status(400).json({ error: 'Query is required' });
    }

    const wsUrl = `ws://${host}:${port}/gremlin`;

    try {
        // In a real generic query runner, we'd use the script executor.
        // However, gremlin-javascript usually promotes bytecode or compiled queries.
        // For an "IDE", we typically want script submission: client.submit()

        // We'll create a new client just for script submission to allow raw string queries.
        // This is different from the 'g' traversal source.
        const gremlin = require('gremlin');
        const client = new gremlin.driver.Client(wsUrl, {
            traversalSource: 'g',
            mimeType: 'application/vnd.gremlin-v3.0+json'
        });

        await client.open();
        const result = await client.submit(query);
        await client.close();

        // Process graph data: extract vertices and edges if present
        const nodes = new Map();
        const links = new Map();

        // Traverse results to find graph elements
        // The result from client.submit is often an array or ResultSet
        // ._items is internal, usually use iteration

        // Use .toArray() which is the standard public API (in 3.5+ it returns the array directly or a promise depending on driver version, 
        // typically synchronous if data is already fetched).
        // Since we await submit(), we should have data. 
        // Note: in some versions toArray() is async, so we verify.
        let items = [];
        if (result && typeof result.toArray === 'function') {
            items = result.toArray();
        } else if (result && result._items) {
            items = result._items;
        }

        // Helper to extract ID safely
        const getId = (obj) => {
            if (obj && typeof obj === 'object' && obj.id) return obj.id;
            return obj;
        };

        // Process initial results
        // Process initial results
        items.forEach(item => {
            if (item && item.id && item.label && item.inV && item.outV) {
                // It's an edge (Check this FIRST because edges often lack inVLabel too, so they would match the vertex check)
                const sId = getId(item.outV);
                const tId = getId(item.inV);

                links.set(item.id, {
                    id: item.id,
                    source: sId,
                    target: tId,
                    label: item.label,
                    properties: item.properties || {}
                });

                // For direct edges in result, ensure nodes exist placeholders
                if (!nodes.has(sId)) nodes.set(sId, { id: sId, label: 'Unknown' });
                if (!nodes.has(tId)) nodes.set(tId, { id: tId, label: 'Unknown' });

            } else if (item && item.id && item.label) {
                // It's a vertex (Matches if it matches schema and wasn't caught as an edge)
                // Note: We removed !inVLabel check because it's simpler to just else-if after edge check
                nodes.set(item.id, {
                    id: item.id,
                    label: item.label,
                    properties: item.properties || {}
                });
            }
        });

        // Feature: Automatically fetch edges between the found nodes (Induced Subgraph)
        // Only if we have nodes but no edges (or fewer edges than expected, but "between nodes" usually implies we want them all)
        // To be safe and give the user what they asked "plot the edges between nodes", we run this check.
        if (nodes.size > 0) {
            const nodeIds = Array.from(nodes.keys());

            // We only run this if we have a reasonable number of nodes to avoid massive queries
            // Standard viz limits usually apply, e.g. < 500
            if (nodeIds.length < 500) {
                try {
                    // Re-open client or reuse (we closed it, so open new one)
                    // Note: We need a Traversal based approach for parameter injection or careful string construction
                    // Constructing a string query for ID list: g.V('id1', 'id2'...).bothE()...

                    // Helper to quote string IDs if necessary (Gremlin IDs can be numbers or strings)
                    // Assumption: simple IDs. For complex IDs, this simplistic joining might fail.
                    // But for standard JanusGraph (Long or UUID), string representation usually works or needs specific handling.
                    // A safer way is using bindings, but for this quick feature:

                    const idList = nodeIds.map(id => {
                        // Attempt to detect if number
                        if (typeof id === 'number') return id;
                        return `'${id}'`;
                    }).join(',');

                    // Query: Get all edges where BOTH ends are in our nodeId set.
                    // g.V(ids...).bothE().where(__.otherV().hasId(ids...))
                    const edgeQuery = `g.V(${idList}).bothE().where(__.otherV().hasId(${idList})).dedup()`;

                    const client2 = new gremlin.driver.Client(wsUrl, {
                        traversalSource: 'g',
                        mimeType: 'application/vnd.gremlin-v3.0+json'
                    });
                    await client2.open();
                    const edgeResult = await client2.submit(edgeQuery);
                    await client2.close();

                    let extraEdges = [];
                    if (edgeResult && typeof edgeResult.toArray === 'function') {
                        extraEdges = edgeResult.toArray();
                    } else if (edgeResult && edgeResult._items) {
                        extraEdges = edgeResult._items;
                    }

                    extraEdges.forEach(item => {
                        if (item && item.id && item.label && item.inV && item.outV) {
                            // Use safe ID extraction
                            const sId = getId(item.outV);
                            const tId = getId(item.inV);

                            // Only add if not exists
                            if (!links.has(item.id)) {
                                links.set(item.id, {
                                    id: item.id,
                                    source: sId,
                                    target: tId,
                                    label: item.label,
                                    properties: item.properties || {}
                                });
                            }
                        }
                    });

                } catch (err) {
                    console.warn("Failed to fetch induced edges:", err);
                    // Swallow error, main query result is still valid
                }
            }
        }

        res.status(200).json({
            raw: items,
            graph: {
                // Ensure we return arrays
                nodes: Array.from(nodes.values()),
                links: Array.from(links.values())
            }
        });

    } catch (error) {
        console.error('Gremlin Error:', error);
        res.status(500).json({ error: error.message, stack: error.stack });
    }
}
