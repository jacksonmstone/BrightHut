import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { register } from '../api/auth'
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
  password: string
  confirmPassword: string
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

type CreateAccountLocationState = {
  fromDonation?: boolean
  prefillFirstName?: string
  prefillLastName?: string
  suggestSupporterType?: string
}

const emptyFormData: FormData = {
  supporterType: null,
  firstName: '',
  lastName: '',
  organizationName: '',
  email: '',
  password: '',
  confirmPassword: '',
  phone: '',
  country: '',
  region: '',
  relationshipType: '',
  acquisitionChannel: '',
}

function initialAccountState(state: unknown): {
  step: 'role-selection' | 'account-details'
  formData: FormData
} {
  const s = state as CreateAccountLocationState | null
  if (!s?.fromDonation) {
    return { step: 'role-selection', formData: { ...emptyFormData } }
  }
  const role = (s.suggestSupporterType as SupporterType) ?? 'MonetaryDonor'
  if (role === 'PartnerOrganization' || role === null) {
    return { step: 'role-selection', formData: { ...emptyFormData } }
  }
  return {
    step: 'account-details',
    formData: {
      ...emptyFormData,
      supporterType: role,
      firstName: s.prefillFirstName?.trim() ?? '',
      lastName: s.prefillLastName?.trim() ?? '',
    },
  }
}

export default function CreateAccount() {
  const location = useLocation()
  const navigate = useNavigate()
  const initial = initialAccountState(location.state)
  const [step, setStep] = useState<'role-selection' | 'account-details'>(initial.step)
  const [formData, setFormData] = useState<FormData>(initial.formData)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [formError, setFormError] = useState('')

  const fromDonationFlow = Boolean((location.state as CreateAccountLocationState | null)?.fromDonation)

  const isOrganization = formData.supporterType === 'PartnerOrganization'

  const handleRoleSelect = (roleId: string) => {
    setFormData({ ...formData, supporterType: roleId as SupporterType })
    setStep('account-details')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target
    setFormData({ ...formData, [name]: value })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFormError('')
    // Required selects / text (we use noValidate so this always runs — native HTML validation was blocking submit with no clear UI)
    if (!formData.supporterType) {
      setFormError('Please go back and choose how you would like to contribute.')
      return
    }
    if (!formData.email.trim()) {
      setFormError('Email is required.')
      return
    }
    if (!isOrganization && (!formData.firstName.trim() || !formData.lastName.trim())) {
      setFormError('First and last name are required.')
      return
    }
    if (isOrganization && !formData.organizationName.trim()) {
      setFormError('Organization name is required.')
      return
    }
    if (!formData.country.trim()) {
      setFormError('Country is required.')
      return
    }
    if (!formData.relationshipType) {
      setFormError('Please select a relationship type.')
      return
    }
    if (!formData.acquisitionChannel) {
      setFormError('Please tell us how you heard about BrightHut.')
      return
    }
    if (formData.password !== formData.confirmPassword) {
      setPasswordError('Passwords do not match.')
      return
    }
    if (formData.password.length < 12) {
      setPasswordError('Password must be at least 12 characters.')
      return
    }
    if (!/[A-Z]/.test(formData.password)) {
      setPasswordError('Password must include at least one uppercase letter.')
      return
    }
    if (!/[a-z]/.test(formData.password)) {
      setPasswordError('Password must include at least one lowercase letter.')
      return
    }
    if (!/[0-9]/.test(formData.password)) {
      setPasswordError('Password must include at least one number.')
      return
    }
    if (!/[^A-Za-z0-9]/.test(formData.password)) {
      setPasswordError('Password must include at least one special character.')
      return
    }
    if (/\s/.test(formData.password)) {
      setPasswordError('Password cannot contain spaces.')
      return
    }
    if (
      formData.email &&
      formData.password.toLowerCase().includes(formData.email.trim().toLowerCase().split('@')[0] ?? '')
    ) {
      setPasswordError('Password cannot contain your email name.')
      return
    }
    setPasswordError('')
    setSubmitError('')
    setSubmitting(true)
    try {
      const res = await register({
        email: formData.email,
        password: formData.password,
        firstName: formData.firstName || undefined,
        lastName: formData.lastName || undefined,
        organizationName: formData.organizationName || undefined,
        phone: formData.phone || undefined,
        country: formData.country || undefined,
        region: formData.region || undefined,
        relationshipType: formData.relationshipType || undefined,
        acquisitionChannel: formData.acquisitionChannel || undefined,
        supporterType: formData.supporterType || undefined,
      })
      localStorage.setItem('token', res.token)
      localStorage.setItem('role', res.role)
      localStorage.setItem('email', res.email)
      window.dispatchEvent(new Event('auth-change'))
      navigate('/')
    } catch (err: unknown) {
      setSubmitError(err instanceof Error ? err.message : 'Registration failed.')
    } finally {
      setSubmitting(false)
    }
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
          {fromDonationFlow ? (
            <p className="create-account-donation-note">
              You’re finishing setup after your gift. We’ve set your role to{' '}
              <strong>Monetary Donor</strong> and prefilled your name—add contact details below.
            </p>
          ) : null}
          <p>
            Role: <strong>{SUPPORTER_TYPES.find(t => t.id === formData.supporterType)?.label}</strong>
          </p>
        </div>

        <form className="create-account-form" onSubmit={handleSubmit} noValidate>
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
              Password
              <input
                type="password"
                name="password"
                className="form-input"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="12+ chars, upper/lower/number/symbol"
                required
              />
            </label>

            <label className="form-label">
              Confirm Password
              <input
                type="password"
                name="confirmPassword"
                className="form-input"
                value={formData.confirmPassword}
                onChange={handleInputChange}
                placeholder="Re-enter your password"
                required
              />
            </label>
            {passwordError && <p className="form-error">{passwordError}</p>}

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

          {(formError || submitError) && (
            <p className="form-error form-error--banner" role="alert">
              {formError || submitError}
            </p>
          )}
          <button type="submit" className="create-account-submit" disabled={submitting}>
            {submitting ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <p className="create-account-footer">
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </main>
  )
}
