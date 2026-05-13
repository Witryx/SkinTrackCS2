const fs = require("fs");
const path = require("path");
const { createRequire } = require("module");

const realCwd = fs.realpathSync.native(process.cwd());
if (realCwd !== process.cwd()) {
  process.chdir(realCwd);
}

const projectRequire = createRequire(path.join(realCwd, "package.json"));
const nextBin = projectRequire.resolve("next/dist/bin/next");

process.argv = [
  process.argv[0],
  nextBin,
  "dev",
  ...process.argv.slice(2),
];

require(nextBin);
