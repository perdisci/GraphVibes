import { connect } from '../../lib/gremlinClient';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { host = 'localhost', port = '8182' } = req.body;
    const wsUrl = `ws://${host}:${port}/gremlin`;

    try {
        const gremlin = require('gremlin');
        const client = new gremlin.driver.Client(wsUrl, {
            traversalSource: 'g',
            mimeType: 'application/vnd.gremlin-v3.0+json'
        });

        // Attempt quickly to open connection
        await client.open();
        // If we get here, connection is successful
        await client.close();

        res.status(200).json({ status: 'connected', message: 'Connection successful' });
    } catch (error) {
        console.error('Connection Test Error:', error.message);
        res.status(500).json({ status: 'error', error: error.message });
    }
}
