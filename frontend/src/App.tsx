import { BrowserRouter, Navigate, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import PageTransition from './components/PageTransition'
import CookieBanner from './components/CookieBanner'
import Home from './pages/Home'
import Login from './pages/Login'
import CreateAccount from './pages/CreateAccount'
import AboutUs from './pages/AboutUs'
import SocialPortal from './pages/SocialPortal'
import DonatePaymentPage from './pages/DonatePaymentPage'
import DonorsPortal from './pages/DonorsPortal'
import MyContributions from './pages/MyContributions'
import AdminDashboard from './pages/AdminDashboard'
import ResidentDetail from './pages/ResidentDetail'
import ParticipantsPortal from './pages/ParticipantsPortal'
import Impact from './pages/Impact'
import PrivacyPolicy from './pages/PrivacyPolicy'
import Analytics from './pages/Analytics'

function RequireAuth({ children, roles }: { children: React.ReactNode; roles?: string[] }) {
  const token = localStorage.getItem('token')
  const role = (localStorage.getItem('role') ?? '').toLowerCase()
  if (!token) return <Navigate to="/login" replace />
  if (roles && !roles.includes(role)) return <Navigate to="/" replace />
  return <>{children}</>
}

function App() {
  return (
    <BrowserRouter>
      <PageTransition />
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <Navbar />
      <div id="main-content" tabIndex={-1}>
        <Routes>
        {/* Public */}
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/impact" element={<Impact />} />
        <Route path="/donate/payment" element={<DonatePaymentPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/social" element={<SocialPortal />} />

        {/* Protected — must be logged in */}
        <Route path="/dashboard" element={<RequireAuth roles={['staff', 'admin']}><AdminDashboard /></RequireAuth>} />
        <Route
          path="/donors"
          element={
            <RequireAuth roles={['donor', 'staff', 'admin']}>
              {['staff', 'admin'].includes((localStorage.getItem('role') ?? '').toLowerCase()) ? <DonorsPortal /> : <MyContributions />}
            </RequireAuth>
          }
        />
        <Route path="/participants" element={<RequireAuth roles={['staff', 'admin']}><ParticipantsPortal /></RequireAuth>} />
        <Route path="/participants/:id" element={<RequireAuth roles={['staff', 'admin']}><ResidentDetail /></RequireAuth>} />
        <Route path="/analytics" element={<RequireAuth roles={['staff', 'admin']}><Analytics /></RequireAuth>} />
        </Routes>
      </div>
      <CookieBanner />
    </BrowserRouter>
  )
}

export default App
