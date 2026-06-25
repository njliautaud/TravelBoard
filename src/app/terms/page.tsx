import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — TravelBoard",
};

export default function TermsOfService() {
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

        <h1 className="text-3xl font-bold text-amber-400">Terms of Service</h1>
        <p className="mt-2 text-sm text-slate-500">Last updated: June 24, 2026</p>

        <div className="mt-8 space-y-8 text-sm leading-relaxed text-slate-300">
          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">1. Acceptance of Terms</h2>
            <p className="text-slate-400">
              By accessing or using TravelBoard, you agree to be bound by these Terms of Service. If you do not agree to
              these terms, please do not use the service. We may update these terms from time to time, and continued use
              of TravelBoard constitutes acceptance of any changes.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">2. Description of Service</h2>
            <p className="text-slate-400">
              TravelBoard is a travel planning application that allows you to save destinations, keep a travel journal,
              search for flights, track deals, and organize your travel plans. TravelBoard is <strong className="text-slate-300">not a travel agency</strong> and
              does not sell, book, or guarantee any travel services, accommodations, or transportation.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">3. Account Responsibilities</h2>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li>You are responsible for maintaining the security of your account credentials.</li>
              <li>You must provide accurate and complete information when creating your account.</li>
              <li>You are responsible for all activity that occurs under your account.</li>
              <li>You must notify us immediately if you suspect unauthorized access to your account.</li>
              <li>You must be at least 13 years of age to use TravelBoard.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">4. Acceptable Use</h2>
            <p className="mb-2 text-slate-400">You agree not to:</p>
            <ul className="list-disc space-y-1 pl-5 text-slate-400">
              <li>Use the service for any unlawful purpose or in violation of any applicable laws.</li>
              <li>Attempt to gain unauthorized access to the service, other accounts, or our systems.</li>
              <li>Interfere with or disrupt the service or servers connected to the service.</li>
              <li>Scrape, crawl, or use automated means to access the service without permission.</li>
              <li>Upload malicious content or attempt to exploit vulnerabilities in the platform.</li>
              <li>Impersonate another person or misrepresent your affiliation with any entity.</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">5. User Content</h2>
            <p className="text-slate-400">
              You retain ownership of all content you create on TravelBoard, including journal entries, notes, and saved
              locations. By using the service, you grant us a limited license to store, display, and process your content
              solely to provide the service to you. We do not claim any intellectual property rights over your content.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">6. Intellectual Property</h2>
            <p className="text-slate-400">
              The TravelBoard application, including its design, code, logos, and branding, is the intellectual property
              of TravelBoard and its licensors. You may not copy, modify, distribute, or reverse-engineer any part of
              the service without prior written permission.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">7. Flight Data & Pricing Disclaimer</h2>
            <p className="text-slate-400">
              Flight prices, availability, and deal information displayed on TravelBoard are sourced from third-party
              providers and are <strong className="text-slate-300">estimates only</strong>. Prices may change at any time and may differ from what is shown
              when you visit the airline or booking site. TravelBoard does not guarantee the accuracy, completeness, or
              timeliness of any pricing information. Always verify prices directly with the airline or booking provider
              before making any purchase.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">8. Disclaimers</h2>
            <p className="text-slate-400">
              TravelBoard is provided &ldquo;as is&rdquo; and &ldquo;as available&rdquo; without warranties of any kind, either express or
              implied, including but not limited to implied warranties of merchantability, fitness for a particular
              purpose, and non-infringement. We do not warrant that the service will be uninterrupted, error-free, or
              secure.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">9. Limitation of Liability</h2>
            <p className="text-slate-400">
              To the maximum extent permitted by law, TravelBoard and its operators shall not be liable for any indirect,
              incidental, special, consequential, or punitive damages, including but not limited to loss of profits, data,
              or goodwill, arising from your use of or inability to use the service. Our total liability for any claim
              arising from these terms shall not exceed the amount you have paid us in the twelve months preceding the claim,
              or $100, whichever is greater.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">10. Termination</h2>
            <p className="text-slate-400">
              We reserve the right to suspend or terminate your account at any time if you violate these Terms of Service
              or engage in conduct that we determine is harmful to the service or other users. You may delete your account
              at any time through the Settings page. Upon termination, your data will be handled in accordance with our{" "}
              <Link href="/privacy" className="text-amber-400 underline decoration-amber-400/30 hover:decoration-amber-400">
                Privacy Policy
              </Link>.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">11. Governing Law</h2>
            <p className="text-slate-400">
              These Terms of Service shall be governed by and construed in accordance with the laws of the United States,
              without regard to conflict of law principles. Any disputes arising from these terms shall be resolved in the
              courts of competent jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold text-amber-400/90">12. Contact Us</h2>
            <p className="text-slate-400">
              If you have questions about these Terms of Service, contact us at{" "}
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
