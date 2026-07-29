import { X } from 'lucide-react';
import { DEFAULT_SYSTEM_PROMPT } from '../../utils/gremlinAgentDefaults';

const AgentSettingsModal = ({ isOpen, onClose, settings, onChangeSettings }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '500px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">AI Query Assistant Settings</h3>
                    <button className="control-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="form-group">
                    <label className="form-label">System Prompt</label>
                    <textarea
                        className="form-input"
                        value={settings.systemPrompt}
                        onChange={e => onChangeSettings({ ...settings, systemPrompt: e.target.value })}
                        placeholder={DEFAULT_SYSTEM_PROMPT}
                        rows={5}
                        style={{ resize: 'vertical', fontFamily: 'inherit' }}
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Graph Schema (optional)</label>
                    <textarea
                        className="form-input"
                        value={settings.schema}
                        onChange={e => onChangeSettings({ ...settings, schema: e.target.value })}
                        placeholder="Describe vertex/edge labels and properties, or leave blank to let the assistant infer the schema from sample data on each request."
                        rows={6}
                        style={{ resize: 'vertical', fontFamily: 'monospace', fontSize: '0.85rem' }}
                    />
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)' }}>
                    Query descriptions (and this schema, if set) are sent to Anthropic&apos;s Claude API to generate Gremlin queries.
                </div>
            </div>
        </div>
    );
};

export default AgentSettingsModal;
