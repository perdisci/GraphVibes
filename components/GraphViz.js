import React, { forwardRef, useRef, useImperativeHandle, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Focus, Maximize2, Minimize2, Settings, RotateCcw } from 'lucide-react';

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
                nodeAutoColorBy="label"
                nodeColor={nodeColor}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                backgroundColor={backgroundColor || "#0f111a"}
                linkColor={linkColor ? (() => linkColor) : (() => '#2f3446')}
                nodeRelSize={6}
                onNodeClick={onNodeClick}
                onLinkClick={onLinkClick}
                linkWidth={2}
                linkHoverPrecision={4}
                dagMode={dagMode}
                dagLevelDistance={50}
            />}

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
