const fs = require("fs");
const { PHASE_DEVELOPMENT_SERVER } = require("next/constants");

const realCwd = fs.realpathSync.native(process.cwd());
if (realCwd !== process.cwd()) {
  process.chdir(realCwd);
}

module.exports = (phase) => {
  /** @type {import('next').NextConfig} */
  const nextConfig = {
    // Keep dev and production artifacts isolated so `next dev` and `next build`
    // do not corrupt each other's chunk layout when both are used locally.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next-dev" : ".next",
  };

  return nextConfig;
};
