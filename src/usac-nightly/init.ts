this.ui = SpreadsheetApp.getUi();

this.usacMenu = this.ui.createMenu("USAC Data");

// Log the ViewIDs object
Logger.log(`ViewIDs: ${JSON.stringify(USACNightly["ViewIDs"])}`);

Object.keys(USACNightly["ViewIDs"]).forEach((viewName) => {
    const menuItemName = `Download ${viewName.replace(/_/g, " ")}`;
    const downloadFunctionName = USACNightly.getDownloadFunctionName(viewName);

    this.usacMenu.addItem(menuItemName, downloadFunctionName);
});

/**
 * Downloads FRN_STATUS and FRN_BASIC_INFORMATION for configured years, states, and BENs.
 */
function downloadUSACNightlyData() {
    const auth = USACNightly.getAuthCredentials();
    const config = USACNightly.getConfigData();

    USACNightly.downloadAndPopulateUSACData("FRN_STATUS", "FRN_STATUS", config, auth);

    USACNightly.downloadAndPopulateUSACData(
        "FRN_BASIC_INFORMATION",
        "FRN_BASIC_INFORMATION",
        config,
        auth
    );

    USACNightly.showToast(
        "USAC Nightly Data has been successfully downloaded.",
        "Download Complete",
        5
    );
}

/**
 * Creates menu items to run the script.
 */
function onOpen() {
    this.usacMenu.addItem("Download USAC Nightly Data", "downloadUSACNightlyData");

    this.usacMenu.addToUi();
}
