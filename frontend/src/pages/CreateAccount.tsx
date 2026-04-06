import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import './CreateAccount.css'

type SupporterType = 'MonetaryDonor' | 'InKindDonor' | 'Volunteer' | 'SkillsContributor' | 'SocialMediaAdvocate' | 'PartnerOrganization' | null
type RelationshipType = 'Local' | 'International' | 'PartnerOrganization'
type AcquisitionChannel = 'Website' | 'SocialMedia' | 'Event' | 'WordOfMouth' | 'PartnerReferral' | 'Church'

interface FormData {
  supporterType: SupporterType
  firstName: string
  lastName: string
  organizationName: string
  email: string
  phone: string
  country: string
  region: string
  relationshipType: RelationshipType | ''
  acquisitionChannel: AcquisitionChannel | ''
}

const SUPPORTER_TYPES = [
  { id: 'MonetaryDonor', label: 'Monetary Donor', icon: '💰' },
  { id: 'InKindDonor', label: 'In-Kind Donor', icon: '📦' },
  { id: 'Volunteer', label: 'Volunteer', icon: '🤝' },
  { id: 'SkillsContributor', label: 'Skills Contributor', icon: '🎯' },
  { id: 'SocialMediaAdvocate', label: 'Social Media Advocate', icon: '📱' },
  { id: 'PartnerOrganization', label: 'Partner Organization', icon: '🏢' },
]

export default function CreateAccount() {
  const navigate = useNavigate()
  const [step, setStep] = useState<'role-selection' | 'account-details'>('role-selection')
  const [formData, setFormData] = useState<FormData>({
    supporterType: null,
    firstName: '',
    lastName: '',
    organizationName: '',
    email: '',
    phone: '',
    country: '',
    region: '',
    relationshipType: '',
    acquisitionChannel: '',
  })

  const isOrganization = formData.supporterType === 'PartnerOrganization'

  const handleRoleSelect = (roleId: string) => {
    setFormData({ ...formData, supporterType: roleId as SupporterType })
    setStep('account-details')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // TODO: connect to backend
    console.log('Form data:', formData)
    alert('Account creation in progress - backend connection coming soon!')
  }

  const handleBack = () => {
    setStep('role-selection')
  }

  if (step === 'role-selection') {
    return (
      <main className="create-account-page">
        <div className="create-account-card">
          <div className="create-account-header">
            <h1>Join BrightHut</h1>
            <p>Choose your role to get started</p>
            <p className="subtitle">We support many types of contributors</p>
          </div>

          <div className="role-selection-grid">
            {SUPPORTER_TYPES.map((role) => (
              <button
                key={role.id}
                className="role-button"
                onClick={() => handleRoleSelect(role.id)}
              >
                <span className="role-icon">{role.icon}</span>
                <span className="role-label">{role.label}</span>
              </button>
            ))}
          </div>

          <p className="create-account-footer">
            Already have an account? <Link to="/login">Sign in</Link>
          </p>
        </div>
      </main>
    )
  }

  return (
    <main className="create-account-page">
      <div className="create-account-card">
        <div className="create-account-header">
          <button className="back-button" onClick={handleBack}>← Back</button>
          <h1>Create Your Account</h1>
          <p>
            Role: <strong>{SUPPORTER_TYPES.find(t => t.id === formData.supporterType)?.label}</strong>
          </p>
        </div>

        <form className="create-account-form" onSubmit={handleSubmit}>
          {/* Name/Organization Section */}
          <fieldset className="form-section">
            <legend>{isOrganization ? 'Organization Information' : 'Personal Information'}</legend>
            
            {isOrganization ? (
              <label className="form-label">
                Organization Name
                <input
                  type="text"
                  name="organizationName"
                  className="form-input"
                  value={formData.organizationName}
                  onChange={handleInputChange}
                  placeholder="Your organization name"
                  required
                />
              </label>
            ) : (
              <>
                <label className="form-label">
                  First Name
                  <input
                    type="text"
                    name="firstName"
                    className="form-input"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    placeholder="First name"
                    required
                  />
                </label>
                <label className="form-label">
                  Last Name
                  <input
                    type="text"
                    name="lastName"
                    className="form-input"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    placeholder="Last name"
                    required
                  />
                </label>
              </>
            )}
          </fieldset>

          {/* Contact Information Section */}
          <fieldset className="form-section">
            <legend>Contact Information</legend>
            
            <label className="form-label">
              Email Address
              <input
                type="email"
                name="email"
                className="form-input"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="you@example.com"
                required
              />
            </label>
            
            <label className="form-label">
              Phone Number
              <input
                type="tel"
                name="phone"
                className="form-input"
                value={formData.phone}
                onChange={handleInputChange}
                placeholder="+1 (555) 123-4567"
              />
            </label>
          </fieldset>

          {/* Location Information Section */}
          <fieldset className="form-section">
            <legend>Location</legend>
            
            <label className="form-label">
              Country
              <input
                type="text"
                name="country"
                className="form-input"
                value={formData.country}
                onChange={handleInputChange}
                placeholder="Country"
                required
              />
            </label>
            
            <label className="form-label">
              Region / State
              <input
                type="text"
                name="region"
                className="form-input"
                value={formData.region}
                onChange={handleInputChange}
                placeholder="Region or state"
              />
            </label>
            
            <label className="form-label">
              Relationship Type
              <select
                name="relationshipType"
                className="form-input"
                value={formData.relationshipType}
                onChange={handleInputChange}
                required
              >
                <option value="">Select relationship type</option>
                <option value="Local">Local</option>
                <option value="International">International</option>
                <option value="PartnerOrganization">Partner Organization</option>
              </select>
            </label>
          </fieldset>

          {/* How did you hear about us */}
          <fieldset className="form-section">
            <legend>How did you hear about us?</legend>
            
            <label className="form-label">
              Acquisition Channel
              <select
                name="acquisitionChannel"
                className="form-input"
                value={formData.acquisitionChannel}
                onChange={handleInputChange}
                required
              >
                <option value="">Select how you found us</option>
                <option value="Website">Website</option>
                <option value="SocialMedia">Social Media</option>
                <option value="Event">Event</option>
                <option value="WordOfMouth">Word of Mouth</option>
                <option value="PartnerReferral">Partner Referral</option>
                <option value="Church">Church</option>
              </select>
            </label>
          </fieldset>

          <button type="submit" className="create-account-submit">Create Account</button>
        </form>

        <p className="create-account-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
