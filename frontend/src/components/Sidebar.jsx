import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
    LayoutGrid,
    Table,
    Network,
    FileCode,
    Filter,
    Download
} from 'lucide-react'

export default function Sidebar() {
    const location = useLocation()
    const navigate = useNavigate()

    const menuItems = [
        { id: 'overview', label: 'Overview', icon: LayoutGrid, hash: '' },
        { id: 'matches', label: 'Match Table', icon: Table, hash: '#matches' },
        { id: 'heatmap', label: 'Heatmap', icon: LayoutGrid, hash: '#heatmap' },
        { id: 'graph', label: 'Relationship Graph', icon: Network, hash: '#graph' },
    ]

    return (
        <motion.aside
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="w-64 p-4 flex flex-col gap-2"
        >
            <div className="card-static p-4">
                <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-4"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    Dashboard Views
                </h3>

                <nav className="flex flex-col gap-1">
                    {menuItems.map((item, index) => {
                        const Icon = item.icon
                        const isActive = location.hash === item.hash ||
                            (item.hash === '' && !location.hash) ||
                            (item.hash === '#matches' && location.hash === '#overview')

                        return (
                            <motion.div
                                key={item.id}
                                onClick={() => navigate(item.hash ? item.hash : '/results')}
                                className="cursor-pointer"
                                whileHover={{ x: 4 }}
                            >
                                <div
                                    className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive
                                        ? 'bg-[var(--color-primary-light)]'
                                        : 'hover:bg-[var(--color-border-light)]'
                                        }`}
                                    style={{
                                        color: isActive
                                            ? 'var(--color-primary)'
                                            : 'var(--color-text-secondary)'
                                    }}
                                >
                                    <Icon className="w-4 h-4" />
                                    <span className="font-medium text-sm">{item.label}</span>
                                </div>
                            </motion.div>
                        )
                    })}
                </nav>
            </div>

            <div className="card-static p-4 mt-2">
                <h3
                    className="text-xs font-semibold uppercase tracking-wider mb-4"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    Quick Actions
                </h3>

                <div className="flex flex-col gap-2">
                    <button className="btn btn-secondary text-sm justify-start">
                        <Filter className="w-4 h-4" />
                        Filter Results
                    </button>
                    <button className="btn btn-secondary text-sm justify-start">
                        <Download className="w-4 h-4" />
                        Export Report
                    </button>
                </div>
            </div>

            <div className="card-static p-4 mt-auto gradient-bg text-white">
                <div className="flex items-center gap-3 mb-2">
                    <FileCode className="w-5 h-5" />
                    <span className="font-semibold">Pro Tip</span>
                </div>
                <p className="text-sm opacity-90 m-0 leading-relaxed">
                    Click on any match to see a detailed side-by-side comparison with highlighted similarities.
                </p>
            </div>
        </motion.aside>
    )
}
