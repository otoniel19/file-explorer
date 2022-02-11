const express = require("express"),
  path = require("path"),
  fs = require("fs"),
  hdbs = require("handlebars"),
  hdbsHelpers = require("handlebars-helpers")({ handlebars: hdbs }),
  logger = require("@otoniel19/logger"),
  router = express.Router(),
  getFileIcon = require("./file-icon"),
  zipLocal = require("zip-local"),
  flash = require("connect-flash"),
  session = require("express-session"),
  { spawnSync, execSync } = require("child_process");

router.use(express.static(path.join(__dirname, "static"), { index: false }));
router.use(
  session({
    secret: "0000",
    resave: false,
    saveUnitialized: true
  })
);

router.use(flash());

var Dir = "";
var Root = "";
var Lock = "";
var Hidden = "";
var Url = "";
var Target = "";
var Nav = [];

/*
 * @param {String} dir the initial directory
 * @param {String} root the root directory
 * @param {Boolean} lock block root directory acess
 * @param {Boolean} hidden show hidden files
 * @param {String} url the url to redirect
 * @param {String} target the target url for future select files mode update
 */
exports.config = function (dir, root, lock, hidden, url, target) {
  Dir = dir;
  Root = root;
  Lock = lock;
  Hidden = hidden;
  Url = url;
  Target = target;
};

//remove duplicate "/" from Dir
const fixDir = () => (Dir = Dir.replace("//", "/"));
setInterval(fixDir, 0);

//block root acess
const lockFileRoot = () => {
  if (Lock) {
    const lock = Root.split("/").join("").split(".").join("");
    fs.readdirSync(Dir).forEach((name) => {
      const dlock = name.split("/").join("").split(".").join("");
      if (dlock == lock) {
        Dir = Root;
        logger.error(`acess denied cannot leave root directory`);
      }
    });
  }
};

setInterval(lockFileRoot, 0);

async function changeDir() {
  Nav = [];
  var scan = Hidden
    ? fs.readdirSync(Dir)
    : fs.readdirSync(Dir).filter((v) => !v.startsWith("."));
  scan.forEach((name) => {
    if (fs.statSync(`${Dir}/${name}`).isFile()) {
      Nav.push({
        type: "file",
        name: name,
        icon: getFileIcon(name, "file")
      });
    } else {
      Nav.push({
        type: "folder",
        name: name,
        icon: getFileIcon(name, "folder")
      });
    }
  });
}

var message = "";

//catch acess denied
setInterval(() => {
  try {
    fs.readdirSync(Dir);
  } catch (e) {
    logger.error("error on scan dir");
    message = "error on scan dir";
    if (e.code == "ENOENT")
      logger.error(`${Dir} dont exists we try to use Root`);

    Dir = Root;
  }
});

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
  //create route
  res.render("create", {
    type: type,
    holderName: `input ${type}name`
  });
});

router.post("/save", (req, res) => {
  const { type, name } = req.body;
  //create file
  if (type == "file") {
    try {
      fs.writeFileSync(`${Dir}/${name}`, "");
      req.flash("successMsg", `file ${name} created`);
    } catch (e) {
      req.flash("errorMsg", `error on create file ${name}`);
    }
  } else {
    try {
      fs.mkdirSync(`${Dir}/${name}`, { recursive: false, force: true });
      req.flash("successMsg", `folder ${name} created`);
    } catch (e) {
      req.flash("errorMsg", `error on create folder ${name}`);
    }
  }
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/cd=:dir", (req, res) => {
  Dir = `${Dir}/${req.params.dir}/`;
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/upOneDir", async (req, res) => {
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
  //remove files or folders
  if (req.body.type == "file") {
    try {
      //fs.rmSync(`${Dir}/${req.body.name}`);
      req.flash("successMsg", `file ${req.body.name} removed`);
    } catch (e) {
      req.flash("errorMsg", `error on remove file ${req.body.name}`);
    }
  } else {
    try {
      fs.rmdirSync(`${Dir}/${req.body.name}`, {
        recursive: false,
        force: true
      });
      req.flash("successMsg", `folder ${req.body.name} removed`);
    } catch (e) {
      req.flash(`errorMsg`, `error on remove folder ${req.body.name}`);
    }
  }
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/rename=:old=:newName", (req, res) => {
  const { old, newName } = req.params;
  try {
    fs.renameSync(`${Dir}/${old}`, `${Dir}/${newName}`);
    req.flash("successMsg", `succesfully renamed ${old} -> ${newName}`);
  } catch (e) {
    req.flash("errorMsg", `failed on rename ${old} -> ${newName}`);
  }
  Dir = Dir.split(old).join("");
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

exports.setup = router;
