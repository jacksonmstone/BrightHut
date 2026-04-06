import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home'
import Login from './pages/Login'
import CreateAccount from './pages/CreateAccount'
import AboutUs from './pages/AboutUs'
import SocialPortal from './pages/SocialPortal'
import DonorsPortal from './pages/DonorsPortal'
import ParticipantsPortal from './pages/ParticipantsPortal'

function App() {
  return (
    <BrowserRouter>
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/about" element={<AboutUs />} />
        <Route path="/social" element={<SocialPortal />} />
        <Route path="/donors" element={<DonorsPortal />} />
        <Route path="/participants" element={<ParticipantsPortal />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
