export function hasBatchim(ch) {
  const code = String(ch).charCodeAt(0);
  if (code < 0xac00 || code > 0xd7a3) return false;
  return (code - 0xac00) % 28 !== 0;
}

export function attachJosa(name, kind) {
  const b = hasBatchim(name.slice(-1));
  const josa = { '아': b ? '아' : '야', '이': b ? '이' : '가', '은': b ? '은' : '는', '을': b ? '을' : '를' }[kind];
  return name + (josa ?? '');
}

export function formatLine(text, nickname) {
  return text.replace(/\{이름(?:\|([아이은을]))?\}/g, (_, kind) =>
    kind ? attachJosa(nickname, kind) : nickname);
}

export function validateNickname(raw) {
  const value = String(raw ?? '').trim();
  if (value.length === 0) return { ok: false, error: '이름을 적어 주세요.' };
  if ([...value].length > 6) return { ok: false, error: '이름은 6글자까지 쓸 수 있어요.' };
  if (!/^[가-힣A-Za-z0-9]{1,6}$/.test(value)) return { ok: false, error: '한글, 영어, 숫자만 쓸 수 있어요.' };
  return { ok: true, value };
}
