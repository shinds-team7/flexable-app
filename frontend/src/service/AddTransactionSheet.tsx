import { router } from "expo-router";
import { View } from "react-native";
import { Button, Sheet, T } from "@/components/ui";
import {
  imageImportSupported,
  useImageImport,
} from "./receiptImport/useImageImport";
/** + 버튼이 여는 시트. 이미지에서 가져오기와 직접 입력 중 고른다. */
export function AddTransactionSheet({
  visible,
  onClose,
}: {
  visible: boolean;
  onClose: () => void;
}) {
  const imageImport = useImageImport();
  return (
    <>
      <Sheet
        visible={visible}
        onClose={onClose}
        title="거래 추가"
        subtitle="이미지는 기기에서만 읽고 서버에 올리지 않아요"
      >
        <View style={{ gap: 10 }}>
          <Button
            label="이미지 업로드"
            icon="image-outline"
            disabled={!imageImportSupported || imageImport.busy}
            onPress={() => {
              onClose();
              imageImport.start();
            }}
          />
          {!imageImportSupported && (
            <T size={13}>이미지 업로드는 앱에서 쓸 수 있어요</T>
          )}
          <Button
            label="직접 입력"
            variant="soft"
            icon="create-outline"
            onPress={() => {
              onClose();
              router.push("/transactions/new");
            }}
          />
        </View>
      </Sheet>
      <Sheet
        visible={!!imageImport.error}
        onClose={imageImport.clearError}
        title="이미지를 읽지 못했어요"
      >
        <View style={{ gap: 10 }}>
          <T>{imageImport.error}</T>
          <Button label="확인" onPress={imageImport.clearError} />
        </View>
      </Sheet>
    </>
  );
}
