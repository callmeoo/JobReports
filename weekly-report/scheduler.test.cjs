const assert = require("node:assert/strict");
const { assignWeeklyTasks } = require("./scheduler.js");

const days = [
  "2026-09-07",
  "2026-09-08",
  "2026-09-09",
  "2026-09-10",
  "2026-09-11",
];

const result = assignWeeklyTasks(
  [
    { id: "seo", title: "SEO", module: "SEO/GEO", priority: "high", hours: 8, dueDate: days[0] },
    { id: "web", title: "网站", module: "网站功能", priority: "medium", hours: 8, dueDate: days[4] },
    { id: "growth", title: "学习", module: "自我成长", priority: "low", hours: 2, dueDate: "" },
    { id: "overflow", title: "超量", module: "其他", priority: "low", hours: 30, dueDate: "" },
  ],
  days,
  8,
);

assert.equal(result.assignments[days[0]][0].id, "seo", "高优且周一截止的任务应排在周一");
assert.ok(
  Object.values(result.assignments).flat().some((task) => task.id === "growth"),
  "自我成长任务应分派到工作日",
);
assert.ok(result.pool.some((task) => task.id === "overflow"), "无法放入单日容量的任务应进入机动池");
assert.ok(
  Object.values(result.loads).every((hours) => hours <= 8),
  "每日分派不得超过容量",
);

console.log("scheduler tests passed");
