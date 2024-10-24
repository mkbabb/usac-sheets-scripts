function downloadFRNStatusAndDelta() {
    const config = {
        currentSheetName: "Today",
        previousSheetName: "Yesterday",
        allSheetName: "Running Raw Data",
        deltaSheetName: "Changes",
        allDeltaSheetName: "Running Changes",
        viewName: "CAT2_BUDGETS",
    };

    USACNightly.downloadUSACDataAndDelta(config);
}

/**
 * Creates menu items to run the script.
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    const usacMenu = ui.createMenu("USAC Data");

    usacMenu.addItem("Download CAT2 Budgets & Delta", "downloadFRNStatusAndDelta");

    usacMenu.addToUi();
}
