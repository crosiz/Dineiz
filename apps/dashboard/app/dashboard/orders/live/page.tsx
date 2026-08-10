import { LiveMonitorPage } from '@/components/features/live-monitor/LiveMonitorPage';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Live Orders | Dineiz Go Dashboard',
};

export default function LiveOrdersRoute() {
  // We return the live monitor component without the standard dashboard layout
  // because the live monitor is a full-screen standalone application view.
  return <LiveMonitorPage />;
}
