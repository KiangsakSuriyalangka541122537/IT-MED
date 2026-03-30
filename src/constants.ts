import { Drug, Company, Representative } from './types';

export const INITIAL_COMPANIES: Company[] = [
  { id: 'c1', name: 'บริษัท ยาดี จำกัด', address: 'กรุงเทพฯ', phone: '02-123-4567' },
  { id: 'c2', name: 'ไทยฟาร์มาซูติคอล', address: 'นนทบุรี', phone: '02-987-6543' },
];

export const INITIAL_DRUGS: Drug[] = [
  { id: 'd1', name: 'Paracetamol 500mg', companyId: 'c1', repId: 'r1', description: 'ยาแก้ปวดลดไข้' },
  { id: 'd2', name: 'Amoxicillin 250mg', companyId: 'c1', repId: 'r1', description: 'ยาฆ่าเชื้อ' },
  { id: 'd3', name: 'Aspirin', companyId: 'c2', repId: 'r2', description: 'ยาละลายลิ่มเลือด' },
];

export const INITIAL_REPS: Representative[] = [
  { id: 'r1', name: 'คุณสมชาย ใจดี', companyId: 'c1', phone: '081-234-5678', lineId: 'somchai_c1' },
  { id: 'r2', name: 'คุณสมหญิง รักดี', companyId: 'c2', phone: '089-876-5432', lineId: 'somying_c2' },
];
