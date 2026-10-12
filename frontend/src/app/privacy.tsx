import { LegalPage } from "@/service/LegalPage";
import { privacyBody } from "@/service/legal";
export default function Privacy() {
  return <LegalPage title="개인정보처리방침" body={privacyBody} />;
}
