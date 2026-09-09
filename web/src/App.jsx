import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Calendar from './pages/Calendar'
import Lists from './pages/Lists'
import HouseholdInfo from './pages/HouseholdInfo'
import GroceryMeals from './pages/GroceryMeals'
import Notes from './pages/Notes'
import ChatSidebar from './components/ChatSidebar'
import './styles/theme.css'
import './App.css'

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

export default function App() {
  return (
    <BrowserRouter>
      <div className="app-shell">
        <Nav />
        <main className="app-content">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/calendar" element={<Calendar />} />
            <Route path="/lists" element={<Lists />} />
            <Route path="/info" element={<HouseholdInfo />} />
            <Route path="/grocery" element={<GroceryMeals />} />
            <Route path="/notes" element={<Notes />} />
          </Routes>
        </main>
        <ChatSidebar />
      </div>
    </BrowserRouter>
  )
}
