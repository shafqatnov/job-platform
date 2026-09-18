// Loads .env into process.env for the Vitest process (a separate Node
// process from Next.js, which does not share Next's own env loading).
// "dotenv" is already present in node_modules as an existing dependency
// of Prisma's own tooling (see prisma7.config.ts) — no new package was
// installed for this.
import "dotenv/config";
