class BufferedSearch {
  constructor(callback, searchDelay = 400) {
    this.delayTimer = null;
    this.callback = callback;
    this.searchDelay = searchDelay;
  }

  setCallback(callback) {
    this.callback = callback;
  }

  doSearch(text) {
    var self = this;
    clearTimeout(this.delayTimer);
    this.delayTimer = setTimeout(function() {
      self.callback(text);
    }, this.searchDelay); // Will do the ajax stuff after 400 ms
  }
}

// TODO autocomplete class nicer
class Autocomplete {
  constructor(
    input,
    array,
    filter = true,
    onSelectItem = function(focus) {
      console.log("Focus ", focus);
    }
  ) {
    /*the autocomplete function takes two arguments,
        the text field element and an array of possible autocompleted values:*/
    this.currentFocus = null;
    this.input = input;
    this.array = array;
    this.filter = filter;
    var self = this;
    self.onSelectItem = onSelectItem;
    this.id = Math.floor(Math.random() * 1000) + Date.now();

    /*execute a function when someone writes in the text field:*/
    input.addEventListener("input", function(e) {
      self.updateArray(self.array);
    });
    /*execute a function presses a key on the keyboard:*/
    input.addEventListener("keydown", function(e) {
      var x = document.getElementById(this.id + "autocomplete-list");
      if (x) x = x.getElementsByTagName("div");
      if (e.keyCode == 40) {
        /*If the arrow DOWN key is pressed,
                increase the currentFocus variable:*/
        self.currentFocus++;
        /*and and make the current item more visible:*/
        self._addActive(x);
      } else if (e.keyCode == 38) {
        //up
        /*If the arrow UP key is pressed,
                decrease the currentFocus variable:*/
        this.currentFocus--;
        /*and and make the current item more visible:*/
        self._addActive(x);
      } else if (e.keyCode == 13) {
        /*If the ENTER key is pressed, prevent the form from being submitted,*/
        e.preventDefault();
        if (self.currentFocus > -1) {
          /*and simulate a click on the "active" item:*/
          if (x) x[self.currentFocus].click();
        }
      }
    });
  }

  updateArray(arr) {
    //console.log("ARR",arr);
    var a,
      b,
      i,
      val = this.input.value;
    var self = this;
    this.array = arr;
    /*close any already open lists of autocompleted values*/
    this._closeAllLists();
    if (!val) {
      return false;
    }
    this.currentFocus = -1;
    /*create a DIV element that will contain the items (values):*/
    a = document.createElement("DIV");
    a.setAttribute("id", this.input.id + "autocomplete-list");
    a.setAttribute("class", "autocomplete-items");
    /*append the DIV element as a child of the autocomplete container:*/
    this.input.parentNode.appendChild(a);
    /*for each item in the array...*/
    for (i = 0; i < arr.length; i++) {
      let index = i;
      /*check if the item starts with the same letters as the text field value:*/
      if (
        this.filter ||
        arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()
      ) {
        /*create a DIV element for each matching element:*/
        b = document.createElement("DIV");
        /*make the matching letters bold:*/
        var pos = arr[i].indexOf(val);
        if (pos >= 0) {
          b.innerHTML =
            arr[i].substr(0, pos) +
            "<strong>" +
            arr[i].substr(pos, val.length) +
            "</strong>";
          b.innerHTML += arr[i].substr(pos + val.length);
        } else {
          b.innerHTML = arr[i];
        }

        /*insert a input field that will hold the current array item's value:*/
        b.innerHTML += '<input type="hidden" value="' + arr[i] + '">';
        /*execute a function when someone clicks on the item value (DIV element):*/
        b.addEventListener("click", function(e) {
          /*insert the value for the autocomplete text field:*/
          let textWithoutDate = this.getElementsByTagName(
            "input"
          )[0].value.replace(/ *\(\d{4}\)/, "");
          self.input.value = textWithoutDate;
          self.currentFocus = index; //new Number(index);
          /*close the list of autocompleted values,
                    (or any other open lists of autocompleted values:*/
          self._closeAllLists();
          self.onSelectItem(self.currentFocus);
        });
        a.appendChild(b);
      }
    }
  }

  _addActive(x) {
    /*a function to classify an item as "active":*/
    if (!x) return false;
    /*start by removing the "active" class on all items:*/
    this._removeActive(x);
    if (this.currentFocus >= x.length) this.currentFocus = 0;
    if (this.currentFocus < 0) this.currentFocus = x.length - 1;
    /*add class "autocomplete-active":*/
    x[this.currentFocus].classList.add("autocomplete-active");
  }
  _removeActive(x) {
    /*a function to remove the "active" class from all autocomplete items:*/
    for (var i = 0; i < x.length; i++) {
      x[i].classList.remove("autocomplete-active");
    }
  }
  _closeAllLists(elmnt) {
    /*close all autocomplete lists in the document,
        except the one passed as an argument:*/
    var x = document.getElementsByClassName("autocomplete-items");
    for (var i = 0; i < x.length; i++) {
      if (elmnt != x[i] && elmnt != this.input) {
        x[i].parentNode.removeChild(x[i]);
      }
    }
  }
}

class TmdbSearch {
  constructor(searchElement, type, onMediaSelected) {
    this.type = type;
    this.searchResults = [];
    this.element = searchElement;
    var self = this;

    var onTitleSelection = function(selectedIndex) {
      if (self.searchResults) {
        // Update fields
        let videoInfos = self.searchResults[selectedIndex];
        onMediaSelected(videoInfos);
      }
    };

    this.searchField = new Autocomplete(
      searchElement,
      [],
      true,
      onTitleSelection
    );
    var bufferedSearch = new BufferedSearch(function(inputData) {
      if (inputData.length > 1) {
        // Initialize
        self.searchName(
          inputData,
          null,
          function(searchResults) {
            let titles = [];
            for (var i = 0; i < 8 && i < searchResults.length; i++) {
              let result = searchResults[i];
              let date = "";
              let name = "";
              if (self.type == "movie") {
                if (result.release_date) {
                  date = result.release_date;
                }
                name = searchResults[i].title;
              } else if (self.type == "serie") {
                if (result.first_air_date) {
                  date = result.first_air_date;
                }
                date = searchResults[i].first_air_date;
                name = searchResults[i].name;
              }
              titles.push(
                name + " (" + new Date(date).getFullYear().toString() + ")"
              );
            }
            self.searchResults = searchResults;
            console.log("Found ", titles, searchElement);
            self.searchField.updateArray(titles);
          },
          function(data) {
            console.log("Failed seraching ", data);
          }
        );
      }
    });

    searchElement.addEventListener("input", function() {
      bufferedSearch.doSearch($(this).val());
    });
  }

  disable(val) {
    this.element.disabled = val;
  }

  searchName(inputData, year, onResult, onError) {
    var getter = null;
    if (this.type == "serie") {
      getter = theMovieDb.search.getTv;
    } else if (this.type == "movie") {
      getter = theMovieDb.search.getMovie;
    } else {
      console.error("Unknown addvideo type");
      return;
    }

    let query = {
      query: inputData
    };
    if (year) {
      query.year = year;
    }

    getter(
      query,
      function(jsonData) {
        let searchResults = JSON.parse(jsonData);
        onResult(searchResults.results);
      },
      function(data) {
        console.log("Failed seraching ", data);
        onError(data);
      }
    );
  }
}

class BufferedSearchElement {
  constructor(searchElement, searchCallback) {
    var self = this;
    this.searchResults = [];
    this.element = searchElement;

    this.bufferedSearch = new BufferedSearch(function(inputData) {
      if (inputData.length > 1) {
        // Initialize
        searchCallback(inputData);
      }
    });

    searchElement.on("input", function() {
      self.bufferedSearch.doSearch($(this).val());
    });
  }

  setCallback(cb) {
    this.bufferedSearch.setCallback(cb);
  }

  reset() {
    this.setCallback(function(pattern) {});
    this.element.val("");
  }

  disable(val) {
    this.element.disabled = val;
  }

  hide() {
    this.element.hide();
  }

  show() {
    this.element.show();
  }
}
