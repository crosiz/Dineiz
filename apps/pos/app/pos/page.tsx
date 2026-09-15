import HomeDashboard from './HomeDashboard';

// `/pos` renders the home dashboard directly — the same thing `/pos/home` does.
//
// This used to be `redirect('/pos/home')`. A render-time redirect() reached via
// a client-side router transition (e.g. LoginClient's push right after a
// successful PIN) desyncs hydration under Turbopack + React 19: React replays
// Next's own <Router>, the hook count no longer matches, and it throws
// "Rendered more hooks than during the previous render" — a blank screen with
// no recovery. Rendering the screen here removes the redirect hop entirely.
export default function POSTerminal() {
  return <HomeDashboard />;
}
