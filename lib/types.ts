export interface FoodEntry {
  id?: string;
  name: string;
  calories: number;
  protein_g: number;
  estimated: boolean;
  cost: number;
  time: string;
  meal: string;
}

export interface SpendEntry {
  id?: string;
  item: string;
  amount: number;
  category: string;
  time: string;
}

export interface TimeBlock {
  start: string;
  end: string;
  activity: string;
  category: string;
}
