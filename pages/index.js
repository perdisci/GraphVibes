import Head from 'next/head';
import { useState, useRef, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Play, Activity, Database, Layers, Banana, Copy, ExternalLink, Check, ZoomIn, ZoomOut, Maximize2, Minimize2, Settings, Focus, X, Link, AlertCircle, Loader, Palette, Info, ChevronUp, ChevronDown, GripHorizontal, Timer, BookOpen } from 'lucide-react';
import { GRAPH_PALETTES } from '../utils/palettes';

const GraphViz = dynamic(() => import('../components/GraphViz'), {
    ssr: false
});

const Editor = dynamic(() => import('@monaco-editor/react'), {
    ssr: false
});

const parseGraphSON = (item) => {
    if (item === null || item === undefined) return item;

    if (Array.isArray(item)) {
        return item.map(parseGraphSON);
    }

    if (typeof item === 'object') {
        if (item['@value'] !== undefined) {
            const type = item['@type'];
            const value = item['@value'];

            if (type === 'g:Map') {
                const map = {};
                if (Array.isArray(value)) {
                    for (let i = 0; i < value.length; i += 2) {
                        const k = parseGraphSON(value[i]);
                        const v = parseGraphSON(value[i + 1]);
                        map[k] = v;
                    }
                }
                return map;
            }
            if (type === 'g:List' || type === 'g:Set') {
                return parseGraphSON(value);
            }
            // For other types like g:Int64, g:Double, g:Metrics, etc., just unwrap/recurse
            return parseGraphSON(value);
        }

        // Regular object, recurse keys
        const newObj = {};
        for (const k in item) {
            newObj[k] = parseGraphSON(item[k]);
        }
        return newObj;
    }

    return item;
};

const formatProfileData = (rawData) => {
    // 1. Parse GraphSON if present
    const parsed = parseGraphSON(rawData);

    // 2. Extract profile object (usually in an array)
    let profileObj = parsed;
    if (Array.isArray(parsed) && parsed.length > 0) {
        profileObj = parsed[0];
    }

    if (!profileObj || !profileObj.metrics) return JSON.stringify(parsed, null, 2);

    const metrics = profileObj.metrics;
    let output = '';

    // Header
    output += 'Dur: ' + (profileObj.dur ? profileObj.dur.toFixed(4) : 'N/A') + ' ms\n\n';

    // Columns
    const pad = (str, len, char = ' ') => (str + '').padEnd(len, char);
    const padL = (str, len, char = ' ') => (str + '').padStart(len, char);

    output += pad('Step', 50) + padL('Count', 12) + padL('Traversers', 12) + padL('Time (ms)', 15) + padL('% Dur', 10) + '\n';
    output += pad('', 50 + 12 + 12 + 15 + 10, '=') + '\n';

    const printMetric = (metric, indent = 0) => {
        const name = (metric.name || 'Unknown').substring(0, 48 - indent);
        const count = metric.counts ? (metric.counts.elementCount || metric.counts.traverserCount || 0) : 0;
        const traversers = metric.counts ? (metric.counts.traverserCount || 0) : 0;
        const dur = metric.dur || 0;
        const perc = metric.percDur || 0;
        const indentStr = ' '.repeat(indent);

        output += pad(indentStr + name, 50) + padL(count, 12) + padL(traversers, 12) + padL(dur.toFixed(3), 15) + padL(perc.toFixed(2), 10) + '\n';

        if (metric.annotations) {
            Object.entries(metric.annotations).forEach(([key, val]) => {
                output += '    ' + indentStr + key + ': ' + val + '\n';
            });
        }

        if (metric.metrics && Array.isArray(metric.metrics)) {
            metric.metrics.forEach(m => printMetric(m, indent + 2));
        }
    };

    metrics.forEach(m => printMetric(m));

    return output;
};



const formatExplainData = (rawData) => {
    // 1. Parse GraphSON if present
    const parsed = parseGraphSON(rawData);

    // 2. Extract explanation object (usually in an array)
    let explainObj = parsed;
    if (Array.isArray(parsed) && parsed.length > 0) {
        explainObj = parsed[0];
    }

    // Fallback if not standard structure
    if (!explainObj) return JSON.stringify(parsed, null, 2);

    // Try to format nicely if it has expected fields
    let output = '';

    if (explainObj.original) {
        output += 'Original Traversal\n' + '=============================================================================================================\n';
        // original might be array or string
        const orig = Array.isArray(explainObj.original) ? explainObj.original.join('\n') : explainObj.original;
        output += (orig || '') + '\n\n';
    }

    if (explainObj.final) {
        output += 'Final Traversal\n' + '=============================================================================================================\n';
        const final = Array.isArray(explainObj.final) ? explainObj.final.join('\n') : explainObj.final;
        output += (final || '') + '\n\n';
    }

    return output || JSON.stringify(explainObj, null, 2);
};

export default function Home() {
    const [query, setQuery] = useState('// Click on Run Query to execute\ng.V().limit(50)');
    const [data, setData] = useState({ nodes: [], links: [] });
    const [raw, setRaw] = useState(null);
    const [profilingData, setProfilingData] = useState(null);
    const [explanationData, setExplanationData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [queryDuration, setQueryDuration] = useState(null);
    const [error, setError] = useState(null);

    const [selectedElement, setSelectedElement] = useState(null);
    const [copied, setCopied] = useState(false);
    const [copiedProperty, setCopiedProperty] = useState(null);

    // UI State
    const [sidebarWidth, setSidebarWidth] = useState(320);
    const [isResizing, setIsResizing] = useState(false);
    const [isMaximized, setIsMaximized] = useState(false);
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
    const [isConnectionModalOpen, setIsConnectionModalOpen] = useState(false);

    // Sidebar UI State
    const [queryEditorHeight, setQueryEditorHeight] = useState(120);
    const [isResizingQuery, setIsResizingQuery] = useState(false);
    const [isResultsCollapsed, setIsResultsCollapsed] = useState(false);
    const [isProfilingCollapsed, setIsProfilingCollapsed] = useState(true);
    const [isExplanationCollapsed, setIsExplanationCollapsed] = useState(true);

    // Connection Settings
    const [connectionSettings, setConnectionSettings] = useState({
        host: 'localhost',
        port: '8182'
    });
    const [connectionStatus, setConnectionStatus] = useState('connecting'); // 'connected', 'connecting', 'disconnected'

    // Theme Settings
    const [theme, setTheme] = useState('light');
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

    const [resultsSplitRatio, setResultsSplitRatio] = useState(0.5);
    const [isResizingResults, setIsResizingResults] = useState(false);

    // Graph Settings
    const [graphSettings, setGraphSettings] = useState({
        backgroundColor: '#ffffff',
        nodeColor: '', // default auto
        linkColor: '',  // default auto
        layoutMode: null, // null (force), td, bu, lr, rl, radialout, radialin
        activeNodePalette: 'default',
        activeEdgePalette: 'default',
        labelStyle: 'glass', // standard, inverted, paper, glass
        expansionLimit: 50
    });

    const graphRef = useRef();
    const sidebarRef = useRef();

    // Resize Handlers
    const startResizing = useCallback(() => setIsResizing(true), []);
    const startResizingQuery = useCallback((e) => {
        e.stopPropagation(); // Prevent sidebar resize
        setIsResizingQuery(true);
    }, []);
    const startResizingResults = useCallback(() => setIsResizingResults(true), []);

    const stopResizing = useCallback(() => {
        setIsResizing(false);
        setIsResizingQuery(false);
        setIsResizingResults(false);
    }, []);

    const resize = useCallback((mouseMoveEvent) => {
        if (isResizing && sidebarRef.current) {
            const newWidth = mouseMoveEvent.clientX - sidebarRef.current.getBoundingClientRect().left;
            if (newWidth > 200 && newWidth < 800) setSidebarWidth(newWidth);
        }
        if (isResizingQuery && sidebarRef.current) {
            const sidebarTop = sidebarRef.current.getBoundingClientRect().top;
            const newHeight = mouseMoveEvent.clientY - sidebarTop - 40; // Approx header offset
            if (newHeight > 50 && newHeight < 600) setQueryEditorHeight(newHeight);
        }
        if (isResizingResults && sidebarRef.current) {
            // Calculate ratio within the available result space
            // This is trickier because flexbox is distributing space.
            // Simplified approach: Calculate relative position within the container.
            // But the container starts after Query Editor.
            // Let's rely on movement delta if possible, or just simpler pointer percent relative to the results section.

            // Allow simplified adjustment:
            // Just update ratio based on movement? No, ratio is easier if we know top/height.
            // Let's assume the results container is valid.
            const resultsContainer = sidebarRef.current.querySelector('.results-container-wrapper');
            if (resultsContainer) {
                const rect = resultsContainer.getBoundingClientRect();
                const relativeY = mouseMoveEvent.clientY - rect.top;
                const ratio = Math.min(Math.max(relativeY / rect.height, 0.1), 0.9);
                setResultsSplitRatio(ratio);
            }
        }
    }, [isResizing, isResizingQuery, isResizingResults]);

    useEffect(() => {
        window.addEventListener('mousemove', resize);
        window.addEventListener('mouseup', stopResizing);
        return () => {
            window.removeEventListener('mousemove', resize);
            window.removeEventListener('mouseup', stopResizing);
        };
    }, [resize, stopResizing]);


    const stopResizingQuery = useCallback(() => {
        setIsResizingQuery(false);
    }, []);

    // Merge stop resizing
    useEffect(() => {
        window.addEventListener('mouseup', stopResizingQuery);
        return () => window.removeEventListener('mouseup', stopResizingQuery);
    }, [stopResizingQuery]);

    useEffect(() => {
        // Initial balance of sidebar
        // We delay slightly to ensure layout is settled
        const timer = setTimeout(() => {
            if (sidebarRef.current) {
                const height = sidebarRef.current.clientHeight;
                // Subtract buffer for headers (approx 40px each) and resize handle (~12px)
                // Total static height ≈ 92px. Safeguard with 120px buffer.
                const availableHeight = height - 120;
                setQueryEditorHeight(Math.max(100, availableHeight / 2));
            }
        }, 0);
        return () => clearTimeout(timer);
    }, []);

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
    };

    useEffect(() => {
        // Trigger zoom to fit when maximized state changes, allowing time for layout update
        if (graphRef.current?.zoomToFit) {
            // Small delay to ensure container has resized
            setTimeout(() => {
                graphRef.current?.zoomToFit?.(400, 50);
            }, 50);
        }
    }, [isMaximized]);


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
        setProfilingData(null);
        setExplanationData(null);
        setQueryDuration(null); // Reset duration at start

        try {
            // Strip comments and trailing semicolons/whitespace to append .profile() safely
            const cleanQuery = query.replace(/\/\/.*$/gm, '').trim().replace(/;+$/, '');

            // 1. Run Main Query
            const startTime = performance.now(); // Start timer
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query: cleanQuery, // Use cleanQuery here
                    host: connectionSettings.host,
                    port: connectionSettings.port
                }),
            });

            if (!res.ok) {
                const text = await res.text(); // Get raw error text
                throw new Error(text);
            }

            const result = await res.json();
            const endTime = performance.now(); // End timer
            setQueryDuration(endTime - startTime); // Set duration

            setData(result.graph);
            setRaw(result.raw);

            // 2. Run Profiling Query
            const profilingQuery = `${cleanQuery}.profile()`;

            try {
                const profileRes = await fetch('/api/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: profilingQuery,
                        host: connectionSettings.host,
                        port: connectionSettings.port
                    }),
                });

                if (profileRes.ok) {
                    const profileResult = await profileRes.json();
                    setProfilingData(profileResult.raw);
                } else {
                    console.warn("Profiling failed", await profileRes.text());
                }
            } catch (profileErr) {
                console.warn("Profiling execution error", profileErr);
            }

            // 3. Run Explanation Query
            const explanationQuery = `${cleanQuery}.explain()`;
            try {
                const explainRes = await fetch('/api/query', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        query: explanationQuery,
                        host: connectionSettings.host,
                        port: connectionSettings.port
                    }),
                });

                if (explainRes.ok) {
                    const explainResult = await explainRes.json();
                    setExplanationData(explainResult.raw);
                } else {
                    console.warn("Explanation failed", await explainRes.text());
                }
            } catch (explainErr) {
                console.warn("Explanation execution error", explainErr);
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const fetchAndMerge = async (query) => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch('/api/query', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    query,
                    host: connectionSettings.host,
                    port: connectionSettings.port
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(errData.error || 'Query failed');
            }

            const result = await res.json();

            // Merge Data
            setData(prevData => {
                const nodeMap = new Map(prevData.nodes.map(n => [n.id, n]));
                const linkMap = new Map(prevData.links.map(l => [l.id, l]));

                // Add new nodes
                result.graph.nodes.forEach(n => {
                    if (!nodeMap.has(n.id)) {
                        nodeMap.set(n.id, n);
                    }
                });

                // Add new links
                result.graph.links.forEach(l => {
                    if (!linkMap.has(l.id)) {
                        linkMap.set(l.id, l);
                    }
                });

                return {
                    nodes: Array.from(nodeMap.values()),
                    links: Array.from(linkMap.values())
                };
            });

        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const expandNode = useCallback((node) => {
        // Query to get neighbors and edges
        // We use store/cap/unfold to get a mixed stream of edges and vertices
        // Quote ID if string to be safe
        const safeId = typeof node.id === 'string' ? `'${node.id}'` : node.id;
        const limit = graphSettings.expansionLimit || 50;

        // g.V(id).bothE().limit(limit).store('r').otherV().store('r').cap('r').unfold()
        const query = `g.V(${safeId}).bothE().limit(${limit}).store('res').otherV().store('res').cap('res').unfold()`;

        fetchAndMerge(query);
    }, [graphSettings.expansionLimit, connectionSettings]);

    // Double-click detection
    const clickTimeoutRef = useRef(null);
    const lastClickRef = useRef(null);

    const handleNodeClick = useCallback((node) => {
        const now = Date.now();
        const DOUBLE_CLICK_DELAY = 300;

        if (lastClickRef.current && (now - lastClickRef.current < DOUBLE_CLICK_DELAY)) {
            // Double click detected
            if (clickTimeoutRef.current) {
                clearTimeout(clickTimeoutRef.current);
                clickTimeoutRef.current = null;
            }
            expandNode(node);
        } else {
            // Single click - set timeout
            lastClickRef.current = now;
            clickTimeoutRef.current = setTimeout(() => {
                setSelectedElement({ ...node, type: 'node' });
            }, DOUBLE_CLICK_DELAY);
        }
    }, [expandNode]);

    const handleLinkClick = useCallback((link) => {
        setSelectedElement({ ...link, type: 'edge' });
    }, []);

    const handleEditorDidMount = (editor, monaco) => {
        // Disable default JS lib suggestions (fixes CacheStorage.has conflict)
        monaco.languages.typescript.javascriptDefaults.setCompilerOptions({
            noLib: true,
            allowNonTsExtensions: true
        });

        // Register Gremlin completion provider
        monaco.languages.registerCompletionItemProvider('javascript', {
            triggerCharacters: ['.'],
            provideCompletionItems: (model, position) => {
                const word = model.getWordUntilPosition(position);
                const range = {
                    startLineNumber: position.lineNumber,
                    endLineNumber: position.lineNumber,
                    startColumn: word.startColumn,
                    endColumn: word.endColumn,
                };

                const gremlinSteps = [
                    { label: 'V', detail: 'Vertices', documentation: 'Selects all vertices in the graph.' },
                    { label: 'E', detail: 'Edges', documentation: 'Selects all edges in the graph.' },
                    { label: 'has', detail: 'Filter Property', documentation: 'Filters elements by property value.' },
                    { label: 'hasLabel', detail: 'Filter Label', documentation: 'Filters elements by label.' },
                    { label: 'hasId', detail: 'Filter ID', documentation: 'Filters elements by ID.' },
                    { label: 'out', detail: 'Out Adjacent', documentation: 'Moves to the outgoing adjacent vertices.' },
                    { label: 'in', detail: 'In Adjacent', documentation: 'Moves to the incoming adjacent vertices.' },
                    { label: 'both', detail: 'Both Adjacent', documentation: 'Moves to both incoming and outgoing adjacent vertices.' },
                    { label: 'outE', detail: 'Out Incident Edges', documentation: 'Moves to the outgoing incident edges.' },
                    { label: 'inE', detail: 'In Incident Edges', documentation: 'Moves to the incoming incident edges.' },
                    { label: 'bothE', detail: 'Both Incident Edges', documentation: 'Moves to both incoming and outgoing incident edges.' },
                    { label: 'values', detail: 'Property Values', documentation: 'Extracts the values of properties.' },
                    { label: 'valueMap', detail: 'Property Map', documentation: 'Extracts the properties as a map.' },
                    { label: 'limit', detail: 'Limit Results', documentation: 'Limits the number of results.' },
                    { label: 'count', detail: 'Count Results', documentation: 'Counts the number of results.' },
                    { label: 'order', detail: 'Order Results', documentation: 'Orders the results.' },
                    { label: 'by', detail: 'Order By', documentation: 'Specifies the property to order by.' },
                    { label: 'path', detail: 'Path', documentation: 'Returns the path context.' },
                    { label: 'simplePath', detail: 'Simple Path', documentation: 'Filters simple paths (no repeated vertices).' },
                    { label: 'dedup', detail: 'Deduplicate', documentation: 'Removes duplicates.' },
                    { label: 'where', detail: 'Filter Traversal', documentation: 'Filters the traversal based on a predicate.' },
                    { label: 'not', detail: 'Negate', documentation: 'Negates a traversal step.' },
                    { label: 'drop', detail: 'Delete', documentation: 'Removes the element from the graph.' },
                    { label: 'addV', detail: 'Add Vertex', documentation: 'Adds a vertex to the graph.' },
                    { label: 'addE', detail: 'Add Edge', documentation: 'Adds an edge to the graph.' },
                    { label: 'property', detail: 'Set Property', documentation: 'Sets a property value.' },
                ];

                const suggestions = gremlinSteps.map(step => ({
                    label: step.label,
                    kind: monaco.languages.CompletionItemKind.Method,
                    documentation: step.documentation,
                    detail: step.detail,
                    insertText: step.label,
                    range: range
                }));

                // Add snippets
                suggestions.push({
                    label: 'g.V().limit(50)',
                    kind: monaco.languages.CompletionItemKind.Snippet,
                    documentation: 'Get first 50 vertices',
                    insertText: 'g.V().limit(50)',
                    insertTextRules: monaco.languages.CompletionItemInsertTextRule.InsertAsSnippet,
                    range: range
                });

                return { suggestions: suggestions };
            }
        });
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

    // Node Label Preferences
    const [nodeLabelPreferences, setNodeLabelPreferences] = useState({});

    const handlePropertyClick = (nodeType, propertyKey) => {
        if (!nodeType) return;
        setNodeLabelPreferences(prev => {
            const current = prev[nodeType];
            // Toggle: if already selected, set to null (explicitly disabled, fallback to ID)
            // If not selected or different, set to new key
            const next = current === propertyKey ? null : propertyKey;
            return { ...prev, [nodeType]: next };
        });
    };

    return (
        <div className="layout">
            <Head>
                <title>Graph.Vibes — JanusGraph Visualizer</title>
                <meta name="description" content="Modern GraphVibes Visualizer" />
            </Head>

            <header className="header">
                <div className="logo" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <img
                        src={theme === 'light' ? '/GraphVibes-Logo-Light.png' : '/GraphVibes-Logo-Dark.png'}
                        alt="GraphVibes"
                        style={{ height: '54px', borderRadius: '8px' }}
                    />
                    Graph.Vibes — JanusGraph Visualizer
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
                    <button
                        className="control-btn"
                        onClick={() => setIsAboutModalOpen(true)}
                        title="About Graph.Vibes"
                        style={{ padding: '0.25rem' }}
                    >
                        <Info size={16} />
                    </button>
                </div>
            </header>

            <main className="main-content" style={{ gridTemplateColumns: isMaximized ? '0px 0px 1fr' : `${sidebarWidth}px 4px 1fr` }}>
                <div className="sidebar" ref={sidebarRef} style={{ display: isMaximized ? 'none' : 'flex', flexDirection: 'column' }}>
                    {/* Query Editor Section */}
                    <div className="query-editor" style={{
                        flex: isResultsCollapsed ? '1' : 'none',
                        height: isResultsCollapsed ? 'auto' : 'auto',
                        display: 'flex',
                        flexDirection: 'column',
                        minHeight: isResultsCollapsed ? '0' : 'auto'
                    }}>
                        <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <Database size={14} /> GREMLIN QUERY
                            </h3>
                        </div>
                        <div style={{
                            height: isResultsCollapsed ? '100%' : `${queryEditorHeight}px`,
                            border: '1px solid var(--border)',
                            borderRadius: '4px',
                            overflow: 'hidden',
                            marginBottom: '0.5rem',
                            transition: isResizingQuery ? 'none' : 'height 0.2s ease'
                        }}>
                            <Editor
                                height="100%"
                                defaultLanguage="javascript"
                                value={query}
                                onChange={(value) => setQuery(value)}
                                onMount={handleEditorDidMount}
                                theme={theme === 'light' ? 'light' : 'vs-dark'}
                                options={{
                                    minimap: { enabled: false },
                                    scrollBeyondLastLine: false,
                                    fontSize: 14,
                                    lineNumbers: 'off',
                                    folding: false,
                                    overviewRulerLanes: 0,
                                    automaticLayout: true,
                                    padding: { top: 8, bottom: 8 }
                                }}
                            />
                        </div>
                        <button className="btn" onClick={handleRunQuery} disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                            {loading ? 'Running...' : <><Play size={16} /> Run Query</>}
                        </button>
                        {queryDuration !== null && !loading && (
                            <div style={{ textAlign: 'center', fontSize: '0.75rem', color: '#64748b', marginBottom: '0.5rem' }}>
                                Last run: {queryDuration.toFixed(2)}ms
                            </div>
                        )}
                        {error && (
                            <div style={{ marginTop: '0.5rem', padding: '0.5rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '4px', color: '#ef4444', fontSize: '0.85rem' }}>
                                {error}
                            </div>
                        )}
                    </div>

                    {/* Resize Handle */}
                    {!isResultsCollapsed && (
                        <div
                            onMouseDown={startResizingQuery}
                            style={{
                                height: '12px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                cursor: 'row-resize',
                                color: 'var(--border)',
                                marginBottom: '0.5rem'
                            }}
                        >
                            <GripHorizontal size={14} />
                        </div>
                    )}

                    {/* Results Panel Section */}
                    <div className="results-container-wrapper" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' }}>
                        <div className="results-panel" style={{
                            flex: isResultsCollapsed ? '0 0 auto' : (isProfilingCollapsed ? '1' : resultsSplitRatio),
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            transition: isResizingResults ? 'none' : 'flex 0.2s ease',
                            minHeight: isResultsCollapsed ? 'auto' : '100px'
                        }}>
                            <div style={{ marginBottom: isResultsCollapsed ? '0' : '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => setIsResultsCollapsed(!isResultsCollapsed)}
                                >
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Layers size={14} /> RAW RESULTS
                                    </h3>
                                    {isResultsCollapsed ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                                </div>

                                {!isResultsCollapsed && (
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
                                )}
                            </div>
                            {!isResultsCollapsed && (
                                <pre style={{ flex: 1, overflow: 'auto', margin: 0 }}>{raw ? JSON.stringify(raw, null, 2) : '// Results will appear here'}</pre>
                            )}
                        </div>

                        {/* Explanation Panel Section */}
                        <div className="explanation-panel" style={{
                            flex: isExplanationCollapsed ? '0 0 auto' : '1',
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            transition: 'flex 0.2s ease',
                            background: 'var(--surface)',
                            padding: '1rem',
                            borderTop: '1px solid var(--border)'
                        }}>
                            <div style={{ marginBottom: isExplanationCollapsed ? '0' : '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => setIsExplanationCollapsed(!isExplanationCollapsed)}
                                >
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <BookOpen size={14} /> QUERY EXPLANATION
                                    </h3>
                                    {isExplanationCollapsed ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                                </div>

                                {!isExplanationCollapsed && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(JSON.stringify(explanationData, null, 2))}
                                            title="Copy explanation JSON"
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
                                            <Copy size={14} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const text = formatExplainData(explanationData);
                                                const blob = new Blob([text], { type: 'text/plain' });
                                                const url = URL.createObjectURL(blob);
                                                window.open(url, '_blank');
                                            }}
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
                                )}
                            </div>
                            {!isExplanationCollapsed && (
                                <pre style={{ flex: 1, overflow: 'auto', margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {explanationData ? formatExplainData(explanationData) : '// Explanation results will appear here'}
                                </pre>
                            )}
                        </div>

                        {/* Resize Handle for Results/Profiling */}
                        {!isResultsCollapsed && !isProfilingCollapsed && (
                            <div
                                onMouseDown={startResizingResults}
                                style={{
                                    height: '8px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    cursor: 'row-resize',
                                    color: 'var(--border)',
                                    borderTop: '1px solid var(--border)',
                                    borderBottom: '1px solid var(--border)',
                                    background: 'var(--bg-secondary)'
                                }}
                            >
                                <GripHorizontal size={12} />
                            </div>
                        )}

                        {/* Profiling Panel Section */}
                        <div className="profiling-panel" style={{
                            flex: isProfilingCollapsed ? '0 0 auto' : (isResultsCollapsed ? '1' : 1 - resultsSplitRatio),
                            display: 'flex',
                            flexDirection: 'column',
                            overflow: 'hidden',
                            transition: isResizingResults ? 'none' : 'flex 0.2s ease',
                            borderTop: '1px solid var(--border)',
                            background: 'var(--surface)',
                            padding: '1rem'
                        }}>
                            <div style={{ marginBottom: isProfilingCollapsed ? '0' : '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div
                                    style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', userSelect: 'none' }}
                                    onClick={() => setIsProfilingCollapsed(!isProfilingCollapsed)}
                                >
                                    <h3 style={{ margin: 0, fontSize: '0.9rem', color: '#94a3b8', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                        <Timer size={14} /> QUERY PROFILING
                                    </h3>
                                    {isProfilingCollapsed ? <ChevronUp size={14} color="#94a3b8" /> : <ChevronDown size={14} color="#94a3b8" />}
                                </div>

                                {!isProfilingCollapsed && (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            onClick={() => navigator.clipboard.writeText(JSON.stringify(profilingData, null, 2))}
                                            title="Copy profiling JSON"
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
                                            <Copy size={14} />
                                        </button>
                                        <button
                                            onClick={() => {
                                                const text = formatProfileData(profilingData);
                                                const blob = new Blob([text], { type: 'text/plain' });
                                                const url = URL.createObjectURL(blob);
                                                window.open(url, '_blank');
                                            }}
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
                                )}
                            </div>
                            {!isProfilingCollapsed && (
                                <pre style={{ flex: 1, overflow: 'auto', margin: 0, fontFamily: 'monospace', fontSize: '0.85rem' }}>
                                    {profilingData ? formatProfileData(profilingData) : '// Profiling results will appear here'}
                                </pre>
                            )}
                        </div>
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
                            labelStyle={graphSettings.labelStyle}
                            onMaximize={toggleMaximize}
                            isMaximized={isMaximized}
                            onSettings={() => setIsSettingsOpen(true)}
                            nodeLabelPreferences={nodeLabelPreferences}
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
                                <h2 style={{ margin: 0, fontSize: '1.1rem', color: 'var(--text-main)', textTransform: 'capitalize' }}>
                                    {selectedElement.type === 'node' ? 'Node Details' : (selectedElement.type === 'edge' ? 'Edge Details' : `${selectedElement.type} Details`)}
                                </h2>
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
                                        {Object.entries(selectedElement.properties).map(([key, val]) => {
                                            const isSelected = nodeLabelPreferences[selectedElement.label] === key;
                                            const isDefault = !nodeLabelPreferences[selectedElement.label] && key === 'name';
                                            const isActive = isSelected || (nodeLabelPreferences[selectedElement.label] === undefined && key === 'name');

                                            return (
                                                <div key={key} style={{ background: 'var(--surface-hover)', padding: '0.75rem', borderRadius: '6px' }}>
                                                    <div
                                                        style={{
                                                            color: isActive ? 'var(--primary)' : 'var(--accent)',
                                                            fontSize: '0.8rem',
                                                            marginBottom: '0.25rem',
                                                            cursor: 'pointer',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            gap: '0.5rem'
                                                        }}
                                                        onClick={() => handlePropertyClick(selectedElement.label, key)}
                                                        title="Click to use as node label"
                                                    >
                                                        {key}
                                                        {isActive && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--primary)' }} />}
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                                                        <div style={{ color: 'var(--text-main)', fontSize: '0.9rem', wordBreak: 'break-all' }}>
                                                            {formatValue(val)}
                                                        </div>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                const textToCopy = formatValue(val);
                                                                navigator.clipboard.writeText(textToCopy);
                                                                setCopiedProperty(key);
                                                                setTimeout(() => setCopiedProperty(null), 2000);
                                                            }}
                                                            title={copiedProperty === key ? "Copied!" : "Copy value"}
                                                            style={{
                                                                background: 'transparent',
                                                                border: 'none',
                                                                color: copiedProperty === key ? '#4ade80' : 'var(--text-dim)',
                                                                cursor: 'pointer',
                                                                padding: '2px',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                flexShrink: 0
                                                            }}
                                                        >
                                                            {copiedProperty === key ? <Check size={12} /> : <Copy size={12} />}
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
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
                            <label className="form-label">Neighbor Expansion Limit (on node double click)</label>
                            <input
                                type="number"
                                className="form-input"
                                value={graphSettings.expansionLimit}
                                onChange={e => setGraphSettings({ ...graphSettings, expansionLimit: parseInt(e.target.value) || 50 })}
                                min="1"
                                max="500"
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
                            <label className="form-label">Node Label Style</label>
                            <select
                                className="form-input"
                                value={graphSettings.labelStyle || 'standard'}
                                onChange={e => setGraphSettings({ ...graphSettings, labelStyle: e.target.value })}
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
                </div >
            )
            }

            {
                isConnectionModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsConnectionModalOpen(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h3 className="modal-title">Connection Settings</h3>
                                <button className="control-btn" onClick={() => setIsConnectionModalOpen(false)}>
                                    <X size={20} />
                                </button>
                            </div>

                            <div className="form-group">
                                <label className="form-label">JanusGraph Server Host</label>
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
                )
            }

            {
                isThemeModalOpen && (
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
                )
            }

            {
                isAboutModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsAboutModalOpen(false)}>
                        <div className="modal" onClick={e => e.stopPropagation()} style={{ width: '400px' }}>
                            <div className="modal-header">
                                <h3 className="modal-title">About Graph.Vibes</h3>
                                <button className="control-btn" onClick={() => setIsAboutModalOpen(false)}>
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
                                    <p style={{ margin: 0, opacity: 0.7, fontSize: '0.9rem' }}>JanusGraph Visualizer</p>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '0.75rem 1.5rem', fontSize: '0.9rem' }}>
                                    <div style={{ fontWeight: 600, opacity: 0.7 }}>Version</div>
                                    <div>0.2.1</div>
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
                )
            }
        </div >
    );
}
