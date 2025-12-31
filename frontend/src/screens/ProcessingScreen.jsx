import { useState, useEffect, useContext } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppStateContext } from '../App'
import {
    Loader2,
    FileCode,
    Clock,
    ChevronDown,
    ChevronUp,
    X,
    CheckCircle,
    AlertCircle,
    Dna
} from 'lucide-react'

// Simulated logs for demo
const SAMPLE_LOGS = [
    { time: '00:00.000', message: 'Initializing analysis engine...', type: 'info' },
    { time: '00:00.234', message: 'Parsing source files...', type: 'info' },
    { time: '00:01.456', message: 'Tokenizing code structures...', type: 'info' },
    { time: '00:02.789', message: 'Building AST representations...', type: 'info' },
    { time: '00:04.012', message: 'Generating fingerprint hashes...', type: 'info' },
    { time: '00:05.345', message: 'Computing pairwise similarities...', type: 'info' },
    { time: '00:06.678', message: 'Applying winnowing algorithm...', type: 'info' },
    { time: '00:08.901', message: 'Clustering similar segments...', type: 'info' },
    { time: '00:10.234', message: 'Calculating risk scores...', type: 'info' },
    { time: '00:11.567', message: 'Generating comparison matrix...', type: 'info' },
    { time: '00:12.890', message: 'Analysis complete!', type: 'success' },
]


export default function ProcessingScreen() {
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { appState, setAppState } = useContext(AppStateContext)
    const scanId = searchParams.get('scanId') || appState.scanId

    const [progress, setProgress] = useState(0)
    const [currentStep, setCurrentStep] = useState(0)
    const [logs, setLogs] = useState([])
    const [showLogs, setShowLogs] = useState(true)
    const [isComplete, setIsComplete] = useState(false)
    const [isCancelled, setIsCancelled] = useState(false)

    const fileCount = appState.files?.length || 5
    const pairCount = (fileCount * (fileCount - 1)) / 2
    const estimatedTime = Math.ceil(pairCount * 0.5 + 3) // Estimated seconds

    useEffect(() => {
        if (isCancelled || !scanId) return

        const pollStatus = async () => {
            try {
                const response = await fetch(`/api/scan/${scanId}/status`)
                if (!response.ok) return

                const status = await response.json()

                setProgress(status.progress)
                setLogs(status.logs.map(l => ({ ...l, type: 'info' })))

                if (status.complete) {
                    setIsComplete(true)

                    // Fetch results
                    const resResponse = await fetch(`/api/scan/${scanId}/results`)
                    const results = await resResponse.json()

                    setAppState(prev => ({
                        ...prev,
                        results: results
                    }))

                    // Navigate
                    setTimeout(() => {
                        navigate('/results')
                    }, 1000)
                }
            } catch (error) {
                console.error("Polling error", error)
            }
        }

        const interval = setInterval(pollStatus, 1000)

        // Initial poll
        pollStatus()

        return () => clearInterval(interval)
    }, [scanId, isCancelled, navigate, setAppState])

    const handleCancel = () => {
        setIsCancelled(true)
        setTimeout(() => navigate('/'), 500)
    }

    const steps = [
        'Parsing files',
        'Tokenizing',
        'Building AST',
        'Fingerprinting',
        'Comparing',
        'Finalizing'
    ]

    return (
        <div className="max-w-3xl mx-auto">
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center mb-12"
            >
                <motion.div
                    className="w-24 h-24 mx-auto mb-6 rounded-3xl gradient-bg flex items-center justify-center"
                    animate={{
                        boxShadow: isComplete
                            ? '0 0 40px rgba(34, 197, 94, 0.4)'
                            : '0 0 40px rgba(99, 102, 241, 0.4)'
                    }}
                >
                    {isComplete ? (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: 'spring', stiffness: 200 }}
                        >
                            <CheckCircle className="w-12 h-12 text-white" />
                        </motion.div>
                    ) : (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                        >
                            <Dna className="w-12 h-12 text-white" />
                        </motion.div>
                    )}
                </motion.div>

                <h1 className="text-3xl font-bold mb-2">
                    {isCancelled
                        ? 'Scan Cancelled'
                        : isComplete
                            ? 'Analysis Complete!'
                            : 'Analyzing Your Code...'}
                </h1>
                <p style={{ color: 'var(--color-text-secondary)' }}>
                    {isCancelled
                        ? 'The scan has been cancelled'
                        : isComplete
                            ? 'Redirecting to results...'
                            : 'Please wait while we process your files'}
                </p>
            </motion.div>

            {!isCancelled && (
                <>
                    {/* Stats Cards */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="grid grid-cols-3 gap-4 mb-8"
                    >
                        <div className="card-static p-4 text-center">
                            <FileCode className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-primary)' }} />
                            <p className="text-2xl font-bold m-0">{fileCount}</p>
                            <p className="text-sm m-0" style={{ color: 'var(--color-text-muted)' }}>Files</p>
                        </div>
                        <div className="card-static p-4 text-center">
                            <Dna className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-secondary)' }} />
                            <p className="text-2xl font-bold m-0">{pairCount}</p>
                            <p className="text-sm m-0" style={{ color: 'var(--color-text-muted)' }}>Pairs</p>
                        </div>
                        <div className="card-static p-4 text-center">
                            <Clock className="w-6 h-6 mx-auto mb-2" style={{ color: 'var(--color-risk-medium)' }} />
                            <p className="text-2xl font-bold m-0">~{estimatedTime}s</p>
                            <p className="text-sm m-0" style={{ color: 'var(--color-text-muted)' }}>Est. Time</p>
                        </div>
                    </motion.div>

                    {/* Progress Bar */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="card-static p-6 mb-6"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <span className="font-semibold">Progress</span>
                            <span className="font-bold text-lg" style={{ color: 'var(--color-primary)' }}>
                                {Math.round(progress)}%
                            </span>
                        </div>

                        <div className="progress-bar mb-4">
                            <motion.div
                                className="progress-fill"
                                style={{ width: `${progress}%` }}
                            />
                        </div>

                        {/* Step Indicators */}
                        <div className="flex justify-between">
                            {steps.map((step, i) => {
                                const stepProgress = (i / (steps.length - 1)) * 100
                                const isActive = progress >= stepProgress
                                const isCurrent = progress >= stepProgress && progress < ((i + 1) / (steps.length - 1)) * 100

                                return (
                                    <div key={step} className="flex flex-col items-center gap-2">
                                        <motion.div
                                            className="w-3 h-3 rounded-full"
                                            style={{
                                                background: isActive
                                                    ? 'var(--color-primary)'
                                                    : 'var(--color-border)'
                                            }}
                                            animate={isCurrent ? { scale: [1, 1.3, 1] } : {}}
                                            transition={{ repeat: Infinity, duration: 1 }}
                                        />
                                        <span
                                            className="text-xs"
                                            style={{
                                                color: isActive
                                                    ? 'var(--color-text)'
                                                    : 'var(--color-text-muted)'
                                            }}
                                        >
                                            {step}
                                        </span>
                                    </div>
                                )
                            })}
                        </div>
                    </motion.div>

                    {/* Log Panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="card-static overflow-hidden"
                    >
                        <button
                            className="w-full flex items-center justify-between p-4"
                            onClick={() => setShowLogs(!showLogs)}
                            style={{ background: 'transparent' }}
                        >
                            <span className="font-semibold">Processing Log</span>
                            {showLogs ? (
                                <ChevronUp className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                            ) : (
                                <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                            )}
                        </button>

                        <AnimatePresence>
                            {showLogs && (
                                <motion.div
                                    initial={{ height: 0 }}
                                    animate={{ height: 'auto' }}
                                    exit={{ height: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden"
                                >
                                    <div
                                        className="p-4 pt-0 max-h-48 overflow-y-auto code-font"
                                        style={{ background: 'var(--color-bg)' }}
                                    >
                                        {logs.map((log, i) => (
                                            <motion.div
                                                key={i}
                                                initial={{ opacity: 0, x: -10 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="flex gap-3 py-1"
                                            >
                                                <span style={{ color: 'var(--color-text-muted)' }}>
                                                    [{log.time}]
                                                </span>
                                                <span style={{
                                                    color: log.type === 'success'
                                                        ? 'var(--color-risk-low)'
                                                        : log.type === 'error'
                                                            ? 'var(--color-risk-high)'
                                                            : 'var(--color-text-secondary)'
                                                }}>
                                                    {log.message}
                                                </span>
                                            </motion.div>
                                        ))}
                                        {!isComplete && (
                                            <motion.div
                                                animate={{ opacity: [1, 0.5, 1] }}
                                                transition={{ repeat: Infinity, duration: 1 }}
                                                className="flex gap-3 py-1"
                                            >
                                                <span style={{ color: 'var(--color-text-muted)' }}>
                                                    [--:--.---]
                                                </span>
                                                <span style={{ color: 'var(--color-text-secondary)' }}>
                                                    Processing...
                                                </span>
                                            </motion.div>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Cancel Button */}
                    {!isComplete && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4 }}
                            className="text-center mt-8"
                        >
                            <button className="btn btn-ghost" onClick={handleCancel}>
                                <X className="w-4 h-4" />
                                Cancel Scan
                            </button>
                        </motion.div>
                    )}
                </>
            )}
        </div>
    )
}

// Helper function to generate mock results
function generateMockResults(fileCount) {
    const files = Array.from({ length: fileCount }, (_, i) => `file_${i + 1}.py`)
    const pairs = []

    for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
            const similarity = Math.random() * 100
            const label = similarity >= 70 ? 'high' : similarity >= 40 ? 'medium' : 'low'

            pairs.push({
                file_a: files[i],
                file_b: files[j],
                similarity: Math.round(similarity * 10) / 10,
                label,
                overlap_spans: generateOverlapSpans(similarity),
            })
        }
    }

    return {
        meta: {
            n_files: fileCount,
            n_pairs: pairs.length,
            runtime_ms: Math.round(Math.random() * 5000 + 2000),
        },
        pairs: pairs.sort((a, b) => b.similarity - a.similarity),
    }
}

function generateOverlapSpans(similarity) {
    const spanCount = Math.floor(similarity / 20)
    return Array.from({ length: spanCount }, (_, i) => ({
        start_a: i * 10,
        end_a: i * 10 + 5,
        start_b: i * 10 + 2,
        end_b: i * 10 + 7,
    }))
}
