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
