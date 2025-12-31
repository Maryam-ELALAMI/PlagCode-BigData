# PlagCode Frontend

A modern, premium UI for Code Similarity / Plagiarism Detection built with React, Vite, and TailwindCSS.

![PlagCode](https://img.shields.io/badge/PlagCode-v1.0-6366f1?style=for-the-badge)

## Features

### 🎨 Design
- **Modern & Premium Feel**: Glassmorphism effects, smooth animations, gradient accents
- **Light/Dark Theme**: Seamless theme switching with accessible contrast
- **Responsive Layout**: Works on all screen sizes
- **Micro-animations**: Framer Motion powered interactions

### 📊 3-Step Wizard Flow

#### 1. Upload Screen
- Drag & drop file upload with visual feedback
- Support for 12+ programming languages
- Configurable analysis options:
  - Auto-detect language
  - Ignore comments
  - Normalize identifiers
- Sample dataset loader for quick demos

#### 2. Processing Screen
- Animated progress bar with step indicators
- Real-time log panel (collapsible)
- Estimated time & file statistics
- Non-blocking cancel button

#### 3. Results Dashboard
- **Summary Cards**: Files, pairs, top similarity, runtime
- **High-Risk Alerts**: Visual warnings for concerning matches
- **Match Table**: Sortable, filterable, paginated
  - Search by filename
  - Similarity threshold slider
  - High-risk only filter
- **Visualizations**:
  - Interactive Similarity Heatmap
  - Relationship Graph (draggable nodes, zoom)
- **Compare View**:
  - Side-by-side code viewer with line numbers
  - Diff mode highlighting
  - "Explain Similarity" panel with hover interactions

### 📁 Additional Features
- **Export**: JSON and PDF report generation
- **History**: Search and reopen previous scan runs
- **Batch Delete**: Multi-select history items

## Tech Stack

- **React 18** - UI library
- **Vite** - Build tool
- **TailwindCSS 4** - Styling
- **Framer Motion** - Animations
- **Lucide React** - Icons
- **React Router** - Navigation
- **Recharts** - Charts (optional)

## Getting Started

### Prerequisites
- Node.js 18+
- npm or pnpm

### Installation

```bash
cd frontend
npm install
```

### Development

```bash
npm run dev
```

Visit [http://localhost:5173](http://localhost:5173)

### Production Build

```bash
npm run build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Navbar.jsx           # Top navigation with theme toggle
│   │   ├── Sidebar.jsx          # Results dashboard sidebar
│   │   ├── SimilarityHeatmap.jsx # Interactive heatmap matrix
│   │   └── RelationshipGraph.jsx # Network graph visualization
│   ├── screens/
│   │   ├── UploadScreen.jsx     # Step 1: File upload
│   │   ├── ProcessingScreen.jsx # Step 2: Analysis progress
│   │   ├── ResultsScreen.jsx    # Step 3: Results dashboard
│   │   ├── CompareView.jsx      # Side-by-side code comparison
│   │   └── HistoryScreen.jsx    # Scan history management
│   ├── App.jsx                  # Main app with routing
│   ├── main.jsx                 # Entry point
│   └── index.css                # Custom CSS & design tokens
├── public/
│   └── favicon.svg              # App icon
├── BACKEND_INTEGRATION.md       # API integration guide
└── package.json
```

## Backend Integration

See [BACKEND_INTEGRATION.md](./BACKEND_INTEGRATION.md) for detailed API integration points.

### Expected JSON Contract

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
      "overlap_spans": [...]
    }
  ]
}
```

## Customization

### Theme Colors

Edit `src/index.css` to customize the color palette:

```css
:root {
  --color-primary: #6366f1;
  --color-secondary: #0ea5e9;
  --color-risk-low: #22c55e;
  --color-risk-medium: #f59e0b;
  --color-risk-high: #ef4444;
}
```

### Supported Extensions

Edit `src/screens/UploadScreen.jsx` to add more file types:

```javascript
const SUPPORTED_EXTENSIONS = [
  { ext: '.py', name: 'Python', color: '#3776ab' },
  // Add more...
]
```

## License

MIT
