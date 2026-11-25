import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/legal-page';
import { LEGAL, legalReady } from '@/lib/legal';

export const metadata = { title: 'Privacy Policy' };

export default function Privacy() {
  if (!legalReady) notFound();
  return (
    <LegalPage title="Privacy Policy">
      <p>EventDesk is software for event management companies to prepare quotations, manage bookings, send invoices and run their crews. It is operated by {LEGAL.operator} (&quot;we&quot;, &quot;us&quot;). This policy explains what information EventDesk holds, why, who it is shared with, and the choices you have.</p>

      <h2>Two kinds of information</h2>
      <p><b>Account information.</b> When a company signs up, we hold the details of the people who sign in: name, email address, phone number and role, and a scrambled (hashed) form of the password. We never store the password itself. If you sign in with Google, we receive your name, email address and Google account ID from Google.</p>
      <p><b>Business records.</b> Companies enter their own business information: company name, address, GSTIN and logo; their customers&apos; names, phone numbers, email addresses and cities; event details; quotations, bookings, invoices and payments; expenses and photos of bills; staff, crew attendance and wages; and suppliers. For the personal information of a company&apos;s customers and staff, the company decides what is entered and why. The company is responsible for that information, and we handle it only to run EventDesk for them.</p>

      <h2>How we use it</h2>
      <ul>
        <li>To sign you in and keep each company&apos;s records separate and private to that company.</li>
        <li>To show, calculate and print the quotations, invoices and reports you ask for.</li>
        <li>To send WhatsApp messages that your company triggers, such as a booking confirmation, a payment reminder or a receipt, to the phone number you entered.</li>
        <li>To send password reset emails when you ask for one.</li>
        <li>To keep the service secure, prevent misuse, and fix problems.</li>
      </ul>
      <p>We do not sell information, show advertising, or use your records to build marketing profiles.</p>

      <h2>Who we share it with</h2>
      <p>We use these service providers to run EventDesk. Each receives only what it needs for its task.</p>
      <ul>
        <li><b>Neon</b> stores the database, including logos and bill photos, on Amazon Web Services servers in Singapore.</li>
        <li><b>Cloudflare</b> hosts the website and passes each request to the app.</li>
        <li><b>Meta (WhatsApp Business Platform)</b> delivers WhatsApp messages: it receives the recipient&apos;s phone number and the message text.</li>
        <li><b>Resend</b> delivers password reset emails: it receives the email address and the message.</li>
        <li><b>Google</b> handles sign-in, only if you choose &quot;Continue with Google&quot;.</li>
      </ul>
      <p>We may also disclose information when the law requires it, for example in response to a valid order from a court or a government authority.</p>

      <h2>Cookies</h2>
      <p>EventDesk sets only the cookies needed to sign you in and protect forms from forgery. It does not use advertising cookies or analytics tracking.</p>

      <h2>How long we keep it</h2>
      <p>We keep a company&apos;s records while its account is open, so its history stays available. When a company asks us to close its account, we delete its records within 30 days, unless the law requires us to keep something longer. The database keeps a rolling recovery copy covering the previous 6 hours, so deleted records disappear from it within 6 hours of deletion. Our hosting providers keep short-lived technical logs, such as request times and error messages, for troubleshooting.</p>

      <h2>Security</h2>
      <p>Connections to EventDesk are encrypted (HTTPS). Passwords are stored only as hashes. Each company can see only its own records, and within a company each person sees only what their role allows. No system is perfectly secure. If we learn of a breach that affects your information, we will tell you and the authorities as the law requires.</p>

      <h2>Your choices and rights</h2>
      <p>The account owner can update company details in Settings and manage team logins in Team and roles at any time. You can ask us for a copy of your information, to correct it, or to delete it, by writing to <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. If you are a customer or staff member of a company that uses EventDesk, please contact that company first, because it controls those records; we will help it respond to you. If you are not satisfied with our answer, you may complain to the Data Protection Board of India.</p>

      <h2>Children</h2>
      <p>EventDesk is a business tool for people aged 18 and over. Companies should not enter information about children unless it is needed for their event and they have the consent of a parent or guardian.</p>

      <h2>Changes to this policy</h2>
      <p>If we change this policy, we will update the date at the top of this page. If the change is significant, we will also tell account owners by email or in the app before it takes effect.</p>

      <h2>Grievance officer</h2>
      <p>For any question or complaint about privacy, write to {LEGAL.operator} at <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. We will acknowledge your message within 48 hours and aim to resolve it within 30 days.</p>
    </LegalPage>
  );
}
