// API의 누락값, 숫자, 운영시간을 정리하는 공통 함수입니다.
export const clean = value => value == null || String(value).trim() === '-' || String(value).trim() === '' ? null : String(value).trim();
export const count = value => {
  const s = clean(value);
  return s && /^\d+$/.test(s) && Number.isSafeInteger(Number(s)) ? Number(s) : null;
};
export const validTime = value => /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/.test(clean(value) || '') ? clean(value) : null;
export const hours = (start, end) => validTime(start) && validTime(end) ? `${validTime(start)} ~ ${validTime(end)}` : null;
