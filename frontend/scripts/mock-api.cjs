/**
 * 백엔드 없이 화면을 만들 때 쓰는 목 서버(docs/contracts/README.md). Prism이 스펙의 example 또는 형식에 맞는 값을 돌려준다.
 *
 * 사용: npm run mock:api → http://localhost:4010, .env.local의 EXPO_PUBLIC_API_URL을 http://localhost:4010으로 두고 npm run web
 * Prism은 스펙의 servers(/api/v1)를 경로 매칭에 쓰지 않는다. 앱 클라이언트는 주소 뒤에 /api/v1을 붙이므로,
 * 경로 앞에 /api/v1을 붙인 사본을 임시 폴더에 만들어 Prism에 넘긴다. 정본 스펙은 그대로다.
 */
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawn } = require("node:child_process");

const spec = path.join(__dirname, "..", "..", "docs", "contracts", "app-api.yaml");
const out = path.join(os.tmpdir(), "flexable-app-api.mock.yaml");

// paths 아래 경로 키(두 칸 들여쓰기 + '/')만 바꾼다
const text = fs
  .readFileSync(spec, "utf8")
  .replace(/^ {2}(\/[^\s:]*):/gm, "  /api/v1$1:")
  .replace(/^ {2}- url: \/api\/v1$/m, "  - url: /");
fs.writeFileSync(out, text);

// Windows에서 npx를 부르려면 셸이 필요하다. 셸에는 명령 문자열 하나로 넘긴다.
const prism = spawn(`npx --yes @stoplight/prism-cli@5.16.0 mock -p 4010 "${out}"`, {
  stdio: "inherit",
  shell: true,
});
prism.on("exit", (code) => process.exit(code ?? 0));
