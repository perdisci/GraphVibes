import { readAgentSettings, writeAgentSettings } from '../../utils/agentSettingsStore';

export default function handler(req, res) {
    if (req.method === 'GET') {
        return res.status(200).json(readAgentSettings());
    }

    if (req.method === 'POST') {
        const { systemPrompt, schema } = req.body;
        return res.status(200).json(writeAgentSettings({ systemPrompt, schema }));
    }

    return res.status(405).json({ error: 'Method not allowed' });
}
