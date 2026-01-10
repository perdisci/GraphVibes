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
        try {
            const { mode } = req.body;

            if (mode === 'edgeProps') {
                const { sourceId, edgeId } = req.body;
                // Robust Fetch Strategy for Single Edge
                // Use fuzzy match approach + split list projection

                // 1. Resolve sourceId safely 
                // Only treat as raw GraphSON/JSON if it looks like an object.
                // Otherwise use JSON.stringify to handle both numbers and strings correctly ("123" vs 123)
                const sId = (typeof sourceId === 'string' && sourceId.trim().startsWith('{'))
                    ? sourceId
                    : JSON.stringify(sourceId);

                // 2. Query
                // Use bothE() to handle potential direction confusion or incoming edges where sourceId is actually target
                const propQuery = `g.V(${sId}).bothE().project('id', 'keys', 'vals').by(__.id()).by(__.properties().key().fold()).by(__.properties().value().fold())`;

                console.log(`[EdgeProps] Fetching for source=${sId} edge=${edgeId}`);
                console.log(`[EdgeProps] Query: ${propQuery}`);

                const clientProp = new gremlin.driver.Client(wsUrl, {
                    traversalSource: 'g',
                    mimeType: 'application/vnd.gremlin-v3.0+json'
                });
                await clientProp.open();
                const propRes = await clientProp.submit(propQuery);
                await clientProp.close();

                let items = [];
                if (propRes && typeof propRes.toArray === 'function') items = propRes.toArray();
                else if (propRes && propRes._items) items = propRes._items;

                let foundProps = {};

                // Helper for deterministic key matching
                const getSafeKey = (id) => {
                    if (id && typeof id === 'object') {
                        const keys = Object.keys(id).sort();
                        if (keys.length === 0 && typeof id.toString === 'function') {
                            const s = id.toString();
                            if (s !== '[object Object]') return s;
                        }
                        const sorted = {};
                        keys.forEach(k => sorted[k] = id[k]);
                        return JSON.stringify(sorted);
                    }
                    return id;
                };

                const targetKey = getSafeKey(edgeId);
                const targetStr = String(edgeId);

                // Find match
                for (const item of items) {
                    let id;
                    let keysArr = [];
                    let valsArr = [];

                    if (item instanceof Map) {
                        id = item.get('id');
                        keysArr = item.get('keys');
                        valsArr = item.get('vals');
                    } else {
                        id = item.id;
                        keysArr = item.keys;
                        valsArr = item.vals;
                    }

                    // Check Match
                    let isMatch = false;
                    // Robust comparison:
                    // 1. SafeKey (deterministically sorted JSON for objects)
                    // 2. String coercion (handles 123 vs "123")
                    if (getSafeKey(id) === targetKey) isMatch = true;
                    else if (String(id) === targetStr) isMatch = true;
                    // 3. Last resort: JSON stringify match (e.g. if one safeKey differed slightly but structure is same)
                    else if (JSON.stringify(id) === JSON.stringify(edgeId)) isMatch = true;

                    if (isMatch) {
                        // Zip
                        const kList = Array.isArray(keysArr) ? keysArr : (keysArr ? Array.from(keysArr) : []);
                        const vList = Array.isArray(valsArr) ? valsArr : (valsArr ? Array.from(valsArr) : []);
                        kList.forEach((k, i) => { if (i < vList.length) foundProps[String(k)] = vList[i]; });
                        break;
                    }
                }

                res.status(200).json({ properties: foundProps });
                return;
            }
        } catch (err) {
            console.error(err);
            if (req.body.mode === 'edgeProps') {
                return res.status(500).json({ error: 'Failed' });
            }
        }

        const client = new gremlin.driver.Client(wsUrl, {
            traversalSource: 'g',
            mimeType: 'application/vnd.gremlin-v3.0+json'
        });

        await client.open();
        console.log(`[Gremlin] Main Query: ${query}`);
        const result = await client.submit(query);
        await client.close();

        // Process graph data: extract vertices and edges if present
        const nodes = new Map();
        const links = new Map();

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

        // Helper for consistent Map keys - robust & deterministic
        const getSafeKey = (id) => {
            if (id && typeof id === 'object') {
                // Sort keys to ensure deterministic string
                const keys = Object.keys(id).sort();
                if (keys.length === 0 && typeof id.toString === 'function') {
                    // Handle Longs or custom classes with no enumerable props but valid toString
                    const s = id.toString();
                    if (s !== '[object Object]') return s;
                }
                const sorted = {};
                keys.forEach(k => sorted[k] = id[k]);
                return JSON.stringify(sorted);
            }
            return id;
        };

        // Process initial results
        // Process initial results
        items.forEach(item => {
            if (item && item.id && item.label && item.inV && item.outV) {
                // It's an edge
                const edge = formatResult(item);
                const safeId = getId(item);
                links.set(getSafeKey(safeId), {
                    id: safeId,
                    label: item.label,
                    source: getId(item.outV), // Use ID ref for D3 (will rely on nodes being present)
                    target: getId(item.inV),
                    properties: item.properties || {}
                });
            } else if (item && item.id && item.label) {
                // It's a node
                const node = formatResult(item);
                const safeId = getId(item);
                nodes.set(getSafeKey(safeId), {
                    id: safeId,
                    label: item.label,
                    properties: item.properties || {}
                });
            } else if (item && item.path && item.path.objects) {
                // Handle path results
                item.path.objects.forEach(obj => {
                    if (obj.id && obj.label) {
                        // Check if edge (has inV/outV - though path objects usually don't have full edge info unless elementMap used)
                        // For now treat as node if simple
                        const safeId = getId(obj);
                        nodes.set(getSafeKey(safeId), {
                            id: safeId,
                            label: obj.label,
                            properties: obj.properties || {}
                        });
                    }
                });
            }
        });

        // If nodes/links are empty (e.g. valueMap, or just IDs), we might need to handle differently
        // But for the Visualizer, we expect nodes/edges.

        // FETCH MISSING PROPERTIES FOR PUPPY GRAPH
        // Check if DB type is puppy and nodes/edges lack props
        const { type } = req.body; // 'janus' or 'puppy'

        if (type === 'puppy') {
            // 1. Enrich Nodes
            const nodesWithoutProps = [];
            for (const n of nodes.values()) {
                if (!n.properties || Object.keys(n.properties).length === 0) {
                    nodesWithoutProps.push(n);
                }
            }

            if (nodesWithoutProps.length > 0) {
                // Fetch properties for these IDs using elementMap
                // We batch this to avoid huge queries
                const BATCH_SIZE_LIMIT = 500;
                const chunk = nodesWithoutProps.slice(0, BATCH_SIZE_LIMIT);

                const idList = chunk.map(n => {
                    const id = n.id;
                    if (typeof id === 'number') return id;
                    // Use JSON.stringify for safety
                    return JSON.stringify(id);
                }).join(',');

                const propQuery = `g.V(${idList}).elementMap()`;

                try {
                    // Run property fetch
                    const clientProp = new gremlin.driver.Client(wsUrl, {
                        traversalSource: 'g',
                        mimeType: 'application/vnd.gremlin-v3.0+json'
                    });
                    await clientProp.open();
                    console.log(`[Gremlin] Node Enrichment Query: ${propQuery}`);
                    const propRes = await clientProp.submit(propQuery);
                    await clientProp.close();

                    let propItems = [];
                    if (propRes && typeof propRes.toArray === 'function') propItems = propRes.toArray();
                    else if (propRes && propRes._items) propItems = propRes._items;

                    // Helper to get ID from Map safely
                    const getMapId = (m) => {
                        let val = m.get('id');
                        if (val) return val;
                        // Try T.id (safe access)
                        try {
                            if (gremlin.process.t && gremlin.process.t.id) {
                                val = m.get(gremlin.process.t.id);
                                if (val) return val;
                            }
                            if (gremlin.process.traversal && gremlin.process.traversal.t && gremlin.process.traversal.t.id) {
                                val = m.get(gremlin.process.traversal.t.id);
                                if (val) return val;
                            }
                        } catch (e) { /* ignore */ }
                        return val;
                    };

                    propItems.forEach(item => {
                        // elementMap returns {id:..., label:..., prop:val...}
                        // We need to merge this into our nodes
                        let id = item.id;
                        let props = {};

                        // If it's a Map (from gremlin-js), we need to extract.
                        // Assuming simplified JSON behavior for this 'IDE'.
                        if (!id && item instanceof Map) {
                            id = getMapId(item);
                        }
                        // Convert Map to Object
                        if (item instanceof Map) {
                            item.forEach((value, key) => {
                                const keyStr = String(key);
                                props[keyStr] = value;
                            });
                        } else {
                            props = { ...item };
                        }

                        // Find node in map
                        // Clean up ID (sometimes elementMap returns ID differently?)
                        const safeId = getId({ id });
                        const safeKey = getSafeKey(safeId);

                        const targetNode = nodes.get(safeKey);
                        if (targetNode) {
                            // Remove id, label from props if present as they are metadata
                            delete props.id;
                            delete props.label;
                            targetNode.properties = { ...targetNode.properties, ...props };
                        }
                    });
                } catch (err) {
                    console.warn("Failed to enrich PuppyGraph node properties:", err);
                }
            }

            // 2. Enrich Edges
            // Puppy Graph might return empty properties for edges too.
            const linksWithoutProps = [];
            for (const l of links.values()) {
                if (!l.properties || Object.keys(l.properties).length === 0) {
                    linksWithoutProps.push(l);
                }
            }

            if (linksWithoutProps.length > 0) {
                const BATCH = 200; // Reduce batch size slightly as outE() can be larger
                const chunk = linksWithoutProps.slice(0, BATCH);

                try {
                    // Strategy change: Direct g.E(id) lookup is failing for complex PuppyGraph IDs.
                    // Fallback to Traversal: g.V(sourceIds).outE().elementMap()
                    // This relies on Vertex IDs which are known to work.

                    const sourceIdSet = new Set();
                    chunk.forEach(l => {
                        // l.source is the ID.
                        // We need to ensure we handle it as we did for Node enrichment.
                        sourceIdSet.add(l.source);
                    });

                    const sourceIds = Array.from(sourceIdSet);

                    // Serialize Source IDs
                    const idList = sourceIds.map(id => {
                        if (typeof id === 'number') return id;
                        // Use JSON.stringify for safety
                        return JSON.stringify(id);
                    }).join(',');

                    // Fetch ALL out-edges for these sources with properties.
                    // We will match them back to our links map in memory.
                    // Fetch ALL out-edges for these sources with properties.
                    // We will match them back to our links map in memory.
                    // Strategy: Split keys and values into separate lists to avoid Map construction bugs in DB.
                    // Use bothE() to handle potential direction confusion
                    const propQuery = `g.V(${idList}).bothE().project('id', 'keys', 'vals').by(__.id()).by(__.properties().key().fold()).by(__.properties().value().fold())`;

                    const clientProp = new gremlin.driver.Client(wsUrl, {
                        traversalSource: 'g',
                        mimeType: 'application/vnd.gremlin-v3.0+json'
                    });
                    await clientProp.open();
                    console.log(`[Gremlin] Edge Enrichment Query: ${propQuery}`);
                    const propRes = await clientProp.submit(propQuery);
                    await clientProp.close();

                    let propItems = [];
                    if (propRes && typeof propRes.toArray === 'function') propItems = propRes.toArray();
                    else if (propRes && propRes._items) propItems = propRes._items;

                    propItems.forEach(item => {
                        let id;
                        let keysArr = [];
                        let valsArr = [];

                        // Extract result from Project (Map or Object)
                        if (item instanceof Map) {
                            id = item.get('id');
                            keysArr = item.get('keys');
                            valsArr = item.get('vals');
                        } else {
                            id = item.id;
                            keysArr = item.keys;
                            valsArr = item.vals;
                        }

                        // Zip keys and values into props object
                        let props = {};
                        const kList = Array.isArray(keysArr) ? keysArr : (keysArr ? Array.from(keysArr) : []);
                        const vList = Array.isArray(valsArr) ? valsArr : (valsArr ? Array.from(valsArr) : []);
                        if (kList.length > 0) {
                            kList.forEach((k, i) => { if (i < vList.length) props[String(k)] = vList[i]; });
                        }

                        // Check ID
                        // Edges usually have string/number IDs. 
                        // Clean up ID
                        const safeId = getId({ id });
                        const safeKey = getSafeKey(safeId);

                        // Look up using safe key
                        let targetLink = links.get(safeKey);

                        // Fallback: If not found by safe key, try loose string matching
                        // This handles cases where ID exists but types differ (Number vs String)
                        // or object key order differences where getSafeKey might fail to align perfectly
                        if (!targetLink) {
                            const paramsIdStr = String(id);
                            // We can iterate values since size is usually small (BATCH=200) or total graph is small
                            for (const l of links.values()) {
                                if (String(l.id) === paramsIdStr) {
                                    targetLink = l;
                                    break;
                                }
                                // Try verified JSON representation if object
                                if (l.id && typeof l.id === 'object' && id && typeof id === 'object') {
                                    // Use robust safeKey on both
                                    if (getSafeKey(l.id) === getSafeKey(id)) {
                                        targetLink = l;
                                        break;
                                    }
                                }
                            }
                        }

                        if (targetLink) {
                            delete props.id;
                            delete props.label;
                            // Remove direction keys (IN/OUT) which come with elementMap
                            delete props.IN;
                            delete props.OUT;
                            // Also map keys if present (by string representation)
                            delete props['Direction.IN'];
                            delete props['Direction.OUT']; // Just in case

                            targetLink.properties = { ...targetLink.properties, ...props };
                        }
                    });

                } catch (err) {
                    console.warn("Failed to enrich PuppyGraph edge properties:", err);
                }
            }
        }

        res.status(200).json({
            raw: items,
            graph: {
                nodes: Array.from(nodes.values()),
                links: Array.from(links.values())
            }
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ error: err.message || 'Error processing query' });
    }
}
