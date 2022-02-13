const express = require("express");
const exp = require("./index");
const { engine } = require("express-handlebars");
const bodyParser = require("body-parser");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.set("views", "./views/browse-mode/");
app.set("view engine", "handlebars");
app.engine("handlebars", engine({ defaultLayout: "main" }));

exp.config("../", "../../home/", false, "/fs", "/");

app.use("/fs", exp.router);
app.listen(3000);
