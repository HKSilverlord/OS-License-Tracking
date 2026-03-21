import * as xlsx from 'xlsx';

try {
  const wb = xlsx.readFile('./data/CATIA LISENCE.xlsx', { cellFormula: true });
  console.log('Available sheets:', wb.SheetNames);
  
  for (const sheetName of wb.SheetNames) {
    console.log(`\n--- Sheet: ${sheetName} ---`);
    const ws = wb.Sheets[sheetName];
    let formulaCount = 0;
    
    for (const cellAddress in ws) {
      if (cellAddress[0] === '!') continue;
      
      const cell = ws[cellAddress];
      if (cell && cell.f) {
        console.log(`Cell ${cellAddress}: Formula = ${cell.f} | Value = ${cell.v}`);
        formulaCount++;
      }
    }
    
    if (formulaCount === 0) {
      console.log('No formulas found in this sheet.');
    } else {
      console.log(`Total formulas found: ${formulaCount}`);
    }
  }
} catch (error) {
  console.error("Error reading file:", error.message);
}
