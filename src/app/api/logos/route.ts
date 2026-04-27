import { type NextRequest } from 'next/server';
import { getLightLogos, createLogo } from '@/services/logo.service';

export async function GET(req: NextRequest) {
  return getLightLogos(req);
}

export async function POST(req: NextRequest) {
  return createLogo(req);
}
