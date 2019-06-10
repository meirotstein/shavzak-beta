var express = require('express');
var app = express();
const https = require('https')
const fs = require('fs')
const settings = JSON.parse(fs.readFileSync('./settings.json'));
app.use(express.static('public'));

if (settings.http) {
  app.listen(settings.http.port);
  console.log(`http server is available on http://localhost:${settings.http.port}`);
}

if (settings.https && settings.https.key && settings.https.cert) {
  const httpsOptions = {
    key: fs.readFileSync(settings.https.key),
    cert: fs.readFileSync(settings.https.cert)
  }
  const server = https.createServer(httpsOptions, app).listen(settings.https.port);
  console.log(`https server is available on http://localhost:${settings.https.port}`);
}