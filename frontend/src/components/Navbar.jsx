import { useContext } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ThemeContext } from '../App'
import {
    Sun,
    Moon,
    Dna,
    History,
    Upload as UploadIcon,
    LayoutDashboard,
    AlertTriangle
} from 'lucide-react'
import { motion } from 'framer-motion'

export default function Navbar() {
    const { theme, toggleTheme } = useContext(ThemeContext)
    const location = useLocation()

    const navItems = [
        { path: '/', label: 'Upload', icon: UploadIcon },
        { path: '/results', label: 'Results', icon: LayoutDashboard },
        { path: '/history', label: 'History', icon: History },
        { path: '/alerts', label: 'Alerts', icon: AlertTriangle },
    ]

    return (
        <motion.nav
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.3 }}
            className="card-static mx-4 mt-4 mb-2 px-6 py-4 flex items-center justify-between"
        >
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 no-underline">
                <motion.div
                    className="gradient-bg p-2.5 rounded-xl"
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.6 }}
                >
                    <Dna className="w-6 h-6 text-white" />
                </motion.div>
                <div>
                    <h1 className="text-xl font-bold gradient-text m-0">PlagCode</h1>
                    <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>
                        Code Similarity Detector
                    </p>
                </div>
            </Link>

            {/* Navigation Links */}
            <div className="flex items-center gap-1">
                {navItems.map((item) => {
                    const Icon = item.icon
                    const isActive = location.pathname === item.path ||
                        (item.path !== '/' && location.pathname.startsWith(item.path))

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className="no-underline"
                        >
                            <motion.div
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl transition-all ${isActive
                                        ? 'gradient-bg text-white'
                                        : 'hover:bg-[var(--color-border-light)]'
                                    }`}
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                style={{ color: isActive ? 'white' : 'var(--color-text-secondary)' }}
                            >
                                <Icon className="w-4 h-4" />
                                <span className="font-medium text-sm">{item.label}</span>
                            </motion.div>
                        </Link>
                    )
                })}
            </div>

            {/* Theme Toggle */}
            <motion.button
                onClick={toggleTheme}
                className="btn-ghost p-3 rounded-xl"
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.95 }}
                aria-label="Toggle theme"
            >
                <motion.div
                    initial={false}
                    animate={{ rotate: theme === 'dark' ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    {theme === 'dark' ? (
                        <Sun className="w-5 h-5 text-yellow-400" />
                    ) : (
                        <Moon className="w-5 h-5 text-indigo-500" />
                    )}
                </motion.div>
            </motion.button>
        </motion.nav>
    )
}
