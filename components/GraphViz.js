import dynamic from 'next/dynamic';

const ForceGraph2D = dynamic(() => import('react-force-graph-2d'), {
    ssr: false
});

const GraphViz = ({ data, onNodeClick, onLinkClick }) => {
    return (
        <div style={{ height: '100%', width: '100%' }}>
            {data && <ForceGraph2D
                graphData={data}
                nodeLabel="label"
                nodeAutoColorBy="label"
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                backgroundColor="#0f111a"
                linkColor={() => '#2f3446'}
                nodeRelSize={6}
                onNodeClick={onNodeClick}
                onLinkClick={onLinkClick}
                linkWidth={2}
                linkHoverPrecision={4}
            />}
        </div>
    );
};

export default GraphViz;
