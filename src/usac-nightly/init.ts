try {
    this.ui = SpreadsheetApp.getUi();
    this.usacMenu = this.ui.createMenu("USAC Data");

    Object.keys(ViewIDs).forEach((viewName) => {
        const menuItemName = `Download ${viewName.replace(/_/g, " ")}`;
        const downloadFunctionName = `downloadView${viewName}`;

        const downloadFunction = function () {
            const auth = getAuthCredentials();
            const config = getConfigData();

            downloadAndPopulateUSACData(viewName, viewName, config, auth);
        };

        this[downloadFunctionName] = downloadFunction;

        this.usacMenu.addItem(menuItemName, downloadFunctionName);
    });

    /**
     * Downloads FRN_STATUS and FRN_BASIC_INFORMATION for configured years, states, and BENs.
     */
    function downloadUSACNightlyData() {
        const auth = getAuthCredentials();
        const config = getConfigData();

        downloadAndPopulateUSACData("FRN_STATUS", "FRN_STATUS", config, auth);

        downloadAndPopulateUSACData(
            "FRN_BASIC_INFORMATION",
            "FRN_BASIC_INFORMATION",
            config,
            auth
        );

        showToast(
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
} catch (e) {}
