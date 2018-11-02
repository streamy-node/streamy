
class BufferedSearch{
    constructor(callback){
        this.delayTimer = null;
        this.callback = callback;
    }
    
    doSearch(text) {
        var self = this;
        clearTimeout(this.delayTimer);
        this.delayTimer = setTimeout(function() {
            self.callback(text);
        }, 400); // Will do the ajax stuff after 1000 ms, or 1 s
    };
}

class Autocomplete{

    constructor(input, array, filter=true, onSelectItem=function(focus){console.log("Focus ",focus);}){
        /*the autocomplete function takes two arguments,
        the text field element and an array of possible autocompleted values:*/
        this.currentFocus = null;
        this.input = input;
        this.array = array;
        this.filter = filter;
        var self = this;

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
            } else if (e.keyCode == 38) { //up
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

        /*execute a function when someone clicks in the document:*/
        document.addEventListener("click", function (e) {
            self._closeAllLists(e.target);
            if(self.currentFocus != null){
                onSelectItem(self.currentFocus);
            }
        });
    }

    updateArray(arr){
        console.log("ARR",arr);
        var a, b, i, val = this.input.value;
        var self = this;
        this.array = arr;
        /*close any already open lists of autocompleted values*/
        this._closeAllLists();
        if (!val) { return false;}
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
            if (this.filter || arr[i].substr(0, val.length).toUpperCase() == val.toUpperCase()) {
                /*create a DIV element for each matching element:*/
                b = document.createElement("DIV");
                /*make the matching letters bold:*/
                var pos = arr[i].indexOf(val);
                if(pos>=0){
                    b.innerHTML = arr[i].substr(0,pos) +"<strong>" + arr[i].substr(pos, val.length) + "</strong>";
                    b.innerHTML += arr[i].substr(pos+val.length);
                }else{
                    b.innerHTML = arr[i];
                }
                
                /*insert a input field that will hold the current array item's value:*/
                b.innerHTML += '<input type="hidden" value="' + arr[i] + '">';
                /*execute a function when someone clicks on the item value (DIV element):*/
                b.addEventListener("click", function(e) {
                    /*insert the value for the autocomplete text field:*/
                    self.input.value = this.getElementsByTagName("input")[0].value;
                    self.currentFocus = index;//new Number(index);
                    /*close the list of autocompleted values,
                    (or any other open lists of autocompleted values:*/
                    self._closeAllLists();
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
        if (this.currentFocus < 0) this.currentFocus = (x.length - 1);
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

};

/// Network utils
function postAsJson(objData,url,onSucess,onError,parseResult=true){
    // Sending and receiving data in JSON format using POST method
    //
    var xhr = new XMLHttpRequest();
    xhr.open("POST", url, true);
    xhr.setRequestHeader("Content-Type", "application/json");
    xhr.onreadystatechange = function () {
        if (xhr.readyState === 4 && xhr.status === 200) {
            if(parseResult){
                var json = JSON.parse(xhr.responseText);
                onSucess(json);
            }else{
                onSucess(xhr.responseText);
            }

        }else if(xhr.readyState === 4 && xhr.status !== 200){
            if(parseResult){
                var json = JSON.parse(xhr.responseText);
                onError(json);
            }else{
                onError(xhr.responseText);
            }
        }
    };
    var data = JSON.stringify(objData);
    xhr.send(data);
}

function deleteReq(url,onSuccess = ((res)=>{}),onError = ((res)=>{})){
    $.ajax({
        url: url,
        type: 'DELETE',
        success: function(result) {
            onSuccess(result)
        },
        error: function (xhr, ajaxOptions, thrownError) {
            onError(xhr);
        }
    });
}