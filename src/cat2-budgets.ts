/**
 * Downloads FRN_STATUS and FRN_BASIC_INFORMATION for configured years, states, and BENs.
 * Manages 'previous' and 'current' sheets, updating them accordingly.
 * Appends data to 'all' sheet with timestamp including hour and minute.
 */
function downloadCat2BudgetsData() {
    const auth = getAuthCredentials();

    const config = getConfigData();

    const fundingYear = normalizeFundingYear(config?.years);
    const state = normalizeState(config?.states);
    const ben = normalizeBEN(config?.bens);

    const options = new Options(fundingYear, state, ben);

    const currentSheetName = "current";
    const previousSheetName = "previous";
    const allSheetName = "running raw data";

    const deltaSheetName = "delta";
    const allDeltaSheetName = "running delta";

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
    if (currentDeltaValues?.length > 0 && currentDeltaValues[0][0] !== "") {
        appendToAllSheet(allDeltaSheet, currentDeltaValues, dateTimeString);
    }

    // Move 'current' data to 'previous'
    const currentRange = currentSheet.getDataRange();
    const currentValues = currentRange.getValues();

    if (currentValues?.length > 0 && currentValues[0][0] !== "") {
        previousSheet.clear();
        previousSheet
            .getRange(1, 1, currentValues.length, currentValues[0].length)
            .setValues(currentValues);

        appendToAllSheet(allSheet, currentValues, dateTimeString);
    }

    // Clear 'current' sheet
    currentSheet.clear();

    // Download and populate new data into 'current' sheet
    downloadAndPopulateUSACData(currentSheetName, "CAT2_BUDGETS", options, auth);
}

/**
 * Appends data to the 'all' sheet with a timestamp column including hour and minute.
 * @param {GoogleAppsScript.Spreadsheet.Sheet} allSheet - The 'all' sheet.
 * @param {Array<Array<any>>} data - The data to append.
 * @param {string} dateTimeString - The date and time string to use as timestamp.
 */
function appendToAllSheet(allSheet, data, dateTimeString) {
    // If the headers haven't been added yet, append a "Timestmap" column
    const headers = data[0];
    if (!headers.includes("Timestamp")) {
        headers.push("Timestamp");
        allSheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }

    // Prepare data with timestamp
    const dataWithTimestamp = data.slice(1).map((row) => row.concat([dateTimeString]));

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
