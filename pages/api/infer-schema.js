import gremlin from 'gremlin';
import { validateConnectionTarget } from '../../utils/validateConnection';
import { formatResult } from '../../utils/gremlinIds';

// Runs JanusGraph's schema-printing management call so the AI Query
// Assistant's schema box can be auto-populated when the operator hasn't
// configured one. Only meaningful against JanusGraph — callers should treat
// a failure here as non-fatal and fall back to generic sample-based inference.
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { host = 'localhost', port = '8182' } = req.body;

    const validation = validateConnectionTarget(host, port);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    const client = new gremlin.driver.Client(`ws://${host}:${port}/gremlin`, {
        traversalSource: 'g',
        mimeType: 'application/vnd.gremlin-v3.0+json'
    });

    try {
        await client.open();
        const result = await client.submit('graph.openManagement().printSchema()');
        const items = typeof result.toArray === 'function' ? result.toArray() : (result._items || []);
        const schema = items.map(formatResult).join('\n').trim();

        if (!schema) {
            return res.status(502).json({ error: 'printSchema() returned no output.' });
        }

        return res.status(200).json({ schema });
    } catch (err) {
        console.error('[infer-schema] printSchema() failed:', err.message);
        return res.status(502).json({ error: err.message || 'Failed to fetch schema via printSchema()' });
    } finally {
        await client.close();
    }
}
