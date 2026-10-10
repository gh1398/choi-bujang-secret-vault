import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { deploymentIdentity } from './deployment-identity.mjs';

const root = resolve(import.meta.dirname, '..');
const publicDir = resolve(root, 'public');
const config = JSON.parse(await readFile(resolve(root, 'aleph.config.json'), 'utf8'));
if (!Number.isInteger(config.step) || config.step < 2 || config.step > 12) {
  throw new Error('2단계 이후의 aleph.config.json 설정을 확인하세요.');
}

await mkdir(publicDir, { recursive: true });
await rm(resolve(publicDir, 'data.json'), { force: true });
if (process.argv.includes('--local')) {
  await rm(resolve(publicDir, 'aleph.json'), { force: true });
  console.log('로컬 미리보기를 준비했습니다. Supabase 자료는 /api/notes에서 읽습니다.');
} else {
  const identity = deploymentIdentity(process.env, config);
  await writeFile(resolve(publicDir, 'aleph.json'),
    `${JSON.stringify(identity, null, 2)}\n`, 'utf8');
  console.log('배포 저장소·커밋·주소를 public/aleph.json에 기록했습니다.');
}