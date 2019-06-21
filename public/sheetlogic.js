var CONSTS = {
  NAME_COL: 2,
  NAME_ROW_S: 13,
  NAME_ROW_L: 137,
  CAT_ROW_S: 3,
  CAT_ROW_L: 8,
  DATE_COL: 'B',
  DATE_START_IDX: 1,
  DATE_END_IDX: 2,

  JOB_ROW_S: 2,
  JOB_COL: 3,
  JOB_COL_L: 8,
  MISSION_ROW_S: 16,
  MISSION_COL: 3,
  MISSION_COL_L: 8,

  SOL_ROW_S: 3,
  SOL_ROW_L: 148,
  SOL_COL: 1,
  SOL_COL_L: 7,
}

var data = {
  sList: [],
  categories: [],
  missionCounts: {},
  soldiers: []
};

var MainSheet = SpreadsheetApp.getActive().getSheetByName('נוכחות');
var MissionsSheet = SpreadsheetApp.getActive().getSheetByName('משימות');
var SoldiersSheet = SpreadsheetApp.getActive().getSheetByName('חיילים');

function showManagementDialog() {
  var html = HtmlService.createHtmlOutputFromFile('mg_dialog')
    .setWidth(400)
    .setHeight(300);

  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showSidebar(html);
}

async function loadData() {
  var period = await MainSheet.getRange(CONSTS.DATE_COL + CONSTS.DATE_START_IDX + ':' + CONSTS.DATE_COL + CONSTS.DATE_END_IDX);
  data.startDate = period.getValues()[0][0].getTime();
  data.endDate = period.getValues()[1][0].getTime();

  var numOfDays = (data.endDate - data.startDate) / (1000 * 60 * 60 * 24) + 1;

  var sList = [];
  var nameRange = await MainSheet.getRange(CONSTS.NAME_ROW_S, CONSTS.NAME_COL, CONSTS.NAME_ROW_L, numOfDays + 1);
  for (var i = 0; i < CONSTS.NAME_ROW_L; ++i) {
    var values = nameRange.getValues();
    var name = values[i] && values[i][0];
    if (name) {
      var presence = values[i].slice(1);
      data.sList.push({
        idx: CONSTS.NAME_ROW_S + i,
        name: name,
        presence: presence
      });
    }
  }

  var categoryRange = await MainSheet.getRange(CONSTS.CAT_ROW_S, CONSTS.NAME_COL, CONSTS.CAT_ROW_L, numOfDays + 1);
  var categories = categoryRange.getValues();
  for (var i = 0; i < CONSTS.CAT_ROW_L; ++i) {
    var cat = categories[i][0];
    if (cat) {
      var sums = categories[i].slice(1);
      data.categories.push({
        name: cat,
        sums: sums
      });
    }
  }

  var jobsRange = await MissionsSheet.getRange(CONSTS.JOB_ROW_S, CONSTS.JOB_COL, 1, CONSTS.JOB_COL_L);
  var jobs = jobsRange.getValues();
  var missionRange = await MissionsSheet.getRange(CONSTS.MISSION_ROW_S, CONSTS.MISSION_COL, 1, CONSTS.MISSION_COL_L);
  var missionCounts = missionRange.getValues();

  if (jobs && jobs.length && missionCounts && missionCounts.length) {
    jobs[0].forEach(function (job, idx) {
      data.missionCounts[job] = missionCounts[0][idx];
    });
  }

  var soldiersRange = await SoldiersSheet.getRange(CONSTS.SOL_ROW_S, CONSTS.SOL_COL, CONSTS.SOL_ROW_L, CONSTS.SOL_COL_L);
  var soldiers = soldiersRange.getValues();

  if (soldiers && soldiers.length) {
    soldiers.forEach(function (s, idx) {
      data.soldiers.push({
        row: CONSTS.SOL_ROW_S + idx,
        id: s[0],
        firstName: s[1],
        lastName: s[2],
        platoon: s[3],
        role: s[4],
        description: s[5],
        comment: s[6] || ''
      });
    });
  }

  return data;
}

async function setPresenceData(sIndex, dayIdx, value) {
  var range = await MainSheet.getRange(sIndex, dayIdx + CONSTS.NAME_COL, 1);
  if (range) {
    return range.setValue(value);
  }
}

async function setCommentData(rowIdx, value) {
  var range = await SoldiersSheet.getRange(rowIdx, 7);
  if (range) {
    return range.setValue(value);
  }
}

function foo() {
  loadData();
  setCommentData(3, 'sdfsd');
}