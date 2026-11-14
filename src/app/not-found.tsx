import Link from 'next/link';
export default function NotFound() {
  return (<main className="public"><div className="panel"><div className="empty"><b>Page not found</b>The link may be wrong or the item was removed. <Link href="/dashboard">Go to the dashboard</Link></div></div></main>);
}
