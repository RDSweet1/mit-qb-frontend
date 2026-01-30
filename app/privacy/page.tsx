export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
        <p className="text-sm text-gray-600 mb-8">Last Updated: January 29, 2026</p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">1. Information We Collect</h2>
          <p className="text-gray-700 mb-3">
            The MIT QuickBooks Timesheet & Billing System collects and processes the following information:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>QuickBooks Online time entry data from QB Workforce</li>
            <li>Customer and service item information from your QuickBooks account</li>
            <li>Invoice and payment data for billing purposes</li>
            <li>User authentication information via Microsoft Azure AD</li>
            <li>Email addresses for report delivery</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">2. How We Use Your Information</h2>
          <p className="text-gray-700 mb-3">We use your information to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Generate weekly time reports for your clients</li>
            <li>Create and manage invoices in QuickBooks Online</li>
            <li>Track billing and payment status</li>
            <li>Send automated email reports to designated recipients</li>
            <li>Provide you with customer service and support</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">3. Data Storage and Security</h2>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Data is stored securely using Supabase (PostgreSQL database)</li>
            <li>QuickBooks OAuth tokens are stored in Azure Key Vault</li>
            <li>All connections use HTTPS/TLS encryption</li>
            <li>We follow industry-standard security practices</li>
            <li>We do NOT store your QuickBooks credentials</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">4. Data Sharing</h2>
          <p className="text-gray-700 mb-3">
            We do not sell, trade, or rent your personal information to third parties.
            We only share data with:
          </p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>QuickBooks Online (via official Intuit APIs)</li>
            <li>Microsoft Azure (for authentication)</li>
            <li>Email service providers (for report delivery)</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">5. Your Rights</h2>
          <p className="text-gray-700 mb-3">You have the right to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Access your data at any time</li>
            <li>Request data deletion</li>
            <li>Disconnect the QuickBooks integration at any time</li>
            <li>Export your data</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">6. QuickBooks Integration</h2>
          <p className="text-gray-700 mb-3">
            This application uses QuickBooks Online OAuth 2.0 for secure authentication.
            You can revoke access at any time from your QuickBooks account settings.
            We only access data necessary for time tracking and billing functionality.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">7. Data Retention</h2>
          <p className="text-gray-700">
            We retain your data for as long as your account is active or as needed to
            provide services. You may request deletion of your data at any time.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">8. Contact Us</h2>
          <p className="text-gray-700">
            For privacy-related questions or concerns, contact us at:
          </p>
          <p className="text-gray-700 mt-2">
            Email: accounting@mitigationconsulting.com<br />
            Phone: 813-962-6855<br />
            Address: MIT Consulting, Tampa, FL
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">9. Changes to This Policy</h2>
          <p className="text-gray-700">
            We may update this privacy policy from time to time. We will notify you of
            any changes by posting the new policy on this page and updating the "Last Updated" date.
          </p>
        </section>
      </div>
    </div>
  );
}
