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

    if (
        currentData.length === 0 ||
        previousData.length === 0 ||
        headers.length === 0 ||
        headers[0].length === 0
    ) {
        return [["Error", "One or more input arrays are empty."]];
    }

    // Flatten headers if it's a 2D array
    const flatHeaders = headers.flat();

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
        leftPkIndicesZeroBased.some(
            (index) => index < 0 || index >= flatHeaders.length
        ) ||
        rightPkIndicesZeroBased.some(
            (index) => index < 0 || index >= flatHeaders.length
        )
    ) {
        return [
            [
                "Error",
                `Invalid Primary Key index. Must be between 1 and ${flatHeaders.length}.`,
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
    const pkHeaders = leftPkIndicesZeroBased.map((index) => flatHeaders[index]);
    output.push([...pkHeaders, "Changes"]);

    for (const [pkValue, currentRow] of currentMap) {
        const previousRow = previousMap.get(pkValue);
        if (!previousRow) continue; // Skip if no matching previous row

        const changes = [];

        flatHeaders.forEach((header, index) => {
            if (leftPkIndicesZeroBased.includes(index)) return; // Skip PK columns
            const currentValue = currentRow[index];
            const previousValue = previousRow[index];

            if (currentValue === previousValue) return; // Skip if values are equal

            const currentNum = Number(currentValue);
            const previousNum = Number(previousValue);

            if (!isNaN(currentNum) && !isNaN(previousNum)) {
                const diff = currentNum - previousNum;
                const emoji = diff > 0 ? "⬆️" : diff < 0 ? "⬇️" : "Δ";

                changes.push(`${emoji} ${header}: ${previousValue} → ${currentValue}`);
            } else {
                changes.push(`Δ ${header}: ${previousValue} → ${currentValue}`);
            }
        });

        if (changes.length === 0) {
            continue;
        }

        const pkValues = pkValue.split("|");
        output.push([...pkValues, changes.join("\n")]);
    }

    return output.length > 1 ? output : [[""]];
}
