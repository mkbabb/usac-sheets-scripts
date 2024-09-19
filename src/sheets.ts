const BASE_URL = "https://opendata.usac.org/api/views/";

const ViewIDs = {
    FRN_STATUS:
        "https://opendata.usac.org/E-Rate/E-Rate-Request-for-Discount-on-Services-FRN-Status/qdmp-ygft/about_data",

    FRN_LINE_ITEMS: "hbj5-2bpj",
    FRN_RECIPIENTS_OF_SERVICE: "tuem-agyq",
    FRN_BASIC_INFORMATION: "9s6i-myen",

    SUPPLEMENTAL_ENTITY_DATA: "7i5i-83qf",

    CONSULTANTS: "x5px-esft",

    CAT2_BUDGETS: "6brt-5pbv",
};

const VIEW_COLUMN_NAME_MAP = {
    FRN_STATUS: {
        ben: "ben",
        state: "state",
    },

    FRN_LINE_ITEMS: {
        ben: "ben",
        state: "state",
    },

    FRN_RECIPIENTS_OF_SERVICE: {
        ben: "ben_no",
        state: "org_state",
    },

    FRN_BASIC_INFORMATION: {
        ben: "epc_organization_id",
        state: "org_state",
    },

    SUPPLEMENTAL_ENTITY_DATA: {
        ben: "entity_number",
        state: "physical_state",
        funding_year: null,
    },

    CONSULTANTS: {
        ben: "epc_organization_id",
        state: "state",
    },

    CAT2_BUDGETS: {
        ben: "BEN",
        funding_year: null,
    },
};

const CHUNK_SIZE = 1000; // Number of records to fetch per request

// Chunk sizes for different options
const OPTIONS_CHUNK_SIZES = {
    ben: 100,
    funding_year: null,
    state: null,
};

/**
 * Chunks an array into smaller arrays.
 * @param {Array} array - Array to be chunked
 * @param {number} chunkSize - Size of each chunk
 * @returns {Array} Array of chunks
 */
function chunkArray(array, chunkSize) {
    if (!array || array.length === 0 || !chunkSize) {
        return [array];
    }
    const chunks = [];
    for (let i = 0; i < array.length; i += chunkSize) {
        chunks.push(array.slice(i, i + chunkSize));
    }
    return chunks;
}

/**
 * Computes the Cartesian product of multiple arrays.
 * @param {Array} arrays - Arrays to compute the Cartesian product of
 * @returns {Array} Cartesian product of the input arrays
 */
function cartesianProduct(arrays) {
    return arrays.reduce(
        (acc, array) => acc.flatMap((x) => array.map((y) => [...x, y])),
        [[]]
    );
}

/**
 * Gets or creates a sheet with the given name.
 * @param {string} sheetName - The name of the sheet.
 * @return {Sheet} The sheet object.
 */
function getOrCreateSheet(sheetName) {
    let sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(sheetName);
    if (!sheet) {
        sheet = SpreadsheetApp.getActiveSpreadsheet().insertSheet(sheetName);
    }
    return sheet;
}

/**
 * Shows a toast message
 * @param {string} message - The message to display
 * @param {string} title - The title of the toast
 * @param {number} timeout - The timeout in seconds
 */
function showToast(message, title, timeout) {
    SpreadsheetApp.getActive().toast(message, title, timeout);
}

// Authentication function to get credentials from AUTH tab
function getAuthCredentials() {
    const authSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("AUTH");
    if (!authSheet) {
        throw new Error(
            'AUTH sheet not found. Please create a sheet named "AUTH" with credentials.'
        );
    }
    return {
        username: authSheet.getRange("B1").getValue(),
        password: authSheet.getRange("B2").getValue(),
    };
}

/**
 * Options class for query parameters
 */
class Options {
    constructor(fundingYear = null, state = null, ben = null) {
        this.funding_year = fundingYear;
        this.state = state;
        this.ben = ben;
    }
}

/**
 * Normalizes and parses the funding year input
 * @param {number[] | string[]} years - The array of funding years
 * @return {string[]|null} An array of funding years or null if the current year is selected
 */
function normalizeFundingYear(years) {
    if (!years || years.length === 0) {
        const year = new Date().getFullYear();
        return [String(year)];
    }

    return years
        .map((year) => String(year).trim())
        .map((year) => parseInt(year, 10))
        .filter((year) => !isNaN(year));
}

/**
 * Normalizes the state input
 * @param {string[]} states - The array of state codes
 * @return {string[]} An array of normalized state codes
 */
function normalizeState(states) {
    if (!states || states.length === 0) {
        return ["NC"];
    }

    return states.map((state) => state.trim().toUpperCase());
}

/**
 * Normalizes the BEN input
 * @param {string[]} bens - The array of Billed Entity Numbers
 * @return {string[]} An array of normalized BENs
 */
function normalizeBEN(bens) {
    if (!bens || bens.length === 0) {
        return null;
    }

    return bens.map((ben) => String(ben).trim());
}

/**
 * Generates all combinations of chunked options.
 * @param {Object} options - The options for filtering the data
 * @param {Object} chunkSizes - Object containing chunk sizes for different options
 * @returns {Array} Array of option combinations
 */
function generateChunkedOptionsCombinations(options, chunkSizes) {
    const chunkedOptions = {};
    Object.entries(options).forEach(([key, value]) => {
        if (Array.isArray(value) && chunkSizes[key]) {
            chunkedOptions[key] = chunkArray(value, chunkSizes[key]);
        } else {
            chunkedOptions[key] = [value];
        }
    });

    return cartesianProduct(Object.values(chunkedOptions)).map((combination) =>
        Object.fromEntries(
            Object.keys(options).map((key, index) => [key, combination[index]])
        )
    );
}

/**
 * Maps options to their corresponding column names for the given view.
 * @param {Options} options - The options for filtering the data
 * @param {string} viewName - The name of the view
 * @returns {Object} Mapped options
 */
function mapOptions(options, viewName) {
    const mappedOptions = {};
    Object.entries(options).forEach(([key, value]) => {
        if (value == null) {
            return;
        }

        const viewColumnMap = VIEW_COLUMN_NAME_MAP[viewName];

        if (viewColumnMap && Object.keys(viewColumnMap).includes(key)) {
            const mappedKey = viewColumnMap[key];

            if (mappedKey != null) {
                mappedOptions[mappedKey] = value;
            }
        } else {
            mappedOptions[key] = value;
        }
    });

    return mappedOptions;
}

/**
 * Gets configuration data from the CONFIG.BEN tab
 * @return {Object} An object containing arrays of years, states, and BENs
 */
function getConfigData() {
    const configSheet =
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CONFIG.BEN");

    if (!configSheet) {
        throw new Error(
            'CONFIG.BEN sheet not found. Please create a sheet named "CONFIG.BEN" with the required configuration.'
        );
    }

    const data = configSheet.getDataRange().getValues();
    const headers = data[0];
    const yearIndex = headers.indexOf("Year");
    const stateIndex = headers.indexOf("State");
    const benIndex = headers.indexOf("BEN");

    if (yearIndex === -1 || stateIndex === -1 || benIndex === -1) {
        throw new Error(
            'Required columns "Year", "State", or "BEN" not found in CONFIG.BEN sheet.'
        );
    }

    const years = data
        .slice(1)
        .map((row) => row[yearIndex])
        .filter(Boolean);
    const states = data
        .slice(1)
        .map((row) => row[stateIndex])
        .filter(Boolean);
    const bens = data
        .slice(1)
        .map((row) => row[benIndex])
        .filter(Boolean);

    return { years, states, bens };
}

/**
 * Parses the view URL to get the view name, view id, and optional language
 *
 * URL format: https://opendata.usac.org/{lang}?/{category}/{hypenated-view-name}/{view-id}/...
 * The {lang}? part is optional.
 *
 * @param {string} viewURL - The view URL
 * @return {Object} An object containing the category, view name, view id, language (if present)
 */
function parseViewURL(viewURL) {
    // Remove protocol if present
    const urlWithoutProtocol = viewURL.replace(/^(https?:)?\/\//, "");

    // Split the remaining URL into parts
    const parts = urlWithoutProtocol.split("/").filter(Boolean);

    parts.shift(); // Remove the domain

    if (parts.length < 3) {
        throw new Error(`Invalid view URL: ${viewURL}`);
    }

    let lang, category, name, id;

    // Check if the first part is a language code (2 characters)
    if (parts[0].length === 2) {
        lang = parts[0];
        category = parts[1];
        name = parts[2];
        id = parts[3];
    } else {
        category = parts[0];
        name = parts[1];
        id = parts[2];
    }

    // Remove hyphens from view name
    const viewName = name.replace(/-/g, " ");

    // Construct the return object
    const result = { name: viewName, id, category };

    // Add language to the result if it's present
    if (lang) {
        result.lang = lang;
    }

    Logger.log(`Parsed view URL: ${viewURL} => ${JSON.stringify(result)}`);

    return result;
}

/**
 * Gets view data from the CONFIG.VIEW tab
 * @return {Object} An object containing an array of views
 */
function getViewData() {
    const viewSheet =
        SpreadsheetApp.getActiveSpreadsheet().getSheetByName("CONFIG.VIEW");

    if (!viewSheet) {
        throw new Error(
            'CONFIG.VIEW sheet not found. Please create a sheet named "CONFIG.VIEW" with the required configuration.'
        );
    }

    const data = viewSheet.getDataRange().getValues();
    const headers = data[0];
    const viewURLIndex = headers.indexOf("View URL");

    if (viewURLIndex === -1) {
        throw new Error('Required columns "View URL" not found in CONFIG.VIEW sheet.');
    }

    const views = data
        .slice(1)
        .map((row) => row[viewURLIndex])
        .filter(Boolean)
        .map(parseViewURL);

    return { views };
}

/**
 * Formats a value for the query
 * @param {any} value - The value to format
 * @return {string} Formatted value
 */
function formatValue(value) {
    return `'${value}'`;
}

/**
 * Formats AND conditions
 * @param {string[]} conditions - Array of conditions
 * @return {string} Formatted AND conditions
 */
function formatAndConditions(conditions) {
    return conditions.join(" AND ");
}

/**
 * Formats OR conditions
 * @param {any[]} values - Array of values
 * @return {string} Formatted OR conditions
 */
function formatOrConditions(values) {
    return values.map(formatValue).join(", ");
}

/**
 * Builds a condition for the query
 * @param {string} key - The key for the condition
 * @param {any} value - The value or array of values for the condition
 * @return {string} The built condition
 */
function buildCondition(key, value) {
    if (Array.isArray(value) && value.length > 1) {
        return `(\`${key}\` IN (${formatOrConditions(value)}))`;
    }

    value = Array.isArray(value) ? value[0] : value;
    value = formatValue(value);

    return `(\`${key}\` = ${value})`;
}

/**
 * Builds the WHERE clause for the query
 * @param {Object} options - The options object
 * @return {string} The built WHERE clause
 */
function buildWhereClause(options) {
    const conditions = Object.entries(options)
        .filter(([_, value]) => value != null && value.length > 0)
        .map(([key, value]) => buildCondition(key, value));

    return conditions.length > 0 ? "WHERE " + formatAndConditions(conditions) : "";
}

// Generate Authorization header
function getAuthHeader(auth) {
    return "Basic " + Utilities.base64Encode(auth.username + ":" + auth.password);
}

// Modified makeAuthenticatedRequest function
function makeAuthenticatedRequest(url, params, auth) {
    const options = {
        method: "get",
        headers: {
            Authorization: getAuthHeader(auth),
        },
        muteHttpExceptions: true,
    };

    const fullUrl =
        url +
        "?" +
        Object.entries(params)
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join("&");

    return UrlFetchApp.fetch(fullUrl, options);
}

/**
 * Generator function to stream USAC data for a given view.
 * @param {string} viewName - The name of the view (e.g., "FRN_STATUS")
 * @param {Options} options - The options for filtering the data
 * @param {Object} auth - Authentication credentials
 * @yields {Array} An array of data rows
 */
function* streamUSACData(viewName, options, auth) {
    const view = ViewIDs[viewName];

    if (!view) {
        throw new Error(`Invalid view name: ${viewName}`);
    }

    const url = `${BASE_URL}${view}/rows.csv`;

    Logger.log(`Fetching data for view: ${viewName}: ${view}`);
    Logger.log(`URL: ${url}`);

    // Apply column name mapping
    const mappedOptions = mapOptions(options, viewName);

    // Generate all combinations of chunked options
    const chunkedOptionsCombinations = generateChunkedOptionsCombinations(
        mappedOptions,
        OPTIONS_CHUNK_SIZES
    );

    for (const currentOptions of chunkedOptionsCombinations) {
        let offset = 0;
        let hasMore = true;

        while (hasMore) {
            const whereClause = buildWhereClause(currentOptions);

            const query = `SELECT * ${whereClause} LIMIT ${CHUNK_SIZE} OFFSET ${offset}`;

            Logger.log(`Query: ${query}`);

            const params = {
                accessType: "DOWNLOAD",
                read_from_nbe: true,
                version: "2.1",
                cacheBust: new Date().getTime(),
                date: Utilities.formatDate(new Date(), "GMT", "yyyyMMdd"),
                query,
            };

            Logger.log(`Params: ${JSON.stringify(params)}`);

            const response = makeAuthenticatedRequest(url, params, auth);

            if (response.getResponseCode() !== 200) {
                throw new Error(
                    `HTTP request failed. Status code: ${response.getResponseCode()}, Response: ${response.getContentText()}`
                );
            }

            const csvData = response.getContentText();
            const data = Utilities.parseCsv(csvData);

            if (data.length > 1) {
                Logger.log(`Fetched ${data.length - 1} records`);

                // First row is headers, so we need more than 1 row
                yield data.slice(offset === 0 ? 0 : 1); // Remove header row for all but first chunk

                offset += CHUNK_SIZE;
            } else {
                hasMore = false;
            }
        }
    }
}

/**
 * Downloads USAC data for a given view and populates a sheet with the data.
 * @param {string} viewName - The name of the view (e.g., "FRN_STATUS")
 * @param {Options} options - The options for filtering the data
 * @param {Object} auth - Authentication credentials
 */
function downloadAndPopulateUSACData(viewName, options, auth) {
    const sheet = getOrCreateSheet(viewName);
    sheet.clear();

    const dataStream = streamUSACData(viewName, options, auth);
    let isFirstChunk = true;
    let rowCount = 1;

    for (const chunk of dataStream) {
        if (isFirstChunk) {
            sheet.getRange(1, 1, chunk.length, chunk[0].length).setValues(chunk);
            sheet.getRange(1, 1, 1, chunk[0].length).setFontWeight("bold");
            sheet.setFrozenRows(1);

            isFirstChunk = false;
            rowCount = chunk.length;
        } else {
            sheet.getRange(rowCount, 1, chunk.length, chunk[0].length).setValues(chunk);

            rowCount += chunk.length;
        }

        if (rowCount <= CHUNK_SIZE) {
            sheet.autoResizeColumns(1, chunk[0].length);
        }

        showToast(
            `Downloaded ${rowCount - 1} records for ${viewName}`,
            "Download Progress",
            2
        );
    }

    showToast(
        `Data for ${viewName} has been successfully downloaded and populated. Total records: ${
            rowCount - 1
        }`,
        "Download Complete",
        5
    );
}

const { views: configViews } = getViewData();

configViews.forEach(({ name, id }) => {
    ViewIDs[name] = id;
});

// parse view URLs from the ViewIDs object, if they are URLs
Object.keys(ViewIDs).forEach((key) => {
    const value = ViewIDs[key];

    if (value.startsWith("http") || value.startsWith("opendata.usac.org")) {
        const { id } = parseViewURL(value);
        ViewIDs[key] = id;
    }
});

Object.keys(ViewIDs).forEach(function (viewName) {
    this[`downloadView${viewName}`] = function () {
        const auth = getAuthCredentials();
        const config = getConfigData();

        const fundingYear = normalizeFundingYear(config.years);
        const state = normalizeState(config.states);
        const ben = normalizeBEN(config.bens);

        const options = new Options(fundingYear, state, ben);

        downloadAndPopulateUSACData(viewName, options, auth);
    };
});

/**
 * Creates menu items to run the script.
 */
function onOpen() {
    const ui = SpreadsheetApp.getUi();
    const menu = ui.createMenu("USAC Data");

    Object.keys(ViewIDs).forEach(function (viewName) {
        menu.addItem(
            `Download ${viewName.replace(/_/g, " ")}`,
            `downloadView${viewName}`
        );
    });

    menu.addItem("Download FRN Data (Config)", "downloadFRNData");

    menu.addToUi();
}

// /**
//  * Re-populates the view IDs and menu items when the CONFIG.VIEW tab is edited.
//  */
// function onEdit(e) {
//     if (e.source.getSheetName() === "CONFIG.VIEW") {
//         populateViewIds();
//         onOpen();
//     }
// }

/**
 * Downloads FRN_STATUS and FRN_BASIC_INFORMATION for configured years, states, and BENs.
 */
function downloadFRNData() {
    const auth = getAuthCredentials();
    const config = getConfigData();

    const fundingYear = normalizeFundingYear(config.years);
    const state = normalizeState(config.states);
    const ben = normalizeBEN(config.bens);

    const options = new Options(fundingYear, state, ben);

    downloadAndPopulateUSACData("FRN_STATUS", options, auth);
    downloadAndPopulateUSACData("FRN_BASIC_INFORMATION", options, auth);

    console.log(
        `Completed downloading FRN_STATUS and FRN_BASIC_INFORMATION for configured years, states, and BENs`
    );
    showToast(
        `Completed downloading FRN_STATUS and FRN_BASIC_INFORMATION for configured years, states, and BENs`,
        "Download Complete",
        5
    );
}
