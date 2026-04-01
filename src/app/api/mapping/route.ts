import { type NextRequest } from 'next/server';
import { listMappings, createMapping } from '@/services/mapping.service';

export async function GET() {
  return listMappings();
}

export async function POST(req: NextRequest) {
  return createMapping(req);
}
