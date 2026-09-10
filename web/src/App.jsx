import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import ChatSidebar from './components/ChatSidebar'
import './styles/theme.css'
import './App.css'

const Calendar = lazy(() => import('./pages/Calendar'))
const Lists = lazy(() => import('./pages/Lists'))
const HouseholdInfo = lazy(() => import('./pages/HouseholdInfo'))
const GroceryMeals = lazy(() => import('./pages/GroceryMeals'))
const Notes = lazy(() => import('./pages/Notes'))

const NAV_LINKS = [
  { to: '/', label: 'Dashboard' },
  { to: '/calendar', label: 'Calendar' },
  { to: '/lists', label: 'Lists' },
  { to: '/info', label: 'Info' },
  { to: '/grocery', label: 'Grocery' },
  { to: '/notes', label: 'Notes' },
]

function Nav() {
  return (
    <nav className="bottom-nav">
      {NAV_LINKS.map(({ to, label }) => (
        <NavLink key={to} to={to} end={to === '/'} className="nav-item">
          {label}
        </NavLink>
      ))}
    </nav>
  )
}

function PageLoader() {
  return <p className="muted-text" style={{ padding: '1rem' }}>Loading...</p>
}

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Nav />
        <main className="app-content">
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/calendar" element={<Calendar />} />
              <Route path="/lists" element={<Lists />} />
              <Route path="/info" element={<HouseholdInfo />} />
              <Route path="/grocery" element={<GroceryMeals />} />
              <Route path="/notes" element={<Notes />} />
            </Routes>
          </Suspense>
        </main>
        <ChatSidebar />
      </div>
    </BrowserRouter>
  )
}
