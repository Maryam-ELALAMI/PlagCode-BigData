import { useMemo } from 'react'
import { motion } from 'framer-motion'

export default function SimilarityHeatmap({ pairs }) {
    // Extract unique files and build matrix
    const { files, matrix } = useMemo(() => {
        const fileSet = new Set()
        pairs.forEach(pair => {
            fileSet.add(pair.file_a)
            fileSet.add(pair.file_b)
        })
        const files = Array.from(fileSet).sort()

        // Build similarity matrix
        const matrix = {}
        files.forEach(f1 => {
            matrix[f1] = {}
            files.forEach(f2 => {
                if (f1 === f2) {
                    matrix[f1][f2] = 100
                } else {
                    const pair = pairs.find(
                        p => (p.file_a === f1 && p.file_b === f2) ||
                            (p.file_a === f2 && p.file_b === f1)
                    )
                    matrix[f1][f2] = pair?.similarity || 0
                }
            })
        })

        return { files, matrix }
    }, [pairs])

    const getColor = (value) => {
        if (value >= 70) return 'var(--color-risk-high)'
        if (value >= 40) return 'var(--color-risk-medium)'
        if (value >= 20) return 'var(--color-risk-low)'
        return 'var(--color-border)'
    }

    const getOpacity = (value) => {
        return Math.max(0.2, value / 100)
    }

    return (
        <div className="card-static p-6">
            <h3 className="text-lg font-semibold mb-6">Similarity Heatmap</h3>

            <div className="overflow-x-auto">
                <div className="inline-block min-w-full">
                    {/* Header Row */}
                    <div className="flex">
                        <div className="w-32 flex-shrink-0" /> {/* Empty corner */}
                        {files.map((file, i) => (
                            <motion.div
                                key={file}
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.02 }}
                                className="w-16 h-32 flex-shrink-0 relative"
                            >
                                <div
                                    className="absolute bottom-0 left-1/2 -translate-x-1/2 origin-bottom-left rotate-[-45deg] whitespace-nowrap text-xs truncate max-w-24"
                                    style={{ color: 'var(--color-text-secondary)' }}
                                    title={file}
                                >
                                    {file.length > 12 ? file.slice(0, 10) + '...' : file}
                                </div>
                            </motion.div>
                        ))}
                    </div>

                    {/* Matrix Rows */}
                    {files.map((rowFile, rowIndex) => (
                        <motion.div
                            key={rowFile}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: rowIndex * 0.02 }}
                            className="flex items-center"
                        >
                            {/* Row Label */}
                            <div
                                className="w-32 flex-shrink-0 pr-4 text-right text-xs truncate"
                                style={{ color: 'var(--color-text-secondary)' }}
                                title={rowFile}
                            >
                                {rowFile.length > 15 ? rowFile.slice(0, 13) + '...' : rowFile}
                            </div>

                            {/* Cells */}
                            {files.map((colFile, colIndex) => {
                                const value = matrix[rowFile][colFile]
                                const isDiagonal = rowFile === colFile

                                return (
                                    <motion.div
                                        key={colFile}
                                        className="w-16 h-12 flex-shrink-0 p-0.5"
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        transition={{ delay: (rowIndex + colIndex) * 0.01 }}
                                    >
                                        <motion.div
                                            className="w-full h-full rounded-md flex items-center justify-center cursor-pointer relative group"
                                            style={{
                                                background: isDiagonal
                                                    ? 'var(--color-border-light)'
                                                    : getColor(value),
                                                opacity: isDiagonal ? 1 : getOpacity(value),
                                            }}
                                            whileHover={{ scale: 1.1, zIndex: 10 }}
                                        >
                                            <span
                                                className="text-xs font-mono font-medium"
                                                style={{
                                                    color: value >= 40 && !isDiagonal ? 'white' : 'var(--color-text-secondary)',
                                                    opacity: isDiagonal ? 0.5 : 1
                                                }}
                                            >
                                                {isDiagonal ? '-' : value.toFixed(0)}
                                            </span>

                                            {/* Tooltip */}
                                            <div
                                                className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 rounded-lg text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-20"
                                                style={{
                                                    background: 'var(--color-text)',
                                                    color: 'var(--color-bg)'
                                                }}
                                            >
                                                <div className="font-semibold mb-1">
                                                    {value.toFixed(1)}% Similar
                                                </div>
                                                <div style={{ opacity: 0.7 }}>
                                                    {rowFile} ↔ {colFile}
                                                </div>
                                            </div>
                                        </motion.div>
                                    </motion.div>
                                )
                            })}
                        </motion.div>
                    ))}
                </div>
            </div>

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-8">
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: 'var(--color-border)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>0-20%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: 'var(--color-risk-low)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>20-40%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: 'var(--color-risk-medium)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>40-70%</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded" style={{ background: 'var(--color-risk-high)' }} />
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>70-100%</span>
                </div>
            </div>
        </div>
    )
}
