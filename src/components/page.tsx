export function PageHead({ title, sub, actions, badge }: { title: string; sub?: React.ReactNode; actions?: React.ReactNode; badge?: React.ReactNode }) {
  return (
    <div className="pagehead">
      <div><div className="title"><h1>{title}</h1>{badge}</div>{sub && <div className="sub">{sub}</div>}</div>
      {actions && <div className="actions">{actions}</div>}
    </div>
  );
}
export function Badge({ s, label }: { s: string; label?: string }) { return <span className={`badge ${s}`}>{label ?? s}</span>; }
export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><b>{title}</b>{children}</div>;
}
