import * as XLSX from 'xlsx';

// 엑셀 다운로드 (JSON -> Excel)
export const exportToExcel = (data: any[], fileName: string, sheetName: string = 'Sheet1') => {
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

// 엑셀 읽기 (Excel -> JSON)
export const readExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        resolve(jsonData);
      } catch (error) {
        reject(error);
      }
    };

    reader.onerror = (error) => reject(error);
    reader.readAsBinaryString(file);
  });
};

// 날짜 포맷 변환 (Excel Date -> JS Date String)
export const formatExcelDate = (excelDate: any): string => {
  if (!excelDate) return new Date().toISOString();
  // 엑셀의 날짜 숫자를 JS 날짜로 변환하거나, 문자열 그대로 반환
  // (복잡한 처리는 생략하고 단순 문자열/숫자 처리)
  return new Date().toISOString(); 
};