// A Date object as "YYYY-MM-DD"
export function dateToString(date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function getToday() {
  return dateToString(new Date());
}

// Sort events by their time, e.g. "09:30" before "18:00"
export function byTime(a, b) {
  return (a.time || "").localeCompare(b.time || "");
}

// Events that happen on a date, including yearly ones (birthdays etc.)
export function eventsOn(events, dateString) {
  return events.filter(
    (item) =>
      item.date === dateString ||
      (item.repeat === "yearly" &&
        item.date.slice(5) === dateString.slice(5) &&
        dateString > item.date)
  );
}

// How many days from one date to another
export function daysBetween(fromDate, toDate) {
  const [y1, m1, d1] = fromDate.split("-").map(Number);
  const [y2, m2, d2] = toDate.split("-").map(Number);
  const first = Date.UTC(y1, m1 - 1, d1);
  const second = Date.UTC(y2, m2 - 1, d2);
  return Math.round((second - first) / 86400000);
}

// "Today", "Tomorrow", "in 12 days", "3 days ago"
export function countdownText(dateString) {
  const days = daysBetween(getToday(), dateString);
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days === -1) return "Yesterday";
  if (days > 1) return `in ${days} days`;
  return `${-days} days ago`;
}

// "Tue, 6 Oct"
export function formatDate(dateString) {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day).toLocaleDateString("en-US", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
}

// Everything happening from today for the next number of days
export function getUpcoming(events, days) {
  const list = [];
  const now = new Date();
  for (let i = 0; i < days; i++) {
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const dateString = dateToString(day);
    eventsOn(events, dateString)
      .sort(byTime)
      .forEach((item) => {
        list.push({ key: dateString + item.id, date: dateString, event: item });
      });
  }
  return list;
}