export interface Drug {
  id: string;
  name: string;
  tradeName?: string;
  companyId: string;
  repId?: string;
  description?: string;
}

export interface Company {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  search_count?: number;
}

export interface Representative {
  id: string;
  name: string;
  companyId: string;
  phone?: string;
  lineId?: string;
}

export type TabType = 'search' | 'manage';
