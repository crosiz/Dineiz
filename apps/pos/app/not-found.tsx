import Link from 'next/link';
import { StatusScreen, statusButton } from '@/components/StatusScreen';

// An address the POS doesn't have (an old bookmark, a mistyped link). Without
// this, Next.js showed its own bare "404 | This page could not be found".
export default function NotFound() {
  return (
    <StatusScreen
      drawing="lost"
      title="This screen doesn't exist"
      actions={<Link href="/pos/home" className={statusButton.primary}>Go to Home</Link>}
    >
      The link may be old. Your orders and your shift are exactly where you left them.
    </StatusScreen>
  );
}
