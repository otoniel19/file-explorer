# file-explorer

- file explorer for express apps

- installation

```sh
 npm install @otoniel19/file-explorer
 # or
 npm install github://otoniel19/file-explorer
```

- avoid using special words
- usage
- browse mode

```js
const express = require("express");
const bodyParser = require("body-parser");
const { engine } = require("express-handlebars");
const fileExp = require("@otoniel19/file-explorer");

const app = express();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.set("views", "./node_modules/@otoniel19/file-explorer/views/browse-mode/");

app.set("view engine", "handlebars");
app.engine("handlebars", engine({ defaultLayout: "main" }));

fileExp.config("../foo", "../foo/bar", true, false, "/foo", "/bar");

app.use("/foo", fileExp.router);

app.listen(3000);
```

- select mode comming soon...

- config

```ts
function config(
  //initial dir
  dir: string,
  //root dir
  root: string,
  //block acess to root dir
  lock: boolean,
  //show hidden files
  hidden: boolean,
  //url
  url: string,
  //target url
  target: string
): void;
```
