const fs = require("fs");

function getCwd() {
  var cwd = process.cwd();
  if (cwd[0] == "test.js") cwd = `${cwd}/../`;
  return cwd;
}

const fl = fs.readdirSync(getCwd()).filter((o) => !o.includes("tests"));

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
