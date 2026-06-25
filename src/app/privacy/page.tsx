import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — TravelBoard",
};

export default function PrivacyPolicy() {
  return (
    <div className="min-h-dvh bg-slate-950 text-slate-200">
      <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
        <Link
          href="/"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-slate-400 transition hover:text-amber-400"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <path d="m12 19-7-7 7-7" />
          </svg>
          Back
        </Link>

        <h1 className="text-3xl font-bold text-amber-400">Privacy Policy</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: June 24, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">1. Information We Collect</h2>
            <p className="mb-2">When you use TravelBoard, we may collect the following information:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li><span className="text-slate-300">Account information</span> — name, email address, and profile photo provided during sign-up.</li>
              <li><span className="text-slate-300">Travel preferences</span> — preferred currencies, distance units, temperature units, and notification settings.</li>
              <li><span className="text-slate-300">Saved locations</span> — places you add to your wishlist or mark as visited, including coordinates and personal notes.</li>
              <li><span className="text-slate-300">Journal entries</span> — travel journal content, photos, and associated metadata you create within the app.</li>
              <li><span className="text-slate-300">Flight searches</span> — origin, destination, dates, and passenger details you enter when searching for flights.</li>
              <li><span className="text-slate-300">Usage data</span> — pages visited, features used, and general interaction patterns to improve the service.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">2. How We Use Your Information</h2>
            <p className="mb-2">We use the information we collect to:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li>Provide, maintain, and improve the TravelBoard service.</li>
              <li>Personalize your experience, including travel recommendations and deal alerts.</li>
              <li>Process flight searches and display relevant pricing information.</li>
              <li>Send service-related notifications (e.g., price alerts, account updates).</li>
              <li>Analyze usage patterns to improve features and fix issues.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">3. Third-Party Services</h2>
            <p className="mb-2">TravelBoard integrates with the following third-party services:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li><span className="text-slate-300">Clerk</span> — handles authentication and account management. Clerk processes your email, name, and login credentials. See <a href="https://clerk.com/privacy" target="_blank" rel="noopener noreferrer" className="text-amber-400 underline decoration-amber-400/30 hover:decoration-amber-400">Clerk&apos;s Privacy Policy</a>.</li>
              <li><span className="text-slate-300">Flight data APIs</span> — when you search for flights, your search parameters (origin, destination, dates) are sent to third-party flight data providers to retrieve pricing and availability.</li>
              <li><span className="text-slate-300">Map services</span> — map tiles and geocoding are provided by third-party mapping services.</li>
            </ul>
            <p className="mt-2 text-slate-400">We do not sell your personal information to any third party.</p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">4. Data Retention</h2>
            <p className="text-slate-400">
              We retain your data for as long as your account is active. If you delete your account, all associated data
              (saved locations, journal entries, preferences, and search history) will be permanently removed from our
              servers within 30 days. Backup copies may persist for up to 90 days before being purged.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">5. Your Rights</h2>
            <p className="mb-2">You have the right to:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li><span className="text-slate-300">Export your data</span> — download all your TravelBoard data in JSON or CSV format from the Settings page.</li>
              <li><span className="text-slate-300">Delete your account</span> — permanently remove your account and all associated data from the Settings page.</li>
              <li><span className="text-slate-300">Access your data</span> — view all information we store about you through the app interface.</li>
              <li><span className="text-slate-300">Correct your data</span> — update your profile, preferences, and saved locations at any time.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">6. Cookies & Local Storage</h2>
            <p className="text-slate-400">
              TravelBoard uses cookies and browser local storage to maintain your session, remember your preferences, and
              provide a smooth user experience. Authentication tokens are stored securely via Clerk. We do not use
              third-party advertising or tracking cookies.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">7. Security</h2>
            <p className="text-slate-400">
              We implement industry-standard security measures to protect your data, including encrypted connections (HTTPS),
              secure authentication via Clerk, and access controls on our infrastructure. However, no method of
              transmission over the Internet is 100% secure, and we cannot guarantee absolute security.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">8. Changes to This Policy</h2>
            <p className="text-slate-400">
              We may update this Privacy Policy from time to time. We will notify you of any material changes by posting
              the updated policy on this page and updating the &ldquo;Last updated&rdquo; date.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">9. Contact Us</h2>
            <p className="text-slate-400">
              If you have questions about this Privacy Policy or your data, contact us at{" "}
              <a href="mailto:relentlessrobotics@gmail.com" className="text-amber-400 underline decoration-amber-400/30 hover:decoration-amber-400">
                relentlessrobotics@gmail.com
              </a>.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
