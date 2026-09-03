import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.47"],
  // Prisma Client is generated to a custom `app/generated/prisma` location
  // (not the default node_modules/@prisma/client Next.js knows to trace
  // automatically), so its native query engine binary gets dropped from the
  // serverless function bundle on Vercel unless explicitly included here.
  // Only the Linux binary is listed (not the macOS one also present locally)
  // so we're not shipping an unusable ~19MB binary in every deployment.
  outputFileTracingIncludes: {
    "/**": ["./app/generated/prisma/libquery_engine-rhel-openssl-3.0.x.so.node"],
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
