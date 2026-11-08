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

  // Make the active KakaoPay method visible without opening settings.
  // This is still a voluntary external transfer, not an in-app payment.
  const kakaoUrl = donationLinks.kakaopay;
  if (isOfficialPaymentLink(kakaoUrl, 'kakaopay')) {
    const dock = document.createElement('a');
    dock.className = 'cliff-donate-dock';
    dock.dataset.donateDock = '';
    dock.textContent = '♡ 후원하기';
    dock.href = kakaoUrl.trim();
    dock.target = '_blank';
    dock.rel = 'noopener noreferrer external';
    dock.referrerPolicy = 'no-referrer';
    dock.setAttribute('aria-label', '카카오페이로 공강 개발 후원하기 · 외부 송금 페이지 열기');
    dock.title = '카카오페이 송금 페이지 열기';
    ui.append(dock);
    installDesktopQrDialog(ui, kakaoUrl.trim());
  }
}

function installDesktopQrDialog(ui, paymentUrl) {
  // Personal KakaoPay transfer links can work on phones yet fail on desktop.
  // Show a self-hosted QR instead of navigating a desktop browser to that URL.
  const isPhoneOrTablet = /Android|iPhone|iPod|iPad/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  if (isPhoneOrTablet) return;

  const overlay = document.createElement('div');
  overlay.className = 'cliff-donate-overlay';
  overlay.dataset.donateOverlay = '';
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="cliff-donate-dialog" role="dialog" aria-modal="true" aria-labelledby="cliff-donate-dialog-title" aria-describedby="cliff-donate-dialog-help">
      <button class="cliff-donate-dialog-close" type="button" data-donate-close aria-label="후원 창 닫기">×</button>
      <span class="cliff-donate-dialog-eyebrow">♡ 공강을 응원해 주세요</span>
      <h2 id="cliff-donate-dialog-title">카카오페이로 후원하기</h2>
      <p id="cliff-donate-dialog-help">휴대폰 카카오톡에서 <strong>더보기 → 코드스캔</strong>으로 아래 QR코드를 스캔해 주세요.</p>
      <div class="cliff-donate-qr-frame">
        <img src="./donation-kakaopay-qr.svg" width="224" height="224" alt="공강 카카오페이 송금용 QR코드">
      </div>
      <label for="cliff-donate-share-link">휴대폰으로 링크 보내기</label>
      <div class="cliff-donate-copy-row">
        <input type="text" id="cliff-donate-share-link" data-donate-link readonly spellcheck="false" aria-label="카카오페이 송금 링크">
        <button type="button" data-donate-copy>복사</button>
      </div>
      <p class="cliff-donate-copy-status" data-donate-status role="status" aria-live="polite"></p>
      <small>후원은 선택 사항이며 모든 공강 기능은 무료예요. 송금 전에 받는 사람을 확인해 주세요.</small>
    </section>`;
  ui.append(overlay);
  const closeButton = overlay.querySelector('[data-donate-close]');
  const copyButton = overlay.querySelector('[data-donate-copy]');
  const input = overlay.querySelector('[data-donate-link]');
  const status = overlay.querySelector('[data-donate-status]');
  input.value = paymentUrl;
  let lastFocused = null;

  function handleKeys(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      close();
    } else if (event.key === 'Tab') {
      // Keep keyboard focus within the open dialog.
      const elements = [closeButton, input, copyButton];
      const current = elements.indexOf(document.activeElement);
      if (event.shiftKey && current <= 0) {
        event.preventDefault();
        copyButton.focus();
      } else if (!event.shiftKey && current === elements.length - 1) {
        event.preventDefault();
        closeButton.focus();
      }
    }
  }

  function close() {
    overlay.hidden = true;
    ui.classList.remove('cliff-ui-donate-open');
    document.removeEventListener('keydown', handleKeys, true);
    lastFocused?.focus();
  }

  function open(event) {
    event.preventDefault();
    lastFocused = event.currentTarget;
    overlay.hidden = false;
    ui.classList.add('cliff-ui-donate-open');
    status.textContent = '';
    closeButton.focus();
    document.addEventListener('keydown', handleKeys, true);
  }

  for (const anchor of ui.querySelectorAll('a[data-method="kakaopay"], a[data-donate-dock]'))
    anchor.addEventListener('click', open);
  closeButton.addEventListener('click', close);
  overlay.addEventListener('click', event => {
    if (event.target === overlay) close();
  });
  copyButton.addEventListener('click', async () => {
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(paymentUrl);
      status.textContent = '송금 링크를 복사했어요. 휴대폰으로 보내서 열어 주세요.';
    } catch {
      input.focus();
      input.select();
      status.textContent = '주소를 선택했어요. Ctrl+C 또는 ⌘C로 복사해 주세요.';
    }
  });
}
