import { dateToString } from "./dateHelpers";

const CURRENCY = "₹";

function total(list) {
  return list.reduce((sum, item) => sum + item.amount, 0);
}

// Looks at your data and returns a few short lines: [{ icon, text }]
export function buildInsights(expenses, budgets, stepHistory) {
  const insights = [];
  const now = new Date();
  const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const spending = expenses.filter((item) => item.type !== "income");

  const thisMonthItems = spending.filter((item) => {
    const d = new Date(item.date);
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  });

  // Last month, but only up to today's day number, so the comparison is fair
  const lastMonthItems = spending.filter((item) => {
    const d = new Date(item.date);
    return (
      d.getMonth() === lastMonth.getMonth() &&
      d.getFullYear() === lastMonth.getFullYear() &&
      d.getDate() <= now.getDate()
    );
  });

  // 1. This month compared with the same days last month
  const thisTotal = total(thisMonthItems);
  const lastTotal = total(lastMonthItems);
  if (lastTotal > 0) {
    const change = Math.round(((thisTotal - lastTotal) / lastTotal) * 100);
    if (change > 0) {
      insights.push({
        icon: "trending-up",
        text: `You've spent ${change}% more than the same days last month`,
      });
    } else if (change < 0) {
      insights.push({
        icon: "trending-down",
        text: `You've spent ${-change}% less than the same days last month`,
      });
    } else {
      insights.push({
        icon: "pie-chart",
        text: "Your spending matches the same days last month",
      });
    }
  }

  // 2. The biggest category this month
  const byCategory = {};
  thisMonthItems.forEach((item) => {
    byCategory[item.category] = (byCategory[item.category] || 0) + item.amount;
  });
  const names = Object.keys(byCategory);
  if (names.length > 0) {
    const top = names.reduce((best, name) => (byCategory[name] > byCategory[best] ? name : best));
    insights.push({
      icon: "pie-chart",
      text: `${top} is your biggest spending this month (${CURRENCY}${byCategory[top].toFixed(0)})`,
    });
  }

  // 3. A budget that has been passed
  const overBudget = Object.keys(budgets).find(
    (name) => budgets[name] > 0 && (byCategory[name] || 0) > budgets[name]
  );
  if (overBudget) {
    const extra = byCategory[overBudget] - budgets[overBudget];
    insights.push({
      icon: "alert-circle",
      text: `${overBudget} is over budget by ${CURRENCY}${extra.toFixed(0)}`,
    });
  }

  // 4. Your best step day in the last 7 days
  let bestSteps = 0;
  let bestDay = "";
  for (let i = 0; i < 7; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const steps = stepHistory[dateToString(day)] || 0;
    if (steps > bestSteps) {
      bestSteps = steps;
      bestDay = day.toLocaleDateString("en-US", { weekday: "long" });
    }
  }
  if (bestSteps > 0) {
    insights.push({
      icon: "footsteps",
      text: `Your best walking day this week was ${bestDay} with ${bestSteps} steps`,
    });
  }

  return insights;
}