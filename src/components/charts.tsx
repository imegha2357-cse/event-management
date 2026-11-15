import { inr } from '@/lib/util';

const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const lastMonths = (n: number, end: string) => { const [y, m] = end.slice(0, 7).split('-').map(Number); return Array.from({ length: n }, (_, i) => { const d = new Date(Date.UTC(y, m - 1 - (n - 1 - i), 1)); return d.toISOString().slice(0, 7); }); };
export const monthName = (k: string) => `${['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;

/** Monthly money in (payments) vs money out (expenses). */
export function IncomeSpend({ months, income, spend }: { months: string[]; income: number[]; spend: number[] }) {
  const max = Math.max(1, ...income, ...spend);
  return (<>
    <div className="legend"><span><i className="inc" />Income</span><span><i className="sp" />Spending</span></div>
    <div className="ischart" role="img" aria-label={`Income and spending for the last ${months.length} months`}>
      {months.map((k, i) => (
        <div className="iscol" key={k}>
          <div className="isbars">
            <i className="inc" style={{ height: `${Math.max(income[i] ? 2 : 0, (income[i] / max) * 100)}%` }} title={`Income ${monthName(k)}: ${inr(income[i])}`} />
            <i className="sp" style={{ height: `${Math.max(spend[i] ? 2 : 0, (spend[i] / max) * 100)}%` }} title={`Spending ${monthName(k)}: ${inr(spend[i])}`} />
          </div>
          <span>{MON[+k.slice(5) - 1]}</span>
        </div>))}
    </div>
  </>);
}
