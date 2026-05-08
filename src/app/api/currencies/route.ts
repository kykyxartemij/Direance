import { getCurrencyList } from '@/services/currency.service';

export async function GET() {
  return getCurrencyList();
}
