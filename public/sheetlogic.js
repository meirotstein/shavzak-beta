var SETTINGS = {};

var data = {
  sList: [],
  categories: [],
  missionCounts: {},
  soldiers: []
};

var MainSheet = SpreadsheetApp.getActive().getSheetByName('נוכחות');
var MissionsSheet = SpreadsheetApp.getActive().getSheetByName('משימות');
var SoldiersSheet = SpreadsheetApp.getActive().getSheetByName('חיילים');
var SettingsSheet = SpreadsheetApp.getActive().getSheetByName('settings');

function showManagementDialog() {
  var html = HtmlService.createHtmlOutputFromFile('mg_dialog')
    .setWidth(400)
    .setHeight(300);

  SpreadsheetApp.getUi() // Or DocumentApp or SlidesApp or FormApp.
    .showSidebar(html);
}

async function initSettings() {
  var presenceSettingsRange = await SettingsSheet.getRange(1, 2, 40);
  var presenceSettings = presenceSettingsRange.getValues().map(function (val) { return val[0] });

  var missionsSettingsRange = await SettingsSheet.getRange(1, 4, 40);
  var missionsSettings = missionsSettingsRange.getValues().map(function (val) { return val[0] });

  var soldiersSettingsRange = await SettingsSheet.getRange(1, 6, 40);
  var soldiersSettings = soldiersSettingsRange.getValues().map(function (val) { return val[0] });

  console.log({ presenceSettings: presenceSettings, missionsSettings: missionsSettings, soldiersSettings: soldiersSettings });

  SETTINGS = {
    NAME_COL: presenceSettings[0],  // also affects CAT col
    NAME_ROW_S: presenceSettings[1],
    NAME_ROW_L: presenceSettings[2],
    CAT_ROW_S: presenceSettings[3],
    CAT_ROW_L: presenceSettings[4],
    DATE_COL: 'B',
    DATE_START_IDX: 1,
    DATE_END_IDX: 2,

    JOB_ROW_S: 2,
    JOB_COL: 3,
    JOB_COL_L: missionsSettings[0],
    MISSION_ROW_S: missionsSettings[1],
    MISSION_COL: 3,
    JOB_COL_L: missionsSettings[0],

    SOL_ROW_S: 3,
    SOL_ROW_L: soldiersSettings[0],
    SOL_COL: 1,
    SOL_COL_L: 7,
  }
}

async function loadData() {

  await initSettings();

  var period = await MainSheet.getRange(SETTINGS.DATE_COL + SETTINGS.DATE_START_IDX + ':' + SETTINGS.DATE_COL + SETTINGS.DATE_END_IDX);
  data.startDate = period.getValues()[0][0].getTime();
  data.endDate = period.getValues()[1][0].getTime();

  var numOfDays = (data.endDate - data.startDate) / (1000 * 60 * 60 * 24) + 1;

  var sList = [];
  var nameRange = await MainSheet.getRange(SETTINGS.NAME_ROW_S, SETTINGS.NAME_COL, SETTINGS.NAME_ROW_L, numOfDays + 1);
  for (var i = 0; i < SETTINGS.NAME_ROW_L; ++i) {
    var values = nameRange.getValues();
    if(!values || !values.length) {
      throw 'no_names_error';
    }
    var name = values[i] && values[i][0];
    if (name) {
      var presence = values[i].slice(1);
      data.sList.push({
        idx: SETTINGS.NAME_ROW_S + i,
        name: name,
        presence: presence
      });
    }
  }

  var categoryRange = await MainSheet.getRange(SETTINGS.CAT_ROW_S, SETTINGS.NAME_COL, SETTINGS.CAT_ROW_L, numOfDays + 1);
  var categories = categoryRange.getValues();
  for (var i = 0; i < SETTINGS.CAT_ROW_L; ++i) {
    var cat = categories[i][0];
    if (cat) {
      var sums = categories[i].slice(1);
      data.categories.push({
        name: cat,
        sums: sums
      });
    }
  }

  var jobsRange = await MissionsSheet.getRange(SETTINGS.JOB_ROW_S, SETTINGS.JOB_COL, 1, SETTINGS.JOB_COL_L);
  var jobs = jobsRange.getValues();
  var missionRange = await MissionsSheet.getRange(SETTINGS.MISSION_ROW_S, SETTINGS.MISSION_COL, 1, SETTINGS.MISSION_COL_L);
  var missionCounts = missionRange.getValues();

  if (jobs && jobs.length && missionCounts && missionCounts.length) {
    jobs[0].forEach(function (job, idx) {
      data.missionCounts[job] = missionCounts[0][idx];
    });
  }

  var soldiersRange = await SoldiersSheet.getRange(SETTINGS.SOL_ROW_S, SETTINGS.SOL_COL, SETTINGS.SOL_ROW_L, SETTINGS.SOL_COL_L);
  var soldiers = soldiersRange.getValues();

  if (soldiers && soldiers.length) {
    soldiers.forEach(function (s, idx) {
      data.soldiers.push({
        row: SETTINGS.SOL_ROW_S + idx,
        id: s[0],
        fullName: s[1],
        platoon: s[2],
        role: s[3],
        description: s[4],
        comment: s[5] || ''
      });
    });
  }

  return data;
}

async function setPresenceData(sIndex, dayIdx, value) {
  var range = await MainSheet.getRange(sIndex, dayIdx + SETTINGS.NAME_COL, 1);
  if (range) {
    return range.setValue(value);
  }
}

async function setCommentData(rowIdx, value) {
  var range = await SoldiersSheet.getRange(rowIdx, 6);
  if (range) {
    return range.setValue(value);
  }
}

function foo() {
  loadData();
  setCommentData(3, 'sdfsd');
}