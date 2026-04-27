import { type NextRequest } from 'next/server';
import { getLightMappings, createMapping } from '@/services/mapping.service';

export async function GET(req: NextRequest) {
  return getLightMappings(req);
}

export async function POST(req: NextRequest) {
  return createMapping(req);
}
