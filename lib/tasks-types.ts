export type TaskRow = {
  id: string;
  title: string;
  due_at: string;
  done: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
};
