import { useState, useContext, useMemo, useEffect } from 'react'
import { useNavigate, useLocation, useParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppStateContext } from '../App'
import {
    FileCode,
    Clock,
    AlertTriangle,
    Dna,
    Search,
    Filter,
    Download,
    Eye,
    FileJson,
    FileText,
    ArrowUpDown,
    ChevronLeft,
    ChevronRight,
    Percent,
    Network,
    LayoutGrid,
    Table as TableIcon
} from 'lucide-react'

// Import visualization components
import SimilarityHeatmap from '../components/SimilarityHeatmap'
import RelationshipGraph from '../components/RelationshipGraph'

export default function ResultsScreen() {
    const navigate = useNavigate()
    const location = useLocation()
    const { appState } = useContext(AppStateContext)
    const { runId } = useParams()

    const [remoteResults, setRemoteResults] = useState(null)
    const [loading, setLoading] = useState(false)
    const [loadError, setLoadError] = useState(null)

    // Determine initial view from hash
    const getViewFromHash = (hash) => {
        switch (hash) {
            case '#heatmap': return 'heatmap'
            case '#graph': return 'graph'
            case '#matches': return 'table'
            default: return 'table'
        }
    }

    const [searchQuery, setSearchQuery] = useState('')
    const [similarityThreshold, setSimilarityThreshold] = useState(0)
    const [showHighRiskOnly, setShowHighRiskOnly] = useState(false)
    const [sortField, setSortField] = useState('similarity')
    const [sortDirection, setSortDirection] = useState('desc')
    const [currentPage, setCurrentPage] = useState(1)
    const [activeView, setActiveView] = useState(() => getViewFromHash(location.hash))
    const itemsPerPage = 10

    // Sync view with hash changes
    useEffect(() => {
        setActiveView(getViewFromHash(location.hash))
    }, [location.hash])

    useEffect(() => {
        const load = async () => {
            if (!runId) return
            setLoading(true)
            setLoadError(null)
            try {
                const res = await fetch(`/api/scan/${runId}/results`)
                if (!res.ok) throw new Error(`Failed to load results: ${res.status} ${res.statusText}`)
                const data = await res.json()
                setRemoteResults(data)
            } catch (e) {
                setLoadError(e.message)
            } finally {
                setLoading(false)
            }
        }
        load()
    }, [runId])

    // Prefer Postgres-backed results when a runId is provided.
    const results = remoteResults || appState.results || generateDemoResults()

    const showRemoteBanner = Boolean(runId)

    // Filter and sort pairs
    const filteredPairs = useMemo(() => {
        let filtered = results.pairs.filter(pair => {
            const matchesSearch =
                pair.file_a.toLowerCase().includes(searchQuery.toLowerCase()) ||
                pair.file_b.toLowerCase().includes(searchQuery.toLowerCase())
            const matchesThreshold = pair.similarity >= similarityThreshold
            const matchesRisk = !showHighRiskOnly || pair.label === 'high'
            return matchesSearch && matchesThreshold && matchesRisk
        })

        filtered.sort((a, b) => {
            const aVal = a[sortField]
            const bVal = b[sortField]
            const direction = sortDirection === 'asc' ? 1 : -1

            if (typeof aVal === 'string') {
                return aVal.localeCompare(bVal) * direction
            }
            return (aVal - bVal) * direction
        })

        return filtered
    }, [results.pairs, searchQuery, similarityThreshold, showHighRiskOnly, sortField, sortDirection])

    // Pagination
    const totalPages = Math.ceil(filteredPairs.length / itemsPerPage)
    const paginatedPairs = filteredPairs.slice(
        (currentPage - 1) * itemsPerPage,
        currentPage * itemsPerPage
    )

    // Stats
    const highRiskCount = results.pairs.filter(p => p.label === 'high').length
    const topSimilarity = Math.max(...results.pairs.map(p => p.similarity))
    const avgSimilarity = results.pairs.reduce((sum, p) => sum + p.similarity, 0) / results.pairs.length

    const handleSort = (field) => {
        if (sortField === field) {
            setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc')
        } else {
            setSortField(field)
            setSortDirection('desc')
        }
    }

    const handleExport = (format) => {
        // ===== BACKEND INTEGRATION POINT =====
        // Replace with actual export API call:
        // const response = await fetch('/api/export', {
        //   method: 'POST',
        //   body: JSON.stringify({ format, results })
        // })
        // const blob = await response.blob()
        // saveAs(blob, `plagcode-report.${format}`)

        const data = format === 'json'
            ? JSON.stringify(results, null, 2)
            : 'PDF export would be generated here'

        const blob = new Blob([data], { type: format === 'json' ? 'application/json' : 'text/plain' })
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `plagcode-report.${format}`
        a.click()
    }

    const handleViewComparison = (fileA, fileB) => {
        const scanId = runId || appState.scanId
        const qp = scanId ? `?scanId=${encodeURIComponent(scanId)}` : ''
        navigate(`/compare/${encodeURIComponent(fileA)}/${encodeURIComponent(fileB)}${qp}`)
    }

    return (
        <div className="animate-fadeIn">
            {showRemoteBanner && (loading || loadError) && (
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 rounded-xl"
                    style={{
                        background: loadError ? 'rgba(239, 68, 68, 0.08)' : 'rgba(99, 102, 241, 0.08)',
                        border: loadError ? '1px solid rgba(239, 68, 68, 0.25)' : '1px solid rgba(99, 102, 241, 0.25)'
                    }}
                >
                    <p className="m-0 text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                        {loading
                            ? `Loading results from Postgres for scan ${runId}…`
                            : `Could not load results for scan ${runId}: ${loadError}`}
                    </p>
                </motion.div>
            )}

            {/* Summary Cards */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="grid grid-cols-4 gap-4 mb-6"
            >
                <SummaryCard
                    icon={FileCode}
                    label="Total Files"
                    value={results.meta.n_files}
                    color="var(--color-primary)"
                />
                <SummaryCard
                    icon={Dna}
                    label="Pairs Compared"
                    value={results.meta.n_pairs}
                    color="var(--color-secondary)"
                />
                <SummaryCard
                    icon={Percent}
                    label="Top Similarity"
                    value={`${topSimilarity.toFixed(1)}%`}
                    color={topSimilarity >= 70 ? 'var(--color-risk-high)' : 'var(--color-risk-medium)'}
                />
                <SummaryCard
                    icon={Clock}
                    label="Runtime"
                    value={`${(results.meta.runtime_ms / 1000).toFixed(2)}s`}
                    color="var(--color-text-secondary)"
                />
            </motion.div>

            {/* Alert for High Risk */}
            {highRiskCount > 0 && (
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="mb-6 p-4 rounded-xl flex items-center gap-4"
                    style={{
                        background: 'rgba(239, 68, 68, 0.1)',
                        border: '1px solid rgba(239, 68, 68, 0.3)'
                    }}
                >
                    <AlertTriangle className="w-6 h-6" style={{ color: 'var(--color-risk-high)' }} />
                    <div>
                        <p className="font-semibold m-0" style={{ color: 'var(--color-risk-high)' }}>
                            {highRiskCount} High-Risk Match{highRiskCount > 1 ? 'es' : ''} Detected
                        </p>
                        <p className="text-sm m-0" style={{ color: 'var(--color-text-secondary)' }}>
                            Files with similarity above 70% require immediate review
                        </p>
                    </div>
                </motion.div>
            )}

            {/* View Toggle */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 mb-6"
            >
                {[
                    { id: 'table', label: 'Table', icon: TableIcon, hash: '#matches' },
                    { id: 'heatmap', label: 'Heatmap', icon: LayoutGrid, hash: '#heatmap' },
                    { id: 'graph', label: 'Graph', icon: Network, hash: '#graph' },
                ].map((view) => (
                    <button
                        key={view.id}
                        className={`btn ${activeView === view.id ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => navigate(view.hash)}
                    >
                        <view.icon className="w-4 h-4" />
                        {view.label}
                    </button>
                ))}

                <div className="flex-1" />

                <button className="btn btn-secondary" onClick={() => handleExport('json')}>
                    <FileJson className="w-4 h-4" />
                    Export JSON
                </button>
                <button className="btn btn-primary" onClick={() => handleExport('pdf')}>
                    <FileText className="w-4 h-4" />
                    Export PDF
                </button>
            </motion.div>

            {/* Content based on active view */}
            <AnimatePresence mode="wait">
                {activeView === 'table' && (
                    <motion.div
                        key="table"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        {/* Filters */}
                        <div className="card-static p-4 mb-4">
                            <div className="flex items-center gap-4 flex-wrap">
                                <div className="flex-1 min-w-[200px]">
                                    <div className="relative">
                                        <Search
                                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                                            style={{ color: 'var(--color-text-muted)' }}
                                        />
                                        <input
                                            type="text"
                                            placeholder="Search files..."
                                            className="input pl-10"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                        />
                                    </div>
                                </div>

                                <div className="flex items-center gap-3">
                                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        Similarity ≥
                                    </span>
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        value={similarityThreshold}
                                        onChange={(e) => setSimilarityThreshold(Number(e.target.value))}
                                        className="slider w-32"
                                    />
                                    <span className="font-mono text-sm w-12">
                                        {similarityThreshold}%
                                    </span>
                                </div>

                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={showHighRiskOnly}
                                        onChange={(e) => setShowHighRiskOnly(e.target.checked)}
                                        className="hidden"
                                    />
                                    <div className={`toggle ${showHighRiskOnly ? 'active' : ''}`} />
                                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        High risk only
                                    </span>
                                </label>
                            </div>
                        </div>

                        {/* Table */}
                        <div className="card-static overflow-hidden">
                            <div className="table-container">
                                <table className="data-table">
                                    <thead>
                                        <tr>
                                            <th onClick={() => handleSort('file_a')} className="cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    File A
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </div>
                                            </th>
                                            <th onClick={() => handleSort('file_b')} className="cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    File B
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </div>
                                            </th>
                                            <th onClick={() => handleSort('similarity')} className="cursor-pointer">
                                                <div className="flex items-center gap-2">
                                                    Similarity
                                                    <ArrowUpDown className="w-3 h-3" />
                                                </div>
                                            </th>
                                            <th>Risk</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedPairs.map((pair, i) => (
                                            <motion.tr
                                                key={`${pair.file_a}-${pair.file_b}`}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                transition={{ delay: i * 0.03 }}
                                            >
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <FileCode className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                                        <span className="code-font">{pair.file_a}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <FileCode className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
                                                        <span className="code-font">{pair.file_b}</span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <div
                                                            className="w-16 h-2 rounded-full overflow-hidden"
                                                            style={{ background: 'var(--color-border)' }}
                                                        >
                                                            <div
                                                                className="h-full rounded-full"
                                                                style={{
                                                                    width: `${pair.similarity}%`,
                                                                    background: pair.similarity >= 70
                                                                        ? 'var(--color-risk-high)'
                                                                        : pair.similarity >= 40
                                                                            ? 'var(--color-risk-medium)'
                                                                            : 'var(--color-risk-low)'
                                                                }}
                                                            />
                                                        </div>
                                                        <span className="font-mono font-medium">
                                                            {pair.similarity.toFixed(1)}%
                                                        </span>
                                                    </div>
                                                </td>
                                                <td>
                                                    <span className={`badge badge-${pair.label}`}>
                                                        {pair.label}
                                                    </span>
                                                </td>
                                                <td>
                                                    <div className="flex items-center gap-2">
                                                        <motion.button
                                                            className="btn btn-ghost p-2"
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleViewComparison(pair.file_a, pair.file_b)}
                                                        >
                                                            <Eye className="w-4 h-4" />
                                                        </motion.button>
                                                        <motion.button
                                                            className="btn btn-ghost p-2"
                                                            whileHover={{ scale: 1.1 }}
                                                            whileTap={{ scale: 0.95 }}
                                                            onClick={() => handleExport('json')}
                                                        >
                                                            <Download className="w-4 h-4" />
                                                        </motion.button>
                                                    </div>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div className="flex items-center justify-between p-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <span className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
                                        Showing {(currentPage - 1) * itemsPerPage + 1} to {Math.min(currentPage * itemsPerPage, filteredPairs.length)} of {filteredPairs.length} results
                                    </span>
                                    <div className="flex items-center gap-2">
                                        <button
                                            className="btn btn-ghost p-2"
                                            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                            disabled={currentPage === 1}
                                        >
                                            <ChevronLeft className="w-4 h-4" />
                                        </button>
                                        {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                            let page
                                            if (totalPages <= 5) {
                                                page = i + 1
                                            } else if (currentPage <= 3) {
                                                page = i + 1
                                            } else if (currentPage >= totalPages - 2) {
                                                page = totalPages - 4 + i
                                            } else {
                                                page = currentPage - 2 + i
                                            }
                                            return (
                                                <button
                                                    key={page}
                                                    className={`btn ${currentPage === page ? 'btn-primary' : 'btn-ghost'} px-3 py-1`}
                                                    onClick={() => setCurrentPage(page)}
                                                >
                                                    {page}
                                                </button>
                                            )
                                        })}
                                        <button
                                            className="btn btn-ghost p-2"
                                            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                                            disabled={currentPage === totalPages}
                                        >
                                            <ChevronRight className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}

                {activeView === 'heatmap' && (
                    <motion.div
                        key="heatmap"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <SimilarityHeatmap pairs={results.pairs} />
                    </motion.div>
                )}

                {activeView === 'graph' && (
                    <motion.div
                        key="graph"
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                    >
                        <RelationshipGraph pairs={results.pairs} threshold={40} />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}

function SummaryCard({ icon: Icon, label, value, color }) {
    return (
        <motion.div
            className="card p-5"
            whileHover={{ scale: 1.02 }}
        >
            <div className="flex items-start justify-between">
                <div>
                    <p className="text-sm mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                    <p className="text-2xl font-bold m-0">{value}</p>
                </div>
                <div
                    className="p-3 rounded-xl"
                    style={{ background: `${color}20` }}
                >
                    <Icon className="w-5 h-5" style={{ color }} />
                </div>
            </div>
        </motion.div>
    )
}

function generateDemoResults() {
    const files = ['main.py', 'utils.py', 'helper.py', 'solution.py', 'test.py', 'app.py', 'config.py', 'data.py']
    const pairs = []

    for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
            const similarity = Math.random() * 100
            pairs.push({
                file_a: files[i],
                file_b: files[j],
                similarity: Math.round(similarity * 10) / 10,
                label: similarity >= 70 ? 'high' : similarity >= 40 ? 'medium' : 'low',
                overlap_spans: []
            })
        }
    }

    return {
        meta: {
            n_files: files.length,
            n_pairs: pairs.length,
            runtime_ms: 3245,
        },
        pairs: pairs.sort((a, b) => b.similarity - a.similarity),
    }
}
