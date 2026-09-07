(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  root.WeeklyScheduler = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  const PRIORITY_WEIGHT = { high: 0, medium: 1, low: 2 };

  function assignWeeklyTasks(tasks, workdays, dailyCapacity) {
    const assignments = Object.fromEntries(workdays.map((day) => [day, []]));
    const loads = Object.fromEntries(workdays.map((day) => [day, 0]));
    const pool = [];

    const sorted = [...tasks].sort((a, b) => {
      const priorityDiff =
        (PRIORITY_WEIGHT[a.priority] ?? 1) - (PRIORITY_WEIGHT[b.priority] ?? 1);
      if (priorityDiff) return priorityDiff;
      const dueA = a.dueDate || "9999-12-31";
      const dueB = b.dueDate || "9999-12-31";
      return dueA.localeCompare(dueB);
    });

    sorted.forEach((task) => {
      const hours = Math.max(0.5, Number(task.hours) || 1);
      const eligibleDays = workdays.filter(
        (day) => !task.dueDate || day <= task.dueDate,
      );
      const target = eligibleDays
        .filter((day) => loads[day] + hours <= dailyCapacity)
        .sort((a, b) => loads[a] - loads[b] || a.localeCompare(b))[0];

      if (!target) {
        pool.push({ ...task, hours, assignedDate: "" });
        return;
      }

      const assigned = { ...task, hours, assignedDate: target };
      assignments[target].push(assigned);
      loads[target] += hours;
    });

    return { assignments, loads, pool };
  }

  return { assignWeeklyTasks };
});
