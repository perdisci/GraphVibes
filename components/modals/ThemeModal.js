import { X } from 'lucide-react';
import { THEME_CONFIG } from '../../utils/themes';

const ThemeModal = ({ isOpen, onClose, theme, onSelectTheme }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '300px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">Select Theme</h3>
                    <button className="control-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                    {Object.entries(THEME_CONFIG).map(([key, config]) => (
                        <button
                            key={key}
                            onClick={() => onSelectTheme(key)}
                            style={{
                                padding: '1rem',
                                background: theme === key ? 'var(--primary)' : 'var(--surface-hover)',
                                border: '1px solid var(--border)',
                                borderRadius: '6px',
                                color: theme === key ? 'white' : 'var(--text-main)',
                                cursor: 'pointer',
                                textAlign: 'left',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}
                        >
                            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: config.background, border: '1px solid #666' }}></div>
                            {config.label}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ThemeModal;
