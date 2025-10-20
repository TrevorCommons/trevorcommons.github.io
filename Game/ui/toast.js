import { TOAST_DURATION_MS } from '../game/constants.js';

export function showToast(msg, ms = TOAST_DURATION_MS) {
  try {
    const t = document.createElement('div');
    t.className = 'game-toast';
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => { try { t.style.opacity = '0'; } catch (e) {} }, ms - 220);
    setTimeout(() => { try { if (t && t.parentNode) t.parentNode.removeChild(t); } catch (e) {} }, ms);
  } catch (e) { console.log('Toast failed', e); }
}

export default showToast;
