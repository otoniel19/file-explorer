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
  session = require("express-session");

//static files
router.use(express.static(path.join(__dirname, "static"), { index: false }));

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
var Lock = "";
var Hidden = "";
var Url = "";
var Target = "";
//current action
var action = {};
var Nav = [];

/*
 * @param {String} dir the initial directory
 * @param {String} root the root directory
 * @param {Boolean} lock block root directory acess
 * @param {Boolean} hidden show hidden files
 * @param {String} url the url to redirect
 * @param {String} target the target url for future select files mode update
 */
const config = function (dir, root, lock, hidden, url, target) {
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
    //root dir name
    const lock = Root.split("/").join("").split(".").join("");
    fs.readdirSync(Dir).forEach((name) => {
      //dir name
      const dlock = name.split("/").join("").split(".").join("");
      if (dlock == lock) {
        Dir = Root;
        logger.error(`acess denied cannot leave root directory`);
      }
    });
  }
};

setInterval(lockFileRoot, 0);

//changeDir
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

//catch acess denied or no such dir
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
  action = { action: "open explorer", dir: Dir };
  res.render("explorer", { nav: Nav });
});

router.get("/create=:type", (req, res) => {
  const { type } = req.params;
  //create file or dir
  action = { action: "open create", type: type, dir: Dir };
  res.render("create", {
    type: type,
    holderName: `input ${type}name`
  });
});

router.post("/save", (req, res) => {
  const { type, name } = req.body;
  //create file
  action = { action: "save", type: type, name: name, dir: Dir };
  if (type == "file") {
    try {
      fs.writeFileSync(`${Dir}/${name}`, "");
      req.flash("successMsg", `file ${name} created`);
      action = { action: "create", name: name, type: type };
    } catch (e) {
      req.flash("errorMsg", `error on create file ${name}`);
    }
  } else {
    //create dir
    try {
      //create the dir
      fs.mkdirSync(`${Dir}/${name}`, { recursive: false, force: true });
      req.flash("successMsg", `folder ${name} created`);
      action = { action: "create", type: type, name: name };
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
  action = { action: "changeDir", dir: Dir };
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/upOneDir", async (req, res) => {
  //up a dir
  Dir = Dir + "/../";
  action = { action: "updir", dir: Dir };
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/config=:name&:type", (req, res) => {
  const { name, type } = req.params;
  const dir = "/" + Dir + "/" + name;
  action = { action: "open config", name: name, type: type, dir: dir };
  res.render("config", {
    name: name,
    dir: dir.replace("//", "/"),
    type: type
  });
});

router.post("/rm", (req, res) => {
  //remove files or folders
  action = {
    action: "remove",
    type: req.body.type,
    name: req.body.name,
    dir: Dir
  };
  //remove file
  if (req.body.type == "file") {
    try {
      fs.rmSync(`${Dir}/${req.body.name}`);
      req.flash("successMsg", `file ${req.body.name} removed`);
    } catch (e) {
      req.flash("errorMsg", `error on remove file ${req.body.name}`);
    }
  } else {
    //remove dir
    try {
      fs.rmSync(`${Dir}/${req.body.name}`, {
        recursive: true,
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
  action = { action: "rename", oldName: old, newName: newName, dir: Dir };

  try {
    //rename the dir or file
    fs.renameSync(`${Dir}/${old}`, `${Dir}/${newName}`);

    req.flash("successMsg", `succesfully renamed ${old} -> ${newName}`);
  } catch (e) {
    req.flash("errorMsg", `failed on rename ${old} -> ${newName}`);
  }
  //remove old name from Dir
  Dir = Dir.split(old).join("");
  if (global.Url == "") res.redirect("/");
  else res.redirect(global.Url);
});

router.get("/openFile=:name", (req, res) => {
  const { name } = req.params;
  action = { action: "open file", name: name, dir: Dir };
  res.render("files", {
    name: name,
    content: fs.readFileSync(`${Dir}/${name}`).toString()
  });
});

router.post("/saveFile", (req, res) => {
  const { name, content } = req.body;
  action = { action: "save file", name: name, dir: Dir };
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
  action = {
    action: "zip",
    name: zipName,
    zipName: zipName + ".zip",
    dir: Dir
  };
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

const getAction = () => {
  return action;
};

module.exports = { getAction, router, config };
