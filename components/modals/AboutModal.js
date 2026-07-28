import { X } from 'lucide-react';

const AboutModal = ({ isOpen, onClose, theme }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
                <div className="modal-header">
                    <h3 className="modal-title">About Graph.Vibes</h3>
                    <button className="control-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>
                <div style={{ padding: '1rem', color: 'var(--text-main)' }}>
                    <div style={{ marginBottom: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
                        <img
                            src={theme === 'light' ? '/GraphVibes-Logo-Light.png' : '/GraphVibes-Logo-Dark.png'}
                            alt="Graph.Vibes"
                            style={{ height: '64px', borderRadius: '8px' }}
                        />
                        <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Graph.Vibes</h2>
                        <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>Graph Visualizer</p>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
                        <div style={{ fontWeight: 600, opacity: 0.7 }}>Version</div>
                        <div>0.2.5</div>
                        <div style={{ fontWeight: 600, opacity: 0.7 }}>Author</div>
                        <div>Roberto Perdisci</div>
                        <div style={{ fontWeight: 600, opacity: 0.7 }}>AI Coding Agent</div>
                        <div>Gemini 3 Pro + Antigravity</div>
                        <div style={{ fontWeight: 600, opacity: 0.7 }}>Stack</div>
                        <div>
                            Next.js (12.3.4) • React (17.0.2)<br />
                            Gremlin (3.5.6) • ForceGraph (^1.29.0)<br />
                            Monaco Editor (^4.7.0) • Lucide Icons (^0.294.0)
                        </div>
                        <div style={{ fontWeight: 600, opacity: 0.7 }}>License</div>
                        <div>MIT</div>
                    </div>
                    <div style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--border)', textAlign: 'center', fontSize: '0.8rem', opacity: 0.5 }}>
                        &copy; 2025 Graph.Vibes Project
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AboutModal;
