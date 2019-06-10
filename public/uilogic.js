var DEF_CAT = 'סהכ';
var data;
var dates = [];
var dayEls = [];
var categories = {};
var selectedSoldier;
var selectedCategory = DEF_CAT;
var missionCounts = {};

// google.script.run.withSuccessHandler(onSuccess).loadData();

function initLoad() {
  Action.run(loadData, onSuccess);
}


function log(val) {
  console.log('%%%%%%%', val);
}

function onSuccess(d) {
  log(d);
  data = d;

  var currDate = new Date(d.startDate);
  var endDate = new Date(d.endDate);

  while (currDate <= endDate) {
    dates.push(currDate);
    currDate = new Date(currDate);
    currDate.setDate(currDate.getDate() + 1);
  }

  d.categories.forEach(function (c) {
    categories[c.name] = c.sums;
  });

  missionCounts = data.missionCounts;

  initView();

}

function initView() {

  var categoriesEl = document.querySelector('.categories');
  var commentEl = document.querySelector('.comment');

  function addCalendarWeek(days) {
    var calendar = document.querySelector('.calendar tbody');
    var week = document.createElement('tr');
    week.className = 'calendar-week';

    days.forEach(function (day, idx) {
      var dayTD = document.createElement('td');
      var dayEL = document.createElement('div');
      dayEL.className = 'calendar-day';

      dayTD.appendChild(dayEL);
      dayEL.innerHTML =
        '<div class="date">' + day.getDate() + '/' + (day.getMonth() + 1) + '</div>' +
        '<div class="amount">' + categories[DEF_CAT][idx] + '</div>';

      dayEL.onclick = togglePresence.bind(this, this.dates.indexOf(day), undefined);
      dayEL.oncontextmenu = togglePresence.bind(this, this.dates.indexOf(day), '');

      week.appendChild(dayTD);
      dayEls.push(dayEL);
    });

    //pad beginning of week
    if (days.length < 7 && days[0].getDay() !== 0) {
      var i = 0;
      while (i++ < days[0].getDay()) {
        var dayEL = document.createElement('div');
        week.insertBefore(dayEL, week.firstChild);
      }
    }

    calendar.appendChild(week);
  }

  function addCategory(label) {
    var catInput = document.createElement('input');
    catInput.setAttribute('type', 'radio');
    catInput.setAttribute('name', 'category');
    catInput.setAttribute('id', label);
    catInput.setAttribute('value', label);
    catInput.onchange = updateSumValueByCategory.bind(this, label);

    if (label === DEF_CAT) {
      catInput.setAttribute('checked', 'checked');
      catInput.className = 'default-category';
    }

    var catLabel = document.createElement('label');
    catLabel.setAttribute('for', label);
    catLabel.innerText = label;

    var wrapper = document.createElement('div');

    wrapper.appendChild(catInput);
    wrapper.appendChild(catLabel);

    categoriesEl.appendChild(wrapper);
  }

  var week = [];
  var currIdx = 0;

  while (this.dates[currIdx]) {
    week.push(this.dates[currIdx]);
    if (this.dates[currIdx].getDay() === 6 || currIdx === this.dates.length - 1) {
      addCalendarWeek(week);
      week = [];
    }
    ++currIdx;
  }

  for (var name in categories) {
    addCategory(name);
  }

  commentEl.style.display = 'inherit';
}

function setListVisibility(val) {
  var list = document.querySelector('.filtered-list-c');
  list.style.display = val ? 'inherit' : 'none';
}

function filterList(value) {
  var list = document.querySelector('.filtered-list');
  list.innerHTML = '';
  setListVisibility(false);
  if (!value) return;

  list.style.display = 'inherit'
  var fList = data.sList.filter(function (s) {
    return s.name && s.name.indexOf(value) >= 0;
  });
  setListVisibility(!!fList.length);
  fList.forEach(function (o) {
    var ul = document.createElement('li');
    ul.innerHTML = '<span tabindex="0">' + o.name + '</span>';
    ul.setAttribute('data-idx', o.idx);
    ul.onclick = selectSoldier;
    list.appendChild(ul);
  });
}

function selectSoldier(evt) {
  var idx = evt.target.parentNode.getAttribute('data-idx');
  var list = document.querySelector('.filtered-list');
  var bar = document.querySelector('.search-bar');
  var commentTA = document.querySelector('.comment textarea');
  commentTA.value = '';

  setListVisibility(false);

  var sData = data.sList.find(function (s) {
    return s.idx === Number(idx);
  });

  if (sData) {
    selectedSoldier = sData;
    bar.value = sData.name;
    applyPresence(sData);

    commentTA.removeAttribute('disabled');
    var soldier = data.soldiers.find(function (s) {
      return s.description === sData.name;
    });

    if (soldier) {
      selectedSoldier.profile = soldier;
      commentTA.value = soldier.comment;
    }
  }
}

function saveComment() {
  if (selectedSoldier && selectedSoldier.profile) {
    var commentTA = document.querySelector('.comment textarea');
    var value = commentTA.value;
    selectedSoldier.profile.comment = value;
    google.script.run.withSuccessHandler(onCommentSave.bind(this, selectedSoldier, value)).setCommentData(selectedSoldier.profile.row, value);
  }
}

function onCommentSave(selectedSoldier, value) {
  log('comment saved: ' + selectedSoldier.name + ', ' + value);
}

function applyPresence(sData) {
  if (sData.presence && sData.presence.length) {
    sData.presence.forEach(function (val, idx) {
      updatePresenceUI(idx, val);
    });
  }
}

function togglePresence(dayIdx, p) {
  if (!selectedSoldier) return;

  var catRegex = /^.*\[(.*)\].*$/;
  var match = catRegex.exec(selectedSoldier.name);
  var cat = match && match.length >= 2 && match[1];

  var oldPresence = selectedSoldier.presence[dayIdx];
  var newPresence;
  var countChange;

  if (typeof p === 'undefined') {
    newPresence = (oldPresence === 1 ? 0 : 1);
  } else {
    newPresence = p;
  }

  updatePresenceUI(dayIdx, newPresence);

  selectedSoldier.presence[dayIdx] = newPresence;

  if (oldPresence === 1) {
    countChange = -1;
  } else if (newPresence === 1) {
    countChange = 1;
  } else {
    countChange = 0;
  }

  google.script.run.withSuccessHandler(onPresenceSave.bind(this, dayIdx, cat, countChange)).setPresenceData(selectedSoldier.idx, dayIdx + 1, newPresence);

  return false;
}

function updatePresenceUI(dayIdx, presence) {
  var el = dayEls[dayIdx];
  switch (presence) {
    case 0:
      // day off
      el.classList.remove('present');
      el.classList.add('off');
      break;
    case 1:
      // present
      el.classList.add('present');
      el.classList.remove('off');
      break;
    default:
      el.classList.remove('present');
      el.classList.remove('off');
  }
}

function updateSumValueByCategory(cat) {
  selectedCategory = cat;
  var sums = categories[cat];
  if (sums && sums.length) {
    dayEls.forEach(function (dayEl, idx) {
      var amountEl = dayEl.querySelector('.amount');
      amountEl.innerText = sums[idx];
      if (sums[idx] < missionCounts[cat]) {
        amountEl.classList.add('undercount');
      } else {
        amountEl.classList.remove('undercount');
      }
    })
  }
}

function onPresenceSave(dayIdx, cat, countChange) {
  if (categories[cat] && typeof categories[cat][dayIdx] !== 'undefined') {
    categories[cat][dayIdx] += countChange;
  }
  categories[DEF_CAT][dayIdx] += countChange;

  if (selectedCategory === cat || selectedCategory === DEF_CAT) {
    updateSumValueByCategory(selectedCategory);
  }
}

function clearSearchbarValue() {
  document.querySelector('.search-bar').value = '';
}