/**
 * Calculates the delta between current and previous data based on chosen Primary Key indices.
 * This function can be called directly from a Google Sheets cell.
 * @param {Array<Array<any>>} currentData - 2D array containing current data.
 * @param {Array<Array<any>>} previousData - 2D array containing previous data.
 * @param {Array<Array<any>>} headers - 2D array containing header names.
 * @param {number|Array<number>} leftPkIndex - The index(es) of the Primary Key column(s) for current data (1-indexed).
 * @param {number|Array<number>} [rightPkIndex] - The index(es) of the Primary Key column(s) for previous data (1-indexed). If omitted, leftPkIndex is used.
 * @returns {Array<Array<any>>} A 2D array with PK columns and Changes column.
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

    const output = [];

    // Add header row with PK column names and "Changes" column
    const pkHeaders = leftPkIndicesZeroBased.map((index) => headers[index]);
    // @ts-ignore
    output.push([...pkHeaders, "Changes"]);

    for (const [pkValue, currentRow] of currentMap) {
        const previousRow = previousMap.get(pkValue);
        const pkValues = pkValue.split("|");
        const changes = [];

        if (!previousRow) {
            // @ts-ignore
            output.push([...pkValues, "New row"]);
            continue;
        }

        headers.forEach((header, index) => {
            if (leftPkIndicesZeroBased.includes(index)) return; // Skip PK columns
            const currentValue = String(currentRow[index]);
            const previousValue = String(previousRow[index]);

            if (currentValue === previousValue) return; // Skip if values are equal

            const currentNum = Number(currentValue);
            const previousNum = Number(previousValue);

            if (!isNaN(currentNum) && !isNaN(previousNum)) {
                const diff = currentNum - previousNum;
                const emoji = diff > 0 ? "⬆️" : diff < 0 ? "⬇️" : "Δ";

                // @ts-ignore
                changes.push(`${emoji} ${header}: ${previousValue} → ${currentValue}`);
            } else {
                // @ts-ignore
                changes.push(`Δ ${header}: ${previousValue} → ${currentValue}`);
            }
        });

        if (changes.length === 0) {
            continue;
        }

        // @ts-ignore
        output.push([...pkValues, changes.join("\n")]);
    }

    return output.length > 1 ? output : [[""]];
}
