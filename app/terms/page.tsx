export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-4xl mx-auto bg-white rounded-lg shadow-md p-8">
        <h1 className="text-3xl font-bold mb-6">End-User License Agreement</h1>
        <p className="text-sm text-gray-600 mb-8">Last Updated: January 29, 2026</p>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">1. Agreement to Terms</h2>
          <p className="text-gray-700">
            By accessing and using the MIT QuickBooks Timesheet & Billing System ("the Service"),
            you agree to be bound by these Terms of Service. If you do not agree to these terms,
            do not use the Service.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">2. License Grant</h2>
          <p className="text-gray-700 mb-3">
            MIT Consulting grants you a limited, non-exclusive, non-transferable license to use
            the Service for your internal business purposes, subject to these terms.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">3. Service Description</h2>
          <p className="text-gray-700 mb-3">The Service provides:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Integration with QuickBooks Online for time entry synchronization</li>
            <li>Weekly time report generation for clients</li>
            <li>Monthly invoice creation and tracking</li>
            <li>Automated email delivery of reports</li>
            <li>Billing and payment status tracking</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">4. User Responsibilities</h2>
          <p className="text-gray-700 mb-3">You agree to:</p>
          <ul className="list-disc pl-6 text-gray-700 space-y-2">
            <li>Provide accurate and complete information</li>
            <li>Maintain the security of your account credentials</li>
            <li>Use the Service in compliance with all applicable laws</li>
            <li>Not attempt to reverse engineer or compromise the Service</li>
            <li>Not use the Service for any unlawful purpose</li>
          </ul>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">5. QuickBooks Integration</h2>
          <p className="text-gray-700">
            This Service integrates with QuickBooks Online via official Intuit APIs.
            You must have a valid QuickBooks Online subscription and authorize the connection.
            You can revoke access at any time through your QuickBooks account settings.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">6. Data Ownership</h2>
          <p className="text-gray-700">
            You retain all ownership rights to your data. MIT Consulting does not claim
            ownership of any data you submit or generate through the Service. We only
            process your data to provide the Service functionality.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">7. Limitation of Liability</h2>
          <p className="text-gray-700">
            The Service is provided "as is" without warranties of any kind. MIT Consulting
            shall not be liable for any indirect, incidental, special, or consequential damages
            arising from your use of the Service.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">8. Service Availability</h2>
          <p className="text-gray-700">
            We strive to maintain high availability but do not guarantee uninterrupted access.
            Scheduled maintenance will be communicated in advance when possible.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">9. Termination</h2>
          <p className="text-gray-700">
            Either party may terminate this agreement at any time. Upon termination, you will
            cease using the Service and may request deletion of your data.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">10. Changes to Terms</h2>
          <p className="text-gray-700">
            We reserve the right to modify these terms at any time. Continued use of the
            Service after changes constitutes acceptance of the modified terms.
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">11. Support</h2>
          <p className="text-gray-700">
            For technical support or questions about these terms, contact:
          </p>
          <p className="text-gray-700 mt-2">
            Email: accounting@mitigationconsulting.com<br />
            Phone: 813-962-6855
          </p>
        </section>

        <section className="mb-6">
          <h2 className="text-xl font-semibold mb-3">12. Governing Law</h2>
          <p className="text-gray-700">
            These terms shall be governed by the laws of the State of Florida, United States,
            without regard to conflict of law provisions.
          </p>
        </section>
      </div>
    </div>
  );
}
