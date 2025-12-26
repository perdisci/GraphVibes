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
    dagMode,
    nodePalette,
    edgePalette
}, ref) => {
    const fgRef = useRef();
    const containerRef = useRef();
    const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
    const [isLegendOpen, setIsLegendOpen] = useState(true);

    // Custom Color Palette (Internal Default)
    const DEFAULT_PALETTE = [
        '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981', '#06b6d4',
        '#3b82f6', '#6366f1', '#8b5cf6', '#d946ef', '#ec4899', '#f43f5e',
        '#14b8a6', '#a855f7', '#22c55e', '#eab308', '#0ea5e9', '#64748b'
    ];

    const activeNodePalette = nodePalette && nodePalette.length > 0 ? nodePalette : DEFAULT_PALETTE;
    const activeEdgePalette = edgePalette && edgePalette.length > 0 ? edgePalette : DEFAULT_PALETTE;

    // Memoize the color mappings to ensure consistency
    const { nodeColorMap, linkColorMap } = React.useMemo(() => {
        const nMap = {};
        const lMap = {};
        let nodeColorIndex = 0;
        let linkColorIndex = 0;

        const getNodeColorVal = (label) => {
            if (!nMap[label]) {
                nMap[label] = activeNodePalette[nodeColorIndex % activeNodePalette.length];
                nodeColorIndex++;
            }
            return nMap[label];
        };

        const getLinkColorVal = (label) => {
            if (!lMap[label]) {
                lMap[label] = activeEdgePalette[linkColorIndex % activeEdgePalette.length];
                linkColorIndex++;
            }
            return lMap[label];
        };

        if (data) {
            data.nodes.forEach(node => getNodeColorVal(node.label));
            data.links.forEach(link => getLinkColorVal(link.label));
        }

        return { nodeColorMap: nMap, linkColorMap: lMap };
    }, [data, activeNodePalette, activeEdgePalette]);

    // Derived color accessors
    const getNodeColor = (node) => {
        if (nodeColor) return nodeColor; // User override
        return nodeColorMap[node.label] || '#94a3b8';
    };

    const getLinkColor = (link) => {
        if (linkColor) return linkColor; // User override
        return linkColorMap[link.label] || '#475569';
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
                nodeRelSize={6}
                onNodeClick={(node, event) => {
                    if (onNodeClick) {
                        const color = getNodeColor(node);
                        onNodeClick({ ...node, displayColor: color }, event);
                    }
                }}
                onLinkClick={(link, event) => {
                    if (onLinkClick) {
                        const color = getLinkColor(link);
                        onLinkClick({ ...link, displayColor: color }, event);
                    }
                }}
                linkWidth={2}
                linkHoverPrecision={4}
                dagMode={dagMode}
                dagLevelDistance={50}
            />}

            {/* Legend */}
            <div className="graph-legend" style={{
                width: isLegendOpen ? '180px' : 'auto',
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
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Nodes</div>
                            {Array.from(new Set(data.nodes.map(n => n.label))).map(label => (
                                <div key={`node-${label}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <div style={{ width: '10px', height: '10px', borderRadius: '50%', background: getNodeColor({ label }) }} />
                                    <span>{label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Edges */}
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Edges</div>
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
