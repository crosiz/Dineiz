import { GET as getApiHealth } from '../../system/api-health/route';

export async function GET(request: Request) {
  return getApiHealth();
}
