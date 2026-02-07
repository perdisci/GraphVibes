import React, { useRef, useImperativeHandle, useState } from 'react';
import ForceGraph2D from 'react-force-graph-2d';
import { ZoomIn, ZoomOut, Focus, Maximize2, Minimize2, Settings, RotateCcw, ChevronDown, ChevronUp, Download, Trash2 } from 'lucide-react';
import { jsPDF } from "jspdf";

const GraphViz = ({
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
    edgePalette,
    labelStyle = 'glass',
    nodeLabelPreferences = {},
    forwardedRef,
    onClear // New prop
}) => {
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

    useImperativeHandle(forwardedRef, () => ({
        zoom: (...args) => fgRef.current?.zoom(...args),
        zoomToFit: (...args) => fgRef.current?.zoomToFit(...args),
        centerAt: (...args) => fgRef.current?.centerAt(...args),
        d3Force: (...args) => fgRef.current?.d3Force(...args),
    }));

    React.useEffect(() => {
        if (fgRef.current) {
            // Reset node positions to force a fresh layout always
            if (data && data.nodes) {
                // If circular, we fix positions. If NOT circular, we UNfix them.
                if (dagMode === 'circular') {
                    const nodes = data.nodes;
                    const count = nodes.length;
                    const radius = count * 10 + 100; // Dynamic radius
                    const angleStep = (2 * Math.PI) / count;

                    nodes.forEach((node, i) => {
                        const angle = i * angleStep;
                        node.fx = radius * Math.cos(angle);
                        node.fy = radius * Math.sin(angle);
                        // Also set current x/y to minimize animation jump
                        node.x = node.fx;
                        node.y = node.fy;
                        node.vx = 0;
                        node.vy = 0;
                    });
                } else if (dagMode === 'community') {
                    // Group by label
                    const nodesByLabel = {};
                    data.nodes.forEach(n => {
                        const lbl = n.label || 'default';
                        if (!nodesByLabel[lbl]) nodesByLabel[lbl] = [];
                        nodesByLabel[lbl].push(n);
                    });

                    const labels = Object.keys(nodesByLabel);
                    const clusterCount = labels.length;
                    const centerRadius = clusterCount * 80 + 100; // Radius of the ring of clusters
                    const centerAngleStep = (2 * Math.PI) / clusterCount;

                    labels.forEach((label, idx) => {
                        const clusterNodes = nodesByLabel[label];
                        const clusterAngle = idx * centerAngleStep;
                        const clusterCenterX = centerRadius * Math.cos(clusterAngle);
                        const clusterCenterY = centerRadius * Math.sin(clusterAngle);

                        const nodeCount = clusterNodes.length;
                        const nodeRadius = Math.sqrt(nodeCount) * 20; // Radius of the cluster itself
                        const nodeAngleStep = (2 * Math.PI) / nodeCount;

                        clusterNodes.forEach((node, nIdx) => {
                            const nAngle = nIdx * nodeAngleStep;
                            node.fx = clusterCenterX + nodeRadius * Math.cos(nAngle);
                            node.fy = clusterCenterY + nodeRadius * Math.sin(nAngle);
                            node.x = node.fx;
                            node.y = node.fy;
                            node.vx = 0;
                            node.vy = 0;
                        });
                    });
                } else {
                    // Release nodes for force/DAG layout
                    data.nodes.forEach(node => {
                        node.fx = null;
                        node.fy = null;
                        node.vx = null;
                        node.vy = null;
                    });
                }
            }

            // Reheat simulation
            fgRef.current.d3ReheatSimulation();

            // If switching to formatted layout, might want to zoom to fit after a delay
            if (dagMode === 'circular' || dagMode === 'community') {
                setTimeout(() => {
                    fgRef.current?.zoomToFit(400);
                }, 100);
            }
        }
    }, [dagMode, data]);

    // Calculate curvature for parallel edges to avoid overlap
    // useMemo ensures this runs before render to prevent visual "pop" or missing curves
    React.useMemo(() => {
        if (!data || !data.links) return;

        const linkMap = {};

        // Helper to safely extract string ID
        const getSafeId = (item) => {
            if (item === null || item === undefined) return "";
            if (typeof item === 'object') {
                // If D3 already linked it, it might be a node object, so try .id
                if (item.id !== undefined) return getSafeId(item.id);
                // Otherwise it's likely a composite ID object
                return JSON.stringify(item);
            }
            return String(item);
        };

        // Group links by their source-target pair (order independent)
        data.links.forEach(link => {
            const srcId = getSafeId(link.source);
            const tgtId = getSafeId(link.target);

            const sortedIds = [srcId, tgtId].sort();
            const key = `${sortedIds[0]}-${sortedIds[1]}`;

            if (!linkMap[key]) linkMap[key] = [];
            linkMap[key].push(link);
        });

        // Assign curvature
        Object.values(linkMap).forEach(group => {
            const count = group.length;
            if (count > 1) {
                // Determine curvature for each edge in the group
                const spacing = 0.2; // Curvature step
                group.forEach((link, i) => {
                    // Center the curves: -0.1, 0.1 for 2 edges
                    const rawCurvature = (i - (count - 1) / 2) * spacing;

                    const srcId = getSafeId(link.source);
                    const tgtId = getSafeId(link.target);

                    // Canonical direction: smaller ID is source
                    // This ensures consistent "lanes" regardless of individual edge direction
                    const isCanonical = srcId < tgtId;

                    link.curvature = isCanonical ? rawCurvature : -rawCurvature;
                });
            } else {
                // Single edge
                const link = group[0];
                const srcId = getSafeId(link.source);
                const tgtId = getSafeId(link.target);

                // Low curvature for self-loops
                if (srcId === tgtId) {
                    link.curvature = 0.3;
                } else {
                    link.curvature = 0; // Straight line
                }
            }
        });
    }, [data]);

    const effectiveDagMode = ['td', 'bu', 'lr', 'rl', 'radialout', 'radialin'].includes(dagMode) ? dagMode : undefined;

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

    // Reusable Node Painting Logic
    const paintNode = (node, ctx, globalScale) => {
        const label = node.label;
        const fontSize = 12 / globalScale;
        const color = getNodeColor(node);

        // Draw node circle
        const radius = 6;

        ctx.beginPath();
        ctx.arc(node.x, node.y, radius, 0, 2 * Math.PI, false);
        ctx.fillStyle = color;
        ctx.fill();

        // Determine text to show
        let text = node.id;
        const prefKey = nodeLabelPreferences[node.label];

        let keyToUse = null;
        if (prefKey !== undefined) {
            if (prefKey !== null) keyToUse = prefKey;
        } else {
            keyToUse = 'name';
        }

        if (keyToUse && node.properties && node.properties[keyToUse]) {
            const propVal = node.properties[keyToUse];
            if (Array.isArray(propVal) && propVal.length > 0 && propVal[0].value) {
                text = propVal[0].value;
            } else if (typeof propVal === 'string' || typeof propVal === 'number') {
                text = propVal;
            } else if (propVal.value) {
                text = propVal.value;
            }
        }

        if (typeof text === 'object') text = JSON.stringify(text);

        // Text setup
        ctx.font = `${fontSize}px Sans-Serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Draw Label based on style
        if (labelStyle === 'paper' || labelStyle === 'glass') {
            const textWidth = ctx.measureText(text).width;
            const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.4);

            ctx.fillStyle = labelStyle === 'paper' ? 'rgba(255, 255, 255, 0.9)' : 'rgba(0, 0, 0, 0.6)';

            const x = node.x - bckgDimensions[0] / 2;
            const y = node.y - bckgDimensions[1] / 2;
            const w = bckgDimensions[0];
            const h = bckgDimensions[1];
            const r = 2;

            ctx.beginPath();
            ctx.moveTo(x + r, y);
            ctx.arcTo(x + w, y, x + w, y + h, r);
            ctx.arcTo(x + w, y + h, x, y + h, r);
            ctx.arcTo(x, y + h, x, y, r);
            ctx.arcTo(x, y, x + w, y, r);
            ctx.closePath();
            ctx.fill();

            ctx.fillStyle = labelStyle === 'paper' ? '#000' : '#fff';
            ctx.fillText(text, node.x, node.y);
        } else if (labelStyle === 'inverted') {
            ctx.lineWidth = 3 / globalScale;
            ctx.strokeStyle = '#ffffff';
            ctx.strokeText(text, node.x, node.y);

            ctx.fillStyle = '#000000';
            ctx.fillText(text, node.x, node.y);
        } else {
            ctx.lineWidth = 3 / globalScale;
            ctx.strokeStyle = '#000000a0';
            ctx.strokeText(text, node.x, node.y);

            ctx.fillStyle = '#ffffff';
            ctx.fillText(text, node.x, node.y);
        }
    };

    // Link Painting Logic for PDF to match Screen Default
    const pdfPaintLink = (link, ctx, globalScale) => {
        const NODE_R = 6;
        const ARROW_LEN = 3.5;
        const ARROW_WIDTH_RATIO = 0.3; // Matches force-graph default narrower arrow

        const src = typeof link.source === 'object' ? link.source : data.nodes.find(n => n.id === link.source);
        const tgt = typeof link.target === 'object' ? link.target : data.nodes.find(n => n.id === link.target);

        if (!src || !tgt) return;

        const color = getLinkColor(link);
        ctx.strokeStyle = color;
        ctx.lineWidth = 1 / globalScale; // Keep lines 1px equivalent

        const x1 = src.x, y1 = src.y;
        const x2 = tgt.x, y2 = tgt.y;

        // Calculate Line Path
        let startX = x1, startY = y1;
        let endX = x2, endY = y2;
        let cpx = null, cpy = null; // Control point for curve

        ctx.beginPath();

        if (src.id === tgt.id) {
            // Self Loop
            // Heuristic loop layout matching typical d3 force layout visual
            const loopScale = 40;
            const cp1x = x1 - loopScale / 2;
            const cp1y = y1 - loopScale;
            const cp2x = x1 + loopScale / 2;
            const cp2y = y1 - loopScale;

            ctx.moveTo(x1, y1);
            ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, x2, y2);
            ctx.stroke();

            // End vector for arrow calculation (derivative at t=1)
            // Cubic Bezier Derivative at t=1 is proportional to P3 - P2
            // P3=(x2,y2), P2=(cp2x,cp2y)
            startX = cp2x;
            startY = cp2y;
        } else if (link.curvature) {
            // Curved Edge
            const mx = (x1 + x2) / 2;
            const my = (y1 + y2) / 2;
            const dx = x2 - x1;
            const dy = y2 - y1;

            cpx = mx + (-dy * link.curvature * 0.5);
            cpy = my + (dx * link.curvature * 0.5);

            ctx.moveTo(x1, y1);
            ctx.quadraticCurveTo(cpx, cpy, x2, y2);
            ctx.stroke();

            // End vector for arrow (Control Point -> End)
            startX = cpx;
            startY = cpy;
        } else {
            // Straight Line
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // End vector is simply Start -> End
            // Initialized by default
        }

        // --- Arrow Drawing ---
        // Calculate angle at the target
        const angle = Math.atan2(endY - startY, endX - startX);

        // Offset tip by node radius so it's visible
        const tipX = endX - Math.cos(angle) * NODE_R;
        const tipY = endY - Math.sin(angle) * NODE_R;

        ctx.save();
        ctx.translate(tipX, tipY);
        ctx.rotate(angle);
        ctx.fillStyle = color;

        ctx.beginPath();
        ctx.moveTo(0, 0); // Tip
        ctx.lineTo(-ARROW_LEN, ARROW_LEN * ARROW_WIDTH_RATIO);
        ctx.lineTo(-ARROW_LEN, -ARROW_LEN * ARROW_WIDTH_RATIO);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
    };

    const handleDownloadPdf = () => {
        if (!data || !dimensions.width || !fgRef.current) return;

        // 1. Setup Canvas (2x scale as requested)
        const scaleFactor = 2; // "Increase the size by only 200%"
        const w = dimensions.width;
        const h = dimensions.height;

        const canvas = document.createElement('canvas');
        canvas.width = w * scaleFactor;
        canvas.height = h * scaleFactor;
        const ctx = canvas.getContext('2d');

        // 2. Background: Forced Light Theme (White)
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // 3. Setup Camera Transform
        const { x: cx, y: cy } = fgRef.current.centerAt();
        const zoom = fgRef.current.zoom();

        ctx.save();
        ctx.scale(scaleFactor, scaleFactor);
        ctx.translate(w / 2, h / 2);
        ctx.scale(zoom, zoom);
        ctx.translate(-cx, -cy);

        // 4. Draw Links (Mimicking Default Style)
        data.links.forEach(link => {
            pdfPaintLink(link, ctx, zoom);
        });

        // 5. Draw Nodes
        data.nodes.forEach(node => {
            paintNode(node, ctx, zoom);
        });

        ctx.restore();

        // Convert to Image
        const imgData = canvas.toDataURL('image/png');

        // Create PDF
        const pdf = new jsPDF({
            orientation: 'landscape',
            unit: 'mm',
            format: 'a4'
        });

        const pageWidth = pdf.internal.pageSize.getWidth();
        const pageHeight = pdf.internal.pageSize.getHeight();

        const imgProps = pdf.getImageProperties(imgData);
        const imgRatio = imgProps.width / imgProps.height;
        const pageRatio = pageWidth / pageHeight;

        let finalWidth = pageWidth;
        let finalHeight = pageHeight;

        if (imgRatio > pageRatio) {
            finalHeight = pageWidth / imgRatio;
        } else {
            finalWidth = pageHeight * imgRatio;
        }

        const x = (pageWidth - finalWidth) / 2;
        const y = (pageHeight - finalHeight) / 2;

        pdf.addImage(imgData, 'PNG', x, y, finalWidth, finalHeight);

        // --- Draw Legend Overlay ---
        const legendX = 10;
        let legendY = 10;

        // Forced Black Text for White Background
        pdf.setTextColor(0, 0, 0);

        pdf.setFontSize(10);
        pdf.text("LEGEND", legendX, legendY);
        legendY += 5;

        pdf.setFontSize(8);

        // Node Types
        const distinctNodes = Array.from(new Set(data.nodes.map(n => n.label)));
        if (distinctNodes.length > 0) {
            pdf.text("Nodes", legendX, legendY);
            legendY += 4;

            distinctNodes.forEach(lbl => {
                const color = getNodeColor({ label: lbl });
                pdf.setFillColor(color);
                pdf.circle(legendX + 2, legendY - 1, 1.5, 'F');
                pdf.setTextColor(0, 0, 0);
                pdf.text(String(lbl), legendX + 6, legendY);
                legendY += 4;
            });
            legendY += 2;
        }

        // Edge Types
        const distinctEdges = Array.from(new Set(data.links.map(l => l.label)));
        if (distinctEdges.length > 0) {
            pdf.text("Edges", legendX, legendY);
            legendY += 4;

            distinctEdges.forEach(lbl => {
                const color = getLinkColor({ label: lbl });
                pdf.setDrawColor(color);
                pdf.setLineWidth(0.5);
                pdf.line(legendX, legendY - 1, legendX + 4, legendY - 1);
                pdf.setTextColor(0, 0, 0);
                pdf.text(String(lbl), legendX + 6, legendY);
                legendY += 4;
            });
        }

        pdf.save('graph.pdf');
    };

    return (
        <div ref={containerRef} style={{ height: '100%', width: '100%', position: 'relative', backgroundColor: backgroundColor || "#0f111a" }}>
            {data && dimensions.width > 0 && <ForceGraph2D
                ref={fgRef}
                width={dimensions.width}
                height={dimensions.height}
                graphData={data}
                nodeLabel="label"
                nodeColor={getNodeColor}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
                backgroundColor={"rgba(0,0,0,0)"}
                linkColor={getLinkColor}
                linkCurvature="curvature"
                nodeRelSize={6}
                nodeCanvasObject={paintNode}
                nodePointerAreaPaint={(node, color, ctx) => {
                    ctx.fillStyle = color;
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 6, 0, 2 * Math.PI, false);
                    ctx.fill();
                }}
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
                dagMode={effectiveDagMode}
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
                                    <span style={{ fontSize: '0.85rem' }}>{label}</span>
                                </div>
                            ))}
                        </div>

                        {/* Edges */}
                        <div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-dim)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Edges</div>
                            {Array.from(new Set(data.links.map(l => l.label))).map(label => (
                                <div key={`link-${label}`} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                                    <div style={{ width: '12px', height: '2px', background: getLinkColor({ label }) }} />
                                    <span style={{ fontSize: '0.85rem' }}>{label}</span>
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
                <button className="control-btn" onClick={handleDownloadPdf} title="Download as PDF"><Download size={18} /></button>
                <button className="control-btn" onClick={onMaximize} title={isMaximized ? "Minimize" : "Maximize"}>
                    {isMaximized ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
                </button>
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button className="control-btn" onClick={onClear} title="Clear Graph" style={{ color: '#ef4444' }}><Trash2 size={18} /></button>
                <div style={{ height: '1px', background: 'var(--border)', margin: '4px 0' }} />
                <button className="control-btn" onClick={onSettings} title="Graph Settings"><Settings size={18} /></button>
            </div>
        </div>
    );
};

GraphViz.displayName = 'GraphViz';

export default GraphViz;
