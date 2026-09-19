'use client';

import './globals.css';
import { useEffect } from 'react';
import { StatusScreen, statusButton } from '@/components/StatusScreen';

// The same as error.tsx, for a failure in the root layout itself (it replaces
// the layout, so it brings its own <html> and stylesheet).
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[pos] app error', error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <StatusScreen
          drawing="error"
          title="Something went wrong"
          actions={<>
            <button type="button" onClick={reset} className={statusButton.primary}>Try again</button>
            <button type="button" onClick={() => window.location.assign('/pos/home')} className={statusButton.secondary}>
              Go to Home
            </button>
          </>}
        >
          Your orders and payments are saved on this terminal. Try again, or go back to Home.
        </StatusScreen>
      </body>
    </html>
  );
}
