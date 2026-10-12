import { router } from 'expo-router';
import { Button, Card, T } from '@/components/ui';
import { OPERATOR_NAME, SERVICE_NAME, SUPPORT_EMAIL } from '@/service/config';
import { Page } from '@/service/ui';
export default function Privacy() {
 const sections = [
 ['수집 항목', '이메일과 비밀번호를 수집하며, 비밀번호는 암호화하여 저장합니다. 사용자가 입력한 잔액, 잔액 기준 시각, 수입일과 예정 수입액, 고정지출, 카드 미결제액, 보호 금액, 거래(금액·종류·날짜·내용·메모), 카테고리 및 필수 동의 여부를 수집합니다.'],
 ['이용 목적', '회원 가입과 로그인, 사용자 확인, 예산 계산, 거래 기록과 내역·분석 제공, 고객지원 및 계정 삭제를 위해 이용합니다.'],
 ['보관 기간', '회원 탈퇴 시 계정과 예산 설정, 거래, 카테고리를 즉시 삭제합니다. 서비스 이용 중에는 계정 유지와 기능 제공을 위해 보관합니다.'],
 ['처리 위탁', 'Amazon Web Services: 서버 및 데이터베이스 운영(서울 리전). Vercel: 웹 호스팅. 서비스 운영에 필요한 범위에서 처리를 위탁합니다.'],
 ['제3자 제공', '개인정보를 제3자에게 제공하지 않습니다.'],
 ['이용자의 권리', '앱에서 예산 설정과 거래를 조회·수정·삭제할 수 있습니다. 마이 → 계정 삭제에서 모든 개인정보 삭제를 요청할 수 있으며, 웹 /delete-account에서도 삭제할 수 있습니다. 로그인할 수 없는 경우 아래 문의처로 열람·정정·삭제를 요청해 주세요. 본인 확인 후 처리합니다.'],
 ['보호 조치', '비밀번호는 복원할 수 없는 암호화 방식으로 저장합니다. 접근 권한을 제한하고 암호화된 연결을 사용하여 정보를 보호합니다.'],
 ['문의처', `운영자: ${OPERATOR_NAME}\n이메일: ${SUPPORT_EMAIL}`],
 ['시행일', '2026-10-13'],
 ];
 return <Page title="개인정보처리방침"><T size={22} weight="800">{SERVICE_NAME} 개인정보처리방침</T>{sections.map(([title,body]) => <Card key={title} style={{gap:10}}><T size={17} weight="700">{title}</T><T style={{lineHeight:23}}>{body}</T></Card>)}<Button label="웹에서 계정 삭제" variant="soft" onPress={() => router.push('/delete-account')} /></Page>;
}
