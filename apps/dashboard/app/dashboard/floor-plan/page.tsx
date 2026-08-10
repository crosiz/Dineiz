import { FloorPlanEditor } from '@/components/features/floor-plan/FloorPlanEditor';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Floor Plan Editor | Dineiz Go Dashboard',
};

export default function FloorPlanRoute() {
  return <FloorPlanEditor />;
}
