import React, { forwardRef, useRef, useImperativeHandle, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Focus, Maximize2, Minimize2, Settings, RotateCcw, ChevronDown, ChevronUp } from 'lucide-react';

const GraphViz = forwardRef(({
    data,
    onNodeClick,
    onLinkClick,
    backgroundColor,
    linkColor,
    nodeColor,
    onMaximize,
    isMaximized,
    onSettings,
    dagMode
}, ref) => {
    const fgRef = useRef();
    const containerRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isLegendOpen, setIsLegendOpen] = useState(true);

    // Custom Color Palette
    const COLOR_PALETTE = [
        '#ef4444', // red-500
        '#f97316', // orange-500
        '#f59e0b', // amber-500
        '#84cc16', // lime-500
        '#10b981', // emerald-500
        '#06b6d4', // cyan-500
        '#3b82f6', // blue-500
        '#6366f1', // indigo-500
        '#8b5cf6', // violet-500
        '#d946ef', // fuchsia-500
        '#ec4899', // pink-500
        '#f43f5e', // rose-500
        '#14b8a6', // teal-500
        '#a855f7', // purple-500
        '#22c55e', // green-500
        '#eab308', // yellow-500
        '#0ea5e9', // sky-500
        '#64748b', // slate-500
    ];

    // Memoize the color mapping to ensure consistency
    const colorMap = React.useMemo(() => {
        const map = {};
        let colorIndex = 0;

        const getColor = (label) => {
            if (!map[label]) {
                map[label] = COLOR_PALETTE[colorIndex % COLOR_PALETTE.length];
                colorIndex++;
            }
            return map[label];
        };

        if (data) {
            data.nodes.forEach(node => getColor(node.label));
            data.links.forEach(link => getColor(link.label));
        }

        return map;
    }, [data]);

    // Derived color accessors
    const getNodeColor = (node) => {
        if (nodeColor) return nodeColor; // User override
        return colorMap[node.label] || '#94a3b8';
    };

    const getLinkColor = (link) => {
        if (linkColor) return linkColor; // User override
        return colorMap[link.label] || '#475569';
    };

    React.useEffect(() => {
        if (!containerRef.current) return;

        const measure = () => {
            if (containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                setDimensions({ width: clientWidth, height: clientHeight });
            }
        };

        // Initial measure
        measure();

        const resizeObserver = new ResizeObserver(() => {
            measure();
        });

        resizeObserver.observe(containerRef.current);

        return () => resizeObserver.disconnect();
    }, []);

    useImperativeHandle(ref, () => ({
        zoom: (...args) => fgRef.current?.zoom(...args),
        zoomToFit: (...args) => fgRef.current?.zoomToFit(...args),
        centerAt: (...args) => fgRef.current?.centerAt(...args),
        d3Force: (...args) => fgRef.current?.d3Force(...args),
    }));

    React.useEffect(() => {
        if (fgRef.current) {
            // Reset node positions to force a fresh layout
            if (data && data.nodes) {
                data.nodes.forEach(node => {
                    node.fx = null;
                    node.fy = null;
                    node.vx = null;
                    node.vy = null;
                    // We don't delete x/y to avoid visual glitching if possible, but for DAG switch it helps to let them flow.
                    // Actually, setting fx/fy to null releases dragged nodes.
                });
            }

            // When dagMode changes, we need to reheat the simulation for the new forces to take effect
            fgRef.current.d3ReheatSimulation();
        }
    }, [dagMode, data]);

    const handleZoomIn = () => {
        if (fgRef.current) {
            fgRef.current.zoom(fgRef.current.zoom() * 1.2, 400);
        }
    };

    const handleZoomOut = () => {
        if (fgRef.current) {
            fgRef.current.zoom(fgRef.current.zoom() / 1.2, 400);
        }
    };

    const handleZoomFit = () => {
        if (fgRef.current) {
            fgRef.current.zoomToFit(400);
        }
    };

    const handleZoomReset = () => {
        if (fgRef.current) {
            fgRef.current.centerAt(0, 0, 400);
            fgRef.current.zoom(1, 400);
        }
    };

    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%', position: 'relative' }}>
            {data && dimensions.width > 0 && <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={data}
                nodeLabel="label"
                nodeColor={getNodeColor}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                backgroundColor={backgroundColor || "#0f111a"}
                linkColor={getLinkColor}
                nodeRelSize={6}
                onNodeClick={onNodeClick}
                onLinkClick={onLinkClick}
                linkWidth={2}
                linkHoverPrecision={4}
                dagMode={dagMode}
                dagLevelDistance={50}
            />}

            {/* Legend */}
            <div className="graph-legend" style={{
                position: 'absolute',
                top: '1rem',
                left: '1rem',
                background: 'rgba(15, 23, 42, 0.9)',
                border: '1px solid #1e293b',
                borderRadius: '8px',
                padding: '0.4rem',
                color: '#e2e8f0',
                fontSize: '0.75rem',
                backdropFilter: 'blur(4px)',
                width: isLegendOpen ? '180px' : 'auto',
                transition: 'all 0.3s ease'
            }}>
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        cursor: 'pointer',
                        marginBottom: isLegendOpen ? '0.5rem' : '0'
                    }}
                    onClick={() => setIsLegendOpen(!isLegendOpen)}
                >
                    <span style={{ fontWeight: '600' }}>Legend</span>
                    {isLegendOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                </div>

                {isLegendOpen && data && (
                    <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                        {/* Nodes */}
                        <div style={{ marginBottom: '0.75rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nodes</div>
                            {Array.from(new Set(data.nodes.map(n => n.label))).map(label => (
                                <div key={`node-${label}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getNodeColor({ label }) }} />
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Edges */}
                        <div>
                            <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Edges</div>
                            {Array.from(new Set(data.links.map(l => l.label))).map(label => (
                                <div key={`link-${label}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <div style={{ width: '12px', height: '2px', background: getLinkColor({ label }) }} />
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            <div className="graph-controls">
                <button className="control-btn" onClick={handleZoomIn} title="Zoom In"><ZoomIn size={18} /></button>
                <button className="control-btn" onClick={handleZoomOut} title="Zoom Out"><ZoomOut size={18} /></button>
                <button className="control-btn" onClick={handleZoomFit} title="Fit to Screen"><Focus size={18} /></button>
                <button className="control-btn" onClick={handleZoomReset} title="Reset View"><RotateCcw size={18} /></button>
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button className="control-btn" onClick={onMaximize} title={isMaximized ? "Minimize" : "Maximize"}>
                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <button className="control-btn" onClick={onSettings} title="Graph Settings"><Settings size={18} /></button>
            </div>
        </div>
    );
});

GraphViz.displayName = 'GraphViz';

export default GraphViz;
