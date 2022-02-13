const fs = require("fs");

const fl = fs.readdirSync(process.cwd()).filter((o) => !o.includes("tests"));

it("check files", () => {
  const expectedFiles = [
    ".git",
    "README.md",
    "dist",
    "file-icon.js",
    "index.js",
    ".jest.config.js",
    "package.json",
    "static",
    "tsconfig.json",
    "views",
    "yarn.lock"
  ];
  expect(fl).toEqual(expect.arrayContaining(expectedFiles));
});
