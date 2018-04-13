const moveFromToArray = function (proc,fromList,toList){
  var index = fromList.indexOf(proc);
  if (index > -1) {
    fromList.splice(index, 1);
    toList.push(proc);
    return true;
  }else{
    return false;
  }
}

const removeFromList = function(process,list){
  var index = list.indexOf(process);
  if (index > -1) {
    list.splice(index, 1);
    return true;
  }else{
    return false;
  }
}

module.exports.moveFromToArray = moveFromToArray
module.exports.removeFromList = removeFromList