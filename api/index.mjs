// Vercel serverless function for every /api/* route (see vercel.json rewrites).
// The handler is bundled from server/vercel.ts by `npm run build:api` during the Vercel build.
export { default } from './_server.mjs';
