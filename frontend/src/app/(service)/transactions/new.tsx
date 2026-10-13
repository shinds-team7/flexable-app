import { useLocalSearchParams } from "expo-router";
import { TransactionForm } from "@/service/TransactionForm";
export default function Route() {
  const { type } = useLocalSearchParams<{ type?: string }>();
  return (
    <TransactionForm initialType={type === "INCOME" ? "INCOME" : undefined} />
  );
}
