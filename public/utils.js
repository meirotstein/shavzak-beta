SpreadsheetApp = {

  getMetadata: async function() {
    return await makeGetSpreadsheetCall();
  },
  
  getActive: function () {
    var Fetcher = function (name) {
      this.name = name;
    }

    Fetcher.prototype.getRange = async function (row, col, row_l, col_l) {
      var that = this;
      var range;
      var renderOption;
      if (typeof col === 'undefined') {
        range = row; //A1 notation
        renderOption = 'FORMATTED_VALUE';
      } else {
        var colLetterS = columnToLetter(col);
        var colLetterE = columnToLetter(col + col_l);

        range = `${colLetterS}${row}:${colLetterE}${row + row_l}`;

      }
      return makeApiGetCall(that.name, range, renderOption).then(function (res) {
        return {
          getValues: function () {
            return res.values;
          },
          setValue: function (value) {
            return makeApiUpdateCall(that.name, range, value);
          }
        };
      });
    }

    return {
      getSheetByName: function (name) {
        return new Fetcher(name);
      }
    }
  }
}

window.Action = {
  run: async function (action, callback) {
    var result;
    var err;
    try {
      result = await action();
    } catch (e) {
      err = e;
    }
    if (callback) {
      if (err) {
        result = result || {};
        result.error = err;
      }
      callback(result);
    }
  }
}

String.prototype.getTime = function () {
  if (/([12]\d{3}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01]))/.test(this)) {
    var d = new Date(this);
    return d.getTime();
  }
}

function columnToLetter(column) {
  var temp, letter = '';
  while (column > 0) {
    temp = (column - 1) % 26;
    letter = String.fromCharCode(temp + 65) + letter;
    column = (column - temp - 1) / 26;
  }
  return letter;
}

function letterToColumn(letter) {
  var column = 0, length = letter.length;
  for (var i = 0; i < length; i++) {
    column += (letter.charCodeAt(i) - 64) * Math.pow(26, length - i - 1);
  }
  return column;
}

function isiOS() {
  return [
    'iPad Simulator',
    'iPhone Simulator',
    'iPod Simulator',
    'iPad',
    'iPhone',
    'iPod'
  ].includes(navigator.platform)
  // iPad on iOS 13 detection
  || (navigator.userAgent.includes("Mac") && "ontouchend" in document)
}

function isLastDayOfMonth(date) {
  var lastDay = new Date(date.getFullYear(), date.getMonth() + 1, 0);
  return lastDay.getDate() === date.getDate();
}

function getDaysBetween(startTs, endTs) {
  return Math.round(Math.abs((endTs - startTs) / (1000 * 3600 * 24)));
}