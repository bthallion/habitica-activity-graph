
function request({
  url,
  headers = {},
  options = {},
}) {
  headers = {
    "Content-Type":"application/json",
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
      "x-api-key": scriptProperties.getProperty('HABITICA_API_KEY'),
      "x-api-user": scriptProperties.getProperty('HABITICA_USER_ID'),
      "x-client": "d904bd62-da08-416b-a816-ba797c9ee265-DataDisplayTool"
    },
    options: {
      method: "GET",
    }
  });
  console.log(response.data.filter((task) => ['daily'].includes(task.type)));
  // return fetch("https://habitica.com/api/v3/tasks/user?_=1753248785839", {
  //   "headers": {
  //     "accept": "application/json, text/javascript, */*; q=0.01",
  //     "accept-language": "en-US,en;q=0.9",
  //     "priority": "u=1, i",
  //     "sec-ch-ua": "\"Google Chrome\";v=\"137\", \"Chromium\";v=\"137\", \"Not/A)Brand\";v=\"24\"",
  //     "sec-ch-ua-mobile": "?0",
  //     "sec-ch-ua-platform": "\"macOS\"",
  //     "sec-fetch-dest": "empty",
  //     "sec-fetch-mode": "cors",
  //     "sec-fetch-site": "same-
  //     "x-client": "d904bd62-da08-416b-a816-ba797c9ee265-DataDisplayTool"
  //   },
  //   "referrer": "https://tools.habitica.com/",
  //   "referrerPolicy": "strict-origin-when-cross-origin",
  //   "body": null,
  //   "method": "GET",
  //   "mode": "cors",
  //   "credentials": "omit"
  // });
}

