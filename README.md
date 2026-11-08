# 공강을 Cloudflare D1에 연결하고 공개하기

## 3D 동행 공간 (2026-11-08)

2D 시안은 잠시 보류하고 3D 세계를 중심으로 개발합니다. 실제 캠퍼스와 건물은 현장 실측이 아닌 3D 재구성 초안입니다.

- `/?map=campus` — 사범대학관 · 학술정보관 사이 잔디밭. 나무, 벤치, 산을 배경으로 함께 모이는 공간. **기본 화면**.
- `/?map=beach` — 노을빛 모래 해변. 곡선 모래사장, 파도 및 포말, 해변 통나무 쉼터.
- `/?map=hill` — 기존 상명대 언덕길 (유지).
- `/?map=cliff` — 기존 바람의 절벽 (유지).

**동행**: 지도마다 독립적인 8인 익명 공간을 사용합니다. 친구들과 같은 URL의 같은 맵을 열어야 서로 보입니다. 좌측 상단의 **함께 모이기** 버튼으로 잔디밭이나 해변의 중앙 구역으로 돌아올 수 있습니다. **사진** 버튼은 화면 UI를 제외한 3D 풍경과 캐릭터를 PNG로 저장합니다. 앉기/눕기/인사/빛 기능은 기존과 동일합니다. 파도 소리는 해변과 절벽에서 켤 수 있습니다.

**공개 전 확인**: 두 기기에서 같은 맵으로 접속한 뒤 인원 표시, 이동·인사 동기화, 사진 저장, 모바일 방향 전환, 다른 맵과 동행이 섞이지 않는지 테스트하세요. GitHub 커밋만으로 Cloudflare 배포가 완료되었다고 가정하지 마세요.

공강 D1 배포용 ZIP에는 화면, 8인 동행 서버, D1 연결 설정, 익명 방문기록 테이블이 들어 있습니다. 직접 채울 설정은 **D1 데이터베이스 ID 한 곳**입니다. 아래 순서대로 진행하면 Cloudflare가 공개 주소를 만들어 줍니다.

## 1. ZIP 풀기

`Gonggang_D1_Deploy.zip`을 새 폴더에 압축 해제하세요. 탐색기에서 `wrangler.jsonc`가 있는 폴더를 열고 주소창에 `powershell`을 입력하면 그 위치에서 터미널이 열립니다. Node.js **22.13 이상**이 필요합니다.

```powershell
node --version
npm.cmd ci
```

## 2. Cloudflare에 로그인하기

```powershell
npx.cmd wrangler login
npx.cmd wrangler whoami
```

브라우저에 뜨는 승인 화면을 완료하세요. `whoami`에 표시되는 계정이 공강을 올릴 계정인지 확인합니다. 같은 계정에 다른 앱의 Worker가 이미 `gonggang`이라는 이름을 쓰고 있으면, 이 폴더의 `wrangler.jsonc` 맨 위 `"name": "gonggang"`을 `"name": "gonggang-campus"`처럼 새 이름으로 바꿉니다.

## 3. 공강 전용 D1 만들기

```powershell
npx.cmd wrangler d1 create gonggang-visits --location=apac --update-config=false
```

명령 결과에 표시된 `database_id`를 복사하세요. 같은 이름의 공강 전용 DB를 이미 만들어뒀다면 아래 명령으로 ID를 확인해서 사용하면 됩니다.

```powershell
npx.cmd wrangler d1 list
```

`apac`은 아시아·태평양 지역을 선호한다는 설정입니다. [Cloudflare D1 위치 안내](https://developers.cloudflare.com/d1/configuration/data-location/)

## 4. 데이터베이스 ID 넣기

`wrangler.jsonc`를 메모장이나 편집기로 열어 `d1_databases` 아래의 `database_id` 값만 복사한 ID로 바꾸고 저장합니다. 이 ZIP의 연결 이름은 `VISITS`입니다.

```json
"d1_databases": [
  {
    "binding": "VISITS",
    "database_name": "gonggang-visits",
    "database_id": "여기에-3단계에서-복사한-ID",
    "migrations_dir": "d1/migrations"
  }
]
```

D1 연결은 Cloudflare가 관리하므로 Wrangler 로그인과 데이터베이스 ID로 설정이 끝납니다. [D1 시작 가이드](https://developers.cloudflare.com/d1/get-started/)

## 5. 배포 전에 내 컴퓨터에서 확인하기

```powershell
npx.cmd wrangler d1 migrations apply VISITS --local
npm.cmd run cloudflare:check
npm.cmd run cloudflare:dev -- --port 8788
```

`http://127.0.0.1:8788`을 두 브라우저 탭에서 엽니다. 설정에서 **혼자 보기**를 끄고 화면 왼쪽 위에 **1명과 함께**가 뜨는지 확인하세요. `http://127.0.0.1:8788/healthz`에서 `"visits":"ready"`가 나오면 테스트용 D1 테이블도 준비된 상태입니다.

테스트를 마치면 터미널에서 `Ctrl+C`를 누릅니다. `--local`은 내 컴퓨터의 테스트 DB에, 다음 단계의 `--remote`는 Cloudflare 계정의 D1에 적용됩니다. [D1 마이그레이션 안내](https://developers.cloudflare.com/d1/reference/migrations/)

## 6. 방문기록 테이블 만들고 공개하기

```powershell
npx.cmd wrangler d1 migrations apply VISITS --remote
npm.cmd run cloudflare:deploy
```

확인 메시지가 뜨면 DB 이름이 `gonggang-visits`인지 보고 진행하세요. 배포가 끝나면 터미널에 표시되는 `https://…workers.dev` 주소가 공유할 링크입니다. 첫 배포에서 Cloudflare가 `workers.dev` 하위 도메인 등록을 요청하면 계정에서 한 번 설정한 뒤 배포 명령을 다시 실행하세요. [workers.dev 주소 설정](https://developers.cloudflare.com/workers/configuration/routing/workers-dev/)

## 7. 공개 주소에서 최종 확인하기

1. 같은 공개 주소를 두 탭이나 기기에서 열고 **1명과 함께** 표시를 확인합니다.
2. 공개 주소 끝에 `/healthz`를 붙여 `"visits":"ready"`가 나오는지 확인합니다.
3. 아래 명령으로 UTC 방문 시각이 쌓였는지 확인합니다. 여행자 이름이나 위치는 기록하지 않습니다.

```powershell
npx.cmd wrangler d1 execute VISITS --remote --command "SELECT visited_at FROM visits ORDER BY visited_at DESC LIMIT 5;"
```

동행방 입장과 방문기록 저장은 별도로 처리됩니다. 일시적인 DB 오류가 발생하면 서버가 기록을 한 번 더 시도합니다. 끝내 저장하지 못한 방문은 집계에서 빠질 수 있습니다.

## 막힐 때

| 증상 | 확인할 것 |
| --- | --- |
| `node`를 찾을 수 없다고 나옴 | Node.js 설치 후 터미널을 다시 열고 `node --version`을 실행합니다. |
| D1을 찾을 수 없거나 권한 오류가 남 | `npx.cmd wrangler whoami`와 `npx.cmd wrangler d1 list`로 계정 및 ID를 다시 확인합니다. |
| `/healthz`에 `not_configured`가 나옴 | `wrangler.jsonc`의 D1 ID와 연결 이름 `VISITS`를 확인합니다. |
| `/healthz`에 `unavailable`이 나옴 | 배포한 주소라면 `--remote`, 내 컴퓨터 주소라면 `--local`로 마이그레이션을 적용했는지 확인합니다. |
| 두 탭을 열었는데 서로 안 보임 | 같은 주소인지 확인하고 양쪽 탭 설정에서 **혼자 보기**를 끕니다. 동행방은 최대 8명입니다. |

나중에 화면 파일만 수정했으면 같은 폴더에서 `npm.cmd run cloudflare:deploy`를 다시 실행하면 됩니다. 새 SQL 변경 파일을 추가한 경우에는 6단계의 마이그레이션 명령도 실행하세요.