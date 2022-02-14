const fs = require("fs");

const fl = fs.readdirSync(process.cwd()).filter((o) => !o.includes("tests"));

describe("Check file-explorer files", () => {
  const expectedFiles = [
    "index.js",
    "package.json",
    "static",
    "tsconfig.json",
    "lib",
    "views",
    "yarn.lock"
  ];
  expectedFiles.forEach((name) => {
    it(`checking ${name}`, () => expect(fl).toContain(name));
  });
});
