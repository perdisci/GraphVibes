import { AlertCircle, X } from 'lucide-react';

const WarningModal = ({ isOpen, onClose, message }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '450px', borderLeft: '4px solid #f59e0b' }}>
                <div className="modal-header">
                    <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}>
                        <AlertCircle size={20} /> Data Integrity Warning
                    </h3>
                    <button className="control-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div style={{ padding: '1rem', color: 'var(--text-main)', whiteSpace: 'pre-wrap' }}>
                    <p style={{ marginTop: 0 }}>Some edges could not be visualized because they reference nodes that do not exist in the current result set.</p>
                    <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '0.75rem',
                        borderRadius: '6px',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        maxHeight: '150px',
                        overflowY: 'auto'
                    }}>
                        {message}
                    </div>
                    <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                            className="btn"
                            onClick={onClose}
                            style={{ background: 'var(--bg-secondary)', color: 'var(--text-main)', border: '1px solid var(--border)' }}
                        >
                            Dismiss
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default WarningModal;
