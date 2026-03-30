const xlsx = require('xlsx');
const fs = require('fs');

try {
  const wb = xlsx.readFile('./CATIA LISENCE.xlsx', { cellFormula: true });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const range = xlsx.utils.decode_range(ws['!ref']);
  
  let output = `Sheet: ${sheetName}\nRange: ${ws['!ref']}\n\n`;
  
  for (let r = range.s.r; r <= range.e.r; r++) {
    output += `\n=== ROW ${r + 1} ===\n`;
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cellRef = xlsx.utils.encode_cell({ r, c });
      const cell = ws[cellRef];
      if (cell && (cell.v !== undefined || cell.f)) {
        const val = cell.v !== undefined ? cell.v : '(empty)';
        const formula = cell.f ? `  FORMULA: ${cell.f}` : '';
        const type = cell.t || '?';
        output += `  ${cellRef} [${type}] = ${val}${formula}\n`;
      }
    }
  }
  
  fs.writeFileSync('./catia_dump.txt', output, 'utf-8');
  console.log('Done! Output written to catia_dump.txt');
  console.log(`Total rows: ${range.e.r - range.s.r + 1}, Total cols: ${range.e.c - range.s.c + 1}`);
} catch (error) {
  console.error("Error:", error.message);
}
