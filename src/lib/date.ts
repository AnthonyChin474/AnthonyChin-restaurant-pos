export function formatMalaysiaTime(dateString: string) {
  return new Date(dateString).toLocaleString(
    "en-MY",
    {
      timeZone: "Asia/Kuala_Lumpur",
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    }
  );
}