import './PrivacyPolicy.css'

export default function PrivacyPolicy() {
  return (
    <main className="privacy-page">
      <section className="privacy-card">
        <h1>Privacy Policy</h1>
        <p className="privacy-updated">Last updated: April 6, 2026</p>

        <h2>1. Who we are</h2>
        <p>
          BrightHut supports residents, donors, and community partners through social programs and
          digital services. This Privacy Policy explains how BrightHut collects, uses, and protects
          personal information when you use our website and services.
        </p>

        <h2>2. Information we collect</h2>
        <ul>
          <li>Account details (such as email and login metadata when authentication is enabled).</li>
          <li>Program records needed to support participants and case management workflows.</li>
          <li>Donation and supporter information for reporting and service operations.</li>
          <li>Technical data such as browser type, access logs, and security events.</li>
          <li>Cookie consent preference (Accept or Decline) saved in your browser.</li>
        </ul>

        <h2>3. How we use your information</h2>
        <ul>
          <li>Deliver and improve BrightHut services.</li>
          <li>Protect accounts, systems, and data from misuse.</li>
          <li>Generate internal analytics and impact reports.</li>
          <li>Meet legal, safeguarding, and compliance obligations.</li>
        </ul>

        <h2>4. Legal basis (GDPR)</h2>
        <p>
          Depending on context, BrightHut processes personal data based on consent, legitimate
          interests, contract performance, and legal obligations.
        </p>

        <h2>5. Data sharing and retention</h2>
        <p>
          We do not sell personal data. We may share data with authorized service providers,
          safeguarding partners, and regulators where required by law. Data is retained only as long
          as necessary for service delivery, legal compliance, and protection of vulnerable groups.
        </p>

        <h2>6. Your rights</h2>
        <p>
          Where applicable, you may request access, correction, deletion, restriction, objection, or
          portability of your data, and you may withdraw consent at any time. You may also lodge a
          complaint with your local data protection authority.
        </p>

        <h2>7. Cookies</h2>
        <p>
          BrightHut currently uses a consent cookie to remember your banner choice. This setup is
          currently <strong>cosmetic</strong>: your Accept/Decline state is stored, but optional
          analytics or marketing cookies are not yet conditionally enabled.
        </p>

        <h2>8. Contact</h2>
        <p>
          For privacy requests, contact BrightHut at <a href="mailto:privacy@brighthut.org">privacy@brighthut.org</a>.
        </p>
      </section>
    </main>
  )
}
