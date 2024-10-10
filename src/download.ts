// Base URL for USAC API
const BASE_URL = "https://opendata.usac.org/api/views/";

// View IDs for different views
// The values can be either view IDs or full view URLs
const ViewIDs = {
    // E-Rate: https://opendata.usac.org/stories/s/E-rate-Tools/bneq-mh8b/
    FRN_STATUS:
        "https://opendata.usac.org/E-Rate/E-Rate-Request-for-Discount-on-Services-FRN-Status/qdmp-ygft/about_data",

    FRN_LINE_ITEMS: "hbj5-2bpj",
    FRN_RECIPIENTS_OF_SERVICE: "tuem-agyq",
    FRN_BASIC_INFORMATION: "9s6i-myen",

    SUPPLEMENTAL_ENTITY_DATA: "7i5i-83qf",

    CONSULTANTS: "x5px-esft",

    CAT2_BUDGETS: "6brt-5pbv",

    // Rural Health Care: https://opendata.usac.org/stories/s/Rural-Health-Care-Tools/qi66-q66c/
    RHC_COMMITMENTS_AND_DISBURSEMENTS:
        "https://opendata.usac.org/Rural-Health-Care/Rural-Health-Care-Commitments-and-Disbursements-FC/2kme-evqq/about_data",
};

// Mapping of view column names to their corresponding column names in the USAC API
const VIEW_COLUMN_NAME_MAP = {
    FRN_STATUS: {
        ben: "ben",
        state: "state",
        year: "funding_year",
    },

    FRN_LINE_ITEMS: {
        ben: "ben",
        state: "state",
        year: "funding_year",
    },

    FRN_RECIPIENTS_OF_SERVICE: {
        ben: "ben_no",
        state: "org_state",
        year: "funding_year",
    },

    FRN_BASIC_INFORMATION: {
        ben: "epc_organization_id",
        state: "org_state",
        year: "funding_year",
    },

    SUPPLEMENTAL_ENTITY_DATA: {
        ben: "entity_number",
        state: "physical_state",
        year: null,
    },

    CONSULTANTS: {
        ben: "epc_organization_id",
        state: "state",
        year: "funding_year",
    },

    CAT2_BUDGETS: {
        ben: "ben",
        year: null,
    },

    RHC_COMMITMENTS_AND_DISBURSEMENTS: {
        ben: null,
        state: "filing_hcp_state",
        year: "funding_year",

        filing_hcp_name: "filing_hcp_name",
    },
};

const CHUNK_SIZE = 1000; // Number of records to fetch per request

const GOOGLE_CHUNK_SIZE = 100; // Number of rows to set in a single batch

// Chunk sizes for different options
const OPTIONS_CHUNK_SIZES = {
    ben: 10,
    funding_year: null,
    state: null,
};

// Authentication function to get credentials from AUTH tab
function getAuthCredentials() {
    const authSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("AUTH");
    if (!authSheet) {
        return null;
    }

    return {
        username: authSheet.getRange("B1").getValue(),
        password: authSheet.getRange("B2").getValue(),
    };
}

const OPTIONS_COLS = {
    Year: "year",
    State: "state",
    BEN: "ben",
};

/**
 * Options class for query parameters
 *
 * @property {string[]} funding_year - The funding year
 * @property {string[]} state - The state code
 * @property {string[]} ben - The Billed Entity Number
 */
class Options {
    constructor(fundingYear = null, state = null, ben = null) {
        // @ts-ignore
        this.funding_year = fundingYear;
        // @ts-ignore
        this.state = state;
        // @ts-ignore
        this.ben = ben;
    }
}

function normalize(value) {
    if (!value || value.length === 0) {
        return null;
    }

    value = Array.isArray(value) ? value : [value];

    return value.map((v) => String(v).trim());
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
        return null;
    }

    const data = configSheet.getDataRange().getValues();

    const headers = data[0];

    const getColumnValues = (header) => {
        const ix = headers.indexOf(header);

        if (ix === -1) {
            return null;
        }

        return data
            .slice(1)
            .map((row) => row[ix])
            .filter(Boolean);
    };

    const options = {
        year: normalizeFundingYear(getColumnValues("Year")),
        state: normalizeState(getColumnValues("State")),
        ben: normalizeBEN(getColumnValues("BEN")),
    };

    // Find other columns that are not in the OPTIONS_COLS
    headers
        .filter((header) => {
            if (!header) {
                return false;
            }

            header = header.trim();

            if (header.length < 2) {
                return false;
            }

            return !OPTIONS_COLS.hasOwnProperty(header);
        })
        .forEach((header) => {
            const values = normalize(getColumnValues(header));

            if (!values || values.length === 0) {
                return;
            }

            options[header] = values;
        });

    return options;
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
        // @ts-ignore
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
        return null;
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
        // @ts-ignore
        .filter(([_, value]) => value != null && value.length > 0)
        .map(([key, value]) => buildCondition(key, value));

    return conditions.length > 0 ? "WHERE " + formatAndConditions(conditions) : "";
}

/**
 * Generator function to stream USAC data for a given view with consistent ordering.
 *
 * See https://dev.socrata.com/docs/queries/ for more information on SODA API queries.
 *
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

    // Generate all combinations of chunked options
    const chunkedOptionsCombinations = generateChunkedOptionsCombinations(
        options,
        OPTIONS_CHUNK_SIZES
    );

    let isFirstChunk = true;

    for (const currentOptions of chunkedOptionsCombinations) {
        let offset = 0;
        let hasMore = true;

        Logger.log(`Current query options: ${JSON.stringify(currentOptions)}`);

        while (hasMore) {
            const mappedOptions = mapOptions(currentOptions, viewName);
            const whereClause = buildWhereClause(mappedOptions);

            // Must have the order by clause to ensure consistent ordering whilst paging
            const query = `SELECT * ${whereClause} ORDER BY :id LIMIT ${CHUNK_SIZE} OFFSET ${offset}`;

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

            // @ts-ignore
            const response = makeAuthenticatedRequest(url, params, auth);
            if (response.getResponseCode() !== 200) {
                throw new Error(
                    `HTTP request failed. Status code: ${response.getResponseCode()}, Response: ${response.getContentText()}`
                );
            }

            const csvData = response.getContentText();
            const data = Utilities.parseCsv(csvData);

            if (data.length > 1) {
                Logger.log(`Fetched ${data.length - 1} records, offset: ${offset}`);

                if (isFirstChunk) {
                    isFirstChunk = false;
                    yield data;
                } else {
                    yield data.slice(1);
                }

                offset += CHUNK_SIZE;
            } else {
                Logger.log(`No more records found, offset: ${offset}`);
                hasMore = false;
            }
        }
    }
}

/**
 * Downloads USAC data for a given view and populates a sheet with the data.
 * @param {string} sheetName - The name of the sheet to populate
 * @param {string} viewName - The name of the view (e.g., "FRN_STATUS")
 * @param {Options} options - The options for filtering the data
 * @param {Object} auth - Authentication credentials
 */
function downloadAndPopulateUSACData(sheetName, viewName, options, auth) {
    const sheet = getOrCreateSheet(sheetName);

    sheet.clear();

    const dataStream = streamUSACData(viewName, options, auth);

    let isFirstChunk = true;
    let rowCount = 1;

    for (const chunk of dataStream) {
        const range = sheet.getRange(rowCount, 1, chunk.length, chunk[0].length);

        range.setValues(chunk);

        if (isFirstChunk) {
            range
                .offset(0, 0, 1, chunk[0].length)
                .setFontWeight("bold")
                .setWrap(true)
                .setWrapStrategy(SpreadsheetApp.WrapStrategy.WRAP);
            sheet.setFrozenRows(1);

            isFirstChunk = false;
            rowCount = chunk.length;
        } else {
            rowCount += chunk.length;
        }

        if (rowCount <= CHUNK_SIZE) {
            sheet.autoResizeColumns(1, chunk[0].length);
        }
    }

    showToast(
        `Data for ${viewName} has been successfully downloaded and populated. Total records: ${
            rowCount - 1
        }`,
        "Download Complete",
        5
    );
}

const configViews = getViewData();
if (configViews) {
    configViews.views.forEach(({ name, id }) => {
        // Normalize the view name to be in uppercase and replace spaces with underscores:
        // e.g., "FRN Status" => "FRN_STATUS"
        name = name.toUpperCase().replace(/ /g, "_");
        ViewIDs[name] = id;
    });
}

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

        downloadAndPopulateUSACData(viewName, viewName, config, auth);
    };
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
    const ui = SpreadsheetApp.getUi();
    const menu = ui.createMenu("USAC Data");

    Object.keys(ViewIDs).forEach(function (viewName) {
        menu.addItem(
            `Download ${viewName.replace(/_/g, " ")}`,
            `downloadView${viewName}`
        );
    });

    menu.addItem("Download USAC Nightly Data", "downloadUSACNightlyData");

    menu.addItem("Download CAT2 Budgets & Delta", "downloadCat2BudgetsData");

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
