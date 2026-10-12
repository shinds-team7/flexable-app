/**
 * 홈 B안 (/demo/home2) — 기존 시연 홈(/demo)과 비교용.
 * 캐릭터를 화면 중앙 상단에 가장 먼저 보여주고, 그 아래는 기존 홈과 같은 구성.
 */
import { CharacterHero } from '@/components/CharacterHero';
import { HomeContent } from '@/components/HomeContent';

export default function Home2() {
  return <HomeContent top={<CharacterHero />} hideHero />;
}
