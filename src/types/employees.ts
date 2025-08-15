export type Employee = {
  id?: string;
  name: string;
  salaryMonthly: number;
  salaryDaily?: number;
  salaryHourly?: number;
  daysPerWeek?: number;
  hoursPerDay?: number;
  daysToPay?: number | null;
  resignationDate?: string | null;
  createdAt?: any;
  updatedAt?: any;
  [k: string]: any;
};

export type EmployeeEvent = {
  id?: string;
  type: 'extra_day' | 'overtime' | 'resignation';
  date: string; // YYYY-MM-DD
  hours?: number | null; // for overtime
  multiplier?: number | null;
  amount?: number;
  note?: string;
  createdAt?: any;
};