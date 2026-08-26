-- db/schema_accounts.sql
-- 자금비서 로그인 계정 테이블. Neon SQL 콘솔에서 한 번 실행하면 됩니다.
-- 이미 실행했다면 다시 실행해도 안전합니다 (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'consultant', 'student')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 기존에 코드에 하드코딩되어 있던 직원 계정 3개를 그대로 이전합니다.
-- 비밀번호는 원래 값 그대로(암호화된 형태로) 옮겨졌으니 로그인 아이디/비밀번호는 안 바뀝니다.
-- 이미 실행한 적이 있다면 중복 오류가 나는데, 그 경우 이 INSERT 블록은 건너뛰어도 됩니다.
INSERT INTO accounts (username, password_hash, name, role) VALUES
  ('ceorepoint', '$2b$10$w88Kh6mfTT8or2ztuw0/CefgsNEjQyH9PLZ1.nFiExr6QqhBILOEO', '관리자', 'admin'),
  ('repoint1',   '$2b$10$cAYFM8fa0BU6EOHwcHOv6uhTdijayoQ.j6jcYFJle1mT5EMEXmI.W', '직원1', 'consultant'),
  ('repoint2',   '$2b$10$WsdU9EehCv8sGj4Osnn5tuRf9NVMYju0tjBJmSNSdlDYlRZ2lRmx.', '직원2', 'consultant')
ON CONFLICT (username) DO NOTHING;

-- 새 직원(컨설턴트) 또는 수강생 계정을 수동으로 추가할 때는 아래처럼 하시면 됩니다.
-- 1) 터미널에서 비밀번호 해시 생성: node -e "console.log(require('bcryptjs').hashSync('원하는비밀번호', 10))"
-- 2) 아래 INSERT에 아이디/해시/이름/역할('admin' | 'consultant' | 'student')을 채워서 실행
-- INSERT INTO accounts (username, password_hash, name, role)
-- VALUES ('student01', '여기에_해시값', '홍길동', 'student');
