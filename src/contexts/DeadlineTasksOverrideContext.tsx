import { createContext, useContext, type ReactNode } from 'react';
import type { Task } from '@/types/task';

const DeadlineTasksOverrideContext = createContext<Task[] | undefined>(undefined);

export function DeadlineTasksOverrideProvider({
  value,
  children,
}: {
  value: Task[] | undefined;
  children: ReactNode;
}) {
  return (
    <DeadlineTasksOverrideContext.Provider value={value}>
      {children}
    </DeadlineTasksOverrideContext.Provider>
  );
}

export function useDeadlineTasksOverride(): Task[] | undefined {
  return useContext(DeadlineTasksOverrideContext);
}
