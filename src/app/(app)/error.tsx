'use client';
export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="body"><div className="formerror" role="alert">
      <b>Something went wrong while loading this page.</b> {error.digest ? `Reference: ${error.digest}.` : ''} Please try again.
      <div style={{ marginTop: 10 }}><button className="btn" onClick={reset}>Try again</button></div>
    </div></div>
  );
}
