import { seoulDate, useResource } from "./ui";

/** 서버 배포 전에도 기존 앱 흐름이 유지되도록 같은 릴리스의 읽기 API로 준비 여부만 확인한다. */
export function useServerExtensions() {
  const date = seoulDate();
  const result = useResource<{ items: unknown[] }>(
    `/scheduled-expenses?from=${date}&to=${date}`,
  );
  return {
    available: !!result.data && !result.error,
    checking: result.loading,
  };
}
