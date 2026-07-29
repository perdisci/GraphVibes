import fs from 'fs';
import path from 'path';
import { DEFAULT_SYSTEM_PROMPT } from './gremlinAgentDefaults';

const SETTINGS_FILE = path.join(process.cwd(), '.agent-settings.json');

export const writeAgentSettings = (settings) => {
    const toSave = {
        systemPrompt: typeof settings.systemPrompt === 'string' ? settings.systemPrompt : DEFAULT_SYSTEM_PROMPT,
        schema: typeof settings.schema === 'string' ? settings.schema : ''
    };
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(toSave, null, 2), 'utf8');
    return toSave;
};

// Acts as the config file's default seed: if `.agent-settings.json` doesn't
// exist yet (fresh checkout), create it with the defaults so there's always
// a real file on disk for the operator to find and edit directly if they want.
export const readAgentSettings = () => {
    try {
        const parsed = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
        return {
            systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : DEFAULT_SYSTEM_PROMPT,
            schema: typeof parsed.schema === 'string' ? parsed.schema : ''
        };
    } catch (err) {
        return writeAgentSettings({ systemPrompt: DEFAULT_SYSTEM_PROMPT, schema: '' });
    }
};
