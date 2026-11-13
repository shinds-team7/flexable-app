import { useLocalSearchParams } from "expo-router";
import { ScheduledExpenseDetailScreen } from "@/service/ScheduledExpenseDetailScreen";
export default function Route() {
  const { id, date } = useLocalSearchParams<{ id: string; date?: string }>();
  return <ScheduledExpenseDetailScreen id={id} date={date} />;
}
