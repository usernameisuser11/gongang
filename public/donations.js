import { donationLinks } from './donation-config.js';

const channels = [
  { key: 'toss', label: '토스로 후원하기', note: '토스 송금' },
  { key: 'kakaopay', label: '카카오페이로 후원하기', note: '카카오페이 코드송금' },
];

function isOfficialPaymentLink(value, channel) {
  if (typeof value !== 'string' || !value.trim()) return false;
  try {
    const url = new URL(value);
    if (url.protocol !== 'https:' || url.username || url.password) return false;
    const host = url.hostname.toLowerCase();
    const allowed = channel === 'toss'
      ? ['toss.im', 'toss.me', 'tossbank.com']
      : ['kakaopay.com', 'qr.kakaopay.com'];
    return allowed.some(domain => host === domain || host.endsWith('.' + domain));
  } catch {
    return false;
  }
}

export function installDonations(ui) {
  const panel = ui.querySelector('[data-panel]');
  if (!panel || panel.querySelector('[data-donations]')) return;

  const section = document.createElement('section');
  section.className = 'cliff-donate';
  section.dataset.donations = '';
  section.setAttribute('aria-label', '공강 개발 후원');

  const heading = document.createElement('h3');
  heading.textContent = '♡ 공강을 응원해 주세요';
  const description = document.createElement('p');
  description.textContent = '새로운 풍경과 안정적인 운영을 위한 자율 후원이에요. 후원하지 않아도 공강의 모든 기능은 무료예요.';
  const methods = document.createElement('div');
  methods.className = 'cliff-donate-methods';
  let enabledCount = 0;

  for (const channel of channels) {
    const url = donationLinks[channel.key];
    const enabled = isOfficialPaymentLink(url, channel.key);
    const control = document.createElement(enabled ? 'a' : 'span');
    control.className = 'cliff-donate-method';
    control.dataset.method = channel.key;
    control.textContent = channel.label;
    if (enabled) {
      control.href = url.trim();
      control.target = '_blank';
      control.rel = 'noopener noreferrer external';
      control.referrerPolicy = 'no-referrer';
      control.setAttribute('aria-label', channel.label + ' · 외부 송금 페이지 열기');
      enabledCount++;
    } else {
      control.classList.add('cliff-donate-unavailable');
      control.setAttribute('aria-disabled', 'true');
      control.title = '송금 링크를 확인한 후 열릴 예정이에요';
    }
    methods.append(control);
  }

  const footnote = document.createElement('small');
  footnote.className = 'cliff-donate-note';
  footnote.textContent = enabledCount
    ? '결제는 공강이 아닌 각 송금 앱에서 진행돼요. 받는 사람과 금액을 꼭 확인해 주세요.'
    : '후원 링크를 준비하고 있어요. 지금은 송금할 수 없어요.';
  section.append(heading, description, methods, footnote);
  panel.append(section);
}
