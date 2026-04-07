import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import CookieBanner from './components/CookieBanner'
import Home from './pages/Home'
import Login from './pages/Login'
import CreateAccount from './pages/CreateAccount'
import AboutUs from './pages/AboutUs'
import SocialPortal from './pages/SocialPortal'
import DonatePaymentPage from './pages/DonatePaymentPage'
import DonorsPortal from './pages/DonorsPortal'
import MyContributions from './pages/MyContributions'
import ParticipantsPortal from './pages/ParticipantsPortal'
import Impact from './pages/Impact'
import PrivacyPolicy from './pages/PrivacyPolicy'

function RequireAuth({ children, staffOnly = false }: { children: React.ReactNode; staffOnly?: boolean }) {
  const token = localStorage.getItem('token')
  const role = localStorage.getItem('role')
  if (!token) return <Navigate to="/login" replace />
  if (staffOnly && role !== 'staff') return <Navigate to="/donors" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/impact" element={<Impact />} />
        <Route path="/donate/payment" element={<DonatePaymentPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />

        {/* Protected — must be logged in */}
        <Route path="/social" element={<RequireAuth staffOnly><SocialPortal /></RequireAuth>} />
        <Route path="/donors" element={<RequireAuth>{localStorage.getItem('role') === 'staff' ? <DonorsPortal /> : <MyContributions />}</RequireAuth>} />
        <Route path="/participants" element={<RequireAuth staffOnly><ParticipantsPortal /></RequireAuth>} />
      </Routes>
      <CookieBanner />
    </BrowserRouter>
  )
}

export default App
