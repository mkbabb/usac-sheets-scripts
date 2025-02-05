const TIMESTAMP_COL = "Timestamp";

/**
 * Calculates the delta between current and previous data based on chosen Primary Key indices,
 * outputting changes in separate columns.
 * @param {Array<Array<any>>} currentData - 2D array containing current data.
 * @param {Array<Array<any>>} previousData - 2D array containing previous data.
 * @param {Array<Array<any>>} headers - 2D array containing header names.
 * @param {number|Array<number>} leftPkIndex - The index(es) of the Primary Key column(s) for current data (1-indexed).
 * @param {number|Array<number>} [rightPkIndex] - The index(es) of the Primary Key column(s) for previous data (1-indexed). If omitted, leftPkIndex is used.
 * @returns {Array<Array<any>>} A 2D array with PK columns and individual change columns.
 */
function CALC_DELTA(currentData, previousData, headers, leftPkIndex, rightPkIndex) {
    if (
        !Array.isArray(currentData) ||
        !Array.isArray(previousData) ||
        !Array.isArray(headers)
    ) {
        return [
            [
                "Error",
                "Invalid input. Current data, previous data, and headers must be arrays.",
            ],
        ];
    }

    headers = headers.flat();

    if (currentData.length === 0 || previousData.length === 0 || headers.length === 0) {
        return [["Error", "One or more input arrays are empty."]];
    }

    // Ensure leftPkIndex and rightPkIndex are arrays
    leftPkIndex = Array.isArray(leftPkIndex) ? leftPkIndex.flat() : [leftPkIndex];
    rightPkIndex = rightPkIndex
        ? Array.isArray(rightPkIndex)
            ? rightPkIndex.flat()
            : [rightPkIndex]
        : leftPkIndex;

    // Adjust pkIndices to be 0-indexed for internal use
    const leftPkIndicesZeroBased = leftPkIndex.map((index) => index - 1);
    const rightPkIndicesZeroBased = rightPkIndex.map((index) => index - 1);

    // Validate PK indices
    if (
        leftPkIndicesZeroBased.some((index) => index < 0 || index >= headers.length) ||
        rightPkIndicesZeroBased.some((index) => index < 0 || index >= headers.length)
    ) {
        return [
            [
                "Error",
                `Invalid Primary Key index. Must be between 1 and ${headers.length}.`,
            ],
        ];
    }

    // Create composite keys for current and previous data
    const currentMap = new Map(
        currentData.map((row) => [
            leftPkIndicesZeroBased.map((i) => row[i]).join("|"),
            row,
        ])
    );
    const previousMap = new Map(
        previousData.map((row) => [
            rightPkIndicesZeroBased.map((i) => row[i]).join("|"),
            row,
        ])
    );

    // Track all columns that have changes
    const changedColumns = new Set();
    const changesByRow = new Map();

    // First pass: collect all changes and identify changed columns
    for (const [pkValue, currentRow] of currentMap) {
        const previousRow = previousMap.get(pkValue);

        // If the previous row is missing, add all columns as changes
        if (!previousRow) {
            const currentRowMap = {
                "New Row": "New Row",
            };
            headers.forEach((header, index) => {
                currentRowMap[header] = currentRow[index];
            });

            // Add a "New Row" column:
            changedColumns.add("New Row");

            changesByRow.set(pkValue, currentRowMap);
            continue;
        }

        const rowChanges = {};
        headers.forEach((header, index) => {
            if (header === TIMESTAMP_COL || leftPkIndicesZeroBased.includes(index)) {
                return;
            }

            const currentValue = String(currentRow[index]);
            const previousValue = String(previousRow[index]);

            // Skip if values are the same
            if (currentValue === previousValue) {
                return;
            }

            const currentNum = Number(currentValue);
            const previousNum = Number(previousValue);

            if (!isNaN(currentNum) && !isNaN(previousNum)) {
                const diff = currentNum - previousNum;
                const emoji = diff > 0 ? "⬆️" : "⬇️";

                rowChanges[
                    header
                ] = `${emoji} ${previousNum.toLocaleString()} → ${currentNum.toLocaleString()}`;
            } else {
                rowChanges[header] = `Δ ${previousValue} → ${currentValue}`;
            }

            changedColumns.add(header);
        });

        if (Object.keys(rowChanges).length > 0) {
            changesByRow.set(pkValue, rowChanges);
        }
    }

    // Convert changed columns to sorted array for consistent output
    const changedColumnsList = Array.from(changedColumns);

    // Align the changed columns list to the headers:
    changedColumnsList.sort((a, b) => headers.indexOf(a) - headers.indexOf(b));

    // Ensure the "New Row" column is always last:
    if (changedColumnsList.includes("New Row")) {
        changedColumnsList.splice(changedColumnsList.indexOf("New Row"), 1);
        changedColumnsList.push("New Row");
    }

    // Create output array with headers
    const output = [];
    const pkHeaders = leftPkIndicesZeroBased.map((index) => headers[index]);

    // @ts-ignore
    output.push([...pkHeaders, ...changedColumnsList]);

    // Second pass: create aligned output rows
    for (const [pkValue, changes] of changesByRow) {
        const pkValues = pkValue.split("|");

        if (!pkValues.every((value) => value !== "")) {
            continue;
        }

        const row = [
            ...pkValues,
            // @ts-ignore
            ...changedColumnsList.map((column) => changes[column] || ""),
        ];

        // @ts-ignore
        output.push(row);
    }

    return output.length > 1 ? output : [[""]];
}
