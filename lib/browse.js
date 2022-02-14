const express = require("express"),
  path = require("path"),
  fs = require("fs"),
  hdbs = require("handlebars"),
  logger = require("@otoniel19/logger"),
  router = express.Router(),
  zipLocal = require("zip-local"),
  flash = require("connect-flash"),
  session = require("express-session"),
  shelljs = require("shelljs"),
  utils = require("./utils");

require("handlebars-helpers")({ handlebars: require("handlebars") });

//static files
router.use(express.static(path.join(__dirname, "../static"), { index: false }));

//session for connect-flash
router.use(
  session({
    secret: "0000",
    resave: false,
    saveUnitialized: true
  })
);

//flash
router.use(flash());

var Dir = "";
var Root = "";
var Hidden = "";
var Url = "";
var Target = "";
var Nav = [];

/*
 * @param {String} dir the initial directory
 * @param {Boolean} hidden show hidden files
 * @param {String} url the url to redirect
 * @param {String} target the target url for future select files mode update
 */
const config = function (dir, root, hidden, url, target) {
  Dir = dir;
  Root = root;
  Hidden = hidden;
  Url = url;
  Target = target;
};

//catch acess denied or no such dir
setInterval(() => {
  try {
    fs.readdirSync(Dir);
  } catch (e) {
    logger.error("error on scan dir");
    if (e.code == "ENOENT") logger.error(`${Dir} dont exists`);

    Dir = Root;
  }
}, 0);

//remove duplicate "/" from Dir
const fixDir = () => (Dir = Dir.replace("//", "/"));
setInterval(fixDir, 0);

//changeDir
async function changeDir() {
  Nav = [];
  try {
    var scan = Hidden
      ? fs.readdirSync(Dir)
      : fs.readdirSync(Dir).filter((v) => !v.startsWith("."));
    scan.forEach((name) => {
      if (fs.statSync(`${Dir}/${name}`).isFile()) {
        Nav.push({
          type: "file",
          name: name,
          icon: utils.getFileIcon(name, "file")
        });
      } else {
        Nav.push({
          type: "folder",
          name: name,
          icon: utils.getFileIcon(name, "folder")
        });
      }
    });
  } catch (e) {
    //if an error the Dir back to the Root
    Dir = Root;
  }
}

router.use(async (req, res, next) => {
  await changeDir();
  if (Url == "/") Url = "";
  else if (Url.length >= 2 && Url.endsWith("/"))
    throw new Error(`${Url} invalid format do not end url with /`);

  global.Url = Url;
  global.Target = Target;
  //url
  hdbs.registerHelper("url", function () {
    return new hdbs.SafeString(Url);
  });

  res.locals.successMsg = req.flash("successMsg");
  res.locals.errorMsg = req.flash("errorMsg");
  await next();
});

router.get("/", (req, res) => {
  res.render("explorer", { nav: Nav });
});

router.get("/create=:type", (req, res) => {
  const { type } = req.params;
  //create file or dir
  res.render("create", {
    type: type,
    holderName: `input ${type}name`
  });
});

router.post("/save", (req, res) => {
  var { type, name } = req.body;
  //create file
  name = name.match(/[^&|€¢£©®°•√π∆¶×%]/gi).join("");
  if (type == "file") {
    try {
      fs.writeFileSync(`${Dir}/${name}`, "");
      req.flash("successMsg", `file ${name} created`);
    } catch (e) {
      req.flash("errorMsg", `error on create file ${name}`);
    }
  } else {
    //create dir
    try {
      //create the dir
      fs.mkdirSync(`${Dir}/${name}`, { recursive: true, force: true });
      req.flash("successMsg", `folder ${name} created`);
    } catch (e) {
      req.flash("errorMsg", `error on create folder ${name}`);
    }
  }
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/cd=:dir", (req, res) => {
  //open dir
  Dir = `${Dir}/${req.params.dir}/`;
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/upOneDir", async (req, res) => {
  //up a dir
  Dir = Dir + "/../";
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/config=:name&:type", (req, res) => {
  const { name, type } = req.params;
  const dir = "/" + Dir + "/" + name;
  res.render("config", {
    name: name,
    dir: dir.replace("//", "/"),
    type: type
  });
});

router.post("/rm", (req, res) => {
  //remove
  const { name, type } = req.body;
  try {
    fs.rmSync(`${Dir}/${name}`, { force: true, recursive: true });
    req.flash("successMsg", `${type} ${name} removed`);
  } catch (e) {
    req.flash("errorMsg", `error on remove ${type} ${name}`);
  }
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/rename=:old=:newName", (req, res) => {
  const { old, newName } = req.params;

  try {
    //rename the dir or file
    fs.renameSync(`${Dir}/${old}`, `${Dir}/${newName}`);

    req.flash("successMsg", `succesfully renamed ${old} -> ${newName}`);
  } catch (e) {
    req.flash("errorMsg", `failed on rename ${old} -> ${newName}`);
  }
  //remove old name from Dir
  Dir = Dir.replace(old, newName);
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/openFile=:name", (req, res) => {
  const { name } = req.params;
  res.render("files", {
    name: name,
    content: fs.readFileSync(`${Dir}/${name}`).toString()
  });
});

router.post("/saveFile", (req, res) => {
  const { name, content } = req.body;
  try {
    fs.writeFileSync(`${Dir}/${name}`, content);
    req.flash("successMsg", `file ${name} saved`);
  } catch (e) {
    req.flash("errorMsg", `error on save file ${name}`);
  }
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

//zip
router.post("/zip", async (req, res) => {
  const { zipName } = req.body;
  try {
    await zipLocal.sync
      .zip(`${Dir.replace("//", "/")}/${zipName}`)
      .compress()
      .save(`${Dir}/${zipName}.zip`);

    req.flash("successMsg", `${zipName} ziped succesfully`);
  } catch (e) {
    req.flash("errorMsg", `error on zip ${zipName}`);
  }
  if (global.Url == "") await res.redirect("/");
  else await res.redirect(global.Url);
});

module.exports = { router, config };
