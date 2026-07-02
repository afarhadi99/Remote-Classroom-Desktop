// Stub for the 'server-only' marker package when bundling railway/server.ts. That
// package's guard only matters inside a Next.js/webpack client-bundle build; this is a
// plain Node service with no client bundle, so the guard is meaningless here.
export {}
