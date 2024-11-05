function downloadAll2021_2025_CAT_2() {
    return USACNightly.downloadViewALL_2021_2025_CATEGORY_2();
}

/**
 * Creates menu items to run the script.
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    const usacMenu = ui.createMenu("USAC Data");

    usacMenu.addItem("Download 2021-2025 CAT2", "downloadAll2021_2025_CAT_2");

    usacMenu.addToUi();
}
