import { useState, useMemo, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react'

export default function RelationshipGraph({ pairs, threshold = 40 }) {
    const containerRef = useRef(null)
    const [zoom, setZoom] = useState(1)
    const [hoveredNode, setHoveredNode] = useState(null)
    const [draggedNode, setDraggedNode] = useState(null)
    const [nodePositions, setNodePositions] = useState({})

    // Build graph data
    const { nodes, edges } = useMemo(() => {
        const nodeMap = new Map()
        const edges = []

        pairs.forEach(pair => {
            if (pair.similarity >= threshold) {
                if (!nodeMap.has(pair.file_a)) {
                    nodeMap.set(pair.file_a, { id: pair.file_a, connections: 0, maxSimilarity: 0 })
                }
                if (!nodeMap.has(pair.file_b)) {
                    nodeMap.set(pair.file_b, { id: pair.file_b, connections: 0, maxSimilarity: 0 })
                }

                const nodeA = nodeMap.get(pair.file_a)
                const nodeB = nodeMap.get(pair.file_b)
                nodeA.connections++
                nodeB.connections++
                nodeA.maxSimilarity = Math.max(nodeA.maxSimilarity, pair.similarity)
                nodeB.maxSimilarity = Math.max(nodeB.maxSimilarity, pair.similarity)

                edges.push({
                    source: pair.file_a,
                    target: pair.file_b,
                    similarity: pair.similarity,
                    label: pair.label,
                })
            }
        })

        return { nodes: Array.from(nodeMap.values()), edges }
    }, [pairs, threshold])

    // Initialize node positions in a circle
    useEffect(() => {
        const centerX = 300
        const centerY = 250
        const radius = Math.min(200, nodes.length * 30)

        const positions = {}
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
            positions[node.id] = {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            }
        })
        setNodePositions(positions)
    }, [nodes])

    const getNodeColor = (node) => {
        if (node.maxSimilarity >= 70) return 'var(--color-risk-high)'
        if (node.maxSimilarity >= 40) return 'var(--color-risk-medium)'
        return 'var(--color-primary)'
    }

    const getEdgeColor = (edge) => {
        if (edge.similarity >= 70) return 'var(--color-risk-high)'
        if (edge.similarity >= 40) return 'var(--color-risk-medium)'
        return 'var(--color-risk-low)'
    }

    const getNodeRadius = (node) => {
        return Math.max(20, Math.min(40, 15 + node.connections * 5))
    }

    const handleNodeDrag = (nodeId, e) => {
        if (!draggedNode) return

        const rect = containerRef.current.getBoundingClientRect()
        const x = (e.clientX - rect.left) / zoom
        const y = (e.clientY - rect.top) / zoom

        setNodePositions(prev => ({
            ...prev,
            [nodeId]: { x, y }
        }))
    }

    const resetPositions = () => {
        const centerX = 300
        const centerY = 250
        const radius = Math.min(200, nodes.length * 30)

        const positions = {}
        nodes.forEach((node, i) => {
            const angle = (2 * Math.PI * i) / nodes.length - Math.PI / 2
            positions[node.id] = {
                x: centerX + radius * Math.cos(angle),
                y: centerY + radius * Math.sin(angle),
            }
        })
        setNodePositions(positions)
        setZoom(1)
    }

    if (nodes.length === 0) {
        return (
            <div className="card-static p-12 text-center">
                <p className="text-lg font-semibold mb-2">No Significant Relationships</p>
                <p style={{ color: 'var(--color-text-muted)' }}>
                    No file pairs found with similarity above {threshold}%
                </p>
            </div>
        )
    }

    return (
        <div className="card-static p-6">
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-semibold mb-1">Relationship Graph</h3>
                    <p className="text-sm m-0" style={{ color: 'var(--color-text-muted)' }}>
                        Showing connections with similarity ≥ {threshold}%
                    </p>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className="btn btn-ghost p-2"
                        onClick={() => setZoom(z => Math.max(0.5, z - 0.1))}
                    >
                        <ZoomOut className="w-4 h-4" />
                    </button>
                    <span className="text-sm font-mono w-12 text-center">
                        {Math.round(zoom * 100)}%
                    </span>
                    <button
                        className="btn btn-ghost p-2"
                        onClick={() => setZoom(z => Math.min(2, z + 0.1))}
                    >
                        <ZoomIn className="w-4 h-4" />
                    </button>
                    <button
                        className="btn btn-secondary ml-2"
                        onClick={resetPositions}
                    >
                        <RotateCcw className="w-4 h-4" />
                        Reset
                    </button>
                </div>
            </div>

            <div
                ref={containerRef}
                className="relative rounded-xl overflow-hidden"
                style={{
                    height: '500px',
                    background: 'var(--color-bg)',
                    border: '1px solid var(--color-border)'
                }}
            >
                <svg
                    width="100%"
                    height="100%"
                    style={{ transform: `scale(${zoom})`, transformOrigin: 'center' }}
                >
                    {/* Edges */}
                    {edges.map((edge, i) => {
                        const source = nodePositions[edge.source]
                        const target = nodePositions[edge.target]
                        if (!source || !target) return null

                        const isHighlighted = hoveredNode === edge.source || hoveredNode === edge.target

                        return (
                            <motion.g key={`edge-${i}`}>
                                <motion.line
                                    x1={source.x}
                                    y1={source.y}
                                    x2={target.x}
                                    y2={target.y}
                                    stroke={getEdgeColor(edge)}
                                    strokeWidth={isHighlighted ? 3 : 2}
                                    strokeOpacity={isHighlighted ? 1 : 0.4}
                                    initial={{ pathLength: 0 }}
                                    animate={{ pathLength: 1 }}
                                    transition={{ delay: i * 0.05, duration: 0.5 }}
                                />
                                {/* Edge label */}
                                {isHighlighted && (
                                    <text
                                        x={(source.x + target.x) / 2}
                                        y={(source.y + target.y) / 2 - 8}
                                        textAnchor="middle"
                                        fontSize="11"
                                        fill="var(--color-text)"
                                        fontFamily="var(--font-mono)"
                                    >
                                        {edge.similarity.toFixed(0)}%
                                    </text>
                                )}
                            </motion.g>
                        )
                    })}

                    {/* Nodes */}
                    {nodes.map((node, i) => {
                        const pos = nodePositions[node.id]
                        if (!pos) return null

                        const radius = getNodeRadius(node)
                        const isHighlighted = hoveredNode === node.id

                        return (
                            <motion.g
                                key={node.id}
                                initial={{ scale: 0 }}
                                animate={{ scale: 1 }}
                                transition={{ delay: i * 0.03, type: 'spring' }}
                                style={{ cursor: 'grab' }}
                                onMouseEnter={() => setHoveredNode(node.id)}
                                onMouseLeave={() => setHoveredNode(null)}
                                onMouseDown={() => setDraggedNode(node.id)}
                                onMouseUp={() => setDraggedNode(null)}
                                onMouseMove={(e) => handleNodeDrag(node.id, e)}
                            >
                                {/* Glow effect */}
                                {isHighlighted && (
                                    <circle
                                        cx={pos.x}
                                        cy={pos.y}
                                        r={radius + 8}
                                        fill={getNodeColor(node)}
                                        opacity={0.3}
                                    />
                                )}

                                {/* Main circle */}
                                <circle
                                    cx={pos.x}
                                    cy={pos.y}
                                    r={radius}
                                    fill={getNodeColor(node)}
                                    stroke="var(--color-bg-card)"
                                    strokeWidth={3}
                                    style={{
                                        filter: isHighlighted ? 'drop-shadow(0 4px 8px rgba(0,0,0,0.3))' : 'none',
                                        transform: isHighlighted ? 'scale(1.1)' : 'scale(1)',
                                        transformOrigin: `${pos.x}px ${pos.y}px`,
                                        transition: 'transform 0.2s'
                                    }}
                                />

                                {/* Node label */}
                                <text
                                    x={pos.x}
                                    y={pos.y + radius + 16}
                                    textAnchor="middle"
                                    fontSize="11"
                                    fill="var(--color-text)"
                                    fontWeight={isHighlighted ? 600 : 400}
                                >
                                    {node.id.length > 12 ? node.id.slice(0, 10) + '...' : node.id}
                                </text>

                                {/* Connection count */}
                                <text
                                    x={pos.x}
                                    y={pos.y + 4}
                                    textAnchor="middle"
                                    fontSize="12"
                                    fontWeight="bold"
                                    fill="white"
                                >
                                    {node.connections}
                                </text>
                            </motion.g>
                        )
                    })}
                </svg>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-6">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: 'var(--color-risk-low)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Low Risk</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: 'var(--color-risk-medium)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Medium Risk</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full" style={{ background: 'var(--color-risk-high)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>High Risk</span>
                </div>
                <div className="border-l pl-6 ml-2" style={{ borderColor: 'var(--color-border)' }}>
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                        Node size = number of connections
                    </span>
                </div>
            </div>
        </div>
    )
}
