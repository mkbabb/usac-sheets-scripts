/**
 * Configuration function for sheet names and view name
 * @returns {Object} Configuration object
 */
function getDeltaConfig() {
    return {
        currentSheetName: "Today",
        previousSheetName: "Yesterday",
        allSheetName: "Running Raw Data",
        deltaSheetName: "Changes",
        allDeltaSheetName: "Running Changes",
        viewName: "FRN_STATUS",
    };
}

/**
 * Downloads and manages USAC data for configured years, states, and BENs.
 * @param {Object} config - Configuration object containing sheet names and view name
 */
function downloadUSACDataAndDelta(deltaConfig) {
    const auth = getAuthCredentials();
    const options = getConfigData();
    const {
        currentSheetName,
        previousSheetName,
        allSheetName,
        deltaSheetName,
        allDeltaSheetName,
        viewName,
    } = deltaConfig;

    const currentSheet = getOrCreateSheet(currentSheetName);
    const previousSheet = getOrCreateSheet(previousSheetName);
    const allSheet = getOrCreateSheet(allSheetName);

    const deltaSheet = getOrCreateSheet(deltaSheetName);
    const allDeltaSheet = getOrCreateSheet(allDeltaSheetName);

    // Get current date and time
    const now = new Date();
    const dateTimeString = Utilities.formatDate(
        now,
        Session.getScriptTimeZone(),
        "yyyy-MM-dd HH:mm"
    );

    const currentDeltaValues = deltaSheet.getDataRange().getValues();
    // If first value in the sheet is blank, don't append
    if (
        currentDeltaValues &&
        currentDeltaValues?.length > 0 &&
        currentDeltaValues[0][0] !== ""
    ) {
        appendToAllSheet(allDeltaSheet, currentDeltaValues, dateTimeString);
    }

    // Move 'current' data to 'previous'
    const currentRange = currentSheet.getDataRange();
    const currentValues = currentRange.getValues();

    if (currentValues && currentValues?.length > 0 && currentValues[0][0] !== "") {
        previousSheet.clear();
        previousSheet
            .getRange(1, 1, currentValues.length, currentValues[0].length)
            .setValues(currentValues);

        appendToAllSheet(allSheet, currentValues, dateTimeString);
        // Clear 'current' sheet

        currentSheet.clear();
    }

    // Download and populate new data into 'current' sheet
    downloadAndPopulateUSACData(currentSheetName, viewName, options, auth);
}

/**
 * Appends data to the 'all' sheet with a timestamp column including hour and minute.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} allSheet - The 'all' sheet.
 * @param {Array<Array<any>>} data - The data to append.
 * @param {string} dateTimeString - The date and time string to use as timestamp.
 */
function appendToAllSheet(allSheet, data, dateTimeString) {
    // If the headers haven't been added yet, append a "Timestamp" column
    const headers = data[0];

    Logger.log(`Headers: ${JSON.stringify(headers)}`);

    if (!headers.includes("Timestamp")) {
        headers.push("Timestamp");
        allSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    // Prepare data with timestamp
    const dataWithTimestamp = data.slice(1).map((row) => row.concat([dateTimeString]));

    Logger.log(`Appending ${dataWithTimestamp.length} rows to 'all' sheet`);
    Logger.log(`Data: ${JSON.stringify(dataWithTimestamp)}`);

    // Append to 'all' sheet
    allSheet
        .getRange(
            allSheet.getLastRow() + 1,
            1,
            dataWithTimestamp.length,
            dataWithTimestamp[0].length
        )
        .setValues(dataWithTimestamp);
}

// Example usage
function runDownloadUSACData() {
    downloadUSACDataAndDelta(getDeltaConfig());
}