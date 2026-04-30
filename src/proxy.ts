import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Simple in-memory rate limit map
// Note: In serverless environments, this will reset frequently.
// For production, use a database or Redis (e.g., Upstash).
const rateLimitMap = new Map<string, { count: number; startTime: number }>();

export function proxy(request: NextRequest) {
  const response = NextResponse.next();

  // 1. Security Headers (Already handled in next.config.ts, but can be reinforced here)
  // response.headers.set('X-Content-Type-Options', 'nosniff');
  // response.headers.set('X-Frame-Options', 'DENY');
  // response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');

  // 2. Rate Limiting for API routes
  const ip = request.headers.get('x-forwarded-for') || '127.0.0.1';
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute
  const maxRequests = 30; // limit to 5 analysis per minute

  const rateData = rateLimitMap.get(ip) || { count: 0, startTime: now };

  if (now - rateData.startTime > windowMs) {
    rateData.count = 1;
    rateData.startTime = now;
  } else {
    rateData.count++;
  }

  rateLimitMap.set(ip, rateData);

  if (rateData.count > maxRequests) {
    return new NextResponse(
      JSON.stringify({
        error: 'Rate limit exceeded. Please wait a minute before trying again.',
        retryAfter: Math.ceil((windowMs - (now - rateData.startTime)) / 1000)
      }),
      {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': Math.ceil((windowMs - (now - rateData.startTime)) / 1000).toString()
        }
      }
    );
  }

  return response;
}

// Ensure middleware only runs on API and main page
export const config = {
  matcher: ['/api/:path*', '/'],
};
