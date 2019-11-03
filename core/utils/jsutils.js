const moveFromToArray = function(proc, fromList, toList) {
  var index = fromList.indexOf(proc);
  if (index > -1) {
    fromList.splice(index, 1);
    toList.push(proc);
    return true;
  } else {
    return false;
  }
};

const removeFromList = function(elem, list) {
  var index = list.indexOf(elem);
  if (index > -1) {
    list.splice(index, 1);
    return true;
  } else {
    return false;
  }
};

const clone = function(a) {
  return JSON.parse(JSON.stringify(a));
};

function getSum(total, num) {
  return total + num;
}

function arrayGetSum(array) {
  array.reduce(getSum);
}

function arrayGetMean(array) {
  return array.reduce(getSum) / array.length;
}

module.exports.moveFromToArray = moveFromToArray;
module.exports.removeFromList = removeFromList;
module.exports.clone = clone;
module.exports.arrayGetSum = arrayGetSum;
module.exports.arrayGetMean = arrayGetMean;
