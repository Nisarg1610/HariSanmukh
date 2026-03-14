export interface User {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  household_id: string;
  role: 'admin' | 'user';
  status: 'active' | 'inactive';
  created_at: string;
}

export interface Household {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
}

export interface Seva {
  id: string;
  household_id: string;
  name: string;
  description?: string;
  cap: number;
  created_at: string;
}