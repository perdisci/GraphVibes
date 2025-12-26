import React, { forwardRef, useRef, useImperativeHandle } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

const GraphViz = forwardRef(({ data, onNodeClick, onLinkClick, backgroundColor, linkColor, nodeColor }, ref) => {
    const fgRef = useRef();

    useImperativeHandle(ref, () => ({
        zoom: (...args) => fgRef.current?.zoom(...args),
        zoomToFit: (...args) => fgRef.current?.zoomToFit(...args),
        centerAt: (...args) => fgRef.current?.centerAt(...args),
    }));

    return (
        <div style={{ height: '100%', width: '100%' }}>
            {data && <ForceGraph2D
                ref={fgRef}
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
            />}
        </div>
    );
});

GraphViz.displayName = 'GraphViz';

export default GraphViz;
