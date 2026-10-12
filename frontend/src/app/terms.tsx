import { LegalPage } from "@/service/LegalPage";
import { termsBody } from "@/service/legal";
export default function Terms() {
  return <LegalPage title="서비스 이용약관" body={termsBody} />;
}
