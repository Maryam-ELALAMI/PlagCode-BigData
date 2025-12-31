import { useState, createContext, useContext } from 'react'
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import './index.css'

// Import screens
import UploadScreen from './screens/UploadScreen'
import ProcessingScreen from './screens/ProcessingScreen'
import ResultsScreen from './screens/ResultsScreen'
import HistoryScreen from './screens/HistoryScreen'
import CompareView from './screens/CompareView'
import AlertsScreen from './screens/AlertsScreen'

// Import components
import Navbar from './components/Navbar'
import Sidebar from './components/Sidebar'

// Create contexts
export const ThemeContext = createContext()
export const AppStateContext = createContext()

// Initial state
const initialState = {
  files: [],
  options: {
    autoDetectLanguage: true,
    ignoreComments: true,
    normalizeIdentifiers: false,
  },
  processingStatus: null,
  results: null,
  history: [],
}

function AppContent() {
  const location = useLocation()
  const showSidebar = location.pathname.startsWith('/results') || location.pathname.startsWith('/compare')

  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />
      <div className="flex flex-1">
        {showSidebar && <Sidebar />}
        <main className="flex-1 p-6">
          <Routes>
            <Route path="/" element={<UploadScreen />} />
            <Route path="/processing" element={<ProcessingScreen />} />
            <Route path="/results" element={<ResultsScreen />} />
            <Route path="/results/:runId" element={<ResultsScreen />} />
            <Route path="/compare/:fileA/:fileB" element={<CompareView />} />
            <Route path="/history" element={<HistoryScreen />} />
            <Route path="/alerts" element={<AlertsScreen />} />
          </Routes>
        </main>
      </div>
    </div>
  )
}

function App() {
  const [theme, setTheme] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('plagcode-theme') || 'light'
    }
    return 'light'
  })

  const [appState, setAppState] = useState(initialState)

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light'
    setTheme(newTheme)
    localStorage.setItem('plagcode-theme', newTheme)
  }

  // Apply theme to document
  if (typeof document !== 'undefined') {
    document.documentElement.setAttribute('data-theme', theme)
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <AppStateContext.Provider value={{ appState, setAppState }}>
        <BrowserRouter>
          <AppContent />
        </BrowserRouter>
      </AppStateContext.Provider>
    </ThemeContext.Provider>
  )
}

export default App
