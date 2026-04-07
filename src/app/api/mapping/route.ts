import { type NextRequest } from 'next/server';
import { getLightMappings, createMapping } from '@/services/mapping.service';

export async function GET() {
  return getLightMappings();
}

export async function POST(req: NextRequest) {
  return createMapping(req);
}
