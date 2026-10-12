import { useLocalSearchParams } from "expo-router";
import { TransactionForm } from "@/service/TransactionForm";
export default function Route() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <TransactionForm id={id} />;
}
