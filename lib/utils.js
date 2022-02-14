exports.getFileIcon = function (ext, tp) {
  ext = ext.split(".");
  var EXT = ext[ext.length - 1].toLowerCase();
  var e = "";
  if (tp == "file") {
    switch (EXT) {
      case "html":
        e = "file-code";
        break;
      case "csv":
        e = "file-csv";
        break;
      case "excel":
        e = "file-excel";
        break;
      case "mp3":
        e = "file-audio";
        break;
      case "png":
      case "jpg":
      case "jpeg":
        e = "file-image";
        break;
      case "txt":
        e = "file-alt";
        break;
      case "json":
        e = "brackets-curly";
        break;
      default:
        e = "file";
        break;
    }
  } else e = "folder";

  return "fa fa-" + e;
};

exports.browseView =
  "./node_modules/@otoniel19/file-explorer/views/browse-mode/";
