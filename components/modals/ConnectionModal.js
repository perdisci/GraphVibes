import { X } from 'lucide-react';

const ConnectionModal = ({ isOpen, onClose, connectionSettings, onChangeSettings, onConnect }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Connection Settings</h3>
                    <button className="control-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="form-group">
                    <label className="form-label">Gremlin Server Host</label>
                    <input
                        type="text"
                        className="form-input"
                        value={connectionSettings.host}
                        onChange={e => onChangeSettings({ ...connectionSettings, host: e.target.value })}
                        placeholder="localhost"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Port</label>
                    <input
                        type="text"
                        className="form-input"
                        value={connectionSettings.port}
                        onChange={e => onChangeSettings({ ...connectionSettings, port: e.target.value })}
                        placeholder="8182"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Database Type</label>
                    <select
                        className="form-input"
                        value={connectionSettings.type || 'janus'}
                        onChange={e => onChangeSettings({ ...connectionSettings, type: e.target.value })}
                        style={{ cursor: 'pointer' }}
                    >
                        <option value="janus">JanusGraph (Default)</option>
                        <option value="puppy">Puppy Graph</option>
                    </select>
                </div>

                <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                    <button
                        onClick={onConnect}
                        style={{
                            background: '#7c3aed',
                            color: 'white',
                            border: 'none',
                            padding: '0.5rem 1rem',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: '500'
                        }}
                    >
                        Save & Connect
                    </button>
                </div>
            </div>
        </div>
    );
};

export default ConnectionModal;
