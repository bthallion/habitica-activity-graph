const TIME_DOMAIN_DROPDOWN_CELL = 'AE3';
const TASK_COMPLETED_COUNTER = 'AE9';
const webhookSetupModal = HtmlService.createTemplateFromFile("template/doGet");

function writeTaskData(userTaskData) {
  const constants = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Data');
  const tasksJson = JSON.stringify(userTaskData);
  const cellCount = Math.ceil(tasksJson.length / 50000);
  for (let i = 0; i < cellCount; i++) {
    const chunk = tasksJson.slice(i*50000, (i+1)*50000);
    constants.getRange(`A${i+2}`).setValue(chunk);
  }
}

function updateTaskData() {
  const response = fetchUserInfo();
  writeTaskData(response);
}

function onOpen() {
  SpreadsheetApp.getUi()
    .createMenu('Habitica')
    .addItem('Set up task activity synchronization', 'runDoGet')
    .addItem('Manually sync task activity', 'updateTaskData')
    .addToUi();

  // updateTaskData();
}

function onEdit(evt) {
  switch (evt.range.getA1Notation()) {
    case TIME_DOMAIN_DROPDOWN_CELL:
      runDoGet();
      break;
  }
}

function renderActivityGraph() { }

function runDoGet() {
  let webAppURL = ScriptApp.getService().getUrl();
  setWebAppURL(webAppURL);
  webhookSetupModal.installTime = getInstallTime();
  SpreadsheetApp.getUi().showModalDialog(webhookSetupModal.evaluate(), getScriptName());
}

function request({
  url,
  headers = {},
  options = {},
}) {
  headers = {
    "Content-Type": "application/json",
    ...headers,
  };
  options = {
    headers,
    ...options,
  };

  const response = UrlFetchApp.fetch(url, options);
  const json = response.getContentText();

  return JSON.parse(json);
}

function fetchUserInfo() {
  const {userId, apiKey} = getLoginCreds();

  const response = request({
    url: 'https://habitica.com/api/v3/tasks/user?_=1753248785839',
    headers: {
      "accept": "application/json, text/javascript, */*; q=0.01",
      "accept-language": "en-US,en;q=0.9",
      "priority": "u=1, i",
      "sec-ch-ua": "\"Google Chrome\";v=\"137\", \"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": "\"macOS\"",
      "sec-fetch-dest": "empty",
      "sec-fetch-mode": "cors",
      "sec-fetch-site": "same-site",
      "x-api-key": apiKey,
      "x-api-user": userId,
      "x-client": "d904bd62-da08-416b-a816-ba797c9ee265-DataDisplayTool"
    },
    options: {
      method: "GET",
    }
  });
  return response;
}

