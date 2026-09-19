'use client';

import { useEffect } from 'react';
import { StatusScreen, statusButton } from '@/components/StatusScreen';

// A screen that crashed while rendering. Without this, Next.js replaced the
// whole POS with its own "Application error: a client-side exception has
// occurred" page and no way back. Orders and payments live in the terminal's
// own storage and outbox, not in the screen, so nothing is lost: say so, and
// offer to try again or go Home.
export default function ScreenError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('[pos] screen error', error);
  }, [error]);

  return (
    <StatusScreen
      drawing="error"
      title="Something went wrong on this screen"
      actions={<>
        <button type="button" onClick={reset} className={statusButton.primary}>Try again</button>
        {/* A full load, not a client navigation: whatever broke this screen
            may still be in the page's memory. */}
        <button type="button" onClick={() => window.location.assign('/pos/home')} className={statusButton.secondary}>
          Go to Home
        </button>
      </>}
    >
      Your orders and payments are saved on this terminal. Try again, or go back to Home.
    </StatusScreen>
  );
}
