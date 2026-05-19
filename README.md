# 숏폼 인터페이스 실험 웹

## 배포 순서 (처음 하는 분용)

---

### Step 1. GitHub에 코드 올리기

1. github.com 접속 → 로그인
2. 우측 상단 `+` → `New repository`
3. Repository name: `shortform-experiment`
4. `Create repository` 클릭
5. 생성된 페이지에서 **"uploading an existing file"** 클릭
6. 이 폴더의 모든 파일을 드래그 앤 드롭
7. `Commit changes` 클릭

---

### Step 2. Supabase 설정

1. supabase.com → 로그인 → 프로젝트 선택
2. 좌측 메뉴 `SQL Editor` 클릭
3. `supabase_schema.sql` 파일 내용 전체 복사 → 붙여넣기 → `Run` 클릭
4. 좌측 메뉴 `Project Settings` → `API` 클릭
5. 아래 두 값을 복사해두기:
   - **Project URL** (예: https://abcdef.supabase.co)
   - **anon public key** (긴 문자열)

---

### Step 3. Vercel 배포

1. vercel.com → 로그인
2. `Add New Project` → GitHub repo `shortform-experiment` 선택
3. `Import` 클릭
4. **Environment Variables** 섹션에서 아래 두 개 추가:
   - `VITE_SUPABASE_URL` = Step 2에서 복사한 Project URL
   - `VITE_SUPABASE_ANON_KEY` = Step 2에서 복사한 anon key
5. `Deploy` 클릭 → 완료!

---

### Step 4. 영상 업로드 (나중에)

1. Supabase → `Storage` → `recordings` 버킷 옆에 새 버킷 `videos` 생성 (public)
2. 영상 60개를 업로드
3. `src/pages/VideoPlayer.jsx` 파일에서 `PLACEHOLDER_VIDEOS` 배열의 `url` 값을 실제 URL로 교체

영상 URL 형식:
```
https://[project-id].supabase.co/storage/v1/object/public/videos/[파일명].mp4
```

---

## 접속 URL

| 화면 | URL |
|------|-----|
| 참가자 화면 | `https://your-app.vercel.app` |
| 연구원 대시보드 | `https://your-app.vercel.app?researcher` |

---

## 실험 플로우

1. 랜딩 페이지
2. 참가자 정보 입력 + 사전 설문
3. 대조군 시청 (세로 스와이프, 종료 버튼)
4. 중간 설문
5. 실험군 시청 (Type A/B/C 랜덤 배정)
6. 사후 설문
7. 완료 화면 (데이터 자동 저장)

## 실험군 타입

- **Type A** (Awareness Cue): 상단에 현재 시청 개수 + 총 시청 시간 실시간 표시
- **Type B** (Friction UI): 10개마다 2초 로딩 화면 삽입
- **Type C** (Pattern Breaker): 11번째부터 가로 스와이프로 전환
