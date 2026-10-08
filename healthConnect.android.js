import { initialize, requestPermission, readRecords } from "react-native-health-connect";

function dayBounds(date = new Date()) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const end = new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  return { start: start.toISOString(), end: end.toISOString() };
}

export async function readHealthConnectToday() {
  try {
    const initialized = await initialize();
    if (!initialized) return null;

    await requestPermission([
      { accessType: "read", recordType: "Steps" },
      { accessType: "read", recordType: "BackgroundAccessPermission" },
    ]);

    const { start, end } = dayBounds();
    const result = await readRecords("Steps", {
      timeRangeFilter: { operator: "between", startTime: start, endTime: end },
    });

    return (result?.records || []).reduce((total, record) => total + Number(record.count || 0), 0);
  } catch {
    return null;
  }
}
