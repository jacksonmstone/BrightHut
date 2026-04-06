import { useNavigate } from 'react-router-dom'
import './PlaceholderPage.css'

interface Props {
  icon: string
  title: string
  description: string
  color: string
}

export default function PlaceholderPage({ icon, title, description, color }: Props) {
  const navigate = useNavigate()

  return (
    <main className="placeholder-page">
      <div className={`placeholder-card placeholder-card--${color}`}>
        <span className="placeholder-icon">{icon}</span>
        <h1>{title}</h1>
        <p>{description}</p>
        <p className="coming-soon">This section is coming soon.</p>
        <button className="back-btn" onClick={() => navigate('/')}>
          ← Back to Home
        </button>
      </div>
    </main>
  )
}
