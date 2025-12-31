# PlagCode Frontend - Backend Integration Guide

This document outlines all the integration points where the frontend expects to communicate with the backend API.

## Expected Backend JSON Contract

The backend should return results in this format:

```json
{
  "meta": {
    "n_files": 10,
    "n_pairs": 45,
    "runtime_ms": 3245
  },
  "pairs": [
    {
      "file_a": "solution_a.py",
      "file_b": "solution_b.py",
      "similarity": 78.5,
      "label": "high",
      "overlap_spans": [
        {
          "start_a": 10,
          "end_a": 25,
          "start_b": 15,
          "end_b": 30,
          "reason": "Same algorithm structure"
        }
      ]
    }
  ]
}
```

## Integration Points

### 1. File Upload & Scan Start
**Location:** `src/screens/UploadScreen.jsx`

```javascript
// In handleStartScan function (around line 75)
// Replace the mock navigation with:

const handleStartScan = async () => {
  const formData = new FormData()
  files.forEach(file => formData.append('files', file))
  formData.append('options', JSON.stringify(options))
  
  try {
    const response = await fetch('/api/scan', {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) throw new Error('Scan failed')
    
    const { scanId } = await response.json()
    navigate(`/processing?scanId=${scanId}`)
  } catch (error) {
    console.error('Error starting scan:', error)
    // Show error notification
  }
}
```

### 2. Processing Status Polling
**Location:** `src/screens/ProcessingScreen.jsx`

```javascript
// Replace the simulated progress with actual polling:

useEffect(() => {
  const pollStatus = async () => {
    const scanId = new URLSearchParams(location.search).get('scanId')
    
    const response = await fetch(`/api/scan/${scanId}/status`)
    const status = await response.json()
    
    setProgress(status.progress)
    setLogs(status.logs)
    
    if (status.complete) {
      const resultsResponse = await fetch(`/api/scan/${scanId}/results`)
      const results = await resultsResponse.json()
      setAppState(prev => ({ ...prev, results }))
      navigate('/results')
    }
  }
  
  const interval = setInterval(pollStatus, 1000)
  return () => clearInterval(interval)
}, [])
```

### 3. Cancel Scan
**Location:** `src/screens/ProcessingScreen.jsx`

```javascript
// In handleCancel function:

const handleCancel = async () => {
  const scanId = new URLSearchParams(location.search).get('scanId')
  await fetch(`/api/scan/${scanId}/cancel`, { method: 'POST' })
  navigate('/')
}
```

### 4. Export Results
**Location:** `src/screens/ResultsScreen.jsx`

```javascript
// In handleExport function (around line 65):

const handleExport = async (format) => {
  const response = await fetch('/api/export', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      format, 
      results: appState.results,
      runId: params.runId 
    }),
  })
  
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `plagcode-report.${format}`
  a.click()
  URL.revokeObjectURL(url)
}
```

### 5. Load File Contents for Comparison
**Location:** `src/screens/CompareView.jsx`

```javascript
// Add useEffect to load actual file contents:

useEffect(() => {
  const loadFileContents = async () => {
    const [contentA, contentB] = await Promise.all([
      fetch(`/api/files/${encodeURIComponent(fileA)}`).then(r => r.text()),
      fetch(`/api/files/${encodeURIComponent(fileB)}`).then(r => r.text()),
    ])
    setCodeA(contentA)
    setCodeB(contentB)
  }
  loadFileContents()
}, [fileA, fileB])
```

### 6. History Management
**Location:** `src/screens/HistoryScreen.jsx`

```javascript
// Load history from backend:

useEffect(() => {
  const loadHistory = async () => {
    const response = await fetch('/api/history')
    const data = await response.json()
    setHistory(data)
  }
  loadHistory()
}, [])

// Delete history items:

const handleDeleteSelected = async () => {
  await Promise.all(selectedItems.map(id => 
    fetch(`/api/history/${id}`, { method: 'DELETE' })
  ))
  setHistory(prev => prev.filter(item => !selectedItems.includes(item.id)))
  setSelectedItems([])
}

// Reopen a historical run:

const handleOpenRun = async (runId) => {
  const response = await fetch(`/api/history/${runId}`)
  const results = await response.json()
  setAppState(prev => ({ ...prev, results }))
  navigate(`/results/${runId}`)
}
```

### 7. Load Sample Dataset
**Location:** `src/screens/UploadScreen.jsx`

```javascript
// In loadSampleDataset function:

const loadSampleDataset = async () => {
  const response = await fetch('/api/samples')
  const samples = await response.json()
  
  // Convert to File objects or use URLs directly
  setFiles(samples.map(s => ({
    name: s.name,
    size: s.size,
    url: s.url, // For server-side files
  })))
}
```

## Backend API Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/scan` | Start a new scan (multipart form with files) |
| GET | `/api/scan/:id/status` | Get scan progress and logs |
| GET | `/api/scan/:id/results` | Get scan results |
| POST | `/api/scan/:id/cancel` | Cancel a running scan |
| POST | `/api/export` | Export results as JSON/PDF |
| GET | `/api/files/:filename` | Get file contents for comparison |
| GET | `/api/history` | List all scan history |
| GET | `/api/history/:id` | Get historical scan results |
| DELETE | `/api/history/:id` | Delete a historical scan |
| GET | `/api/samples` | Get sample dataset files |

## Environment Configuration

Create a `.env` file in the frontend directory:

```env
VITE_API_BASE_URL=http://localhost:8000
```

Then use it in your API calls:

```javascript
const API_BASE = import.meta.env.VITE_API_BASE_URL || ''

// Example:
fetch(`${API_BASE}/api/scan`, { ... })
```

## CORS Configuration

Ensure your backend allows CORS from the frontend development server:

```python
# FastAPI example
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## WebSocket Support (Optional)

For real-time progress updates, consider using WebSocket instead of polling:

```javascript
// In ProcessingScreen.jsx
useEffect(() => {
  const ws = new WebSocket(`ws://localhost:8000/ws/scan/${scanId}`)
  
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data)
    setProgress(data.progress)
    setLogs(prev => [...prev, data.log])
    
    if (data.complete) {
      setAppState(prev => ({ ...prev, results: data.results }))
      navigate('/results')
    }
  }
  
  return () => ws.close()
}, [scanId])
```
