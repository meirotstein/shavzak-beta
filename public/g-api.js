// Enter an API key from the Google API Console:
//   https://console.developers.google.com/apis/credentials
var apiKey = 'AIzaSyBqkmtsyrL9cZo5gnvCQsi_7cjj9mTo10w';

// Enter the API Discovery Docs that describes the APIs you want to
// access. In this example, we are accessing the People API, so we load
// Discovery Doc found here: https://developers.google.com/people/api/rest/
var discoveryDocs = ["https://sheets.googleapis.com/$discovery/rest?version=v4"];

// Enter a client ID for a web application from the Google API Console:
//   https://console.developers.google.com/apis/credentials?project=_
// In your API Console project, add a JavaScript origin that corresponds
//   to the domain where you will be running the script.
var clientId = '405201608861-r6i2r3pju0e3lvlt2m40b3d6drf9ik73.apps.googleusercontent.com';

// Enter one or more authorization scopes. Refer to the documentation for
// the API or https://developers.google.com/people/v1/how-tos/authorizing
// for details.
var scopes = 'https://www.googleapis.com/auth/spreadsheets';

var spreadsheetId = fetchSpreadsheetId();

var authorizeButton = document.getElementById('authorize-button');
var signoutButton = document.getElementById('signout-button');
var signedInUser = document.getElementById('signin-user-name');
var initLoader = document.getElementById('init-loader');

function iniFrame() {
  return window.self !== window.top;
}

function toggleInitLoader(show) {
  if (show) {
    initLoader.style.display = 'block';
  } else {
    initLoader.style.display = 'none';
  }
}

function saveToLocalStorage(spid, doNotReload) {
  localStorage.setItem('spreadsheet--id', spid);
  if (!doNotReload) {
    location.reload();
  }
}

function fetchSpreadsheetId() {
  const url = new URL(location.href);
  const spidAsParam = url.searchParams.get('spid');
  if (spidAsParam) {
    saveToLocalStorage(spidAsParam, true);
  }
  return localStorage.getItem('spreadsheet--id');
}

function handleClientLoad() {
  if (iniFrame()) {
    document.body.className = 'in-iframe';
  }
  // Load the API client and auth2 library
  gapi.load('client:auth2', initClient);
}

function initClient() {
  gapi.client.init({
    apiKey: apiKey,
    discoveryDocs: discoveryDocs,
    clientId: clientId,
    scope: scopes
  }).then(function () {
    // Listen for sign-in state changes.
    gapi.auth2.getAuthInstance().isSignedIn.listen(updateSigninStatus);

    // Handle the initial sign-in state.
    updateSigninStatus(gapi.auth2.getAuthInstance().isSignedIn.get());

    authorizeButton.onclick = handleAuthClick;
    signoutButton.onclick = handleSignoutClick;
  });
}

function updateSigninStatus(isSignedIn) {
  if (isSignedIn) {
    window.userProfile = gapi.auth2.getAuthInstance().currentUser.get().getBasicProfile();

    authorizeButton.style.display = 'none';
    signoutButton.style.display = 'block';

    signedInUser.style.display = 'block';
    signedInUser.textContent = userProfile.getEmail();

    toggleInitLoader(true);

    initLoad();
    // makeApiCall();
  } else {
    authorizeButton.style.display = 'block';
    signoutButton.style.display = 'none';


    toggleInitLoader(false);
  }
}

function handleAuthClick(event) {
  gapi.auth2.getAuthInstance().signIn();
}

function handleSignoutClick(event) {
  gapi.auth2.getAuthInstance().signOut();
  location.reload();
}

function makeApiGetCall(sheet, range, renderOption) {
  return gapi.client.sheets.spreadsheets.values.get({
    spreadsheetId: spreadsheetId,
    valueRenderOption: renderOption || 'UNFORMATTED_VALUE',
    range: `${sheet}!${range}`
  }).then(function (resp) {
    var r = JSON.parse(resp.body);
    console.log(r);
    return r;
  }).catch(function (err) {
    throw { error: err.body };
  });
}

function makeApiUpdateCall(sheet, range, value) {
  return gapi.client.sheets.spreadsheets.values.update({
    spreadsheetId: spreadsheetId,
    range: `${sheet}!${range}`,
    valueInputOption: 'RAW',
    resource: { values: [[value]] },
  }).then(function (resp) {
    var r = JSON.parse(resp.body);
    console.log(r);
    return r;
  }).catch(function (err) {
    // var r = JSON.parse(resp.body);
    console.log(err);
    return { error: err.body };
  });
}