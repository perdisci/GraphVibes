import { X } from 'lucide-react';

const GraphSettingsModal = ({ isOpen, onClose, graphSettings, onChangeSettings, palettes }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()}>
                <div className="modal-header">
                    <h3 className="modal-title">Graph Settings</h3>
                    <button className="control-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="form-group">
                    <label className="form-label">Background Color</label>
                    <input
                        type="text"
                        className="form-input"
                        value={graphSettings.backgroundColor}
                        onChange={e => onChangeSettings({ ...graphSettings, backgroundColor: e.target.value })}
                        placeholder="#0f111a"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Neighbor Expansion Limit (on node double click)</label>
                    <input
                        type="number"
                        className="form-input"
                        value={graphSettings.expansionLimit}
                        onChange={e => onChangeSettings({ ...graphSettings, expansionLimit: parseInt(e.target.value) || 50 })}
                        min="1"
                        max="500"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">Node Color Theme</label>
                    <select
                        className="form-input"
                        value={graphSettings.activeNodePalette}
                        onChange={e => onChangeSettings({ ...graphSettings, activeNodePalette: e.target.value })}
                        style={{ cursor: 'pointer' }}
                    >
                        {Object.entries(palettes).map(([key, palette]) => (
                            <option key={key} value={key}>
                                {palette.label}
                            </option>
                        ))}
                    </select>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {/* Preview dots */}
                        {palettes[graphSettings.activeNodePalette]?.colors.slice(0, 8).map(c => (
                            <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Edge Color Theme</label>
                    <select
                        className="form-input"
                        value={graphSettings.activeEdgePalette}
                        onChange={e => onChangeSettings({ ...graphSettings, activeEdgePalette: e.target.value })}
                        style={{ cursor: 'pointer' }}
                    >
                        {Object.entries(palettes).map(([key, palette]) => (
                            <option key={key} value={key}>
                                {palette.label}
                            </option>
                        ))}
                    </select>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {/* Preview dots */}
                        {palettes[graphSettings.activeEdgePalette]?.colors.slice(0, 8).map(c => (
                            <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                        ))}
                    </div>
                </div>

                <div className="form-group">
                    <label className="form-label">Node Label Style</label>
                    <select
                        className="form-input"
                        value={graphSettings.labelStyle || 'standard'}
                        onChange={e => onChangeSettings({ ...graphSettings, labelStyle: e.target.value })}
                        style={{ cursor: 'pointer' }}
                    >
                        <option value="standard">Standard (Outline)</option>
                        <option value="inverted">Inverted (Dark Text)</option>
                        <option value="paper">Paper (White Box)</option>
                        <option value="glass">Glass (Dark Box)</option>
                    </select>
                </div>

                <div className="form-group">
                    <label className="form-label">Graph Layout</label>
                    <select
                        className="form-input"
                        value={graphSettings.layoutMode || ''}
                        onChange={e => onChangeSettings({ ...graphSettings, layoutMode: e.target.value || null })}
                        style={{ cursor: 'pointer' }}
                    >
                        <option value="">Force Directed (Standard)</option>
                        <option value="td">Tree (Top-Down)</option>
                        <option value="bu">Tree (Bottom-Up)</option>
                        <option value="lr">Tree (Left-Right)</option>
                        <option value="rl">Tree (Right-Left)</option>
                        <option value="radialout">Radial (Outwards)</option>
                        <option value="radialin">Radial (Inwards)</option>
                        <option value="circular">Circular</option>
                        <option value="community">Community</option>
                    </select>
                </div>
            </div>
        </div>
    );
};

export default GraphSettingsModal;
