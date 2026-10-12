import { useRef, useState } from "react";
import { View } from "react-native";
import { Button, Card, ConfirmModal, Segment, T } from "@/components/ui";
import { api } from "./api/client";
import { CategorySheet } from "./CategorySheet";
import { useSession } from "./Session";
import { CategoryIcon, ErrorNotice, Loading, Page, useResource } from "./ui";
import type { Category, Kind } from "./types";
export function CategoriesScreen() {
  const [type, setType] = useState<Kind>("EXPENSE");
  const [sheet, setSheet] = useState(false);
  const [selected, setSelected] = useState<Category | null>(null);
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState<unknown>();
  const session = useSession();
  const result = useResource<Category[]>(`/categories?type=${type}`);
  const remove = async () => {
    if (!selected || lock.current) return;
    lock.current = true;
    setBusy(true);
    setError(undefined);
    const id = selected.id;
    setSelected(null);
    try {
      await api(`/categories/${id}`, { method: "DELETE" });
      session.invalidate();
    } catch (e) {
      setError(e);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  };
  return (
    <Page title="카테고리 관리">
      <Segment
        items={[
          { key: "EXPENSE", label: "지출" },
          { key: "INCOME", label: "수입" },
        ]}
        value={type}
        onChange={setType}
      />
      <ErrorNotice error={error} />
      <ErrorNotice error={result.error} retry={result.retry} />
      {result.loading ? (
        <Loading />
      ) : (
        result.data?.map((c) => (
          <Card
            key={c.id}
            style={{ flexDirection: "row", alignItems: "center", gap: 12 }}
          >
            <CategoryIcon icon={c.icon} color={c.color} />
            <View style={{ flex: 1 }}>
              <T weight="600">{c.name}</T>
              {c.isDefault && <T size={12}>기본 카테고리</T>}
            </View>
            {!c.isDefault && (
              <Button
                label="삭제"
                variant="ghost"
                disabled={busy}
                onPress={() => setSelected(c)}
              />
            )}
          </Card>
        ))
      )}
      <Button label="+ 카테고리 추가" onPress={() => setSheet(true)} />
      <CategorySheet
        visible={sheet}
        onClose={() => setSheet(false)}
        type={type}
        onCreated={() => result.retry()}
      />
      <ConfirmModal
        visible={!!selected}
        title="카테고리를 삭제할까요?"
        message="이 카테고리의 거래는 '기타'로 옮겨져요"
        confirmLabel="삭제"
        onCancel={() => setSelected(null)}
        onConfirm={remove}
      />
    </Page>
  );
}
