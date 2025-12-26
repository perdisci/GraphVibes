import Head from 'next/head';
import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Play, Activity, Database, Layers, Banana, Copy, ExternalLink, Check, ZoomIn, ZoomOut, Maximize2, Minimize2, Settings, Focus, X, Link, AlertCircle, Loader, Palette } from 'lucide-react';
import { GRAPH_PALETTES } from '../utils/palettes';

const GraphViz = dynamic(() => import('../components/GraphViz'), {
    ssr: false
});

export default function Home() {
    const [query, setQuery] = useState('g.V().limit(50)');
    const [data, setData] = useState({ nodes: [], links: [] });
    const [raw, setRaw] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selectedElement, setSelectedElement] = useState(null);
    const [copied, setCopied] = useState(false);

    // UI State
    const [sidebarWidth, setSidebarWidth] = useState(400);
    const [isResizing, setIsResizing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

    // Connection Settings
    const [connectionSettings, setConnectionSettings] = useState({
        host: 'localhost',
        port: '8182'
    });
    const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected', 'connecting', 'disconnected'

    // Theme Settings
    const [theme, setTheme] = useState('dark');
    const [isThemeModalOpen, setIsThemeModalOpen] = useState(false);

    const THEME_CONFIG = {
        dark: { background: '#0f111a', label: 'Dark Mode' },
        light: { background: '#ffffff', label: 'Light Mode' },
        midnight: { background: '#020617', label: 'Midnight' }
    };

    // Apply theme
    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        // Update graph background but preserve other settings
        setGraphSettings(prev => ({ ...prev, backgroundColor: THEME_CONFIG[theme].background }));
    }, [theme]);

    // Graph Settings
    const [graphSettings, setGraphSettings] = useState({
        backgroundColor: '#0f111a',
        nodeColor: '', // default auto
        linkColor: '',  // default auto
        layoutMode: null, // null (force), td, bu, lr, rl, radialout, radialin
        activeNodePalette: 'default',
        activeEdgePalette: 'default'
    });

    const graphRef = useRef();
    const sidebarRef = useRef();

    // Resize Logic
    const startResizing = useCallback(() => {
        setIsResizing(true);
    }, []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
    }, []);

    const resize = useCallback((mouseMoveEvent) => {
        if (isResizing) {
            const newWidth = mouseMoveEvent.clientX;
            if (newWidth > 200 && newWidth < 800) {
                setSidebarWidth(newWidth);
            }
        }
    }, [isResizing]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);

    // Graph Controls
    const handleZoomIn = () => {
        if (graphRef.current) {
            graphRef.current.zoom(graphRef.current.zoom() * 1.2, 400);
        }
    };

    const handleZoomOut = () => {
        if (graphRef.current) {
            graphRef.current.zoom(graphRef.current.zoom() / 1.2, 400);
        }
    };

    const handleZoomFit = () => {
        if (graphRef.current) {
            graphRef.current.zoomToFit(400);
        }
    };

    const toggleMaximize = () => {
        setIsMaximized(!isMaximized);
        setTimeout(() => {
            if (graphRef.current) graphRef.current.zoomToFit(200);
        }, 100);
    };


    // Check connection on load and settings change
    const checkConnection = useCallback(async (host, port) => {
        setConnectionStatus('connecting');
        try {
            const res = await fetch('/api/test-connection', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ host, port }),
            });
            if (res.ok) {
                setConnectionStatus('connected');
            } else {
                setConnectionStatus('disconnected');
            }
        } catch (err) {
            setConnectionStatus('disconnected');
        }
    }, []);

    useEffect(() => {
        checkConnection(connectionSettings.host, connectionSettings.port);
    }, [checkConnection]); // connectionSettings dep handled by manual trigger or we can add it if we want auto-save.
    // For now, let's trigger on mount. And let's trigger when modal closes or "Save" is clicked.
    // Actually user requested "When I change... it should test". 
    // Implementing auto-check when modal closes or explicit "Test" button is better UX than typing.
    // Let's add debounced check or check on modal close/save.

    // User said "When I change...". Let's add a "Connect" button in the modal.

    const handleConnect = () => {
        checkConnection(connectionSettings.host, connectionSettings.port);
        setIsConnectionModalOpen(false);
    };

    const handleRunQuery = async () => {
        setLoading(true);
        setError(null);
        setSelectedElement(null);
        try {
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    host: connectionSettings.host,
                    port: connectionSettings.port
                }),
            });
            const result = await res.json();

            if (!res.ok) throw new Error(result.error);

            // Force graph to re-render or update
            setData(result.graph);
            setRaw(result.raw);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleNodeClick = (node) => {
        setSelectedElement({ ...node, type: 'node' });
    };

    const handleLinkClick = (link) => {
        setSelectedElement({ ...link, type: 'edge' });
    };

    const formatValue = (val) => {
        if (Array.isArray(val) && val.length > 0 && val[0].value !== undefined) {
            // Handle Gremlin property structure
            return val[0].value;
        }
        if (typeof val === 'object') {
            return JSON.stringify(val);
        }
        return String(val);
    };

    const handleCopy = () => {
        if (!raw) return;
        const text = JSON.stringify(raw, null, 2);
        navigator.clipboard.writeText(text).then(() => {
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        });
    };

    const handleMaximize = () => {
        if (!raw) return;
        const text = JSON.stringify(raw, null, 2);
        const newWindow = window.open();
        if (newWindow) {
            newWindow.document.write(`<pre style="margin: 0;">${text}</pre>`);
            newWindow.document.close();
        }
    };

    return (
        <div className="layout">
            <Head>
                <title>GraphVibes</title>
                <meta name="description" content="Modern GraphVibes Visualizer" />
            </Head>

            <header className="header">
                <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Banana size={24} color="#d946ef" /> GraphVibes.
                </div>
                <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto', alignItems: 'center' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', marginRight: '0.5rem' }}>
                        {connectionStatus === 'connected' && (
                            <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--status-connected)' }}>
                                <Activity size={14} /> Connected
                            </span>
                        )}
                        {connectionStatus === 'connecting' && (
                            <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#facc15' }}>
                                <Loader size={14} className="animate-spin" /> Connecting...
                            </span>
                        )}
                        {connectionStatus === 'disconnected' && (
                            <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#ef4444' }}>
                                <AlertCircle size={14} /> Disconnected
                            </span>
                        )}
                        <span style={{ fontSize: '0.65rem', color: '#64748b' }}>
                            {connectionSettings.host}:{connectionSettings.port}
                        </span>
                    </div>
                    <button
                        className="control-btn"
                        onClick={() => setIsConnectionModalOpen(true)}
                        title="Connection Settings"
                        style={{ padding: '0.25rem' }}
                    >
                        <Link size={16} />
                    </button>
                    <button
                        className="control-btn"
                        onClick={() => setIsThemeModalOpen(true)}
                        title="Change Theme"
                        style={{ padding: '0.25rem' }}
                    >
                        <Palette size={16} />
                    </button>
                </div>
            </header>

            <main className="main-content" style={{ gridTemplateColumns: isMaximized ? '0px 0px 1fr' : `${sidebarWidth}px 4px 1fr` }}>
                <div className="sidebar" ref={sidebarRef} style={{ display: isMaximized ? 'none' : 'flex' }}>
                    <div className="query-editor">
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Database size={14} /> GREMLIN QUERY
                            </h3>
                        </div>
                        <textarea
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            spellCheck={false}
                        />
                        <button className="btn" onClick={handleRunQuery} disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                            {loading ? 'Running...' : <><Play size={16} /> Run Query</>}
                        </button>
                        {error && (
                            <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', color: '#ef4444', fontSize: '0.85rem' }}>
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="results-panel">
                        <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Layers size={14} /> RAW RESULTS
                            </h3>
                            <div style={{ display: 'flex', gap: '0.5rem' }}>
                                <button
                                    onClick={handleCopy}
                                    title="Copy raw JSON"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: copied ? '#4ade80' : '#94a3b8',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    {copied ? <Check size={14} /> : <Copy size={14} />}
                                </button>
                                <button
                                    onClick={handleMaximize}
                                    title="Open locally in new tab"
                                    style={{
                                        background: 'none',
                                        border: 'none',
                                        color: '#94a3b8',
                                        cursor: 'pointer',
                                        padding: '4px',
                                        display: 'flex',
                                        alignItems: 'center'
                                    }}
                                >
                                    <ExternalLink size={14} />
                                </button>
                            </div>
                        </div>
                        <pre>{raw ? JSON.stringify(raw, null, 2) : '// Results will appear here'}</pre>
                    </div>
                </div>

                {/* Resize Handle */}
                <div
                    className={`resize-handle ${isResizing ? 'active' : ''}`}
                    style={{ display: isMaximized ? 'none' : 'block' }}
                    onMouseDown={startResizing}
                />

                <div className={`graph-area ${isMaximized ? 'full-screen-graph' : ''}`} style={{ position: 'relative' }}>
                    <div style={{ height: '100%', width: '100%' }}>
                        <GraphViz
                            ref={graphRef}
                            data={data}
                            onNodeClick={handleNodeClick}
                            onLinkClick={handleLinkClick}
                            backgroundColor={graphSettings.backgroundColor}
                            nodeColor={graphSettings.nodeColor || undefined}
                            linkColor={graphSettings.linkColor || undefined}
                            dagMode={graphSettings.layoutMode}
                            nodePalette={GRAPH_PALETTES[graphSettings.activeNodePalette]?.colors}
                            edgePalette={GRAPH_PALETTES[graphSettings.activeEdgePalette]?.colors}
                            onMaximize={toggleMaximize}
                            isMaximized={isMaximized}
                            onSettings={() => setIsSettingsOpen(true)}
                        />
                    </div>

                    {!isMaximized && (
                        <div className="graph-status">
                            {data.nodes.length} Nodes • {data.links.length} Edges
                        </div>
                    )}
                    {selectedElement && (
                        <div className="detail-popup">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>{selectedElement.type} Details</h2>
                                <button
                                    onClick={() => setSelectedElement(null)}
                                    style={{ background: 'none', border: 'none', color: 'var(--text-dim)', cursor: 'pointer', fontSize: '1.2rem' }}
                                >×</button>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>ID</div>
                                <div style={{ fontFamily: 'monospace', color: 'var(--text-main)' }}>
                                    {typeof selectedElement.id === 'object'
                                        ? (selectedElement.id.relationId || JSON.stringify(selectedElement.id))
                                        : selectedElement.id}
                                </div>
                            </div>

                            {selectedElement.label && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: 'var(--text-dim)', marginBottom: '0.25rem' }}>LABEL</div>
                                    <div style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '4px', background: selectedElement.displayColor || selectedElement.color || '#6366f1', color: '#fff', fontSize: '0.85rem' }}>
                                        {selectedElement.label}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>PROPERTIES</div>
                                {selectedElement.properties && Object.keys(selectedElement.properties).length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {Object.entries(selectedElement.properties).map(([key, val]) => (
                                            <div key={key} style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '6px' }}>
                                                <div style={{ color: 'var(--accent)', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{key}</div>
                                                <div style={{ color: 'var(--text-main)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                                                    {formatValue(val)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ color: 'var(--text-dim)', fontStyle: 'italic' }}>No properties</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>

            {isSettingsOpen && (
                <div className="modal-overlay" onClick={() => setIsSettingsOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Graph Settings</h3>
                            <button className="control-btn" onClick={() => setIsSettingsOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Background Color</label>
                            <input
                                type="text"
                                className="form-input"
                                value={graphSettings.backgroundColor}
                                onChange={e => setGraphSettings({ ...graphSettings, backgroundColor: e.target.value })}
                                placeholder="#0f111a"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Node Color Theme</label>
                            <select
                                className="form-input"
                                value={graphSettings.activeNodePalette}
                                onChange={e => setGraphSettings({ ...graphSettings, activeNodePalette: e.target.value })}
                                style={{ cursor: 'pointer' }}
                            >
                                {Object.entries(GRAPH_PALETTES).map(([key, palette]) => (
                                    <option key={key} value={key}>
                                        {palette.label}
                                    </option>
                                ))}
                            </select>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {/* Preview dots */}
                                {GRAPH_PALETTES[graphSettings.activeNodePalette]?.colors.slice(0, 8).map(c => (
                                    <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Edge Color Theme</label>
                            <select
                                className="form-input"
                                value={graphSettings.activeEdgePalette}
                                onChange={e => setGraphSettings({ ...graphSettings, activeEdgePalette: e.target.value })}
                                style={{ cursor: 'pointer' }}
                            >
                                {Object.entries(GRAPH_PALETTES).map(([key, palette]) => (
                                    <option key={key} value={key}>
                                        {palette.label}
                                    </option>
                                ))}
                            </select>
                            <div style={{ fontSize: '0.7rem', color: 'var(--text-dim)', marginTop: '0.25rem', display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                                {/* Preview dots */}
                                {GRAPH_PALETTES[graphSettings.activeEdgePalette]?.colors.slice(0, 8).map(c => (
                                    <div key={c} style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
                                ))}
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Graph Layout</label>
                            <select
                                className="form-input"
                                value={graphSettings.layoutMode || ''}
                                onChange={e => setGraphSettings({ ...graphSettings, layoutMode: e.target.value || null })}
                                style={{ cursor: 'pointer' }}
                            >
                                <option value="">Force Directed (Standard)</option>
                                <option value="td">Tree (Top-Down)</option>
                                <option value="bu">Tree (Bottom-Up)</option>
                                <option value="lr">Tree (Left-Right)</option>
                                <option value="rl">Tree (Right-Left)</option>
                                <option value="radialout">Radial (Outwards)</option>
                                <option value="radialin">Radial (Inwards)</option>
                            </select>
                        </div>
                    </div>
                </div>
            )}

            {isConnectionModalOpen && (
                <div className="modal-overlay" onClick={() => setIsConnectionModalOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3 className="modal-title">Connection Settings</h3>
                            <button className="control-btn" onClick={() => setIsConnectionModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>

                        <div className="form-group">
                            <label className="form-label">Gremlin Server Host</label>
                            <input
                                type="text"
                                className="form-input"
                                value={connectionSettings.host}
                                onChange={e => setConnectionSettings({ ...connectionSettings, host: e.target.value })}
                                placeholder="localhost"
                            />
                        </div>

                        <div className="form-group">
                            <label className="form-label">Port</label>
                            <input
                                type="text"
                                className="form-input"
                                value={connectionSettings.port}
                                onChange={e => setConnectionSettings({ ...connectionSettings, port: e.target.value })}
                                placeholder="8182"
                            />
                        </div>

                        <div style={{ marginTop: '1.5rem', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={handleConnect}
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
            )}

            {isThemeModalOpen && (
                <div className="modal-overlay" onClick={() => setIsThemeModalOpen(false)}>
                    <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '300px' }}>
                        <div className="modal-header">
                            <h3 className="modal-title">Select Theme</h3>
                            <button className="control-btn" onClick={() => setIsThemeModalOpen(false)}>
                                <X size={20} />
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                            {Object.entries(THEME_CONFIG).map(([key, config]) => (
                                <button
                                    key={key}
                                    onClick={() => { setTheme(key); setIsThemeModalOpen(false); }}
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
            )}
        </div>
    );
}
