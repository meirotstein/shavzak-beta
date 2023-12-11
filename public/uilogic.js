var DEF_CAT = 'סהכ';
var AT_HOME_CAT = 'בחופש';
var data;
var dates = [];
var dayEls = [];
var weeksEls = [];
var currentVisibleMonth = (new Date()).getMonth();
var categories = {};
var selectedSoldier;
var selectedCategory = DEF_CAT;
var missionCounts = {};
var loader;

// google.script.run.withSuccessHandler(onSuccess).loadData();

function initLoad() {
  loader = document.querySelector('.main-loader');
  loader.style.display = 'inherit';
  var spidEl = document.querySelector('.spreadsheet-id');
  var spid = fetchSpreadsheetId();
  if (spid) {
    spidEl.value = spid;
    Action.run(loadData, onSuccess);
  } else {
    spidEl.classList.add('error');
    onFail();
  }
}


function log(val) {
  console.log('%%%%%%%', val);
}

function isToday(date) {
  if (!date) return;
  var today = new Date();
  return today.getDate() === date.getDate() &&
    today.getMonth() === date.getMonth() &&
    today.getFullYear() === date.getFullYear();
}

function onFail(err) {
  console.log('fail to load', err);
  toggleInitLoader(false);
  var noNamesErrMsg = 'שגיאה: רשימת החיילים ריקה';
  var defaultErrMsg = 'שגיאה: אין גישה לקובץ או שהקובץ אינו קיים';

  var msg;
  if (err === 'no_names_error') {
    msg = noNamesErrMsg;
  } else {
    msg = defaultErrMsg;
  }

  let errView = document.querySelector('.err-view');

  errView.innerText = msg;
  errView.style.display = 'block';
}

function revealMainView() {
  toggleInitLoader(false);
  document.querySelector('.main-view').style.display = 'block';
}

function onSuccess(result) {

  showTitleIfApplicable();

  if (result && result.error) {
    onFail(result.error);
    loader.style.display = 'none';
    var spidEl = document.querySelector('.spreadsheet-id');
    spidEl.classList.add('error');
    return;
  }
  loader.style.display = 'none';
  log(result);

  revealMainView();

  data = result;

  var currDate = new Date(data.startDate);
  currDate.setHours(0, 0, 0, 0);
  var endDate = new Date(data.endDate);
  endDate.setHours(0, 0, 0, 0);

  while (currDate <= endDate) {
    dates.push(currDate);
    currDate = new Date(currDate);
    currDate.setDate(currDate.getDate() + 1);
  }

  data.categories.forEach(function (c) {
    categories[c.name] = c.sums;
  });

  missionCounts = data.missionCounts;

  initView();

}

function showTitleIfApplicable() {
  var meta = getMeta();

  if (meta && meta.properties) {
    var titleEl = document.querySelector('.spreadsheet-title');
    titleEl.textContent = meta.properties.title;
  }
}

function initView() {

  var today = new Date();

  var categoriesEl = document.querySelector('.categories');
  var commentEl = document.querySelector('.comment');
  var prevEl = document.querySelector('.days-page .prev');
  var nextEl = document.querySelector('.days-page .next');

  prevEl.onclick = function () {
    --currentVisibleMonth;
    setWeeksVisibility();
  }

  nextEl.onclick = function () {
    ++currentVisibleMonth;
    setWeeksVisibility();
  }

  function addCalendarWeek(days, weekNum, weekOffset) {
    var calendar = document.querySelector('.calendar tbody');
    var week = document.createElement('tr');
    weeksEls.push(week);
    var daysIdxOffset = (weekNum || 0) * 7;
    if (weekNum !== 0 && weekOffset) {
      daysIdxOffset -= weekOffset;
    }
    week.className = 'calendar-week';
    week.setAttribute('data-month', days[0].getMonth());

    days.forEach(function (day, idx) {
      var dayTD = document.createElement('td');
      var dayEL = document.createElement('div');
      dayEL.className = 'calendar-day';
      if (isToday(day)) {
        dayEL.className += ' today';
      }


      dayTD.appendChild(dayEL);
      dayEL.innerHTML =
        '<div class="date">' + day.getDate() + '/' + (day.getMonth() + 1) + '</div>' +
        '<div class="amount">' + categories[DEF_CAT][idx + daysIdxOffset] + '</div>' +
        `<img style="display:none;" class="loader" src="loading.svg"></img>`;

      if (isiOS()) {
        console.log('iOS events');
        var timer = {};
        dayEL.ontouchstart = (function (index) {
          timer[index] = Date.now();
        }).bind(this, idx);
        dayEL.ontouchend = (function (index) {
          if (Date.now() - timer[index] < 500) {
            togglePresence(this.dates.indexOf(day), undefined);
          } else {
            togglePresence(this.dates.indexOf(day), '');
          }
        }).bind(this, idx)
      } else {
        dayEL.onclick = togglePresence.bind(this, this.dates.indexOf(day), undefined);
        dayEL.oncontextmenu = togglePresence.bind(this, this.dates.indexOf(day), '');
      }

      week.appendChild(dayTD);
      dayEls.push(dayEL);
    });

    //pad beginning of week
    if (days.length < 7 && days[0].getDay() !== 0) {
      var i = 0;
      while (i++ < days[0].getDay()) {
        var dayEL = document.createElement('td');
        week.insertBefore(dayEL, week.firstChild);
      }
    }

    calendar.appendChild(week);
    if (days.length < 7) {
      return weekOffset + (7 - days.length);
    }
    return weekOffset;
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

  function setWeeksVisibility() {
    weeksEls.forEach(function (week) {
      if (parseInt(week.getAttribute('data-month')) === currentVisibleMonth) {
        week.classList.remove('hide');
      } else {
        week.classList.add('hide');
      }
    })

    if (currentVisibleMonth === parseInt(weeksEls[0].getAttribute('data-month'))){
      prevEl.classList.add('hide');
    } else {
      prevEl.classList.remove('hide');
    }

    if (currentVisibleMonth === parseInt(weeksEls[weeksEls.length - 1].getAttribute('data-month'))){
      nextEl.classList.add('hide');
    } else {
      nextEl.classList.remove('hide');
    }
  }

  var week = [];
  var currIdx = 0;
  var weekNum = 0;
  var weekOffset = 0;

  while (this.dates[currIdx]) {
    week.push(this.dates[currIdx]);
    if (this.dates[currIdx].getDay() === 6 || isLastDayOfMonth(this.dates[currIdx]) || currIdx === this.dates.length - 1) {
      weekOffset = addCalendarWeek(week, weekNum++, weekOffset);
      week = [];
    }
    ++currIdx;
  }

  setWeeksVisibility();

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
  var idx =
    evt.target.getAttribute('data-idx') ||          // li
    evt.target.parentNode.getAttribute('data-idx'); // li > span
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
    fixPresence(sData);
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
    var commentLoader = document.querySelector('.comment .loader').style.display = 'inherit';
    var value = commentTA.value;
    selectedSoldier.profile.comment = value;
    // google.script.run.withSuccessHandler(onCommentSave.bind(this, selectedSoldier, value)).setCommentData(selectedSoldier.profile.row, value);
    Action.run(setCommentData.bind(this, selectedSoldier.profile.row, value), onCommentSave.bind(this, selectedSoldier, value));
  }
}

function onCommentSave(selectedSoldier, value, result) {
  var commentTA = document.querySelector('.comment textarea');
  document.querySelector('.comment .loader').style.display = 'none';
  if (result && result.error) {
    commentTA.classList.add('save-error');
    return;
  }
  commentTA.classList.remove('save-error');
  log('comment saved: ' + selectedSoldier.name + ', ' + value);
}

function applyPresence(sData) {
  if (sData.presence && sData.presence.length) {
    sData.presence.forEach(function (val, idx) {
      updatePresenceUI(idx, val);
    });
  }
}

function fixPresence(sData) {
  if (sData.presence && sData.presence.length < dates.length) {
    for (var i = sData.presence.length; i < dates.length; ++i) {
      sData.presence[i] = "";
    }
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
  var atHomeChange;

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

  if (newPresence === 0) {
    atHomeChange = 1;
  } else if (oldPresence === 0) {
    atHomeChange = -1;
  } else {
    atHomeChange = 0;
  }


  dayEls[dayIdx].querySelector('.loader').style.display = 'inherit';
  // google.script.run.withSuccessHandler(onPresenceSave.bind(this, dayIdx, cat, countChange)).setPresenceData(selectedSoldier.idx, dayIdx + 1, newPresence);
  Action.run(setPresenceData.bind(this, selectedSoldier.idx, dayIdx + 1, newPresence), onPresenceSave.bind(this, dayIdx, cat, countChange, atHomeChange));

  return false;
}

function updatePresenceUI(dayIdx, presence) {
  var el = dayEls[dayIdx];
  switch (presence) {
    case 0:
    case '0':
      // day off
      el.classList.remove('present');
      el.classList.remove('sick');
      el.classList.add('off');
      break;
    case 1:
    case '1':
      // present
      el.classList.remove('off');
      el.classList.remove('sick');
      el.classList.add('present');

      break;
    case 2:
    case '2':
      // sick (betim/gimelim)
      el.classList.remove('off');
      el.classList.remove('present');
      el.classList.add('sick');
      break;
    default:
      el.classList.remove('present');
      el.classList.remove('off');
      el.classList.remove('sick');
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

function onPresenceSave(dayIdx, cat, countChange, atHomeChange, result) {
  dayEls[dayIdx].querySelector('.loader').style.display = 'none';
  if (result && result.error) {
    dayEls[dayIdx].classList.add('save-error');
    return;
  }

  dayEls[dayIdx].classList.remove('save-error');

  if (categories[cat] && typeof categories[cat][dayIdx] !== 'undefined') {
    categories[cat][dayIdx] += countChange;
  }
  categories[DEF_CAT][dayIdx] += countChange;

  if (atHomeChange !== 0) {
    categories[AT_HOME_CAT][dayIdx] += atHomeChange;
  }

  if (selectedCategory === cat || selectedCategory === DEF_CAT) {
    updateSumValueByCategory(selectedCategory);
  } else if (selectedCategory === AT_HOME_CAT) {
    updateSumValueByCategory(AT_HOME_CAT);
  }
}

function getPresenceModel(date) {
  var daysBetween = getDaysBetween(data.startDate, date.getTime());
  var dayIdx = daysBetween;

  var dailyPresence = {
    totalPresence: 0,
    totalHome: 0,
    totalSick: 0,
    platoons: new Set(),
  };
  
  data.sList.forEach(function (soldier) {
    var description = soldier.name;
    var regex = /^(.*?)\s*\[.*?\]\s*(.*)$/;

    var match = description.match(regex);

    var name = match[1].trim();
    var platoon = match[2].trim();
    dailyPresence.platoons.add(platoon);

    dailyPresence[platoon] = dailyPresence[platoon] || {};
    dailyPresence[platoon].presence = dailyPresence[platoon].presence || [];
    dailyPresence[platoon].home = dailyPresence[platoon].home || [];
    dailyPresence[platoon].sick = dailyPresence[platoon].sick || [];

    var presence = soldier.presence[dayIdx] + "";
    if (presence === '1') {
      dailyPresence[platoon].presence.push(name);
      ++dailyPresence.totalPresence;
    } else if (presence === '0') {
      dailyPresence[platoon].home.push(name);
      ++dailyPresence.totalHome;
    } else if (presence === '2') {
      dailyPresence[platoon].sick.push(name);
      ++dailyPresence.totalSick;
    }
  });

  return dailyPresence;
}

function createPlatoonView(platoon, dailyPresence, idx) {
  var platoonViewEl = document.createElement('div');
  platoonViewEl.className = 'platoon-view';

  platoonViewEl.innerHTML = 
    `<div class="head">
      <label>${platoon}</label>
      <label class="presence-len">${dailyPresence[platoon].presence.length}</label>
      <label class="action_btn" onclick="showPlatoonPresenceList(${idx})">הצג רשימה</label>
    </div>
    <div class="platoon-presence platoon-presence_${idx} hide">
      <div class="sub-head">
        <label>נוכחים</label>
      </div>
      <ul class="presence-list">
        ${
          function() {
            var lis = '';
            dailyPresence[platoon].presence.forEach(function(name) {
              lis += `<li>${name}</li>`;
            })
            return lis;
          }()
        }
      </ul>
      ${
        function() {
          if (dailyPresence[platoon].home.length) {
            return `
              <div class="sub-head">
                <label>בחופשה (${dailyPresence[platoon].home.length})</label>
              </div>
              <ul class="presence-list">
                ${
                  function() {
                    var lis = '';
                    dailyPresence[platoon].home.forEach(function(name) {
                      lis += `<li>${name}</li>`;
                    })
                    return lis;
                  }()
                }
              </ul>`
          }
          return '';
        }()
      }
      ${
        function() {
          if (dailyPresence[platoon].sick.length) {
            return `
              <div class="sub-head">
                <label>במחלה (${dailyPresence[platoon].sick.length})</label>
              </div>
              <ul class="presence-list">
                ${
                  function() {
                    var lis = '';
                    dailyPresence[platoon].sick.forEach(function(name) {
                      lis += `<li>${name}</li>`;
                    })
                    return lis;
                  }()
                }
              </ul>`
          }
          return '';
        }()
      }
    </div>
  `
  return platoonViewEl;
}

function showPresenceModal() {
  var currentDate = new Date();

  var dailyPresence = getPresenceModel(currentDate);

  var dailyModalEl = document.querySelector('.daily-view-modal');
  var dailyModalTitleEl = document.querySelector('.daily-view-modal .title');
  dailyModalTitleEl.innerText = `נוכחות יומית ${currentDate.getDate() + '/' + (currentDate.getMonth() + 1)}`;
  var dailyModalListsEl = document.querySelector('.daily-view-modal .lists');
  var dailyModalSubTitleEl = document.querySelector('.daily-view-modal .sub-title');
  var subTitleText = `נוכחים ${dailyPresence.totalPresence} `;
  if (dailyPresence.totalHome) {
    subTitleText += `| חופשה ${dailyPresence.totalHome} `;
  }
  if (dailyPresence.totalSick) {
    subTitleText += `| מחלה ${dailyPresence.totalSick} `;
  }
  dailyModalSubTitleEl.innerText = subTitleText;
  var dailyModalListsEl = document.querySelector('.daily-view-modal .lists');
  dailyModalListsEl.innerHTML = '';

  var count = 0;
  for (var platoon of dailyPresence.platoons) {
    ++count;
    var platoonViewEl = createPlatoonView(platoon, dailyPresence, count);
    dailyModalListsEl.appendChild(platoonViewEl);
  }

  dailyModalEl.classList.remove('hide');
}

function showPlatoonPresenceList(platoonIdx) {
  var platoonViewEl = document.querySelector(`.platoon-presence_${platoonIdx}`);
  platoonViewEl.classList.toggle('hide');
}

function hidePresenceModal() {
  var dailyModalEl = document.querySelector('.daily-view-modal');
  dailyModalEl.classList.add('hide');
}

function sharePresenceOnWhatsapp() {
  var currentDate = new Date();

  var dailyPresence = getPresenceModel(currentDate);
  var whatsappNewline = '%0a';

  var msg = `*נוכחות יומית ${currentDate.getDate() + '/' + (currentDate.getMonth() + 1)}*${
    whatsappNewline + whatsappNewline
  }${
    `סהכ נוכחים: ${dailyPresence.totalPresence}${whatsappNewline}סהכ בחופשה: ${dailyPresence.totalHome}${whatsappNewline}סהכ במחלה: ${dailyPresence.totalSick}${whatsappNewline}${whatsappNewline}`
  }
  ${
    function() {
      var companyLst = '';
      for (var platoon of dailyPresence.platoons) {
        var platoonLst = 
        `*[${platoon.length === 1 ? 'מחלקה' : 'מחלקת'} ${platoon}]*${whatsappNewline}${whatsappNewline}${
          function() {
            var lis = `*_נוכחים (${dailyPresence[platoon].presence.length})_*${whatsappNewline}`;
            dailyPresence[platoon].presence.forEach(function(name) {
              lis += `${name}${whatsappNewline}`;
            })
            return `${lis}${whatsappNewline}`;
          }()
        }${
          function() {
            if (dailyPresence[platoon].home.length) {
              var lis = `*_בחופשה (${dailyPresence[platoon].home.length})_*${whatsappNewline}`;
              dailyPresence[platoon].home.forEach(function(name) {
                lis += `${name}${whatsappNewline}`;
              })
              return `${lis}${whatsappNewline}`;
            }
            return '';
          }()
        }${
          function() {
            if (dailyPresence[platoon].sick.length) {
              var lis = `*_במחלה (${dailyPresence[platoon].sick.length})_*${whatsappNewline}`;
              dailyPresence[platoon].sick.forEach(function(name) {
                lis += `${name}${whatsappNewline}`;
              })
              return `${lis}${whatsappNewline}`;
            }
            return '';
          }()
        }`

        companyLst += `${platoonLst}${whatsappNewline}`;
      }
      return companyLst;
    }()
  }`

  var whatsapp_url = `whatsapp://send?text=${msg}`;
  console.log(whatsapp_url);
  window.location.href = whatsapp_url;
}

function clearSearchbarValue() {
  document.querySelector('.search-bar').value = '';
}

function showSpreadsheet() {
  var wrapper = document.querySelector('.spreadsheet-wrapper');
  wrapper.classList.remove('shrink');
}