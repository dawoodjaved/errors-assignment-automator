const CONFIG = {
  AIRBRAKE_API_KEY:
    PropertiesService.getScriptProperties().getProperty("AIRBRAKE_API_KEY"),
  AIRBRAKE_API_URL: `https://api.airbrake.io/api/v4/projects/52217/groups?limit=500&key=${PropertiesService.getScriptProperties().getProperty(
    "AIRBRAKE_API_KEY"
  )}`,
  SLACK_WEBHOOK_URL:
    PropertiesService.getScriptProperties().getProperty("SLACK_WEBHOOK_URL"),

  SLACK_CHANNEL_ID:
    PropertiesService.getScriptProperties().getProperty("SLACK_CHANNEL_ID"),

  SLACK_AS_CHANNEL_ID:
    PropertiesService.getScriptProperties().getProperty("SLACK_AS_CHANNEL_ID"),

  SLACK_EZR_CHANNEL_ID:
    PropertiesService.getScriptProperties().getProperty("SLACK_EZR_CHANNEL_ID"),

  SLACK_BOT_TOKEN:
    PropertiesService.getScriptProperties().getProperty("SLACK_BOT_TOKEN"),
  RM_API_URL: "https://pm.7vals.com",
  RM_API_KEY:
    PropertiesService.getScriptProperties().getProperty("REDMINE_API_KEY"),

  SHEET_NAME: "Open Airbrakes",
  RESOLVED_SHEET_NAME: "Resolved Airbrakes",
  ASSIGNMENT_SHEET_NAME: "Daily Assignments",
  SHEET_ID: PropertiesService.getScriptProperties().getProperty("SHEET_ID"),

  EZO_ALLOWED_HOSTS: PropertiesService.getScriptProperties().getProperty("EZO_ALLOWED_HOSTS"),

  AS_ALLOWED_HOSTS: PropertiesService.getScriptProperties().getProperty("AS_ALLOWED_HOSTS"),

  EZR_ALLOWED_HOSTS: PropertiesService.getScriptProperties().getProperty("EZR_ALLOWED_HOSTS"),

  CMMS_ALLOWED_HOSTS: PropertiesService.getScriptProperties().getProperty("CMMS_ALLOWED_HOSTS"),

  ALERT_DAYS_SMALL: 7,
  ALERT_DAYS_LARGE: 3,
  RM_CLOSED_STATUSES: [
    "Resolved (Peer Reviewed)",
    "Feedback",
    "Closed",
    "Deployed",
  ],
  SUPER_HIGH_THRESHOLD: 20,
  ALLOWED_USERS_TO_ASSIGN_ARIBRAKES: PropertiesService.getScriptProperties().getProperty("ALLOWED_USERS_TO_ASSIGN_ARIBRAKES")
};

const USER_IDS = CONFIG.ALLOWED_USERS_TO_ASSIGN_ARIBRAKES.split(",");

function getPlatformFromHost(errorHost) {
  if (CONFIG.EZO_ALLOWED_HOSTS.some(host => host === errorHost)) return "EZO";
  if (CONFIG.AS_ALLOWED_HOSTS.some(host => host === errorHost)) return "AS";
  if (CONFIG.EZR_ALLOWED_HOSTS.some(host => host === errorHost)) return "EZR";
  if (CONFIG.CMMS_ALLOWED_HOSTS.some(host => host === errorHost)) return "CMMS";

  return null;
}

function getChannelIdFromProduct(product) {
  return CONFIG.SLACK_CHANNEL_ID;

  if (product == 'EZO' || product == 'CMMS') return CONFIG.SLACK_EZO_CMMS_CHANNEL_ID;
  if (product == 'EZR') return CONFIG.SLACK_EZR_CHANNEL_ID;
  if (product == 'AS') return CONFIG.SLACK_AS_CHANNEL_ID;

  return null;
}

function createStyledDropdowns(sheetName) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(sheetName);

  // Column headers to find in the sheet
  const headers = ["Product", "RM Status", "Assigned To"];

  // Dropdown values for each column
  const dropdownValues = {
    Product: ["AS", "EZO", "EZR", "CMMS", "Platform"],
    "RM Status": [
      "New",
      "In Progress",
      "Dev Complete",
      "Resolved (Peer Reviewed)",
      "Feedback",
      "Closed",
      "Deployed",
      "Hold",
    ],
    "Assigned To": CONFIG.ALLOWED_USERS_TO_ASSIGN_ARIBRAKES.split(",")
  };

  // Color codes for each value category
  const colors = {
    Product: ["#ADD8E6", "#1E3A8A", "#FF6F61", "#F4A460", "#2F855A"],
    "RM Status": [
      "#FFA07A",
      "#FF4500",
      "#32CD32",
      "#DAA520",
      "#9370DB",
      "#808080",
      "#808080",
      "#808080",
    ],
    "Assigned To": [
      "#FF6347",
      "#FF7F50",
      "#FFD700",
      "#9ACD32",
      "#20B2AA",
      "#4682B4",
      "#8A2BE2",
      "#DA70D6",
      "#FF4500",
      "#8B4513",
    ],
  };

  const data = sheet.getDataRange().getValues();
  const headerRow = data[0];

  headers.forEach((header) => {
    const columnIndex = headerRow.indexOf(header) + 1;
    if (columnIndex === 0) return;

    const range = sheet.getRange(2, columnIndex, sheet.getLastRow() - 1);

    // Check if the range already has data validation
    const validations = range.getDataValidations();
    const hasValidation = validations.flat().some((v) => v !== null);

    // Apply dropdown validation
    const rule = SpreadsheetApp.newDataValidation()
      .requireValueInList(dropdownValues[header], true)
      .setAllowInvalid(false)
      .build();

    range.setDataValidation(rule);

    // Clear existing conditional formatting
    range.clearFormat();

    // Apply conditional formatting with colors
    const newRules = sheet.getConditionalFormatRules();
    dropdownValues[header].forEach((value, index) => {
      const color = colors[header][index % colors[header].length];
      const formatRule = SpreadsheetApp.newConditionalFormatRule()
        .whenTextEqualTo(value)
        .setBackground(color)
        .setFontColor("#FFFFFF")
        .setBold(true)
        .setRanges([range])
        .build();
      newRules.push(formatRule);
    });
    sheet.setConditionalFormatRules(newRules);
  });

  Logger.log("✅ Styled dropdowns created (or skipped if already present).");
}

// =============== FETCH AIRBRAKES ===============
function fetchAirbrakes() {
  return;
  const response = UrlFetchApp.fetch(CONFIG.AIRBRAKE_API_URL, {
    method: "get",
    headers: { key: CONFIG.AIRBRAKE_API_KEY },
  });

  const data = JSON.parse(response.getContentText());

  const allGroups = data.groups || [];

  const filteredGroups = [];

  allGroups.forEach((group) => {
    try {
      const noticeResp = UrlFetchApp.fetch(
        `https://api.airbrake.io/api/v4/projects/52217/groups/${group.id}/notices?key=${CONFIG.AIRBRAKE_API_KEY}`,
        {
          method: "get",
          headers: { key: CONFIG.AIRBRAKE_API_KEY },
        }
      );

      const noticeData = JSON.parse(noticeResp.getContentText());
      const latestNotice = noticeData.notices && noticeData.notices[0];

      const hostname = latestNotice?.context?.hostname;

      if (hostname) {
        group.hostName = hostname;
        filteredGroups.push(group);
      }
    } catch (err) {
      Logger.log(`❌ Failed for group ${group.id}: ${err}`);
    }
  });
  Logger.log(filteredGroups.length)
  detectNewErrors(filteredGroups);
  updateGoogleSheet(filteredGroups);
  //createStyledDropdowns(CONFIG.SHEET_NAME);
}

function updateGoogleSheet(errors) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const existingData = sheet.getDataRange().getValues();
  const headers = existingData[0];
  const idIndex = headers.indexOf("Airbrake ID");
  const occurrenceIndex = headers.indexOf("Occurrence Count");
  const prevOccurrenceIndex = headers.indexOf("Previous Occurrence Count");
  const resolvedIndex = headers.indexOf("Resolved Status");
  const lastUpdatedIndex = headers.indexOf("Last Updated");
  const daysOpenIndex = headers.indexOf("Days Open");

  const idMap = {};
  for (let i = 1; i < existingData.length; i++) {
    idMap[existingData[i][idIndex]] = i + 1;
  }

  const now = new Date();
  errors.forEach((error) => {
    const hostName = error.hostName;
    Logger.log(JSON.stringify(error))
    const errorId = error.id;
    const occurrenceCount =
      error.noticeCount || error.count || error.occurrenceCount || 0;
    const resolved = error.resolved;
    const createdAt = error.createdAt ? new Date(error.createdAt) : null;
    const lastNoticeAt = error.lastNoticeAt
      ? new Date(error.lastNoticeAt).toLocaleString()
      : "";
    if (idMap[errorId]) {
      const rowIndex = idMap[errorId];
      const row = existingData[rowIndex - 1];
      const updates = [];

      const previousOccurrence = parseInt(row[occurrenceIndex]) || 0;
      const previousResolvedStatus = row[resolvedIndex];
      const previousLastUpdated = row[lastUpdatedIndex];

      if (occurrenceCount !== previousOccurrence) {
        sheet.getRange(rowIndex, occurrenceIndex + 1).setValue(occurrenceCount);
        sheet
          .getRange(rowIndex, prevOccurrenceIndex + 1)
          .setValue(previousOccurrence);
        updates.push("Occurrence Count");
      }

      if (resolved !== previousResolvedStatus) {
        sheet.getRange(rowIndex, resolvedIndex + 1).setValue(resolved);
        updates.push("Resolved Status");
      }

      if (lastNoticeAt !== previousLastUpdated) {
        sheet.getRange(rowIndex, lastUpdatedIndex + 1).setValue(lastNoticeAt);
        updates.push("Last Updated");
      }

      if (createdAt && daysOpenIndex !== -1) {
        const daysOpen = Math.floor((now - createdAt) / (1000 * 60 * 60 * 24));
        sheet.getRange(rowIndex, daysOpenIndex + 1).setValue(daysOpen);
        updates.push("Days Open");
      }

      if (updates.length > 0) {
        Logger.log(
          `Updated columns [${updates.join(", ")}] for error ID: ${errorId}`
        );
      } else {
        Logger.log(`No changes for error ID: ${errorId}`);
      }
    } else if (!resolved) {
      // Append new row
      const url = `https://airbrake.io/projects/52217/groups/${errorId}`;
      const message =
        error.errors && error.errors.length > 0
          ? error.errors[0].message
          : "No message";
      const muted = error.muted ? "true" : "false";
      const createdAtStr = createdAt ? createdAt.toLocaleString() : "";
      const lastNoticeStr = error.lastNoticeAt
        ? new Date(error.lastNoticeAt).toLocaleString()
        : "";
      const row = [
        errorId,
        getPlatformFromHost(hostName) || "EZO",
        url,
        message,
        occurrenceCount,
        "0", // Previous Occurrences
        resolved,
        "", // RM Ticket ID
        "", // RM Status
        "", // Assigned To
        "", // Day Assigned
        "", // Days Open
        now.toLocaleString(),
        "", // Slack Thread ID
        muted,
        createdAtStr,
        lastNoticeStr,
      ];
      sheet.appendRow(row);
      Logger.log(`Appended new error: ${errorId}`);
    }
  });
}

// =============== DETECT NEW ERRORS & POST TO SLACK ===============
function detectNewErrors(errors) {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const data = sheet.getDataRange().getValues();
  const existingIDs = data.map((row) => row[0]);
  const newErrors = [];

  errors.forEach((error) => {
    const errorId = error.id;
    const hostName = error.hostName;
    var product = getPlatformFromHost(hostName)
    var channelID = getChannelIdFromProduct(product)
    const url = `https://airbrake.io/projects/52217/groups/${errorId}`;
    const resolved = error.resolved;
    // Check if the error already exists in the sheet
    if (!existingIDs.includes(errorId) && !resolved) {
      Logger.log(`new error ${errorId}`)
      console.log("New error detected: " + errorId);
      const firstError =
        error.errors && error.errors.length > 0 ? error.errors[0] : {};

      const message = firstError.message || "No message";
      const filePath =
        firstError.backtrace && firstError.backtrace.length > 0
          ? firstError.backtrace[0].file
          : "Unknown";

      const lineNumber =
        firstError.backtrace && firstError.backtrace.length > 0
          ? firstError.backtrace[0].line
          : "Unknown";

      const occurrenceCount =
        error.noticeTotalCount || error.occurrenceCount || 0;
      const lastNoticeAt = error.lastNoticeAt
        ? new Date(error.lastNoticeAt).toLocaleString()
        : "Unknown";
      // Prepare the error object for sheet update
      
      newErrors.push({
        id: errorId,
        url: url,
        errors: [{ message }],
        hostName: hostName,
        occurrenceCount: occurrenceCount,
        resolved: resolved,
        muted: error.muted ? "true" : "false",
        createdAt: error.createdAt ? new Date(error.createdAt) : "",
        lastNoticeAt: error.lastNoticeAt ? new Date(error.lastNoticeAt) : "",
      });

      // Send a Slack message for the new error
      sendSlackMessage(
        '',
        CONFIG.SLACK_CHANNEL_ID,
        [
          { title: "📝 Message", value: message },
          {
            title: "🔥 Occurrences",
            value: (
              error.noticeTotalCount ||
              error.occurrenceCount ||
              "0"
            ).toString(),
          },
          { title: "🆔 Error ID", value: errorId },
          { title: "📂 File", value: `${filePath}:*${lineNumber.toString()}*` },
          { title: "📋 Product", value: product },
          { title: "🔗 Link", value: `<${url}|View Error>` },
        ],
        "#E01E5A",
        true
      );
    } else {
      console.log("Error already exists: " + errorId);
    }
  });

  Logger.log(newErrors.length)

  // Update the Google Sheet with new errors
  if (newErrors.length > 0) {
    updateGoogleSheet(newErrors);
  }
}

function extractAirbrakeLink(payload) {
  if (!payload.airbrake_error_url) return null;
  var url = payload.airbrake_error_url;
  
  const match = url.match(/groups\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

// Check if the message is from the Airbrake bot
function isAirbrakeBotMessage(payload) {
  return (
    payload.error &&
    payload.airbrake_error_url &&
    payload.error.project &&
    typeof payload.error.project.name === "string" &&
    payload.error.project.name.toLowerCase().includes("ezofficeinventory")
  );
}

function doPost(e) {
  try {
    const formData = decodeURIComponent(e.postData.contents);
    const payloadString = formData.replace("payload=", "");
    const payload = JSON.parse(payloadString);
    var actionTakenUserName = 'Dawood Javeed';

    if (payload.user && payload.user.id) {
      const actionTakenSlackUserId = payload.user.id;
      actionTakenUserName = findUserName(actionTakenSlackUserId);
      if (!CONFIG.ALLOWED_USERS_TO_ASSIGN_ARIBRAKES.includes(actionTakenSlackUserId)) {
        sendDebugToSlack(`You are not allowed to assign airbrake ${actionTakenUserName}`);
        return;
      }
      
    }

    //sendDebugToSlack(isAirbrakeBotMessage(payload))
    // Check if the message is from the Airbrake bot
    if (isAirbrakeBotMessage(payload)) {
      // Extract Airbrake link from the message
      const airbrakeID = extractAirbrakeLink(payload);
      // sendDebugToSlack(airbrakeID);
      if (airbrakeID) {
        getAirbrakeErrorByIdAndUpdateSheet(airbrakeID);
      }
    } else {
      const responseUrl = payload.response_url;
      //sendDebugToSlack(JSON.stringify(payload.actions))
      const selectedSlackUserID = payload.actions[0].selected_user;
      const blocks = payload.message.blocks;

      let errorId = "";
      let redmineTitle = "";

      const sectionBlock = blocks.find(
        (block) => block.type === "section" && Array.isArray(block.fields)
      );

      //sendDebugToSlack(JSON.stringify(sectionBlock))
      if (sectionBlock && sectionBlock.fields) {
        sectionBlock.fields.forEach((field) => {
          // Normalize text: convert + to space and decode any encoded characters
          const rawText = field.text;
        //  sendDebugToSlack(rawText)
          const decodedText = decodeURIComponent(rawText.replace(/\+/g, " "));
          //sendDebugToSlack(decodedText)
          if (decodedText.includes("Error ID")) {
            errorId = decodedText.split("\n")[1];
          }

          if (decodedText.includes("Message")) {
            redmineTitle = decodedText.split("\n")[1];
          }
        });
      }
      //sendDebugToSlack(errorId)
      //sendDebugToSlack(redmineTitle)
      //sendDebugToSlack(`selected user slack id is here ${selectedSlackUserID}`)
      const userRedmineId = findRedmineId(selectedSlackUserID);
      const assigneeName = findUserName(selectedSlackUserID);
      const airbrakeLink = `https://airbrake.io/projects/52217/groups/${errorId}`;
      const redmineURL = createRedmineTicket(
        selectedSlackUserID,
        userRedmineId,
        errorId,
        redmineTitle,
        `Airbrake: ${airbrakeLink}`,
        actionTakenUserName
      );
      //sendDebugToSlack(redmineURL)
      if (redmineURL) {
        // 🚀 1. Update original message to remove dropdown
        const channelId = payload.channel.id;
        const messageTs = payload.message.ts;
        const title = ":rotating_light: New Airbrake Error Detected!";
        const color = "#E01E5A";

        // Rebuild the original field array
        const sectionBlock = payload.message.blocks.find(
          (b) => b.type === "section" && b.fields
        );
        const fieldsArray = sectionBlock.fields.map((field) => {
          const cleanedText = field.text.replace(/\+/g, " ");
          const decodedText = decodeURIComponent(cleanedText);
          const split = decodedText.split("\n");

          return {
            title: split[0].replace(/\*/g, "").trim(),
            value: split[1] ? split[1].trim() : "",
          };
        });

        fieldsArray.push(
          {
            title: ":bust_in_silhouette: Assigned To",
            value: `<@${selectedSlackUserID}>`,
          },
          {
            title: "🔗 Redmine Ticket",
            value: `<${redmineURL}|View Ticket>`,
          }
        );

        updateSlackMessage(channelId, messageTs, title, fieldsArray, color);

        // 🚀 2. Update Google Sheets with assignment details
        updateGoogleSheetWithAssignment(
          errorId,
          extractRedmineId(redmineURL),
          selectedSlackUserID
        );

        addDailyRedmineAssignmentSummaryInSheet(
          airbrakeLink,
          redmineURL,
          assigneeName
        );
      }
    }
  } catch (err) {
    //sendDebugToSlack("doPost error: " + err)
    Logger.log("doPost error: " + err);
  }
}

function addDailyRedmineAssignmentSummaryInSheet(
  airbrakeLink,
  redmineURL,
  assignee
) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.ASSIGNMENT_SHEET_NAME);

  const assignedAt = new Date();

  sheet.appendRow([airbrakeLink, redmineURL, assignee, assignedAt]);
}

// 🚀 Function to update the Google Sheets row
function updateGoogleSheetWithAssignment(errorId, redmineId, slackUserId) {
  try {
    const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
    const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    const data = sheet.getDataRange().getValues();

    const assignedToName = findUserName(slackUserId);
    const now = new Date();
    const formattedDate = Utilities.formatDate(
      now,
      Session.getScriptTimeZone(),
      "MM/dd/yyyy HH:mm:ss"
    );

    // Find the row with the matching Error ID
    for (let i = 1; i < data.length; i++) {
      if (data[i][0] == errorId) {
        // Assuming 'Error ID' is in column 1
        sheet.getRange(i + 1, 8).setValue(redmineId); // Assigned RM Ticket ID
        sheet.getRange(i + 1, 9).setValue("New"); // RM Status
        sheet.getRange(i + 1, 10).setValue(assignedToName); // Assigned To
        sheet.getRange(i + 1, 11).setValue(formattedDate); // Day Assigned
        Logger.log("✅ Updated sheet for error ID: " + errorId);
        return;
      }
    }

    Logger.log("❌ Error ID not found in the sheet: " + errorId);
  } catch (err) {
    Logger.log("Error updating Google Sheet: " + err);
  }
}

// Helper function to find the user name from Slack ID
function findUserName(slackUserId) {
  for (const key in USER_IDS) {
    if (USER_IDS[key].slackId === slackUserId) {
      return USER_IDS[key].Name;
    }
  }
  return "Unknown User";
}

function findSlackIdByName(name) {
  if (!name) return null;

  for (const key in USER_IDS) {
    if (USER_IDS[key].Name === name) {
      return USER_IDS[key].slackId;
    }
  }
  return null;
}

function extractRedmineId(redmineURL) {
  const match = redmineURL.match(/\/issues\/(\d+)/);
  return match ? match[1] : null;
}
//
function sendDebugToSlack(text) {
  const payload = {
    text: `🐞 *Debug Log:*\n${text}`,
  };

//CONFIG.SLACK_WEBHOOK_URL
  UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  });
}

function getAirbrakeErrorByIdAndUpdateSheet(errorId) {
  try {
    const url = `https://api.airbrake.io/api/v4/projects/52217/groups/${errorId}?key=${CONFIG.AIRBRAKE_API_KEY}`;
    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { "Content-Type": "application/json" },
    });

    if (response.getResponseCode() === 200) {
      const errorData = JSON.parse(response.getContentText());

      if (!errorData) return null;

      var errorDataGroup = errorData.group;
      const allGroups = [errorDataGroup] || [];

      const filteredGroups = [];
      allGroups.forEach((group) => {
        try {
          const noticeResp = UrlFetchApp.fetch(
            `https://api.airbrake.io/api/v4/projects/52217/groups/${group.id}/notices?key=${CONFIG.AIRBRAKE_API_KEY}`,
            {
              method: "get",
              headers: { key: CONFIG.AIRBRAKE_API_KEY },
            }
          );
          const noticeData = JSON.parse(noticeResp.getContentText());
          const latestNotice = noticeData.notices && noticeData.notices[0];

          const hostname = latestNotice?.context?.hostname;
          if (hostname) {
            errorDataGroup.hostName = hostname;
            filteredGroups.push(errorDataGroup);
          }
        } catch (err) {
          Logger.log(`❌ Failed for group ${group.id}: ${err}`);
        }
      });

      if (filteredGroups.length > 0) {
        detectNewErrors(filteredGroups);
        updateGoogleSheet(filteredGroups);
      }
    } else {
      Logger.log(
        "Failed to fetch Airbrake error: " + response.getContentText()
      );
      return null;
    }
  } catch (err) {
    Logger.log("Error fetching Airbrake error: " + err.message);
    return null;
  }
}

// Lookup Redmine ID by Slack User ID
function findRedmineId(slackUserId) {
  for (const username in USER_IDS) {
    if (USER_IDS[username].slackId === slackUserId) {
      return USER_IDS[username].redmineId;
    }
  }
  return null;
}

// Create Redmine Ticket
function createRedmineTicket(
  selectedSlackUserID,
  selectedUserRedmineId,
  airbrakeId,
  subject,
  description,
  actionTakenUserName
) {
  const selectedUser = Object.values(USER_IDS).find(
    (user) => user.slackId === selectedSlackUserID
  );

  //sendDebugToSlack(actionTakenUserName)
  if (!selectedUser) {
    Logger.log("No matching user for Slack ID: " + selectedSlackUserID);
    return null;
  }
  try {
    if (actionTakenUserName) {
      description = `This Airbrake has been Assigned by ${actionTakenUserName}\n\n ${description}`
    }
    const payload = {
      issue: {
        project_id: 2,
        subject: subject,
        description: description,
        tracker_id: 4,
        assigned_to_id: selectedUserRedmineId,
      },
    };
    const response = UrlFetchApp.fetch(`${CONFIG.RM_API_URL}/issues.json`, {
      method: "post",
      contentType: "application/json",
      headers: { "X-Redmine-API-Key": CONFIG.RM_API_KEY },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true,
    });
    const responseData = JSON.parse(response.getContentText());
    const issueId = responseData.issue && responseData.issue.id;
    return `${CONFIG.RM_API_URL}/issues/${issueId}`;
  } catch (err) {
    Logger.log("Error creating Redmine Ticket: " + err);
    return "";
  }
}

function checkEvery3Days() {
  checkAlerts("3-day");
}

function checkEvery7Days() {
  checkAlerts("7-day");
}

function checkRegularly() {
  checkAlerts("regular");
}

// =============== CHECK ALERTS ===============
function checkAlerts(mode) {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  var occuranceRisingMainErrorSent = false;
  var highOccuranceErrorMainErrorSent = false;
  var lowOccuranceErrorMainErrorSent = false;
  var criticalErrorMainErrorSent = false;
  var regularlyErrorMainErrorSent= false;

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const airbrakeId = row[0] ? row[0].toString() : "Unknown ID";
    const message = row[3] || "No Message";
    const url = row[2].toString();
    const occurrence = parseInt(row[4]) || 0;
    const prevOccurrence = parseInt(row[5]) || 0;
    const resolved = row[6];
    const rmTicketId = row[7];
    const rmStatus = row[8] || "Unknown";
    const assigneeName = row[9];
    const redmineUrl = rmTicketId
      ? `${CONFIG.RM_API_URL}/issues/${rmTicketId}`
      : null;
    const assigneeSlackId = findSlackIdByName(assigneeName);

    if (occurrence === 1) continue;
    if (CONFIG.RM_CLOSED_STATUSES.includes(rmStatus)) continue;

    let fields = [
      { title: "📝 Message", value: message },
      { title: "🔗 Link", value: `<${url}|View Error>` },
    ];
    if (redmineUrl)
      fields.push({
        title: "🔗 Redmine Ticket",
        value: `<${redmineUrl}|View Ticket>`,
      });
    if (assigneeSlackId)
      fields.push({ title: "👤 Assignee", value: `<@${assigneeSlackId}>` });

    //✅ RM Still Open
    if (mode === "regular" && resolved && redmineUrl) {
      if(!regularlyErrorMainErrorSent) {
        result = sendSlackMessage("✅ Airbrake Resolved, but RM Still Open", [], "#2EB67D", false, null, "The following errors have been marked as resolved in Airbrake, but the corresponding RM ticket is still open — review needed. Please check the thread to view errors.");
        var regularlyErrorThread = result && result.status == 200 ? result.ts : null;
        regularlyErrorMainErrorSent = true;
      }
      fields.push({ title: "📝 RM Status", value: rmStatus });
      sendSlackMessage(
        "✅ Airbrake Resolved, but RM Still Open",
        fields,
        "#E01E5A",
        !assigneeSlackId,
        regularlyErrorThread
      );
    }

    // 🔁 Rising occurrences (real-time mode)
    if (
      mode === "3-day" &&
      prevOccurrence &&
      occurrence >= prevOccurrence + 3 &&
      !resolved &&
      !rmTicketId
    ) {
      if(!occuranceRisingMainErrorSent) {
        result = sendSlackMessage("⚡ Occurrences Rising!", [], "#2EB67D", false, null, "This error is occurring more frequently — investigate before it escalates. Please check the thread to view errors.");
        var occuranceRisingErrorThread = result && result.status == 200 ? result.ts : null;
        occuranceRisingMainErrorSent = true;
      }
      fields.push(
        { title: "🔺 Previous Occurrences", value: prevOccurrence.toString() },
        { title: "🔺 Current Occurrences", value: occurrence.toString() }
      );
      sendSlackMessage(
        "⚡ Occurrences Rising!",
        fields,
        "#F2C744",
        !assigneeSlackId,
        occuranceRisingErrorThread
      );
      continue;
    }

    // 🔥 High occurrence (mode=3-day)
    if (mode === "3-day" && occurrence > 10 && !resolved && !rmTicketId) {
      if(!highOccuranceErrorMainErrorSent) {
        result = sendSlackMessage("🔥 High-Occurrence Error", [], "#2EB67D", false, null, "The following errors have occurred more than 10 times — may indicate a recurring issue. Please check the thread to view errors.");
        var highOccuranceErrorThread = result && result.status == 200 ? result.ts : null;
        highOccuranceErrorMainErrorSent = true;
      }
      fields.push({ title: "🔥 Occurrences", value: occurrence.toString() });
      sendSlackMessage(
        "🔥 High-Occurrence Error",
        fields,
        "#F4A261",
        !assigneeSlackId,
        highOccuranceErrorThread
      );
      continue;
    }

    // ⚠️ Low occurrence (mode=7-day)
    if (mode === "7-day" && occurrence <= 10 && !resolved) {
      if(!lowOccuranceErrorMainErrorSent) {
        result = sendSlackMessage("⚠️ Low-Occurrence Error Pending for 7+ Days", [], "#2EB67D", false, null, "The following errors have occurred fewer than 10 times and has remained unresolved for over a week. Please check the thread to view errors.");
        var lowOccuranceErrorThread = result && result.status == 200 ? result.ts : null;
        lowOccuranceErrorMainErrorSent = true;
      }
      fields.push({ title: "🔥 Occurrences", value: occurrence.toString() });
      sendSlackMessage(
        "⚠️ Low-Occurrence Error Pending for 7+ Days",
        fields,
        "#F2C744",
        !assigneeSlackId,
        lowOccuranceErrorThread
      );
      continue;
    }

    // 🚨 Super high alert (mode=7-day)
    if (mode === "7-day" && occurrence > 20 && !resolved && !rmTicketId) {
      if(!criticalErrorMainErrorSent) {
        result = sendSlackMessage("🚨 CRITICAL: >20 Occurrences!", [], "#2EB67D", false, null, "Critical alert — the following errors have occurred over 20 times and needs immediate attention. Please check the thread to view errors.");
        var criticalErrorThread = result && result.status == 200 ? result.ts : null;
        criticalErrorMainErrorSent = true;
      }
      fields.push({ title: "🔥 Occurrences", value: occurrence.toString() });
      sendSlackMessage(
        "🚨 CRITICAL: >20 Occurrences!",
        fields,
        "#E01E5A",
        !assigneeSlackId,
        criticalErrorThread
      );
      continue;
    }
  }
}


function newCheckAlerts() {
  const mode = '3-day';
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const errorsToSend = [];
  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const airbrakeId = row[0] ? row[0].toString() : "Unknown ID";
    const message = row[3] || "No Message";
    const url = row[2].toString();
    const occurrence = parseInt(row[4]) || 0;
    const prevOccurrence = parseInt(row[5]) || 0;
    const resolved = row[6];
    const rmTicketId = row[7];
    const rmStatus = row[8] || "Unknown";
    const assigneeName = row[9];
    const redmineUrl = rmTicketId
      ? `${CONFIG.RM_API_URL}/issues/${rmTicketId}`
      : null;
    const assigneeSlackId = findSlackIdByName(assigneeName);

    if (occurrence === 1) continue;
    if (CONFIG.RM_CLOSED_STATUSES.includes(rmStatus)) continue;

    let fields = [
      { title: "🆔 Error ID", value: airbrakeId },
      { title: "📝 Message", value: message },
      { title: "🔗 Link", value: `<${url}|View Error>` },
    ];
    if (redmineUrl)
      fields.push({
        title: "🔗 Redmine Ticket",
        value: `<${redmineUrl}|View Ticket>`,
      });
    if (assigneeSlackId)
      fields.push({ title: "👤 Assignee", value: `<@${assigneeSlackId}>` });

    // 🔁 Rising occurrences (real-time mode)

    if (
      mode === "3-day" &&
      prevOccurrence &&
      occurrence > prevOccurrence &&
      !resolved &&
      !rmTicketId
    ) {
      fields.push(
        { title: "🔺 Previous Occurrences", value: prevOccurrence.toString() },
        { title: "🔺 Current Occurrences", value: occurrence.toString() }
      );
      errorsToSend.push({
        title: "⚡ Occurrences Rising!",
        fields,
        showDropdown: !assigneeSlackId,
      });
      continue;
    }

    // 🔥 High occurrence (mode=3-day)
    if (mode === "7-day" && occurrence > 6 && !resolved && !rmTicketId) {
      fields.push({ title: "🔥 Occurrences", value: occurrence.toString() });
      sendSlackMessage(
        "🔥 High-Occurrence Error",
        fields,
        "#F4A261",
        !assigneeSlackId
      );
      continue;
    }

    // ⚠️ Low occurrence (mode=7-day)
    if (mode === "7-day" && occurrence <= 6 && !resolved && rmTicketId) {
      fields.push({ title: "🔥 Occurrences", value: occurrence.toString() });
      sendSlackMessage(
        "⚠️ Low-Occurrence Error Pending for 7+ Days",
        fields,
        "#F2C744",
        !assigneeSlackId
      );
      continue;
    }

    // 🚨 Super high alert (mode=7-day)
    if (mode === "3-day" && occurrence > 20 && !resolved && !rmTicketId) {
      fields.push({ title: "🔥 Occurrences", value: occurrence.toString() });
      sendSlackMessage(
        "🚨 CRITICAL: >20 Occurrences!",
        fields,
        "#E01E5A",
        !assigneeSlackId
      );
      continue;
    }

    //✅ RM Still Open
    if (mode === "regular" && resolved && redmineUrl) {
      fields.push({ title: "📝 RM Status", value: rmStatus });
      sendSlackMessage(
        "✅ Airbrake Resolved, but RM Still Open",
        fields,
        "#E01E5A",
        !assigneeSlackId
      );
      continue;
    }
  }
  return errorsToSend;
}


function chunkArray(arr, size) {
  const result = [];
  for (let i = 0; i < arr.length; i += size) {
    result.push(arr.slice(i, i + size));
  }
  return result;
}

function testingAllSendMessages() {
  var errorsToSend = newCheckAlerts();
  const chunks = chunkArray(errorsToSend, 16);
  chunks.forEach((chunk) => {
    sendAllErrorsAsSingleMessage(chunk); // same function from earlier
  });
}

function sendAllErrorsAsSingleMessage(errors) {
  if (errors.length === 0) return;

  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: errors[0].title || "🚨 Airbrake Error Alerts", // Use first error's title
        emoji: true,
      },
    },
    { type: "divider" },
  ];

  errors.forEach((error, index) => {
    const summary = summarizeFields(error.fields);

    blocks.push(
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${error.title}*\n${summary}`,
        },
      }
    );

    if (error.showDropdown) {
      blocks.push({
        type: "actions",
        elements: [
          {
            type: "users_select",
            action_id: `assign_rm_ticket_${index}`,
            placeholder: {
              type: "plain_text",
              text: "Assign RM Ticket to user...",
            },
          },
        ],
      });
    }

    blocks.push({ type: "divider" });
  });

  const payload = {
    channel: CONFIG.SLACK_CHANNEL_ID,
    blocks,
    attachments: [
      {
        color: "#E01E5A",
        footer: "Airbrake Assignment Automator",
        ts: Math.floor(new Date().getTime() / 1000),
      },
    ],
  };

  const response = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
    },
    payload: JSON.stringify(payload),
  });

  const json = JSON.parse(response.getContentText());
  if (!json.ok) {
    Logger.log("❌ Slack postMessage error: " + JSON.stringify(json));
  }
  Utilities.sleep(2000);
  return { ts: json.ts, channel: json.channel };
}


function summarizeFields(fields) {
  return fields.map(f => `*${f.title}*: ${f.value}`).join(" • ");
}

function sendDailyRedmineAssignmentSummarySlackMessage() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.ASSIGNMENT_SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  Logger.log(JSON.stringify(data));
  var assignmentLines = [];

  for (let i = 1; i < data.length; i++) {
    const airbrakeURL = data[i][0];
    const redmineURL = data[i][1];
    const assigneeName = data[i][2];
    const assignedAt = new Date(data[i][3]);

    var normalizedTime = new Date(assignedAt);
    // Normalize assignedAt
    normalizedTime.setHours(0, 0, 0, 0);

    // Check if normalizedTime is today
    if (normalizedTime.getTime() === today.getTime()) {
      const assigneeSlackId = findSlackIdByName(assigneeName);

      const timeStr = Utilities.formatDate(
        assignedAt,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd HH:mm"
      );
      assignmentLines.push(
        `🔗 <${airbrakeURL}|Airbrake Link> • 📌 <${redmineURL}|Redmine Ticket> • 🙋 <@${assigneeSlackId}> • ⏰ ${timeStr}`
      );
    }
  }

  if (assignmentLines.length === 0) return;

  const summaryText = assignmentLines.join("\n");

  const payload = {
    text: `*📝 Today's Assigned Airbrakes Summary*\n\n${summaryText}\n\nCC: <@${CONFIG.SLACK_CC_USER_ID}>`,
  };

  Logger.log(payload);

  UrlFetchApp.fetch(CONFIG.SLACK_WEBHOOK_URL, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
  });

  Utilities.sleep(2000);
  // Send as direct message to the CC user via chat.postMessage
  const response = UrlFetchApp.fetch("https://slack.com/api/conversations.open", {
  method: "post",
  contentType: "application/json",
  headers: {
    Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
  },
    payload: JSON.stringify({ users: "U02TFAHD146" }), // Replace with actual user ID
  });

  const dmChannelId = JSON.parse(response.getContentText()).channel.id;

  // 2. Then use this ID in your message payload
  const dmPayload = {
    channel: dmChannelId,
    text: `*📝 Today's Assigned Airbrakes Summary*\n\n${summaryText}`,
  };

  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
    },
    payload: JSON.stringify(dmPayload),
  });

  Utilities.sleep(2000);
  const responseForSecondUser = UrlFetchApp.fetch("https://slack.com/api/conversations.open", {
  method: "post",
  contentType: "application/json",
  headers: {
    Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
  },
    payload: JSON.stringify({ users: "U02TB8L8PQB" }), // Replace with actual user ID
  });

  const dmChannelIdForSecondUser = JSON.parse(responseForSecondUser.getContentText()).channel.id;

  // 2. Then use this ID in your message payload
  const dmPayloadForSecondUser = {
    channel: dmChannelIdForSecondUser,
    text: `*📝 Today's Assigned Airbrakes Summary*\n\n${summaryText}`,
  };

  UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
    },
    payload: JSON.stringify(dmPayloadForSecondUser),
  });

  // Clear all data rows except the header
  sheet.getRange(2, 1, sheet.getLastRow() - 1, sheet.getLastColumn()).clearContent();
}

// =============== MOVE RESOLVED TO OTHER SHEET ===============
function moveResolvedErrors() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const resolvedSheet = ss.getSheetByName(CONFIG.RESOLVED_SHEET_NAME);
  var resolvedFound = false;
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const resolvedRows = [];

  for (let i = data.length - 1; i > 0; i--) {
    const row = data[i];
    const rmStatus = row[8];

    if (CONFIG.RM_CLOSED_STATUSES.includes(rmStatus)) {
      resolvedRows.push(row);
      sheet.deleteRow(i + 1);
      resolvedFound = true;
    }
  }

  resolvedRows.reverse().forEach((row) => resolvedSheet.appendRow(row));
  //if (resolvedFound) createStyledDropdowns(CONFIG.RESOLVED_SHEET_NAME);
}

function updateAssignedRMTicketsInSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  const rmTicketIdIndex = headers.indexOf("Assigned RM Ticket ID");

  if (rmTicketIdIndex === -1) {
    Logger.log("Assigned RM Ticket ID column not found.");
    return;
  }

  // Find indexes of RM Status and Assigned To columns
  const statusIndex = headers.indexOf("RM Status");
  const assigneeIndex = headers.indexOf("Assigned To");

  // Collect all unique ticket IDs using an array
  const ticketIds = [];
  const ticketRowMap = new Map();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    let ticketId = row[rmTicketIdIndex];

    // Log the raw ticket ID value
    Logger.log(`Raw Ticket ID: ${ticketId} (Type: ${typeof ticketId})`);

    // Check if the ticket ID is a valid number and not zero or empty
    if (ticketId && !ticketIds.includes(ticketId)) {
      ticketIds.push(ticketId);
      ticketRowMap.set(ticketId, i); // Store the row index for each ticket ID
    }

    Logger.log(`Current Ticket IDs Array: ${JSON.stringify(ticketIds)}`);
  }

  Logger.log(`Final Ticket IDs: ${JSON.stringify(ticketIds)}`);
  if (ticketIds.length === 0) {
    Logger.log("No RM Ticket IDs found to update.");
    return;
  }

  // Fetch all ticket details in a single API call
  const ticketDetailsMap = batchFetchRedmineTicketDetails(ticketIds);

  // Update the data array with fetched details
  ticketRowMap.forEach((rowIndex, ticketId) => {
    const ticketDetails = ticketDetailsMap[ticketId];
    if (ticketDetails) {
      const row = data[rowIndex];
      Logger.log(ticketDetails.status)
      Logger.log(ticketDetails.assignee)
      if (statusIndex !== -1) row[statusIndex] = ticketDetails.status;
      if (assigneeIndex !== -1) row[assigneeIndex] = ticketDetails.assignee;
    }
  });

  // Update the entire sheet in one go
  
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  Logger.log("Sheet updated successfully.");
}

function batchFetchRedmineTicketDetails(ticketIds) {
  const ticketDetailsMap = {};

  ticketIds.forEach((issueId) => {
    try {
      const response = UrlFetchApp.fetch(
        `${CONFIG.RM_API_URL}/issues/${issueId}.json`,
        {
          method: "get",
          headers: { "X-Redmine-API-Key": CONFIG.RM_API_KEY },
          muteHttpExceptions: true,
        }
      );

      if (response.getResponseCode() === 200) {
        const data = JSON.parse(response.getContentText());
        ticketDetailsMap[issueId] = {
          status: data.issue.status.name,
          assignee: data.issue.assigned_to ? data.issue.assigned_to.name : "",
        };
      } else {
        Logger.log(`Redmine issue not found or inaccessible: ${issueId}`);
      }
    } catch (e) {
      Logger.log(`Error fetching Redmine issue ${issueId}: ${e.message}`);
    }
  });
  return ticketDetailsMap;
}

function oldbatchFetchRedmineTicketDetails(ticketIds) {
  const ticketDetailsMap = {};

  try {
    // Step 1: Fetch all statuses
    const statuses = getAllStatuses();
    if (statuses.length === 0) {
      Logger.log("No statuses found.");
      return ticketDetailsMap;
    }

    // Step 2: Split ticket IDs into batches of 25
    const batchSize = 50;
    const batches = [];
    for (let i = 0; i < ticketIds.length; i += batchSize) {
      batches.push(ticketIds.slice(i, i + batchSize));
    }

    // Step 3: Fetch issues for each batch of ticket IDs
    batches.forEach((batch, index) => {
      const statusFilter = statuses.join(",");
      const apiUrl = `${CONFIG.RM_API_URL}/issues.json?key=${
        CONFIG.RM_API_KEY
      }&issue_id=${batch.join(",")}&status_id=${statusFilter}`;

      try {
        Logger.log(`Fetching batch ${index + 1} with IDs: ${batch.join(",")}`);
        const response = UrlFetchApp.fetch(apiUrl, {
          method: "get",
          headers: {
            "X-Redmine-API-Key": CONFIG.RM_API_KEY,
          },
          muteHttpExceptions: true,
        });

        if (response.getResponseCode() === 200) {
          const result = JSON.parse(response.getContentText());
          if (result.issues && Array.isArray(result.issues)) {
            result.issues.forEach((issue) => {
              const issueId = issue.id;
              ticketDetailsMap[issueId] = {
                status: issue.status.name,
                assignee: issue.assigned_to
                  ? issue.assigned_to.name
                  : "Unassigned",
              };
            });
          } else {
            Logger.log(`No issues found for batch ${index + 1}`);
          }
        } else {
          Logger.log(
            `Error fetching batch ${index + 1}: ${response.getContentText()}`
          );
        }
      } catch (error) {
        Logger.log(`Error fetching batch ${index + 1}: ${error.message}`);
      }
    });

    Logger.log(
      "Combined ticket details map: " + JSON.stringify(ticketDetailsMap)
    );
  } catch (e) {
    Logger.log("Error: " + e.message);
  }

  return ticketDetailsMap;
}

function getAllStatuses() {
  try {
    const response = UrlFetchApp.fetch(
      `${CONFIG.RM_API_URL}/issue_statuses.json`,
      {
        method: "get",
        headers: {
          "X-Redmine-API-Key": CONFIG.RM_API_KEY,
        },
        muteHttpExceptions: true,
      }
    );

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      const statuses = data.issue_statuses.map((status) => status.id);
      Logger.log("Available Statuses: " + JSON.stringify(statuses));
      return statuses;
    } else {
      Logger.log("Error fetching statuses: " + response.getContentText());
      return [];
    }
  } catch (e) {
    Logger.log("Error: " + e.message);
    return [];
  }
}

// =============== WEEKLY SUMMARY ===============
function generateWeeklySummary() {
  const sheet = SpreadsheetApp.openById(CONFIG.SHEET_ID).getSheetByName(
    CONFIG.SHEET_NAME
  );
  const data = sheet.getDataRange().getValues();

  let total = 0;
  let redAlerts = 0;
  let resolvedThisWeek = 0;
  let totalThisWeek = 0;
  let criticalCount = 0;
  let warningCount = 0;
  let stableCount = 0;

  const today = new Date();
  const oneWeekAgo = new Date(today);
  oneWeekAgo.setDate(today.getDate() - 7);

  data.slice(1).forEach((row) => {
    const createdAt = new Date(row[15]); // First Notice At column
    const resolved = row[6] === "true"; // Resolved column
    const occurrenceCount = parseInt(row[4]); // Occurrence count column

    if (createdAt >= oneWeekAgo) {
      totalThisWeek++;
      if (resolved) resolvedThisWeek++;
    }

    if (!resolved) {
      total++;
      if (occurrenceCount > 20) criticalCount++;
      else if (occurrenceCount > 10) warningCount++;
      else stableCount++;
      if (occurrenceCount > 10) redAlerts++;
    }
  });

  const fieldsArray = [
    { title: "📅 Report Date", value: new Date().toLocaleString() },
    { title: "🔴 Total Open Airbrakes", value: total.toString() },
    {
      title: "🚨 High-Occurrence Airbrakes (>10)",
      value: redAlerts.toString(),
    },
    { title: "✅ Resolved This Week", value: resolvedThisWeek.toString() },
    {
      title: "🗂️ Total Airbrakes Logged This Week",
      value: totalThisWeek.toString(),
    },
    {
      title: "🚦 Critical Airbrakes (>20 Occurrences)",
      value: criticalCount.toString(),
    },
    {
      title: "⚠️ Warning Airbrakes (10-20 Occurrences)",
      value: warningCount.toString(),
    },
    {
      title: "📊 Stable Airbrakes (<10 Occurrences)",
      value: stableCount.toString(),
    },
  ];

  sendSlackMessage("📊 Weekly Airbrake Summary", fieldsArray, "#2EB67D", false);
}

function sendWeeklyRMReminders() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();

  for (let i = 1; i < data.length; i++) {
    const row = data[i];
    const airbrakeId = row[0]?.toString() || "Unknown ID";
    const url = row[2]?.toString() || "";
    const occurrence = parseInt(row[4]) || 0;
    const rmTicketId = row[7];
    const rmStatus = row[8] || "Unknown";
    const assigneeName = row[9];
    const assigneeSlackId = findSlackIdByName(assigneeName);
    const redmineUrl = rmTicketId
      ? `${CONFIG.RM_API_URL}/issues/${rmTicketId}`
      : null;
    Logger.log(redmineUrl);
    Logger.log(rmTicketId);
    Logger.log(rmStatus);
    if (
      !rmTicketId ||
      !assigneeSlackId ||
      CONFIG.RM_CLOSED_STATUSES.includes(rmStatus)
    )
      continue;

    const fields = [
      { title: "🆔 Error ID", value: airbrakeId },
      { title: "🔗 Airbrake Link", value: `<${url}|View Error>` },
      { title: "📌 Redmine Ticket", value: `<${redmineUrl}|#${rmTicketId}>` },
      { title: "🔢 Occurrences", value: occurrence.toString() },
      { title: "📋 RM Status", value: rmStatus },
    ];

    sendDirectSlackMessage(
      assigneeSlackId,
      "🔔 Weekly Reminder: RM Ticket Still Open",
      fields,
      "#4C6EF5"
    );
  }
}

function updateSlackMessage(channelId, ts, title, fieldsArray, color = "#2EB67D") {
  const payload = {
    channel: channelId,
    ts: ts,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: title,
          emoji: true,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        fields: fieldsArray.map((field) => ({
          type: "mrkdwn",
          text: `*${field.title}*\n${field.value}`,
        })),
      },
    ],
    attachments: [
      {
        color: color,
        footer: "Airbrake Assignment Automator",
        ts: Math.floor(new Date().getTime() / 1000),
      },
    ],
  };

  const response = UrlFetchApp.fetch("https://slack.com/api/chat.update", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
    },
    payload: JSON.stringify(payload),
  });

  const json = JSON.parse(response.getContentText());
  if (!json.ok) {
    Logger.log("❌ Slack update error: " + JSON.stringify(json));
  }

  return json;
}

function sendSlackMessage(title, channelID, fieldsArray, color = "#E01E5A", includeDropdown, thread_ts = null, subtitle = null) {
  const payload = {
    channel: channelID,
    blocks: [],
    attachments: [
      {
        color: color,
        footer: "Airbrake Assignment Automator",
        ts: Math.floor(new Date().getTime() / 1000),
      },
    ],
  };

  // 🔹 Add title if not empty
  if (title && title.trim() !== "") {
    payload.blocks.push({
      type: "header",
      text: {
        type: "plain_text",
        text: title,
        emoji: true,
      },
    });
  }

  // 🔹 Add subtitle block if provided
  if (subtitle) {
    payload.blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `_${subtitle}_`,
      },
    });
  }

  // 🔹 Include fields if provided
  if (fieldsArray.length > 0) {
    payload.blocks.push(
      {
        type: "divider",
      },
      {
        type: "section",
        fields: fieldsArray.map((field) => ({
          type: "mrkdwn",
          text: `*${field.title}*\n${field.value}`,
        })),
      }
    );

    // 🔹 Include dropdown if enabled
    if (includeDropdown) {
      payload.blocks.push({
        type: "actions",
        elements: [
          {
            type: "users_select",
            action_id: "assign_rm_ticket",
            placeholder: {
              type: "plain_text",
              text: "Assign RM Ticket to user...",
            },
          },
        ],
      });
    }
  } else if (!title || title.trim() === "") {
    // Fallback to simple text message if no blocks and no title
    payload.text = "(No title or fields provided)";
  } else {
    payload.text = title;
  }

  // 🔹 Add thread_ts if replying in thread
  if (thread_ts) {
    payload.thread_ts = thread_ts;
  }

  const response = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
    },
    payload: JSON.stringify(payload),
  });

  const json = JSON.parse(response.getContentText());
  if (!json.ok) {
    Logger.log("❌ Slack postMessage error: " + JSON.stringify(json));
  }

  Utilities.sleep(2000);
  return { ts: json.ts, channel: json.channel, status: 200 };
}


// =============== SEND DIRECTLY SLACK MESSAGES ===============
function sendDirectSlackMessage(assigneeSlackId, title, fieldsArray, color = "#4C6EF5") {
  // Step 1: Open a DM channel
  const openResponse = UrlFetchApp.fetch(
    "https://slack.com/api/conversations.open",
    {
      method: "post",
      contentType: "application/json",
      headers: {
        Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
      },
      payload: JSON.stringify({
        users: assigneeSlackId,
      }),
    }
  );

  const openJson = JSON.parse(openResponse.getContentText());
  if (!openJson.ok) {
    Logger.log("❌ Failed to open conversation: " + JSON.stringify(openJson));
    return;
  }

  const dmChannel = openJson.channel.id;

  // Step 2: Build message payload
  const payload = {
    channel: dmChannel,
    blocks: [
      {
        type: "header",
        text: {
          type: "plain_text",
          text: title,
          emoji: true,
        },
      },
      {
        type: "divider",
      },
      {
        type: "section",
        fields: fieldsArray.map((field) => ({
          type: "mrkdwn",
          text: `*${field.title}*\n${field.value}`,
        })),
      },
      {
        type: "context",
        elements: [
          {
            type: "mrkdwn",
            text: "🔁 This is a friendly reminder to review your assigned Redmine ticket. Thank you! 🙏",
          },
        ],
      },
    ],
    attachments: [
      {
        color: color,
        footer: "Airbrake Assignment Automator",
        ts: Math.floor(new Date().getTime() / 1000),
      },
    ],
  };

  // Step 3: Send the message
  const response = UrlFetchApp.fetch("https://slack.com/api/chat.postMessage", {
    method: "post",
    contentType: "application/json",
    headers: {
      Authorization: `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
    },
    payload: JSON.stringify(payload),
  });

  const json = JSON.parse(response.getContentText());
  if (!json.ok) {
    Logger.log("❌ Slack DM postMessage error: " + JSON.stringify(json));
  }
}

// Utilities Method - Delete all message from a specific channel
function findSlackMessageByText(channelId, uniqueText) {
  const token = CONFIG.SLACK_BOT_TOKEN;
  let cursor = '';
  let foundMessages = [];

  while (true) {
    let url = `https://slack.com/api/conversations.history?channel=${channelId}&limit=100`;
    if (cursor) url += `&cursor=${cursor}`;

    const response = UrlFetchApp.fetch(url, {
      method: "get",
      headers: {
        Authorization: "Bearer " + token,
      },
    });

    const data = JSON.parse(response.getContentText());
    const messages = data.messages;

    // 🔍 Try to find the target message
    for (const msg of messages) {
      if (msg.text && msg.text.includes(uniqueText)) {
        foundMessages.push(msg);
      }
    }
    Logger.log(foundMessages.length);
    // 🚪 Stop if no more pages
    const nextCursor = data.response_metadata?.next_cursor;
    if (!nextCursor) break;

    cursor = nextCursor;
    Utilities.sleep(1000); // optional: avoid rate limits
  }

  if (foundMessages.length > 0) {
    Logger.log('✅ Found message: ' + foundMessages[0].text);
  } else {
    Logger.log('❌ No matching message found.');
  }
  return foundMessages;
}

function deleteBotMessages(uniqueText) {
  const channelId = CONFIG.SLACK_CHANNEL_ID; // replace with your channel ID
  const token = CONFIG.SLACK_BOT_TOKEN; // replace with your bot token
  const messages = findSlackMessageByText(channelId, uniqueText);

  if(messages.length == 0) return;

  if (!Array.isArray(messages)) return;
  for (const msg of messages) {
    if (msg.bot_id) {
      Logger.log('Deleting Message with Bot');
      const url = "https://slack.com/api/chat.delete";
      const payload = {
        channel: channelId,
        ts: msg.ts,
      };

      const options = {
        method: "post",
        contentType: "application/json",
        payload: JSON.stringify(payload),
        headers: {
          Authorization: "Bearer " + token,
        },
      };

      const response = UrlFetchApp.fetch(url, options);
      const result = JSON.parse(response.getContentText());
      Logger.log(result);

      // To avoid hitting rate limits
      Utilities.sleep(1000);
    }
  }
}
// Utilities Method - END

// =============== GET REDMINE ISSUE STATUS ===============
function getRedmineIssueStatus(issueId) {
  try {
    const response = UrlFetchApp.fetch(
      `${CONFIG.RM_API_URL}/issues/${issueId}.json`,
      {
        method: "get",
        headers: { "X-Redmine-API-Key": CONFIG.RM_API_KEY },
        muteHttpExceptions: true,
      }
    );

    if (response.getResponseCode() === 200) {
      const data = JSON.parse(response.getContentText());
      return data.issue.status.name;
    } else {
      Logger.log("Redmine issue not found: " + issueId);
      return null;
    }
  } catch (e) {
    Logger.log("Error fetching Redmine issue: " + e);
    return null;
  }
}

function updateAirbrakeAssignmentsFromSecondSheet() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet1 = ss.getSheetByName(CONFIG.SHEET_NAME);
  const ss2 = SpreadsheetApp.openById(
    "1f3sbxGX2dbg7Yw7K2tWbuDb7uocSYTGwtJt4i2yZxZ4"
  );
  const sheet2 = ss2.getSheetByName("Sheet1");

  const sheet1Data = sheet1.getDataRange().getValues();
  const sheet2Data = sheet2.getDataRange().getValues();

  const header1 = sheet1Data[0];
  const header2 = sheet2Data[0];

  // Validate required columns exist in both sheets
  const airbrakeIdIndex1 = header1.indexOf("Airbrake ID");
  const assignedTicketIndex = header1.indexOf("Assigned RM Ticket ID");
  const rmStatusIndex = header1.indexOf("RM Status");
  const assignedToIndex = header1.indexOf("Assigned To");

  const airbrakeUrlIndex2 = header2.indexOf("Airbrake URL");
  const redmineUrlIndex2 = header2.indexOf("Redmine");
  const statusIndex2 = header2.indexOf("Status");
  const assigneeIndex2 = header2.indexOf("Assignee");

  if (
    airbrakeIdIndex1 === -1 ||
    assignedTicketIndex === -1 ||
    rmStatusIndex === -1 ||
    assignedToIndex === -1 ||
    airbrakeUrlIndex2 === -1 ||
    redmineUrlIndex2 === -1 ||
    statusIndex2 === -1 ||
    assigneeIndex2 === -1
  ) {
    throw new Error("❌ One or more required column headers not found.");
  }

  // Step 1: Build lookup map from sheet2 based on Airbrake ID
  const airbrakeMap = {};
  for (let i = 1; i < sheet2Data.length; i++) {
    const airbrakeUrl = sheet2Data[i][airbrakeUrlIndex2];
    if (!airbrakeUrl) continue;

    const match = airbrakeUrl.match(/groups\/(\d+)/);
    if (!match) continue;

    const airbrakeId = match[1];
    const redmineUrl = sheet2Data[i][redmineUrlIndex2];
    const redmineMatch = redmineUrl?.match(/issues\/(\d+)/);
    const redmineId = redmineMatch ? redmineMatch[1] : "";

    airbrakeMap[airbrakeId] = {
      redmineId,
      status: sheet2Data[i][statusIndex2],
      assignee: sheet2Data[i][assigneeIndex2],
    };
  }

  // Step 2: Loop through Sheet 1 rows and update only safe matches
  for (let i = 1; i < sheet1Data.length; i++) {
    const rowAirbrakeId = sheet1Data[i][airbrakeIdIndex1];
    if (!rowAirbrakeId || !airbrakeMap[rowAirbrakeId]) continue;

    const { redmineId, status, assignee } = airbrakeMap[rowAirbrakeId];

    // Update only the 3 intended columns
    if (redmineId)
      sheet1.getRange(i + 1, assignedTicketIndex + 1).setValue(redmineId);
    if (status) sheet1.getRange(i + 1, rmStatusIndex + 1).setValue(status);
    if (assignee)
      sheet1.getRange(i + 1, assignedToIndex + 1).setValue(assignee);
  }

  Logger.log("✅ Safe update complete. Only matching rows modified.");
}

function listTriggers() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    Logger.log(`Function: ${trigger.getHandlerFunction()}`);
    Logger.log(`Type: ${trigger.getEventType()}`);
    Logger.log(`Trigger ID: ${trigger.getUniqueId()}`);
    Logger.log(`Next Run: ${trigger.getTriggerSource()}`);
  });
}

function logNextRunTime() {
  const triggers = ScriptApp.getProjectTriggers();
  triggers.forEach((trigger) => {
    if (trigger.getEventType() === ScriptApp.EventType.TIME) {
      const lastRun = new Date(); // Assuming the script runs right after execution
      const nextRun = new Date(lastRun.getTime() + 7 * 24 * 60 * 60 * 1000); // Adding 7 days
      Logger.log(
        `Function: ${trigger.getHandlerFunction()} - Next Run (approx): ${nextRun}`
      );
    }
  });
}

function checkAndCleanAirbrakeErrors() {
  const ss = SpreadsheetApp.openById(CONFIG.SHEET_ID);
  const sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];

  const today = new Date();

  // Column Indexes
  const IDX_AIRBRAKE_ID = 0;
  const IDX_LAST_NOTICE_AT = headers.indexOf("Last Notice At");
  const ASSIGNED_RM_INDEX = headers.indexOf("Assigned RM Ticket ID");

  let rowIndex = 1; // Start from second row (excluding header)

  while (rowIndex < data.length) {
    const row = data[rowIndex];
    const errorId = row[IDX_AIRBRAKE_ID];
    const lastNoticeAtRaw = row[IDX_LAST_NOTICE_AT];
    const rmID = row[ASSIGNED_RM_INDEX];

    if (!errorId || !lastNoticeAtRaw) {
      rowIndex++;
      continue;
    }

    const lastNoticeAt = new Date(lastNoticeAtRaw);
    const ageInDays = (today - lastNoticeAt) / (1000 * 60 * 60 * 24);

    if (ageInDays < 30) {
      rowIndex++;
      Logger.log(`Alive Airbrake https://airbrake.io/projects/52217/groups/${errorId}`)
      continue; // Skip recent errors
    }

    const url = `https://api.airbrake.io/api/v4/projects/52217/groups/${errorId}?key=${CONFIG.AIRBRAKE_API_KEY}`;

    try {
      const response = UrlFetchApp.fetch(url, {
        method: "get",
        headers: { "Content-Type": "application/json" },
        muteHttpExceptions: true,
      });

      const statusCode = response.getResponseCode();

      if (statusCode === 404) {
        // ❌ Error no longer exists — delete row
        sheet.deleteRow(rowIndex + 1); // +1 because Sheets is 1-indexed
        data.splice(rowIndex, 1); // Remove from memory array
        if (rmID) {
          Logger.log(`RM id found ${rmID}`)
          const response = UrlFetchApp.fetch(
          `${CONFIG.RM_API_URL}/issues/${rmID}.json`,
          {
            method: "put",
            contentType: "application/json",
            headers: { "X-Redmine-API-Key": CONFIG.RM_API_KEY },
            payload: JSON.stringify({ issue: {
              status_id: 5
            }}),
            muteHttpExceptions: true,
          });
        }
        deleteBotMessages(errorId);
        Logger.log(`Dead Airbrake https://airbrake.io/projects/52217/groups/${errorId}`)
        continue; // Don't increment rowIndex; next row moved up
      } else if (statusCode === 200) {
        // ✅ Still exists — update Last Notice At
        const errorData = JSON.parse(response.getContentText());
        const updatedLastNoticeAt = errorData.group?.last_notice_at;

        if (updatedLastNoticeAt) {
          const formattedDate = new Date(updatedLastNoticeAt).toLocaleString();
          sheet.getRange(rowIndex + 1, IDX_LAST_NOTICE_AT + 1).setValue(formattedDate);
        }
      } else {
        Logger.log(`⚠️ Unexpected status ${statusCode} for Airbrake ID ${errorId}`);
      }
    } catch (err) {
      Logger.log(`⚠️ Request failed for ID ${errorId}: ${err}`);
    }

    Utilities.sleep(1000); // Delay to prevent rate limit issues
    rowIndex++;
  }

  Logger.log("✅ Finished checking Airbrake errors.");
}

// =============== SETUP ALL TRIGGERS (ONE-TIME) ===============
function setupTriggers() {
  // Remove all existing triggers
  const allTriggers = ScriptApp.getProjectTriggers();
  allTriggers.forEach((trigger) => ScriptApp.deleteTrigger(trigger));

  // Every 3 days: check for errors with occurrence > 6
  ScriptApp.newTrigger("checkEvery3Days")
    .timeBased()
    .everyDays(3)
    .atHour(4) // Run at 4 AM
    .create();

  // Every 7 days: check for errors with occurrence <= 6 and >20
  ScriptApp.newTrigger("checkEvery7Days")
    .timeBased()
    .everyDays(7)
    .atHour(4) // Run at 4 AM
    .create();

  // Check rising occurrences every hour (no specific time control)
  ScriptApp.newTrigger("checkRegularly")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();

  ScriptApp.newTrigger("fetchAirbrakes").timeBased().everyHours(6).create();

  ScriptApp.newTrigger("updateAssignedRMTicketsInSheet")
    .timeBased()
    .everyHours(7)
    .create();

  ScriptApp.newTrigger("moveResolvedErrors").timeBased().everyHours(8).create();

  ScriptApp.newTrigger("generateWeeklySummary")
    .timeBased()
    .onWeekDay(ScriptApp.WeekDay.SUNDAY)
    .atHour(23)
    .create();

  ScriptApp.newTrigger("sendWeeklyRMReminders")
    .timeBased()
    .everyDays(7)
    .atHour(4)
    .create();

  ScriptApp.newTrigger("sendDailyRedmineAssignmentSummarySlackMessage")
    .timeBased()
    .everyDays(1)
    .atHour(20) // 20 = 8 PM
    .create();

  ScriptApp.newTrigger("checkAndCleanAirbrakeErrors")
    .timeBased()
    .everyDays(7)
    .atHour(1) // Run at 4 AM
    .create();
}
