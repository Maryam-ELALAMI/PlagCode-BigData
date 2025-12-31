import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
    Search,
    Calendar,
    FileCode,
    Clock,
    Trash2,
    RefreshCw,
    ChevronRight,
    AlertTriangle,
    FolderOpen,
    History
} from 'lucide-react'

const toDate = (v) => {
    const d = new Date(v)
    return Number.isNaN(d.getTime()) ? new Date() : d
}

export default function HistoryScreen() {
    const navigate = useNavigate()
    const [searchQuery, setSearchQuery] = useState('')
    const [history, setHistory] = useState([])
    const [selectedItems, setSelectedItems] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)

    const loadHistory = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/scans?limit=100')
            if (!res.ok) throw new Error(`Failed to load scans: ${res.status} ${res.statusText}`)
            const data = await res.json()

            const scans = (data.scans || []).map(s => ({
                id: s.scan_id,
                name: s.scan_id, // MVP: scan_id as label; can be replaced by params_json.name later
                date: toDate(s.created_at),
                status: s.status,
                progress: s.progress,
                fileCount: s.file_count ?? 0,
                pairCount: s.pair_count ?? 0,
                highRiskCount: s.high_risk_count ?? 0,
                topSimilarity: Number(s.top_similarity ?? 0),
                runtime: s.runtime_ms ?? 0,
            }))

            setHistory(scans)
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadHistory()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const filteredHistory = useMemo(() => {
        return history.filter(item =>
            item.name.toLowerCase().includes(searchQuery.toLowerCase())
        )
    }, [history, searchQuery])

    const handleOpenRun = (runId) => {
        navigate(`/results/${runId}`)
    }

    const handleDeleteSelected = () => {
        // MVP: UI-only selection clearing. Deleting scans is intentionally not exposed yet.
        setHistory(prev => prev.filter(item => !selectedItems.includes(item.id)))
        setSelectedItems([])
    }

    const formatDate = (date) => {
        const now = new Date()
        const diff = now - date
        const days = Math.floor(diff / (1000 * 60 * 60 * 24))

        if (days === 0) {
            return 'Today at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else if (days === 1) {
            return 'Yesterday at ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        } else if (days < 7) {
            return `${days} days ago`
        } else {
            return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
        }
    }

    const formatRuntime = (ms) => {
        if (ms < 1000) return `${ms}ms`
        if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
        return `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`
    }

    const toggleSelect = (id) => {
        setSelectedItems(prev =>
            prev.includes(id)
                ? prev.filter(i => i !== id)
                : [...prev, id]
        )
    }

    return (
        <div className="max-w-5xl mx-auto animate-fadeIn">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-8"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div
                        className="p-3 rounded-xl"
                        style={{ background: 'var(--color-primary-light)' }}
                    >
                        <History className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold m-0">Scan History</h1>
                        <p className="m-0" style={{ color: 'var(--color-text-secondary)' }}>
                            View and manage your previous scans
                        </p>
                    </div>
                </div>
            </motion.div>

            {/* Search & Actions */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-4 mb-6"
            >
                <div className="flex-1 relative">
                    <Search
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                        style={{ color: 'var(--color-text-muted)' }}
                    />
                    <input
                        type="text"
                        placeholder="Search scans..."
                        className="input pl-10"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>

                <button className="btn btn-secondary" onClick={loadHistory}>
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                </button>

                <AnimatePresence>
                    {selectedItems.length > 0 && (
                        <motion.button
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="btn btn-danger"
                            onClick={handleDeleteSelected}
                        >
                            <Trash2 className="w-4 h-4" />
                            Delete ({selectedItems.length})
                        </motion.button>
                    )}
                </AnimatePresence>
            </motion.div>

            {error && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="card-static p-4 mb-4"
                    style={{ border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)' }}
                >
                    <p className="m-0 font-semibold" style={{ color: 'var(--color-risk-high)' }}>
                        {error}
                    </p>
                </motion.div>
            )}

            {/* History List */}
            {loading ? (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="card-static p-8">
                    <p className="m-0" style={{ color: 'var(--color-text-secondary)' }}>Loading scans…</p>
                </motion.div>
            ) : filteredHistory.length === 0 ? (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="card-static p-12 text-center"
                >
                    <FolderOpen
                        className="w-16 h-16 mx-auto mb-4"
                        style={{ color: 'var(--color-text-muted)' }}
                    />
                    <h3 className="text-lg font-semibold mb-2">No Scans Found</h3>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        {searchQuery
                            ? 'No scans match your search criteria'
                            : 'Start a new scan to see it here'}
                    </p>
                </motion.div>
            ) : (
                <div className="space-y-3">
                    {filteredHistory.map((item, index) => (
                        <motion.div
                            key={item.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="card-static overflow-hidden"
                        >
                            <div className="flex items-center p-4">
                                {/* Checkbox */}
                                <div className="mr-4">
                                    <input
                                        type="checkbox"
                                        checked={selectedItems.includes(item.id)}
                                        onChange={() => toggleSelect(item.id)}
                                        className="w-4 h-4 rounded"
                                        style={{ accentColor: 'var(--color-primary)' }}
                                    />
                                </div>

                                {/* Main Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-3 mb-2">
                                        <h3 className="font-semibold m-0 truncate">{item.name}</h3>
                                        {item.highRiskCount > 0 && (
                                            <span className="badge badge-high flex items-center gap-1">
                                                <AlertTriangle className="w-3 h-3" />
                                                {item.highRiskCount} High Risk
                                            </span>
                                        )}
                                        {item.status && (
                                            <span className="badge">{item.status}</span>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                        <div className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {formatDate(item.date)}
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <FileCode className="w-3.5 h-3.5" />
                                            {item.fileCount} files
                                        </div>
                                        <div className="flex items-center gap-1.5">
                                            <Clock className="w-3.5 h-3.5" />
                                            {formatRuntime(item.runtime)}
                                        </div>
                                    </div>
                                </div>

                                {/* Stats */}
                                <div className="hidden md:flex items-center gap-8 px-6">
                                    <div className="text-center">
                                        <p className="text-sm font-mono font-bold m-0">{item.pairCount}</p>
                                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>Pairs</p>
                                    </div>
                                    <div className="text-center">
                                        <p
                                            className="text-sm font-mono font-bold m-0"
                                            style={{
                                                color: item.topSimilarity >= 70
                                                    ? 'var(--color-risk-high)'
                                                    : item.topSimilarity >= 40
                                                        ? 'var(--color-risk-medium)'
                                                        : 'var(--color-risk-low)'
                                            }}
                                        >
                                            {item.topSimilarity.toFixed(1)}%
                                        </p>
                                        <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>Top Match</p>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 ml-4">
                                    <motion.button
                                        whileHover={{ scale: 1.05 }}
                                        whileTap={{ scale: 0.95 }}
                                        className="btn btn-primary"
                                        onClick={() => handleOpenRun(item.id)}
                                    >
                                        Open
                                        <ChevronRight className="w-4 h-4" />
                                    </motion.button>
                                </div>
                            </div>

                            {/* Progress bar showing top similarity */}
                            <div
                                className="h-1"
                                style={{ background: 'var(--color-border-light)' }}
                            >
                                <div
                                    className="h-full transition-all duration-500"
                                    style={{
                                        width: `${item.topSimilarity}%`,
                                        background: item.topSimilarity >= 70
                                            ? 'var(--color-risk-high)'
                                            : item.topSimilarity >= 40
                                                ? 'var(--color-risk-medium)'
                                                : 'var(--color-risk-low)'
                                    }}
                                />
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* Stats Footer */}
            {history.length > 0 && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="mt-8 text-center"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    <p className="text-sm">
                        Showing {filteredHistory.length} of {history.length} scans •
                        Total {history.reduce((sum, h) => sum + h.fileCount, 0)} files analyzed
                    </p>
                </motion.div>
            )}
        </div>
    )
}
