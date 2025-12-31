import { useState, useCallback, useContext } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppStateContext } from '../App'
import {
    Upload,
    FileCode,
    X,
    Settings,
    Play,
    Database,
    Check,
    ChevronDown,
    Sparkles,
    Shield,
    Zap,
    Code
} from 'lucide-react'

const SUPPORTED_EXTENSIONS = [
    { ext: '.py', name: 'Python', color: '#3776ab' },
    { ext: '.js', name: 'JavaScript', color: '#f7df1e' },
    { ext: '.ts', name: 'TypeScript', color: '#3178c6' },
    { ext: '.java', name: 'Java', color: '#ed8b00' },
    { ext: '.cpp', name: 'C++', color: '#00599c' },
    { ext: '.c', name: 'C', color: '#a8b9cc' },
    { ext: '.cs', name: 'C#', color: '#239120' },
    { ext: '.go', name: 'Go', color: '#00add8' },
    { ext: '.rb', name: 'Ruby', color: '#cc342d' },
    { ext: '.php', name: 'PHP', color: '#777bb4' },
    { ext: '.rs', name: 'Rust', color: '#dea584' },
    { ext: '.swift', name: 'Swift', color: '#fa7343' },
]

export default function UploadScreen() {
    const navigate = useNavigate()
    const { appState, setAppState } = useContext(AppStateContext)
    const [files, setFiles] = useState([])
    const [isDragging, setIsDragging] = useState(false)
    const [showOptions, setShowOptions] = useState(false)
    const [options, setOptions] = useState({
        autoDetectLanguage: true,
        ignoreComments: true,
        normalizeIdentifiers: false,
    })

    const handleDragOver = useCallback((e) => {
        e.preventDefault()
        setIsDragging(true)
    }, [])

    const handleDragLeave = useCallback((e) => {
        e.preventDefault()
        setIsDragging(false)
    }, [])

    const handleDrop = useCallback((e) => {
        e.preventDefault()
        setIsDragging(false)

        const droppedFiles = Array.from(e.dataTransfer.files).filter(file => {
            const ext = '.' + file.name.split('.').pop().toLowerCase()
            return SUPPORTED_EXTENSIONS.some(s => s.ext === ext)
        })

        setFiles(prev => [...prev, ...droppedFiles])
    }, [])

    const handleFileInput = (e) => {
        const selectedFiles = Array.from(e.target.files).filter(file => {
            const ext = '.' + file.name.split('.').pop().toLowerCase()
            return SUPPORTED_EXTENSIONS.some(s => s.ext === ext)
        })
        setFiles(prev => [...prev, ...selectedFiles])
    }

    const removeFile = (index) => {
        setFiles(prev => prev.filter((_, i) => i !== index))
    }

    const handleStartScan = async () => {
        if (files.length < 2) {
            alert('Please upload at least 2 files to compare')
            return
        }

        const formData = new FormData()
        files.forEach(file => {
            formData.append('files', file)
        })
        formData.append('options', JSON.stringify(options))

        try {
            const response = await fetch('/api/scan', {
                method: 'POST',
                body: formData,
            })

            if (!response.ok) {
                const errorText = await response.text()
                throw new Error(`Upload failed: ${response.status} ${response.statusText} - ${errorText}`)
            }

            const data = await response.json()

            setAppState(prev => ({
                ...prev,
                scanId: data.scanId,
                files: files.map(f => f.name), // Store names only, content is on server
                options: options,
            }))

            navigate(`/processing?scanId=${data.scanId}`)
        } catch (error) {
            console.error('Error starting scan:', error)
            alert(`Failed to start scan: ${error.message}. Check console for details.`)
        }
    }

    const loadSampleDataset = () => {
        // Simulate loading sample files
        const sampleFiles = [
            new File(['// Sample code 1'], 'solution_a.py', { type: 'text/plain' }),
            new File(['// Sample code 2'], 'solution_b.py', { type: 'text/plain' }),
            new File(['// Sample code 3'], 'solution_c.py', { type: 'text/plain' }),
            new File(['// Sample code 4'], 'submission_1.java', { type: 'text/plain' }),
            new File(['// Sample code 5'], 'submission_2.java', { type: 'text/plain' }),
        ]
        setFiles(sampleFiles)
    }

    const getFileExtension = (filename) => {
        return '.' + filename.split('.').pop().toLowerCase()
    }

    const getExtensionColor = (filename) => {
        const ext = getFileExtension(filename)
        const found = SUPPORTED_EXTENSIONS.find(s => s.ext === ext)
        return found?.color || 'var(--color-primary)'
    }

    return (
        <div className="max-w-4xl mx-auto">
            {/* Hero Section */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="text-center mb-8"
            >
                <motion.div
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                    style={{ background: 'var(--color-primary-light)' }}
                    initial={{ scale: 0.9 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.2 }}
                >
                    <Sparkles className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                    <span className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>
                        AI-Powered Code Analysis
                    </span>
                </motion.div>

                <h1 className="text-4xl font-bold mb-4">
                    Detect Code Similarity in <span className="gradient-text">Seconds</span>
                </h1>
                <p className="text-lg mb-0" style={{ color: 'var(--color-text-secondary)' }}>
                    Upload your code files and let our advanced algorithms find similarities,
                    detect potential plagiarism, and generate detailed reports.
                </p>
            </motion.div>

            {/* Feature Pills */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1, duration: 0.5 }}
                className="flex justify-center gap-4 mb-8"
            >
                {[
                    { icon: Shield, label: 'Privacy First' },
                    { icon: Zap, label: 'Lightning Fast' },
                    { icon: Code, label: 'Multi-Language' },
                ].map((feature, i) => (
                    <motion.div
                        key={feature.label}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl card-static"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + i * 0.1 }}
                    >
                        <feature.icon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                        <span className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                            {feature.label}
                        </span>
                    </motion.div>
                ))}
            </motion.div>

            {/* Upload Zone */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2, duration: 0.5 }}
            >
                <div
                    className={`dropzone ${isDragging ? 'active' : ''}`}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    onClick={() => document.getElementById('file-input').click()}
                >
                    <input
                        id="file-input"
                        type="file"
                        multiple
                        accept={SUPPORTED_EXTENSIONS.map(s => s.ext).join(',')}
                        onChange={handleFileInput}
                        className="hidden"
                    />

                    <motion.div
                        animate={{ y: isDragging ? -10 : 0 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >
                        <div
                            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                            style={{ background: 'var(--color-primary-light)' }}
                        >
                            <Upload className="w-10 h-10" style={{ color: 'var(--color-primary)' }} />
                        </div>

                        <h3 className="text-xl font-semibold mb-2">
                            {isDragging ? 'Drop files here' : 'Drag & drop your code files'}
                        </h3>
                        <p className="mb-0" style={{ color: 'var(--color-text-secondary)' }}>
                            or <span style={{ color: 'var(--color-primary)' }} className="font-medium">click to browse</span>
                        </p>
                    </motion.div>
                </div>
            </motion.div>

            {/* Supported Extensions */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                className="mt-6 flex flex-wrap justify-center gap-2"
            >
                {SUPPORTED_EXTENSIONS.map((ext, i) => (
                    <motion.div
                        key={ext.ext}
                        className="chip"
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.3 + i * 0.03 }}
                        whileHover={{ scale: 1.05 }}
                    >
                        <div
                            className="w-2 h-2 rounded-full"
                            style={{ background: ext.color }}
                        />
                        <span>{ext.ext}</span>
                    </motion.div>
                ))}
            </motion.div>

            {/* File List */}
            <AnimatePresence>
                {files.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        className="mt-8"
                    >
                        <div className="card-static p-6">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-lg font-semibold m-0">
                                    Uploaded Files ({files.length})
                                </h3>
                                <button
                                    className="btn btn-ghost text-sm"
                                    onClick={() => setFiles([])}
                                >
                                    Clear all
                                </button>
                            </div>

                            <div className="grid gap-2 max-h-64 overflow-y-auto pr-2">
                                {files.map((file, index) => (
                                    <motion.div
                                        key={`${file.name}-${index}`}
                                        initial={{ opacity: 0, x: -20 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 20 }}
                                        className="flex items-center gap-3 p-3 rounded-xl"
                                        style={{ background: 'var(--color-border-light)' }}
                                    >
                                        <div
                                            className="w-10 h-10 rounded-lg flex items-center justify-center"
                                            style={{ background: getExtensionColor(file.name) + '20' }}
                                        >
                                            <FileCode
                                                className="w-5 h-5"
                                                style={{ color: getExtensionColor(file.name) }}
                                            />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="font-medium m-0 truncate">{file.name}</p>
                                            <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>
                                                {(file.size / 1024).toFixed(1)} KB
                                            </p>
                                        </div>
                                        <motion.button
                                            whileHover={{ scale: 1.1 }}
                                            whileTap={{ scale: 0.9 }}
                                            className="btn-ghost p-2 rounded-lg"
                                            onClick={() => removeFile(index)}
                                        >
                                            <X className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                                        </motion.button>
                                    </motion.div>
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Options Panel */}
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="mt-6"
            >
                <div className="card-static overflow-hidden">
                    <button
                        className="w-full flex items-center justify-between p-4 text-left"
                        onClick={() => setShowOptions(!showOptions)}
                        style={{ background: 'transparent' }}
                    >
                        <div className="flex items-center gap-3">
                            <Settings className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
                            <span className="font-semibold">Analysis Options</span>
                        </div>
                        <motion.div
                            animate={{ rotate: showOptions ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown className="w-5 h-5" style={{ color: 'var(--color-text-muted)' }} />
                        </motion.div>
                    </button>

                    <AnimatePresence>
                        {showOptions && (
                            <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.2 }}
                            >
                                <div className="p-4 pt-0 grid gap-4">
                                    {[
                                        {
                                            key: 'autoDetectLanguage',
                                            label: 'Auto-detect language',
                                            desc: 'Automatically identify programming language from file content'
                                        },
                                        {
                                            key: 'ignoreComments',
                                            label: 'Ignore comments',
                                            desc: 'Exclude comments from similarity comparison'
                                        },
                                        {
                                            key: 'normalizeIdentifiers',
                                            label: 'Normalize identifiers',
                                            desc: 'Treat renamed variables as equivalent for comparison'
                                        },
                                    ].map((option) => (
                                        <div
                                            key={option.key}
                                            className="flex items-start justify-between gap-4 p-4 rounded-xl"
                                            style={{ background: 'var(--color-border-light)' }}
                                        >
                                            <div>
                                                <p className="font-medium m-0 mb-1">{option.label}</p>
                                                <p className="text-sm m-0" style={{ color: 'var(--color-text-muted)' }}>
                                                    {option.desc}
                                                </p>
                                            </div>
                                            <button
                                                className={`toggle ${options[option.key] ? 'active' : ''}`}
                                                onClick={() => setOptions(prev => ({
                                                    ...prev,
                                                    [option.key]: !prev[option.key]
                                                }))}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>

            {/* Action Buttons */}
            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                className="mt-8 flex items-center justify-center gap-4"
            >
                <motion.button
                    className="btn btn-secondary"
                    onClick={loadSampleDataset}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <Database className="w-5 h-5" />
                    Load Sample Dataset
                </motion.button>

                <motion.button
                    className="btn btn-primary px-8"
                    onClick={handleStartScan}
                    disabled={files.length < 2}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                >
                    <Play className="w-5 h-5" />
                    Start Scan
                </motion.button>
            </motion.div>

            {files.length === 1 && (
                <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-center mt-4 text-sm"
                    style={{ color: 'var(--color-text-muted)' }}
                >
                    Upload at least 2 files to compare
                </motion.p>
            )}
        </div>
    )
}
