/**
 * Parse CSV text into an array of objects.
 * Numeric strings are converted to numbers.
 */
export default function parseCSV(text) {
  const lines = text.trim().split("\n");
  const headers = lines[0].split(",");
  return lines.slice(1).map((line) => {
    const values = line.split(",");
    const obj = {};
    headers.forEach((h, i) => {
      const v = values[i];
      obj[h.trim()] =
        isNaN(v) || v === undefined || v.trim() === ""
          ? (v || "").trim()
          : parseFloat(v);
    });
    return obj;
  });
}
