import Head from 'next/head';
import { useState } from 'react';
import GraphViz from '../components/GraphViz';
import { Play, Activity, Database, Layers } from 'lucide-react';

export default function Home() {
    const [query, setQuery] = useState('g.V().limit(50)');
    const [data, setData] = useState({ nodes: [], links: [] });
    const [raw, setRaw] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [selectedElement, setSelectedElement] = useState(null);

    const runQuery = async () => {
        setLoading(true);
        setError(null);
        setSelectedElement(null);
        try {
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
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

    return (
        <div className="layout">
            <Head>
                <title>JanusGraph Viz</title>
                <meta name="description" content="Modern JanusGraph Visualizer" />
            </Head>

            <header className="header">
                <div className="logo">LowGravity.</div>
                <div style={{ display: 'flex', gap: '1rem', marginLeft: 'auto' }}>
                    <span style={{ fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#4ade80' }}>
                        <Activity size={14} /> Connected
                    </span>
                </div>
            </header>

            <main className="main-content">
                <div className="sidebar">
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
                        <button className="btn" onClick={runQuery} disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem' }}>
                            {loading ? 'Running...' : <><Play size={16} /> Run Query</>}
                        </button>
                        {error && (
                            <div style={{ marginTop: '1rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', color: '#ef4444', fontSize: '0.85rem' }}>
                                {error}
                            </div>
                        )}
                    </div>

                    <div className="results-panel">
                        <h3 style={{ marginTop: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <Layers size={14} /> RAW RESULTS
                        </h3>
                        <pre>{raw ? JSON.stringify(raw, null, 2) : '// Results will appear here'}</pre>
                    </div>
                </div>

                <div className="graph-area" style={{ position: 'relative' }}>
                    <GraphViz data={data} onNodeClick={handleNodeClick} onLinkClick={handleLinkClick} />
                    <div style={{ position: 'absolute', bottom: '1rem', right: '1rem', background: 'rgba(0,0,0,0.6)', padding: '0.5rem 1rem', borderRadius: '20px', fontSize: '0.8rem', color: '#94a3b8', backdropFilter: 'blur(4px)' }}>
                        {data.nodes.length} Nodes • {data.links.length} Edges
                    </div>
                    {selectedElement && (
                        <div style={{
                            position: 'absolute',
                            top: 0,
                            right: 0,
                            bottom: 0,
                            width: '300px',
                            background: 'rgba(26, 29, 45, 0.95)',
                            borderLeft: '1px solid #2f3446',
                            backdropFilter: 'blur(10px)',
                            padding: '1.5rem',
                            overflowY: 'auto',
                            boxShadow: '-4px 0 20px rgba(0,0,0,0.3)',
                            animation: 'slideIn 0.3s ease-out'
                        }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                                <h2 style={{ margin: 0, fontSize: '1.1rem', color: '#fff', textTransform: 'capitalize' }}>{selectedElement.type} Details</h2>
                                <button
                                    onClick={() => setSelectedElement(null)}
                                    style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '1.2rem' }}
                                >×</button>
                            </div>

                            <div style={{ marginBottom: '1.5rem' }}>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>ID</div>
                                <div style={{ fontFamily: 'monospace', color: '#fff' }}>
                                    {typeof selectedElement.id === 'object'
                                        ? (selectedElement.id.relationId || JSON.stringify(selectedElement.id))
                                        : selectedElement.id}
                                </div>
                            </div>

                            {selectedElement.label && (
                                <div style={{ marginBottom: '1.5rem' }}>
                                    <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.25rem' }}>LABEL</div>
                                    <div style={{ display: 'inline-block', padding: '0.25rem 0.5rem', borderRadius: '4px', background: selectedElement.color || '#6366f1', color: '#fff', fontSize: '0.85rem' }}>
                                        {selectedElement.label}
                                    </div>
                                </div>
                            )}

                            <div>
                                <div style={{ fontSize: '0.8rem', color: '#94a3b8', marginBottom: '0.5rem' }}>PROPERTIES</div>
                                {selectedElement.properties && Object.keys(selectedElement.properties).length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {Object.entries(selectedElement.properties).map(([key, val]) => (
                                            <div key={key} style={{ background: 'rgba(0,0,0,0.2)', padding: '0.75rem', borderRadius: '6px' }}>
                                                <div style={{ color: '#d946ef', fontSize: '0.8rem', marginBottom: '0.25rem' }}>{key}</div>
                                                <div style={{ color: '#e2e8f0', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                                                    {formatValue(val)}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div style={{ color: '#64748b', fontStyle: 'italic' }}>No properties</div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}
