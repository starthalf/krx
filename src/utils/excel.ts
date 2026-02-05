// src/utils/excel.ts
import * as XLSX from 'xlsx';

// [수정] 멀티 시트 지원을 위한 타입 정의
type SheetData = any[] | { [sheetName: string]: any[] };

export const exportToExcel = (data: SheetData, fileName: string) => {
  const wb = XLSX.utils.book_new();

  if (Array.isArray(data)) {
    // 1. 기존 방식: 데이터 배열 하나만 왔을 때 (Sheet1 생성)
    const ws = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, 'Sheet1');
  } else {
    // 2. 신규 방식: { 시트명: 데이터, 시트명2: 데이터2 } 형태로 왔을 때
    Object.entries(data).forEach(([sheetName, sheetData]) => {
      const ws = XLSX.utils.json_to_sheet(sheetData);
      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    });
  }

  XLSX.writeFile(wb, `${fileName}.xlsx`);
};

export const readExcel = (file: File): Promise<any[]> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        // 첫 번째 시트만 읽어서 데이터로 반환 (가이드 시트는 무시)
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

export const formatExcelDate = (excelDate: any): string => {
  if (!excelDate) return new Date().toISOString();
  return new Date().toISOString(); 
};