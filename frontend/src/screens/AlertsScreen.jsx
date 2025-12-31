import { useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
    AlertTriangle,
    RefreshCw,
    Search,
    Clock,
    Bug,
    Hash,
} from 'lucide-react'

function formatTime(iso) {
    if (!iso) return ''
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return String(iso)
    return d.toLocaleString()
}

export default function AlertsScreen() {
    const [alerts, setAlerts] = useState([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState(null)
    const [searchQuery, setSearchQuery] = useState('')

    const loadAlerts = async () => {
        setLoading(true)
        setError(null)
        try {
            const res = await fetch('/api/alerts?limit=200')
            if (!res.ok) {
                throw new Error(`Failed to load alerts: ${res.status} ${res.statusText}`)
            }
            const data = await res.json()
            setAlerts(data.alerts || [])
        } catch (e) {
            setError(e.message)
        } finally {
            setLoading(false)
        }
    }

    useEffect(() => {
        loadAlerts()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    const filtered = useMemo(() => {
        const q = searchQuery.trim().toLowerCase()
        if (!q) return alerts
        return alerts.filter(a => {
            const scan = (a.scan_id || '').toLowerCase()
            const svc = (a.service || '').toLowerCase()
            const code = (a.error_code || '').toLowerCase()
            const msg = (a.message || '').toLowerCase()
            return scan.includes(q) || svc.includes(q) || code.includes(q) || msg.includes(q)
        })
    }, [alerts, searchQuery])

    return (
        <div className="max-w-5xl mx-auto animate-fadeIn">
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-6"
            >
                <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 rounded-xl" style={{ background: 'rgba(239, 68, 68, 0.10)' }}>
                        <AlertTriangle className="w-6 h-6" style={{ color: 'var(--color-risk-high)' }} />
                    </div>
                    <div className="flex-1">
                        <h1 className="text-2xl font-bold m-0">Alerts</h1>
                        <p className="m-0" style={{ color: 'var(--color-text-secondary)' }}>
                            Operational alerts written by workers and API (Postgres-backed)
                        </p>
                    </div>
                    <button className="btn btn-secondary" onClick={loadAlerts}>
                        <RefreshCw className="w-4 h-4" />
                        Refresh
                    </button>
                </div>

                <div className="flex items-center gap-4 mt-4">
                    <div className="flex-1 relative">
                        <Search
                            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4"
                            style={{ color: 'var(--color-text-muted)' }}
                        />
                        <input
                            className="input pl-10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="Search by scan_id, service, error_code, message..."
                        />
                    </div>
                    <div className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                        {filtered.length} shown
                    </div>
                </div>
            </motion.div>

            {error && (
                <div
                    className="card-static p-4 mb-4"
                    style={{ border: '1px solid rgba(239, 68, 68, 0.35)', background: 'rgba(239, 68, 68, 0.08)' }}
                >
                    <p className="m-0 font-semibold" style={{ color: 'var(--color-risk-high)' }}>
                        {error}
                    </p>
                </div>
            )}

            {loading ? (
                <div className="card-static p-8">
                    <p className="m-0" style={{ color: 'var(--color-text-secondary)' }}>Loading alerts…</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="card-static p-12 text-center">
                    <Bug className="w-16 h-16 mx-auto mb-4" style={{ color: 'var(--color-text-muted)' }} />
                    <h3 className="text-lg font-semibold mb-2">No alerts</h3>
                    <p style={{ color: 'var(--color-text-muted)' }}>
                        That’s either great… or suspiciously quiet.
                    </p>
                </div>
            ) : (
                <div className="space-y-3">
                    {filtered.map((a) => (
                        <div key={a.id} className="card-static p-4">
                            <div className="flex items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="badge badge-high">{a.error_code}</span>
                                        <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                                            {a.service}
                                        </span>
                                    </div>
                                    <p className="m-0 font-semibold" style={{ color: 'var(--color-text-secondary)' }}>
                                        {a.message}
                                    </p>
                                    <div className="flex flex-wrap items-center gap-4 text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
                                        <span className="flex items-center gap-1">
                                            <Clock className="w-3.5 h-3.5" />
                                            {formatTime(a.created_at)}
                                        </span>
                                        {a.scan_id && (
                                            <span className="flex items-center gap-1">
                                                <Hash className="w-3.5 h-3.5" />
                                                <span className="font-mono">{a.scan_id}</span>
                                            </span>
                                        )}
                                    </div>
                                </div>

                                {/* Payload preview */}
                                <details className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                                    <summary className="cursor-pointer select-none">payload</summary>
                                    <pre className="mt-2 p-3 rounded-lg overflow-auto" style={{ background: 'rgba(0,0,0,0.06)' }}>
{JSON.stringify(a.payload_json || {}, null, 2)}
                                    </pre>
                                </details>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}
