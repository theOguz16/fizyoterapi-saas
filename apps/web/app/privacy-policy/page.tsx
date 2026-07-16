import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Fizyoflow",
  description: "Privacy policy for the Fizyoflow mobile app, website, admin panel, and clinic pages.",
  alternates: { canonical: "/privacy-policy" },
};

export default function PrivacyPolicyEnPage() {
  return (
    <main className="legal-page">
      <section className="container legal-panel">
        <a className="brand" href="/"><span className="brand-mark"><img src="/brand/fizyoflow-current-mark.png" alt="" /></span><span>Fizyoflow</span></a>
        <p className="eyebrow">Privacy Policy EN</p>
        <h1>Fizyoflow Privacy Policy</h1>
        <p>
          This privacy policy applies to the Fizyoflow mobile application, website, admin panel, and public clinic pages
          developed by Oğuz Han UYAR for mobile and web devices (together, the &quot;App&quot; or the &quot;Service&quot;). Fizyoflow provides
          digital clinic management infrastructure for physiotherapy clinics, clinical pilates studios, trainers, and
          members.
        </p>
        <p>
          This policy is effective as of May 26, 2026. Some parts of the Service may be used on behalf of a clinic or
          business account. In those cases, the clinic may also act as a data controller or processor for its own clients
          and staff.
        </p>

        <h2>What information does the App obtain and how is it used?</h2>
        <p>
          Fizyoflow may process information you provide during registration, login, clinic applications, salon joining,
          bookings, packages, payment requests, measurements, notification settings, and support flows. This may include
          name, email, phone number, encrypted session information, role, clinic name, city/district, address, working
          hours, trainer information, package and membership records, booking and attendance records, campaign or lead form
          notes, and in-app activity history.
        </p>
        <p>
          Measurement, progress, and session notes entered by members or recorded by clinic/trainer accounts are processed
          only to provide the Service, run clinic operations, and deliver the user experience. Fizyoflow does not provide
          emergency healthcare, diagnosis, or treatment services; the relevant clinic or professional is responsible for
          the healthcare service itself.
        </p>

        <h2>What information is collected automatically?</h2>
        <p>
          The Service may automatically collect technical data such as device type, operating system, app version, IP
          address, approximate connection region, error logs, performance metrics, session security records, device push
          notification tokens, page views, and feature usage data. This information is used for security, troubleshooting,
          notifications, abuse prevention, and product performance improvements.
        </p>

        <h2>Does the App process location data?</h2>
        <p>
          Fizyoflow may process location-like preferences such as city or district selections to support clinic discovery,
          public clinic pages, map directions, and relevant clinic recommendations. Precise real-time GPS location is not
          collected unless a specific in-app permission flow is shown and accepted. When map, routing, or location links
          open third-party map services, those services may apply their own privacy terms.
        </p>

        <h2>Notifications and device permissions</h2>
        <p>
          The App may ask for notification permission to send booking, package, approval, group class, risk, and account
          security alerts. You can manage notifications from your device settings or from the notification settings screen
          in the App. QR scanning, gallery, or camera permissions are requested only when needed for the relevant feature.
        </p>

        <h2>Payments and subscriptions</h2>
        <p>
          Fizyoflow may process payment status, plan information, transaction references, and invoice/subscription status
          for clinic packages, membership plans, or mobile subscription flows. Sensitive payment details such as full card
          numbers are not stored on Fizyoflow servers; payments and subscriptions are handled by the applicable app store,
          payment provider, or third-party service under their own security standards.
        </p>

        <h2>Does the App use artificial intelligence?</h2>
        <p>
          Fizyoflow&apos;s current Service focuses on booking, package, clinic page, lead, notification, and operations
          management. If an AI-powered feature is enabled in the App, the data sent to the relevant provider and the
          consent flow will be described in this policy or in the relevant feature screen.
        </p>

        <h2>Do third parties access information?</h2>
        <p>
          Fizyoflow may use cloud hosting, database, error monitoring, analytics, notification, email, payment, app store,
          and map service providers to operate the Service. These providers process data only for service delivery,
          security, measurement, and support purposes. Information submitted through public clinic pages or lead forms may
          be shared with the relevant clinic so they can respond to your request.
        </p>
        <p>
          Information may also be disclosed when required to comply with legal obligations, respond to court or authority
          requests, protect our rights, investigate fraud or security issues, or protect users.
        </p>

        <h2>Analytics and cookies</h2>
        <p>
          On the website and public clinic pages, analytics tools such as GA4, PostHog, or similar services run only after
          consent, except for mandatory security records. Analytics is used to understand traffic sources, CTA clicks, form
          conversions, and product performance. You can manage cookie choices through browser settings or the cookie banner.
        </p>

        <h2>What are my opt-out rights?</h2>
        <p>
          You can stop new data collection from the mobile App by uninstalling it from your device. You can disable
          notifications in device settings, reject analytics cookies, and opt out of marketing communications. For account
          or data requests, contact us through the support channel.
        </p>

        <h2>Data retention</h2>
        <p>
          Account, clinic, booking, package, payment status, and operational records are retained while you use the Service
          and for a reasonable period required by legal, contractual, or legitimate business needs. Automatic technical
          records and security logs may generally be retained for up to 24 months and may then be stored in anonymized or
          aggregated form.
        </p>

        <h2>How can I delete my account and data?</h2>
        <p>
          You can request deletion of your account and personal data stored in Fizyoflow systems by emailing
          destek@fizyoflow.com with the subject line &quot;Fizyoflow account deletion request&quot;. After identity verification and
          scope review, data associated with your account will be deleted within a reasonable period, except for records
          that must be retained for legal obligations. See the <a href="/hesap-silme">Account Deletion</a> page for details.
        </p>

        <h2>Children&apos;s privacy</h2>
        <p>
          Fizyoflow is not directed to children under 13 and does not knowingly collect personal data from children under
          13. If we become aware that such data has been processed, we will delete it within a reasonable period. Parents or
          guardians can contact us at destek@fizyoflow.com.
        </p>

        <h2>Security</h2>
        <p>
          Fizyoflow uses authorization, access control, encryption, secure session management, backups, logging, and
          procedural safeguards to protect processed data. However, no internet transmission or electronic storage method
          can be guaranteed to be completely secure.
        </p>

        <h2>Changes</h2>
        <p>
          This privacy policy may be updated from time to time. The current version will be published on this page.
          Continuing to use the Service may mean that you accept the data processing activities described in the active
          policy.
        </p>

        <h2>Contact</h2>
        <p>
          For privacy, account deletion, or App practice questions, contact the Service Provider at destek@fizyoflow.com.
        </p>

        <p>
          Turkish version: <a href="/gizlilik-politikasi">Gizlilik Politikası TR</a>
        </p>
      </section>
    </main>
  );
}
