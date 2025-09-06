const TIME_DOMAIN_DROPDOWN_CELL = 'BG4';
const FIRST_DAY_OF_WEEK_DROPDOWN_CELL = 'BG6';
const WEEKS_IN_ROW_DROPDOWN_CELL = 'BG8';
const WEEK_AXIS_DROPDOWN_CELL = 'BG10';
const DIRECTION_DROPDOWN_CELL = 'BG12';

const TASK_COMPLETED_COUNTER = 'BE6';
const webhookSetupModal = HtmlService.createTemplateFromFile("template/doGet");
const MS_IN_DAY = 24 * 60 * 60 * 1000;
const FIRST_DATA_ROW = 2;

function getDataRowFromDateString(dateString) {
  const dataSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Data');
  const firstCellValue = dataSheet.getRange(`A${FIRST_DATA_ROW}`).getValue();
  if (firstCellValue == "") {
    return FIRST_DATA_ROW;
  }
  const firstTime = new Date(firstCellValue).getTime();
  const currentTime = new Date(dateString).getTime();
  const rowOffset = (currentTime - firstTime) / MS_IN_DAY;
  const dataRow = rowOffset + FIRST_DATA_ROW;
  const lastRow = dataSheet.getMaxRows();

  if (rowOffset < 0) {
    dataSheet.insertRowsBefore(FIRST_DATA_ROW, Math.abs(rowOffset));
    return FIRST_DATA_ROW;
  } else if (lastRow < dataRow) {
    dataSheet.insertRowsAfter(lastRow, dataRow - lastRow);
  }

  return dataRow;
}

function writeTaskData(dailiesCompletedMap) {
  const dataSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Data');

  for (const [dateString, { idsDue, idsCompleted }] of Object.entries(dailiesCompletedMap)) {
    const dataRow = getDataRowFromDateString(dateString);
    const [[
      oldIdsDue,
      oldIdsCompleted,
    ]] = dataSheet.getRange(`B${dataRow}:C${dataRow}`).getValues();
    let newIdsDue;
    let newIdsCompleted;
    const today = new Date();
    const rowDate = new Date(dateString);

    // If a task is older than a month, Habitica may have lost our data, so we will
    // join the cached results with the currently fetched results as a best effort
    if (monthDiff([rowDate, today]) >= 1) {
      newIdsDue = Array.from(new Set([...oldIdsDue.split(','), ...idsDue].filter(Boolean)));
      newIdsCompleted = Array.from(new Set([...oldIdsCompleted.split(','), ...idsCompleted].filter(Boolean)));
    } else {
      // Less than a month, it's more likely that a change in due / completed is intentional
      // and not a result of lost data
      newIdsDue = idsDue;
      newIdsCompleted = idsCompleted;
    }

    dataSheet.getRange(`A${dataRow}:E${dataRow}`).setValues([[
      dateString,
      newIdsDue.join(','),
      newIdsCompleted.join(','),
      newIdsDue.length,
      newIdsCompleted.length,
    ]]);
  }
}

function updateTaskData() {
  const response = fetchUserInfo();
  const dailiesCompletedMap = response.data
    .filter((task) => task.type === 'daily')
    .reduce((acc, { history, id }) => {
      for (const { date, isDue, completed } of history) {
        const dateString = new Date(date).toDateString();
        const row = acc[dateString] ?? {
          idsDue: [],
          idsCompleted: [],
        };
        if (isDue) row.idsDue.push(id);
        if (completed) row.idsCompleted.push(id);
        acc[dateString] = row;
      }
      return acc;
    }, {});
  writeTaskData(dailiesCompletedMap);
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
    case WEEKS_IN_ROW_DROPDOWN_CELL:
    case WEEK_AXIS_DROPDOWN_CELL:
    case FIRST_DAY_OF_WEEK_DROPDOWN_CELL:
    case DIRECTION_DROPDOWN_CELL:
      renderActivityGraph();
      break;
  }
}

function getTaskData() {
  const dataSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Data');
  const lastRow = dataSheet.getLastRow();
  const rows = Array.from(dataSheet.getRange(`A2:E${lastRow}`).getValues());
  return rows.reduce((acc, [date, idsDue, idsCompleted]) => {
    if (date) {
      const dateString = new Date(date).toDateString();
      const time = new Date(dateString).getTime();
      acc[dateString] = {
        dateString,
        idsDue: idsDue.split(','),
        idsCompleted: idsCompleted.split(','),
        time,
      };
    }
    return acc;
  }, {});
}

const BG_CELL_COLOR = '#0d1117';
// 0%
const EMPTY_CELL_COLOR = '#151b23';
// 1% - 33%
const FIRST_THIRD_CELL_COLOR = '#033a16';
// 34% - 66%
const SECOND_THIRD_CELL_COLOR = '#196c2e';
// 67% - 99%
const LAST_THIRD_CELL_COLOR = '#2ea043';
// 100%
const COMPLETED_CELL_COLOR = '#56d364';

const STREAK_CELL_COLOR = '#ffc512';
const STREAK_FLOWER = '🌻';
const TODAY_PLANT = '🪴';

const TEXT_COLOR = '#f0f6fc';

function clearGraph() {
  const trackerSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Tracker');
  const graphRange = trackerSheet.getRange('B2:BC58');
  graphRange.clear();
  graphRange.setNote(null);
  graphRange.setBackground(BG_CELL_COLOR);
  graphRange.setFontColor(TEXT_COLOR);
  graphRange.setFontFamily('Google Sans');
  graphRange.setFontSize(9);
  graphRange.setBorder(
    true,
    true,
    true,
    true,
    true,
    true,
    BG_CELL_COLOR,
    SpreadsheetApp.BorderStyle.SOLID_THICK,
  );
}

const GRAPH_START_COLUMN = 'C';
const GRAPH_START_COLUMN_INDEX = 3;
const GRAPH_START_ROW = 3;
const GRAPH_END_COLUMN = 'BC';
const GRAPH_END_COLUMN_INDEX = 55;
const LABEL_ROW = 2;
const LABEL_COLUMN = 'B';


function monthDiff([dateFrom, dateTo]) {
  return dateTo.getMonth() - dateFrom.getMonth() +
    (12 * (dateTo.getFullYear() - dateFrom.getFullYear()))
}

function getInclusiveDaysBetweenDates([first, second]) {
  return Math.round((second - first) / (MS_IN_DAY)) + 1;
}

const DAYS = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];

/**
 * 
 * @returns {[Date, Date]}
 */
function getDateRange() {
  const trackerSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Tracker');
  const timeDomain = trackerSheet.getRange(TIME_DOMAIN_DROPDOWN_CELL).getValue();
  const weeksInRow = trackerSheet.getRange(WEEKS_IN_ROW_DROPDOWN_CELL).getValue();
  const firstDay = DAYS.indexOf(trackerSheet.getRange(FIRST_DAY_OF_WEEK_DROPDOWN_CELL).getValue());
  const lastDay = firstDay - 1 < 0 ? firstDay - 1 + 7 : firstDay - 1;

  switch (timeDomain) {
    case 'Last 12 Months':
      const startDate = new Date(new Date().toDateString());
      startDate.setMonth(startDate.getMonth() - 12);
      let firstDayDiff = startDate.getDay() - firstDay;
      if (firstDayDiff < 0) {
        firstDayDiff += 7;
      }
      startDate.setDate(startDate.getDate() - firstDayDiff);

      const endDate = new Date(new Date().toDateString());
      let lastDayDiff = lastDay - endDate.getDay();
      if (lastDayDiff < 0) {
        lastDayDiff += 7;
      }
      endDate.setDate(endDate.getDate() + lastDayDiff);
      const diffMod = getInclusiveDaysBetweenDates([startDate, endDate]) % (weeksInRow * 7);
      // If the number of weeks per row doesn't mod evenly into the total days,
      // add the difference so that we have an even grid
      if (diffMod !== 0) {
        endDate.setDate(endDate.getDate() + (weeksInRow * 7 - diffMod));
      }
      return [startDate, endDate];
  }
}

function getGraphConfig() {
  const trackerSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Tracker');
  const firstDay = trackerSheet.getRange(FIRST_DAY_OF_WEEK_DROPDOWN_CELL).getValue();
  const weeksInRow = trackerSheet.getRange(WEEKS_IN_ROW_DROPDOWN_CELL).getValue();
  const weekAxis = trackerSheet.getRange(WEEK_AXIS_DROPDOWN_CELL).getValue();
  const direction = trackerSheet.getRange(DIRECTION_DROPDOWN_CELL).getValue();
  const dateRange = getDateRange();
  const totalDays = getInclusiveDaysBetweenDates(dateRange);
  const isVertical = weekAxis === 'Vertical';
  const width = isVertical ?
    totalDays / (weeksInRow * 7) :
    weeksInRow * 7;
  const height = totalDays / width;

  return {
    isNormal: direction === 'Normal',
    firstDay,
    weeksInRow,
    weekAxis,
    width,
    height,
    isVertical,
    dateRange,
  };
}

function getGraphCells() {
  const { isNormal, isVertical, dateRange, width, height } = getGraphConfig();
  const [startDate] = dateRange;
  const graph = [...new Array(height)].map(() => new Array(width));
  const cellLookup = {};

  for (let i = 0; i < height; i++) {
    for (let j = 0; j < width; j++) {
      let dayOffset;
      if (isVertical && isNormal) {
        dayOffset = i + (height * j);
      } else if (isVertical) {
        dayOffset = i + (height * (height - 1 - j));
      } else if (!isVertical && isNormal) {
        dayOffset = j + (width * i);
      } else {
        dayOffset = j + (width * (width - 1 - i));
      }
      const cellDate = new Date(startDate);
      cellDate.setDate(cellDate.getDate() + dayOffset);
      const cellDateString = cellDate.toDateString();
      graph[i][j] = {
        date: cellDateString,
        row: GRAPH_START_ROW + i,
        col: GRAPH_START_COLUMN_INDEX + j,
      };
      cellLookup[cellDateString] = {
        row: GRAPH_START_ROW + i,
        col: GRAPH_START_COLUMN_INDEX + j,
      };
    }
  }

  return { cellLookup, graph };
}

const MONTHS = [
  'Jan', 'Feb',
  'Mar', 'Apr',
  'May', 'Jun',
  'Jul', 'Aug',
  'Sep', 'Oct',
  'Nov', 'Dec'
];

const DAY_LABELS = [
  'Sun',
  'Mon',
  'Tue',
  'Wed',
  'Thu',
  'Fri',
  'Sat',
];

function drawLabels() {
  const trackerSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Tracker');
  const { isVertical } = getGraphConfig();
  const { graph } = getGraphCells();

  // Days on the left, months on the top
  if (isVertical) {
    for (let i = 0; i < graph.length; i += 2) {
      const cell = graph[i][0];
      const date = new Date(cell.date);
      const dayLabel = DAY_LABELS[date.getDay()];
      trackerSheet.getRange(cell.row, cell.col - 1).setValue(dayLabel + '   ');
    }

    const labels = new Set();
    const labelPoints = new Set();
    for (let i = 0; i < graph[0].length; i++) {
      const cell = graph[0][i];
      const date = new Date(cell.date);
      const monthYear = `${date.getMonth()}-${date.getFullYear()}`;
      // always draw the first cell label
      if (i === 0) {
        labelPoints.add(i);
        labels.add(monthYear);
      } else if (!labels.has(monthYear) && (!labelPoints.has(i - 1) || i === graph.length - 1)) {
        labelPoints.add(i);
        labels.add(monthYear);
      }

      if (labelPoints.has(i)) {
        trackerSheet.getRange(cell.row - 1, cell.col).setValue(MONTHS[date.getMonth()] + '   ');
      }
    }
  }
}

function getCompletionGradientCellColor(percentDone) {
  if (percentDone === 0) return EMPTY_CELL_COLOR;
  if (percentDone <= 0.333) return FIRST_THIRD_CELL_COLOR;
  if (percentDone <= 0.666) return SECOND_THIRD_CELL_COLOR;
  if (percentDone <= 0.999) return LAST_THIRD_CELL_COLOR;
  return COMPLETED_CELL_COLOR;
}

function getCellColors(taskData) {
  // in descending chronological order
  const tasks = Object.values(taskData)
    .sort((a, b) => b.time - a.time);

  const today = new Date().toDateString();
  let isStreak = true;
  return tasks
    .reduce((acc, { idsCompleted, idsDue, dateString }, index) => {
      const percentDone = idsCompleted.length / idsDue.length;
      // we don't need to have completed all of today's tasks for the streak to continue
      if (dateString === today) {
        if (percentDone === 1) {
          const previousTask = tasks[index + 1];
          if (previousTask.idsCompleted / previousTask.idsDue === 1) {
            acc[dateString] = STREAK_CELL_COLOR;
            return acc;
          }
        }
        acc[dateString] = getCompletionGradientCellColor(percentDone);
        return acc;
      } else if (isStreak === true) {
        if (percentDone === 1) {
          acc[dateString] = STREAK_CELL_COLOR;
          return acc;
        }
        isStreak = false;
      }
      acc[dateString] = getCompletionGradientCellColor(percentDone);
      return acc;
    }, {});
}

function renderActivityGraph() {
  const trackerSheet = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Tracker');
  const config = getGraphConfig();
  const taskData = getTaskData();

  clearGraph();
  trackerSheet.showColumns(
    GRAPH_START_COLUMN_INDEX,
    GRAPH_END_COLUMN_INDEX - GRAPH_START_COLUMN_INDEX
  );
  if (config.width < GRAPH_END_COLUMN_INDEX - GRAPH_START_COLUMN_INDEX) {
    trackerSheet.hideColumns(
      GRAPH_START_COLUMN_INDEX + config.width,
      GRAPH_END_COLUMN_INDEX - GRAPH_START_COLUMN_INDEX - config.width,
    );
  }

  drawLabels();

  const { graph } = getGraphCells();
  const cellColorMap = getCellColors(taskData);
  const today = new Date();
  const todayString = today.toDateString()
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayString = yesterday.toDateString();
  for (const row of graph) {
    for (const cell of row) {
      const color = cellColorMap[cell.date] ?? EMPTY_CELL_COLOR;
      const cellRange = trackerSheet.getRange(cell.row, cell.col);
      cellRange.setBackground(color);
      if (cell.date === todayString) {
        if (color === STREAK_CELL_COLOR) {
          cellRange.setValue(STREAK_FLOWER);
        } else {
          cellRange.setValue(TODAY_PLANT);
        }
      } else if (cell.date === yesterdayString && color === STREAK_CELL_COLOR) {
        if (cellColorMap[todayString] !== STREAK_CELL_COLOR) {
          cellRange.setValue(STREAK_FLOWER);
        }
      }
    }
  }
}

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
  const { userId, apiKey } = getLoginCreds();

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

