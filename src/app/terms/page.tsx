import { notFound } from 'next/navigation';
import { LegalPage } from '@/components/legal-page';
import { LEGAL, legalReady } from '@/lib/legal';
import { PLAN_MATRIX } from '@/lib/plans';

export const metadata = { title: 'Terms and Conditions' };

export default function Terms() {
  if (!legalReady) notFound();
  const price = PLAN_MATRIX.find(r => r[0] === 'Monthly price')!;
  return (
    <LegalPage title="Terms and Conditions">
      <p>These terms are an agreement between {LEGAL.operator} (&quot;we&quot;, &quot;us&quot;) and the company that creates an EventDesk account (&quot;you&quot;). By creating an account or using EventDesk, you accept these terms on behalf of your company. The person who accepts them confirms they have authority to do so.</p>

      <h2>1. The service</h2>
      <p>EventDesk is online software for event management companies. It lets you prepare quotations, share them with your customers, turn accepted quotations into bookings, issue invoices, record payments and expenses, manage staff and crews, and print reports. Features depend on your plan, as shown on the Plan page in Settings.</p>

      <h2>2. Your account</h2>
      <ul>
        <li>Give accurate details when you sign up, and keep them up to date.</li>
        <li>Keep passwords private. Each team member must use their own login.</li>
        <li>You are responsible for what is done through your company&apos;s logins, including the roles you give your team.</li>
        <li>Tell us straight away at <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a> if you think someone has used your account without permission.</li>
      </ul>

      <h2>3. Plans and fees</h2>
      <p>EventDesk has three plans: Basic ({price[1]} a month), Pro ({price[2]} a month) and Enterprise ({price[3]} a month). Taxes are added where the law requires them. You can ask to change plan from the Plan page; a change applies once we confirm it. We will tell you at least 30 days before any price change affects you. Fees already paid are not refunded, except where the law requires it.</p>

      <h2>4. Your records</h2>
      <p>The business records you enter belong to your company. You give us permission to store and process them only so we can run EventDesk for you, as described in our <a href="/privacy">Privacy Policy</a>. You confirm that you have the right to enter them, including any consent your customers and staff must give under the law.</p>

      <h2>5. WhatsApp messages and documents</h2>
      <p>When you send booking confirmations, reminders or receipts through EventDesk, you are the sender. Message only customers who expect to hear from you, and follow WhatsApp&apos;s Business and Commerce policies. You are responsible for the contents and accuracy of your quotations and invoices, including prices, tax rates and your GSTIN. EventDesk calculates totals and tax from the figures you enter, but does not give tax or legal advice.</p>

      <h2>6. Acceptable use</h2>
      <p>Do not use EventDesk to break the law; send spam; upload harmful code; try to reach another company&apos;s records; overload or probe the service; or copy, resell or reverse engineer it. We may suspend an account that does any of these, and will tell you why unless the law prevents us.</p>

      <h2>7. Availability and changes</h2>
      <p>We work to keep EventDesk available and your records safe, but we cannot promise it will never be interrupted or free of errors. We may improve or change features. If we remove a feature your plan depends on, we will give you reasonable notice.</p>

      <h2>8. Ending the agreement</h2>
      <p>You may stop using EventDesk and ask us to close your account at any time. We may end this agreement with 30 days&apos; notice, or straight away if you seriously break these terms. Before your account closes, you can print or save your reports, invoices and quotations. After it closes, we delete your records as described in the Privacy Policy.</p>

      <h2>9. Liability</h2>
      <p>To the extent the law allows, we are not liable for indirect losses such as lost profit, lost business or lost data that you could have saved, and our total liability for any claim is limited to the fees you paid us in the 12 months before the claim. Nothing in these terms limits liability that cannot be limited by law.</p>

      <h2>10. Changes to these terms</h2>
      <p>We may update these terms. We will change the date at the top of this page and tell account owners about significant changes at least 30 days before they apply. Continuing to use EventDesk after that date means you accept the new terms.</p>

      <h2>11. Law and disputes</h2>
      <p>These terms are governed by the laws of India. Courts in {LEGAL.courts} have exclusive jurisdiction over any dispute about them. Before going to court, please write to us so we can try to resolve the matter.</p>
    </LegalPage>
  );
}
