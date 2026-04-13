import React from 'react';
import Link from 'next/link';

export default function PrivacyPolicy() {
  return (
    <main className="min-h-screen py-10 px-6 max-w-3xl mx-auto" style={{ color: 'var(--text-1)' }}>
      <div className="mb-8">
        <Link href="/" className="text-sm font-semibold mb-6 inline-block" style={{ color: 'var(--accent)' }}>
          &larr; Back to Home
        </Link>
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-sm" style={{ color: 'var(--text-3)' }}>Last Updated: {new Date().toLocaleDateString()}</p>
      </div>

      <div className="space-y-6 text-sm leading-relaxed" style={{ color: 'var(--text-2)' }}>
        <section>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-1)' }}>1. Introduction</h2>
          <p>
            Welcome to Hariprabodham. We are committed to protecting your personal information and your right to privacy. 
            If you have any questions or concerns about our policy or our practices with regards to your personal 
            information, please contact us.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-1)' }}>2. Information We Collect</h2>
          <p>
            We collect personal information that you provide to us, such as your email address, name, and profile picture 
            when you register for an account using Google OAuth. This is used solely for the purpose of identifying you 
            within your household and providing the relevant application features.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-1)' }}>3. How We Use Your Information</h2>
          <p>
            We use personal information collected via our App for a variety of business purposes described below. 
            We process your personal information for these purposes in reliance on our legitimate business interests, 
            in order to enter into or perform a contract with you, with your consent, and/or for compliance with our legal obligations.
            <br/><br/>
            Specifically, we use the information to:
          </p>
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>Facilitate account creation and logon process.</li>
            <li>Manage household configurations (such as laundry, seva, garbage collection).</li>
            <li>Send administrative information to you.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-1)' }}>4. Sharing Your Information</h2>
          <p>
            We do not share, sell, rent, or trade your information with third parties for their promotional purposes.
            Your information is only visible to other authenticated members within the same configured household application.
          </p>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--text-1)' }}>5. Security of Your Information</h2>
          <p>
            We use administrative, technical, and physical security measures to help protect your personal information. 
            While we have taken reasonable steps to secure the personal information you provide to us, please be aware that 
            despite our efforts, no security measures are perfect or impenetrable, and no method of data transmission can be 
            guaranteed against any interception or other type of misuse.
          </p>
        </section>

      </div>
    </main>
  );
}
