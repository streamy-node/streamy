/// Network utils
function postAsJson(objData, url, onSucess, onError, parseResult = true) {
  // Sending and receiving data in JSON format using POST method
  //
  var xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("Content-Type", "application/json");
  xhr.onreadystatechange = function() {
    if (xhr.readyState === 4 && (xhr.status === 200 || xhr.status === 201)) {
      if (parseResult) {
        var json = JSON.parse(xhr.responseText);
        onSucess(json);
      } else {
        onSucess(xhr.responseText);
      }
    } else if (
      xhr.readyState === 4 &&
      !(xhr.status === 200 || xhr.status === 201)
    ) {
      // if(parseResult){
      //     var json = JSON.parse(xhr.responseText);
      //     onError(json);
      // }else{
      onError(xhr.responseText);
      //}
    }
  };
  var data = JSON.stringify(objData);
  xhr.send(data);
}

function deleteReq(url, onSuccess = res => {}, onError = res => {}) {
  $.ajax({
    url: url,
    type: "DELETE",
    success: function(result) {
      onSuccess(result);
    },
    error: function(xhr, ajaxOptions, thrownError) {
      onError(xhr);
    }
  });
}
