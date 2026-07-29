import fs from 'fs';
import path from 'path';
import { DEFAULT_SYSTEM_PROMPT } from './gremlinAgentDefaults';

// The defaults GraphVibes ships with — read-only from the app's perspective,
// never overwritten by operator/UI changes. Committed to the repo so a fresh
// checkout starts with a known system prompt.
const DEFAULTS_FILE = path.join(process.cwd(), '.agent-settings.json');

// Whatever the operator changes via the Agent Settings modal (system prompt
// edits, auto-inferred schema) is persisted here instead, so DEFAULTS_FILE
// stays untouched. Gitignored — this is per-instance, not part of the repo.
const LOCAL_FILE = path.join(process.cwd(), '.agent-settings.local.json');

const readJsonSettings = (filePath) => {
    const parsed = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    return {
        systemPrompt: typeof parsed.systemPrompt === 'string' ? parsed.systemPrompt : DEFAULT_SYSTEM_PROMPT,
        schema: typeof parsed.schema === 'string' ? parsed.schema : ''
    };
};

// Seeds DEFAULTS_FILE with DEFAULT_SYSTEM_PROMPT if it doesn't exist yet
// (fresh checkout), so there's always a real, committed default config file.
const readDefaultAgentSettings = () => {
    try {
        return readJsonSettings(DEFAULTS_FILE);
    } catch (err) {
        const defaults = { systemPrompt: DEFAULT_SYSTEM_PROMPT, schema: '' };
        fs.writeFileSync(DEFAULTS_FILE, JSON.stringify(defaults, null, 2), 'utf8');
        return defaults;
    }
};

export const readAgentSettings = () => {
    try {
        return readJsonSettings(LOCAL_FILE);
    } catch (err) {
        return readDefaultAgentSettings();
    }
};

export const writeAgentSettings = (settings) => {
    const toSave = {
        systemPrompt: typeof settings.systemPrompt === 'string' ? settings.systemPrompt : DEFAULT_SYSTEM_PROMPT,
        schema: typeof settings.schema === 'string' ? settings.schema : ''
    };
    fs.writeFileSync(LOCAL_FILE, JSON.stringify(toSave, null, 2), 'utf8');
    return toSave;
};
