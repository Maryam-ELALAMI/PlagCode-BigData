import { useState, useContext, useMemo, useEffect } from 'react'
import { useParams, useNavigate, Link, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { AppStateContext } from '../App'
import {
    ArrowLeft,
    FileCode,
    Copy,
    Check,
    GitCompare,
    Lightbulb,
    ChevronDown,
    ChevronUp,
    Eye,
    EyeOff,
    Maximize2,
    Minimize2,
    Code,
    Hash,
    Layers
} from 'lucide-react'

// Mock code content for demo
const MOCK_CODE_A = `def calculate_similarity(text1, text2):
    """Calculate similarity between two texts."""
    words1 = set(text1.lower().split())
    words2 = set(text2.lower().split())
    
    intersection = words1 & words2
    union = words1 | words2
    
    if not union:
        return 0.0
    
    return len(intersection) / len(union)

def preprocess_code(code):
    # Remove comments and whitespace
    lines = code.split('\\n')
    result = []
    for line in lines:
        stripped = line.strip()
        if stripped and not stripped.startswith('#'):
            result.append(stripped)
    return '\\n'.join(result)

def main():
    code1 = load_file('file1.py')
    code2 = load_file('file2.py')
    
    score = calculate_similarity(
        preprocess_code(code1),
        preprocess_code(code2)
    )
    print(f"Similarity: {score:.2%}")`

const MOCK_CODE_B = `def compute_similarity(str1, str2):
    """Compute similarity score between strings."""
    tokens1 = set(str1.lower().split())
    tokens2 = set(str2.lower().split())
    
    common = tokens1 & tokens2
    total = tokens1 | tokens2
    
    if not total:
        return 0.0
    
    return len(common) / len(total)

def clean_code(source):
    # Strip comments and extra whitespace
    lines = source.split('\\n')
    output = []
    for line in lines:
        clean = line.strip()
        if clean and not clean.startswith('#'):
            output.append(clean)
    return '\\n'.join(output)

def run():
    src1 = read_file('input1.py')
    src2 = read_file('input2.py')
    
    result = compute_similarity(
        clean_code(src1),
        clean_code(src2)
    )
    print(f"Match: {result:.2%}")`

// Highlight ranges for demo (line numbers that are similar)
const SIMILAR_RANGES = [
    { startA: 1, endA: 12, startB: 1, endB: 12, reason: 'Same algorithm structure' },
    { startA: 14, endA: 22, startB: 14, endB: 22, reason: 'Similar preprocessing logic' },
    { startA: 24, endA: 32, startB: 24, endB: 32, reason: 'Identical control flow' },
]

export default function CompareView() {
    const { fileA, fileB } = useParams()
    const navigate = useNavigate()
    const [searchParams] = useSearchParams()
    const { appState } = useContext(AppStateContext)

    const effectiveScanId = searchParams.get('scanId') || appState.scanId

    const [showDiff, setShowDiff] = useState(false)
    const [showExplanation, setShowExplanation] = useState(true)
    const [fullscreen, setFullscreen] = useState(false)
    const [copiedA, setCopiedA] = useState(false)
    const [copiedB, setCopiedB] = useState(false)
    const [highlightedRange, setHighlightedRange] = useState(null)

    const [codeA, setCodeA] = useState('')
    const [codeB, setCodeB] = useState('')

    // Fetch file content
    useEffect(() => {
        const loadFiles = async () => {
            if (effectiveScanId) {
                try {
                    const [resA, resB] = await Promise.all([
                        fetch(`/api/files/${effectiveScanId}/${encodeURIComponent(decodeURIComponent(fileA))}`),
                        fetch(`/api/files/${effectiveScanId}/${encodeURIComponent(decodeURIComponent(fileB))}`)
                    ])

                    if (resA.ok) {
                        const dataA = await resA.json()
                        setCodeA(dataA.content)
                    }
                    if (resB.ok) {
                        const dataB = await resB.json()
                        setCodeB(dataB.content)
                    }
                } catch (e) {
                    console.error("Error loading files", e)
                }
            } else {
                setCodeA(MOCK_CODE_A)
                setCodeB(MOCK_CODE_B)
            }
        }
        loadFiles()
    }, [effectiveScanId, fileA, fileB])

    // Find pair data
    const pairData = useMemo(() => {
        const decodedA = decodeURIComponent(fileA)
        const decodedB = decodeURIComponent(fileB)
        return appState.results?.pairs?.find(
            p => (p.file_a === decodedA && p.file_b === decodedB) ||
                (p.file_a === decodedB && p.file_b === decodedA)
        ) || {
            file_a: decodedA,
            file_b: decodedB,
            similarity: 78.5,
            label: 'high',
            overlap_spans: SIMILAR_RANGES
        }
    }, [appState.results, fileA, fileB])

    const linesA = (codeA || '').split('\n')
    const linesB = (codeB || '').split('\n')

    const handleCopy = async (code, side) => {
        await navigator.clipboard.writeText(code)
        if (side === 'A') {
            setCopiedA(true)
            setTimeout(() => setCopiedA(false), 2000)
        } else {
            setCopiedB(true)
            setTimeout(() => setCopiedB(false), 2000)
        }
    }

    const isLineHighlighted = (lineNum, side) => {
        if (!highlightedRange) return false
        const start = side === 'A' ? highlightedRange.startA : highlightedRange.startB
        const end = side === 'A' ? highlightedRange.endA : highlightedRange.endB
        return lineNum >= start && lineNum <= end
    }

    const isLineSimilar = (lineNum, side) => {
        return SIMILAR_RANGES.some(range => {
            const start = side === 'A' ? range.startA : range.startB
            const end = side === 'A' ? range.endA : range.endB
            return lineNum >= start && lineNum <= end
        })
    }

    return (
        <div className={`animate-fadeIn ${fullscreen ? 'fixed inset-0 z-50 p-4' : ''}`} style={{ background: fullscreen ? 'var(--color-bg)' : 'transparent' }}>
            {/* Header */}
            <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center justify-between mb-6"
            >
                <div className="flex items-center gap-4">
                    <Link to="/results" className="btn btn-ghost">
                        <ArrowLeft className="w-4 h-4" />
                        Back to Results
                    </Link>

                    <div className="h-6 w-px" style={{ background: 'var(--color-border)' }} />

                    <div className="flex items-center gap-2">
                        <span className={`badge badge-${pairData.label}`}>
                            {pairData.similarity.toFixed(1)}% Similar
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button
                        className={`btn ${showDiff ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setShowDiff(!showDiff)}
                    >
                        <GitCompare className="w-4 h-4" />
                        {showDiff ? 'Hide Diff' : 'Show Diff'}
                    </button>
                    <button
                        className="btn btn-ghost p-2"
                        onClick={() => setFullscreen(!fullscreen)}
                    >
                        {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </button>
                </div>
            </motion.div>

            <div className="grid grid-cols-12 gap-4">
                {/* Code Comparison */}
                <div className={`${showExplanation ? 'col-span-9' : 'col-span-12'}`}>
                    <div className="grid grid-cols-2 gap-4">
                        {/* File A */}
                        <motion.div
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="card-static overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-2">
                                    <FileCode className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                    <span className="font-medium code-font">{decodeURIComponent(fileA)}</span>
                                </div>
                                <button
                                    className="btn btn-ghost p-2"
                                    onClick={() => handleCopy(codeA, 'A')}
                                >
                                    {copiedA ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="overflow-auto max-h-[600px]" style={{ background: 'var(--color-bg)' }}>
                                <pre className="p-0 m-0">
                                    <code className="code-font">
                                        {linesA.map((line, i) => {
                                            const lineNum = i + 1
                                            const similar = isLineSimilar(lineNum, 'A')
                                            const highlighted = isLineHighlighted(lineNum, 'A')

                                            return (
                                                <div
                                                    key={i}
                                                    className="flex"
                                                    style={{
                                                        background: highlighted
                                                            ? 'rgba(99, 102, 241, 0.2)'
                                                            : similar && showDiff
                                                                ? 'rgba(239, 68, 68, 0.1)'
                                                                : 'transparent',
                                                        transition: 'background 0.2s'
                                                    }}
                                                >
                                                    <span
                                                        className="w-12 text-right pr-4 select-none flex-shrink-0"
                                                        style={{
                                                            color: 'var(--color-text-muted)',
                                                            borderRight: '1px solid var(--color-border)'
                                                        }}
                                                    >
                                                        {lineNum}
                                                    </span>
                                                    <span
                                                        className="pl-4 flex-1"
                                                        style={{
                                                            color: similar && showDiff
                                                                ? 'var(--color-risk-high)'
                                                                : 'var(--color-text)'
                                                        }}
                                                    >
                                                        {line || ' '}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </code>
                                </pre>
                            </div>
                        </motion.div>

                        {/* File B */}
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            className="card-static overflow-hidden"
                        >
                            <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
                                <div className="flex items-center gap-2">
                                    <FileCode className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
                                    <span className="font-medium code-font">{decodeURIComponent(fileB)}</span>
                                </div>
                                <button
                                    className="btn btn-ghost p-2"
                                    onClick={() => handleCopy(codeB, 'B')}
                                >
                                    {copiedB ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                                </button>
                            </div>

                            <div className="overflow-auto max-h-[600px]" style={{ background: 'var(--color-bg)' }}>
                                <pre className="p-0 m-0">
                                    <code className="code-font">
                                        {linesB.map((line, i) => {
                                            const lineNum = i + 1
                                            const similar = isLineSimilar(lineNum, 'B')
                                            const highlighted = isLineHighlighted(lineNum, 'B')

                                            return (
                                                <div
                                                    key={i}
                                                    className="flex"
                                                    style={{
                                                        background: highlighted
                                                            ? 'rgba(14, 165, 233, 0.2)'
                                                            : similar && showDiff
                                                                ? 'rgba(239, 68, 68, 0.1)'
                                                                : 'transparent',
                                                        transition: 'background 0.2s'
                                                    }}
                                                >
                                                    <span
                                                        className="w-12 text-right pr-4 select-none flex-shrink-0"
                                                        style={{
                                                            color: 'var(--color-text-muted)',
                                                            borderRight: '1px solid var(--color-border)'
                                                        }}
                                                    >
                                                        {lineNum}
                                                    </span>
                                                    <span
                                                        className="pl-4 flex-1"
                                                        style={{
                                                            color: similar && showDiff
                                                                ? 'var(--color-risk-high)'
                                                                : 'var(--color-text)'
                                                        }}
                                                    >
                                                        {line || ' '}
                                                    </span>
                                                </div>
                                            )
                                        })}
                                    </code>
                                </pre>
                            </div>
                        </motion.div>
                    </div>
                </div>

                {/* Explanation Panel */}
                <AnimatePresence>
                    {showExplanation && (
                        <motion.div
                            initial={{ opacity: 0, x: 20 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: 20 }}
                            className="col-span-3"
                        >
                            <div className="card-static p-4">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex items-center gap-2">
                                        <Lightbulb className="w-5 h-5" style={{ color: 'var(--color-risk-medium)' }} />
                                        <h3 className="font-semibold m-0">Explain Similarity</h3>
                                    </div>
                                    <button
                                        className="btn btn-ghost p-1"
                                        onClick={() => setShowExplanation(false)}
                                    >
                                        <EyeOff className="w-4 h-4" />
                                    </button>
                                </div>

                                <div className="space-y-3">
                                    {SIMILAR_RANGES.map((range, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            transition={{ delay: i * 0.1 }}
                                            className="p-3 rounded-xl cursor-pointer transition-all"
                                            style={{
                                                background: highlightedRange === range
                                                    ? 'var(--color-primary-light)'
                                                    : 'var(--color-border-light)',
                                                border: highlightedRange === range
                                                    ? '1px solid var(--color-primary)'
                                                    : '1px solid transparent'
                                            }}
                                            onMouseEnter={() => setHighlightedRange(range)}
                                            onMouseLeave={() => setHighlightedRange(null)}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <Code className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                                <span className="text-xs font-mono" style={{ color: 'var(--color-text-muted)' }}>
                                                    Lines {range.startA}-{range.endA} ↔ {range.startB}-{range.endB}
                                                </span>
                                            </div>
                                            <p className="text-sm m-0" style={{ color: 'var(--color-text-secondary)' }}>
                                                {range.reason}
                                            </p>
                                        </motion.div>
                                    ))}
                                </div>

                                {/* Analysis Summary */}
                                <div className="mt-6 pt-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
                                    <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text-muted)' }}>
                                        Analysis Summary
                                    </h4>

                                    <div className="space-y-2">
                                        <div className="flex items-center gap-2">
                                            <Hash className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                                            <span className="text-sm">Token match: 82%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Layers className="w-4 h-4" style={{ color: 'var(--color-secondary)' }} />
                                            <span className="text-sm">AST similarity: 76%</span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <Code className="w-4 h-4" style={{ color: 'var(--color-risk-medium)' }} />
                                            <span className="text-sm">Fingerprint match: 85%</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Show explanation toggle when hidden */}
            {!showExplanation && (
                <motion.button
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="fixed right-4 top-1/2 -translate-y-1/2 btn btn-secondary"
                    onClick={() => setShowExplanation(true)}
                >
                    <Eye className="w-4 h-4" />
                    Show Explanation
                </motion.button>
            )}
        </div>
    )
}
