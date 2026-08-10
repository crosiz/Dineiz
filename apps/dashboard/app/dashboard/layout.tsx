import { UserProviderWrapper } from '@/contexts/user-context';
import { PlanProviderWrapper } from '@/contexts/plan-context';
import { DashboardLayout } from '@/components/layout/DashboardLayout';

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <UserProviderWrapper>
      <PlanProviderWrapper>
        <DashboardLayout>{children}</DashboardLayout>
      </PlanProviderWrapper>
    </UserProviderWrapper>
  );
}
