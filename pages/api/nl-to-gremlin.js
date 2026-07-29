import Anthropic from '@anthropic-ai/sdk';
import gremlin from 'gremlin';
import { validateConnectionTarget } from '../../utils/validateConnection';
import { formatResult } from '../../utils/gremlinIds';
import { DEFAULT_SYSTEM_PROMPT } from '../../utils/gremlinAgentDefaults';

const MODEL = 'claude-opus-5';

// Runs a few lightweight introspection queries against the Gremlin server so
// the model has something to infer the schema from when the operator hasn't
// configured one explicitly in the Agent Settings modal.
const inferSchema = async (wsUrl) => {
    const client = new gremlin.driver.Client(wsUrl, {
        traversalSource: 'g',
        mimeType: 'application/vnd.gremlin-v3.0+json'
    });

    try {
        await client.open();

        const run = async (query) => {
            const result = await client.submit(query);
            const items = typeof result.toArray === 'function' ? result.toArray() : (result._items || []);
            return items.map(formatResult);
        };

        const [vertexLabels, edgeLabels, sampleVertices, sampleEdges] = await Promise.all([
            run('g.V().label().dedup().limit(50)'),
            run('g.E().label().dedup().limit(50)'),
            run('g.V().limit(10).valueMap(true)'),
            run('g.E().limit(10).valueMap(true)')
        ]);

        return [
            'Vertex labels: ' + JSON.stringify(vertexLabels),
            'Edge labels: ' + JSON.stringify(edgeLabels),
            'Sample vertices (label + properties): ' + JSON.stringify(sampleVertices),
            'Sample edges (label + properties): ' + JSON.stringify(sampleEdges)
        ].join('\n');
    } finally {
        await client.close();
    }
};

// The model is instructed to return only the raw query, but strip a
// markdown code fence defensively in case it wraps the answer anyway.
const stripCodeFence = (text) => {
    const trimmed = text.trim();
    const fenced = trimmed.match(/^```(?:\w+)?\n([\s\S]*?)\n?```$/);
    return (fenced ? fenced[1] : trimmed).trim();
};

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const {
        description,
        systemPrompt,
        schema,
        host = 'localhost',
        port = '8182'
    } = req.body;

    if (!description || !description.trim()) {
        return res.status(400).json({ error: 'A natural language description is required' });
    }

    const validation = validateConnectionTarget(host, port);
    if (!validation.valid) {
        return res.status(400).json({ error: validation.error });
    }

    let schemaContext = (schema || '').trim();
    if (!schemaContext) {
        try {
            schemaContext = await inferSchema(`ws://${host}:${port}/gremlin`);
        } catch (err) {
            console.warn('[nl-to-gremlin] Schema inference failed, proceeding without it:', err.message);
        }
    }

    const systemSections = [
        (systemPrompt || DEFAULT_SYSTEM_PROMPT).trim(),
        schemaContext ? `Graph Schema (for reference):\n${schemaContext}` : null,
        'Respond with ONLY the raw Gremlin traversal, starting with `g.`. Do not include an explanation, markdown formatting, or code fences.'
    ].filter(Boolean);

    try {
        const anthropic = new Anthropic();
        const response = await anthropic.messages.create({
            model: MODEL,
            max_tokens: 4096,
            thinking: { type: 'adaptive' },
            output_config: { effort: 'medium' },
            system: systemSections.join('\n\n'),
            messages: [{ role: 'user', content: description }]
        });

        if (response.stop_reason === 'refusal') {
            return res.status(422).json({ error: 'The model declined to translate this request.' });
        }

        const textBlock = response.content.find(b => b.type === 'text');
        if (!textBlock || !textBlock.text.trim()) {
            return res.status(500).json({ error: 'The model did not return a query.' });
        }

        return res.status(200).json({ gremlin: stripCodeFence(textBlock.text) });

    } catch (err) {
        if (err instanceof Anthropic.AuthenticationError) {
            return res.status(500).json({ error: 'ANTHROPIC_API_KEY is not configured (or is invalid) on the server.' });
        }
        if (err instanceof Anthropic.RateLimitError) {
            return res.status(429).json({ error: 'Rate limited by the Claude API. Please try again shortly.' });
        }
        if (err instanceof Anthropic.APIConnectionError) {
            return res.status(502).json({ error: 'Could not reach the Claude API.' });
        }
        if (err instanceof Anthropic.APIError) {
            return res.status(502).json({ error: `Claude API error: ${err.message}` });
        }
        console.error('[nl-to-gremlin] Unexpected error:', err);
        return res.status(500).json({ error: err.message || 'Failed to translate query' });
    }
}
