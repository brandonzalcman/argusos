import { ScaffoldScreen } from "../src/components/ScaffoldScreen";

/** Placeholder route for future permission-filtered task assignment and optimistic updates. */
export default function TasksScreen() {
  return (
    <ScaffoldScreen
      title="Assigned tasks"
      purpose="A future task list scoped to the authenticated tenant, position and active incident."
      implementationNote="loadAssignedTasks() is a typed throwing contract. No tasks are loaded, cached or displayed."
    />
  );
}
