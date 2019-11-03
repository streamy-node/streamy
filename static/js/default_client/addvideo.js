class AddVideoConstroller {
  constructor(templates) {
    this.templates = templates;
    this.searchField = null;
    this.resumable = null;
    this.searches = [];
    this.filesElements = new Map();
  }

  initialize() {
    //Nothing to initialize for now
  }

  render(div, type) {
    this.div = div;
    if (!this.isInitialized) {
      this.initialize();
      this.isInitialized = true;
    }

    $(div).html(this.templates.addvideo);
    this.setup(type);
  }

  setup(type) {
    var self = this;
    this.type = type;

    //Setup simple name search
    let mainSearchElem = new AddMediaItem(type);
    this.appendToContainer(
      ".add_search",
      mainSearchElem.render($(".add_file_tpl"), {}, true)
    );
    this.setupDropeZone();

    //restore uploading files
    for (var entry of this.filesElements.entries()) {
      //var key = entry[0],
      let value = entry[1];
      if (value.type == type) {
        this.appendToContainer("#tasks_list", value.element);
      }
    }

    //Setup main buttons
    $("#filesUpload").on("change", function(filesList) {
      let filesInput = $("#filesUpload")[0];
      for (let file of filesInput.files) {
        self.addFile(file);
      }
    });
    $(".files_upload").click(function() {
      $("#filesUpload").trigger("click");
    });
  }

  //////////// ADDING BY FILES ///////////////

  addFile(file) {
    let regex = null;
    let self = this;
    let year = null;

    //if filename already added do nothing
    if (this.filesElements.has(file.name)) {
      return;
    }

    let addFileElement = null;
    if (this.type == "movie") {
      regex = new RegExp("^(.+?[_.]*)[_. -](\\d{4})");
      var corresp = regex.exec(file.name);
      if (corresp && corresp.length >= 3) {
        file.parsedName = this.cleanName(corresp[1]);
        year = corresp[2];
      }
      addFileElement = new AddMediaFileItem("movie");
    } else if (this.type == "serie") {
      regex = new RegExp("^(.+?[_.]*)S(\\d{2})E(\\d{2,3})");
      var corresp = regex.exec(file.name);
      if (corresp && corresp.length >= 3) {
        file.parsedName = this.cleanName(corresp[1]);
        file.season = parseInt(corresp[2]);
        file.episode = parseInt(corresp[3]);
      }
      addFileElement = new AddEpisodeFileItem();
    }

    let itemElem = addFileElement.render($(".add_file_tpl"), file, false);
    this.appendToContainer("#tasks_list", itemElem);
    if (file) {
      this.filesElements.set(file.name, addFileElement);
      addFileElement.onRemoved = function() {
        self.filesElements.delete(file.name);
      };
    }
  }

  cleanName(name) {
    let reg1 = /[._]/g;
    let reg2 = /[\\[\\]\\(\\)]/g;
    let newName = name.replace(reg1, " ");
    newName = newName.replace(reg2, "");
    return newName;
  }

  setupDropeZone() {
    var self = this;
    let dropZone = document.getElementById("drop-zone");

    var startUpload = function(files) {
      console.log(files);
      for (let file of files) {
        self.addFile(file);
      }
    };

    dropZone.ondrop = function(e) {
      e.preventDefault();
      this.className = "upload-drop-zone";
      startUpload(e.dataTransfer.files);
    };

    dropZone.ondragover = function() {
      this.className = "upload-drop-zone drop";
      return false;
    };

    dropZone.ondragleave = function() {
      this.className = "upload-drop-zone";
      return false;
    };
  }

  appendToContainer(containerId, elem) {
    $(containerId)
      .first()
      .append(elem);
  }
}
