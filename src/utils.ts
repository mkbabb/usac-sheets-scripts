/**
 * Sets a given range of values in a sheet, chunking them if necessary into chunks of GOOGLE_CHUNK_SIZE.
 * @param {GoogleAppsScript.Spreadsheet.Range} range - The range to set the values in
 * @param {Array<Array<any>>} values - The values to set
 */
function chunkSetValues(range, values, chunkSize) {
    for (let i = 0; i < values.length; i += chunkSize) {
        const chunk = values.slice(i, i + chunkSize);
        range.offset(i, 0, chunk.length, chunk[0].length).setValues(chunk);
    }
}

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
        // @ts-ignore
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
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    let sheet = ss.getSheetByName(sheetName);
    if (!sheet) {
        sheet = ss.insertSheet(sheetName);
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

/**
 * Gets the authorization header for the given authentication object.
 * @param auth  - The authentication object containing username and password.
 */
function getAuthHeader(auth) {
    return "Basic " + Utilities.base64Encode(auth.username + ":" + auth.password);
}

/**
 * Gets the download function name for the given view name.
 * @param {string} viewName - The name of the view.
 */
function getDownloadFunctionName(viewName) {
    return `downloadView${viewName}`;
}

/**
 * Makes an authenticated request to the given URL with the given parameters.
 * @param {string} url - The URL to make the request to.
 * @param {Object} params - The parameters to include in the request.
 * @param {Object} auth - The authentication object containing username and password.
 * @param {string} [method] - The HTTP method to use. Defaults to "GET".
 * @returns {HTTPResponse} The response object.
 */
function makeAuthenticatedRequest(url, params, auth, method) {
    method = method?.toLowerCase() ?? "get";

    const options = {
        method,
        muteHttpExceptions: true,
    };

    if (auth) {
        // @ts-ignore
        options.headers = {
            Authorization: getAuthHeader(auth),
        };
    }

    const fullUrl =
        url +
        "?" +
        Object.entries(params)
            // @ts-ignore
            .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
            .join("&");

    return UrlFetchApp.fetch(fullUrl, options);
}

/**
 * Makes a request with exponential backoff retry logic
 * @param {function} operation - Function that returns the request response
 * @param {Object} options - Backoff options
 * @param {number} [options.maxAttempts=5] - Maximum number of retry attempts
 * @param {number} [options.initialDelayMs=1000] - Initial delay in milliseconds
 * @param {number} [options.maxDelayMs=32000] - Maximum delay between retries
 * @param {function} [options.shouldRetry] - Function to determine if error should trigger retry
 * @returns {any} - Response from the successful request
 * @throws {Error} - Throws if max attempts exceeded or permanent failure
 */
function withExponentialBackoff(operation, options = {}) {
    const {
        maxAttempts = 5,
        initialDelayMs = 1000,
        maxDelayMs = 32000,
        shouldRetry = (error) => true,
    } = options;

    let attempts = 0;
    let delay = initialDelayMs;

    while (attempts < maxAttempts) {
        try {
            attempts++;
            return operation();
        } catch (error) {
            if (attempts === maxAttempts || !shouldRetry(error)) {
                throw new Error(
                    `Operation failed after ${attempts} attempts: ${error.message}`
                );
            }

            // Log retry attempt
            Logger.log(
                `Request failed, attempt ${attempts}/${maxAttempts}. Retrying in ${delay}ms. Error: ${error.message}`
            );

            // Sleep for the calculated delay
            Utilities.sleep(delay);

            // Calculate next delay with exponential backoff, but don't exceed maxDelayMs
            delay = Math.min(delay * 2, maxDelayMs);
        }
    }
}

/**
 * @typedef {Object<string, any>} DataRow
 * A single row of data represented as an object where keys are column headers
 */

/**
 * Converts a 2D array of data with headers into an array of objects
 * @param {Array<Array<any>>} data - 2D array where first row contains headers
 * @returns {Array<DataRow>} Array of objects where keys are headers and values are row data
 * @throws {Error} If data is empty or malformed
 */
function convertToDict(data) {
    if (!data || !data.length || !data[0].length) {
        throw new Error("Invalid data structure: Empty or malformed data");
    }

    const headers = data[0];
    const rows = data.slice(1);

    return rows.map((row) => {
        const rowDict = {};
        headers.forEach((header, index) => {
            if (header) {
                // Only include non-empty headers
                rowDict[header] = row[index];
            }
        });
        return rowDict;
    });
}

/**
 * Aligns data with target headers, filling missing values with null
 * @param {Array<DataRow>} dictData - Array of data objects
 * @param {Array<string>} targetHeaders - Headers to align data to
 * @returns {Array<Array<any>>} 2D array aligned with target headers
 * @throws {Error} If input parameters are invalid
 */
function alignDataToHeaders(dictData, targetHeaders) {
    if (!Array.isArray(dictData) || !Array.isArray(targetHeaders)) {
        throw new Error("Invalid input: dictData and targetHeaders must be arrays");
    }

    if (!targetHeaders.length) {
        throw new Error("Target headers array cannot be empty");
    }

    return dictData.map((row) => {
        return targetHeaders.map((header) => {
            return row.hasOwnProperty(header) ? row[header] : null;
        });
    });
}

/**
 * Gets existing headers from a sheet
 * @param {GoogleAppsScript.Spreadsheet.Sheet} sheet - The sheet to get headers from
 * @returns {Array<string>} Array of header strings
 * @throws {Error} If sheet is empty or headers can't be retrieved
 */
function getSheetHeaders(sheet) {
    const headerRange = sheet.getRange(1, 1, 1, sheet.getLastColumn());
    const headers = headerRange.getValues()[0];

    if (!headers.length) {
        throw new Error("No headers found in sheet");
    }

    return headers;
}
