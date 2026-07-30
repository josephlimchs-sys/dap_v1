/* dap-engine.js
   Drop this file + dap-engine.css into any site. It knows nothing about
   the host page's content — only reads tour-config.json and drives
   generic overlay elements it creates itself.

   Usage (see index.html):
     <link rel="stylesheet" href="dap-engine.css">
     <script src="dap-engine.js"></script>
     <script>
       DAP.init({ configUrl: 'tour-config.json', collectUrl: '/collect' });
     </script>
*/
(function (global) {
  class DAPEngine {
    constructor({ steps, siteId, tourId, collectUrl }) {
      this.steps = steps;
      this.siteId = siteId;
      this.tourId = tourId;
      this.collectUrl = collectUrl;
      this.i = 0;
      this._buildChrome();
    }

    _buildChrome() {
      // Creates the overlay DOM once, reused across every step.
      this.backdrop = document.createElement('div');
      this.backdrop.className = 'dap-backdrop';
      this.shades = {
        top: document.createElement('div'),
        bottom: document.createElement('div'),
        left: document.createElement('div'),
        right: document.createElement('div'),
      };
      Object.values(this.shades).forEach(el => {
        el.className = 'dap-shade';
        this.backdrop.appendChild(el);
      });

      this.spot = document.createElement('div');
      this.spot.className = 'dap-spot';

      this.card = document.createElement('div');
      this.card.className = 'dap-card';
      this.card.innerHTML = `
        <div class="dap-eyebrow"></div>
        <h4></h4>
        <p></p>
        <div class="dap-foot">
          <div class="dap-dots"></div>
          <div class="dap-btns">
            <button class="skip">Skip</button>
            <button class="back">Back</button>
            <button class="next">Next</button>
          </div>
        </div>`;

      this.launch = document.createElement('button');
      this.launch.className = 'dap-launch';
      this.launch.innerHTML = '<span class="dot"></span> Take the tour';

      document.body.append(this.backdrop, this.spot, this.card, this.launch);

      this.card.querySelector('.next').onclick = () => this.next();
      this.card.querySelector('.back').onclick = () => this.back();
      this.card.querySelector('.skip').onclick = () => this.abandon();
      this.launch.onclick = () => this.start();
    }

    emit(type, payload) {
      const body = JSON.stringify({
        type, site_id: this.siteId, tour_id: this.tourId, ts: Date.now(), ...payload
      });
      if (this.collectUrl && navigator.sendBeacon) {
        navigator.sendBeacon(this.collectUrl, body);
      } else if (this.collectUrl) {
        fetch(this.collectUrl, { method: 'POST', body, keepalive: true }).catch(() => {});
      } else {
        // No endpoint configured yet — surface events for local debugging.
        console.log('[dap-engine]', type, payload);
      }
    }

    start() {
      this.i = 0;
      this.emit('tour_started', {});
      Object.values(this.shades).forEach(el => el.classList.add('on'));
      this._renderDots();
      this._show();
    }

    next() {
      this._teardownStepListener();
      this.emit('step_completed', { step_index: this.i });
      this.i++;
      if (this.i >= this.steps.length) {
        this.emit('tour_completed', {});
        this.close();
        return;
      }
      this._show();
    }

    back() {
      if (this.i === 0) return;
      this._teardownStepListener();
      this.i--;
      this._show();
    }

    _teardownStepListener() {
      if (this._activeListener) {
        this._activeListener.target.removeEventListener(this._activeListener.event, this._activeListener.handler);
        this._activeListener = null;
      }
    }

    abandon() {
      this.emit('tour_abandoned', { last_step_index: this.i });
      this.close();
    }

    close() {
      Object.values(this.shades).forEach(el => el.classList.remove('on'));
      this.spot.classList.remove('on');
      this.card.classList.remove('on');
    }

    _renderDots() {
      this.card.querySelector('.dap-dots').innerHTML =
        this.steps.map(() => '<i></i>').join('');
    }

    _updateDots() {
      [...this.card.querySelectorAll('.dap-dots i')].forEach((el, idx) => {
        el.className = idx < this.i ? 'done' : idx === this.i ? 'now' : '';
      });
    }

    _show() {
      const step = this.steps[this.i];
      const target = document.querySelector(step.selector) ||
                     (step.fallback ? document.querySelector(step.fallback) : null);

      if (!target) { this.next(); return; } // graceful skip if selector not found
      this.emit('step_viewed', { step_index: this.i });

      this._paintCardAt(target);
      this._renderCopy(step);
      this._updateDots();

      target.scrollIntoView({ block: 'center', behavior: 'smooth' });

      if (step.validate) {
        this._wireValidation(target, step);
      } else if (step.action === 'click') {
        this._wireClickAction(target, step);
      } else {
        this._setNextEnabled(true);
      }
    }

    _paintCardAt(target) {
      const box = target.getBoundingClientRect();
      const pad = 6;
      const holeTop = Math.max(box.top - pad, 0);
      const holeLeft = Math.max(box.left - pad, 0);
      const holeWidth = box.width + pad * 2;
      const holeHeight = box.height + pad * 2;
      const holeBottom = holeTop + holeHeight;
      const holeRight = holeLeft + holeWidth;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      // Four rects tiling the viewport around the hole — this is what
      // actually makes the highlighted element clickable/typeable again;
      // without a real gap in the overlay, clicks land on the dimmed
      // layer instead of the page underneath, no matter how convincing
      // the spotlight looks visually.
      Object.assign(this.shades.top.style,    { top: '0px', left: '0px', width: vw + 'px', height: holeTop + 'px' });
      Object.assign(this.shades.bottom.style, { top: holeBottom + 'px', left: '0px', width: vw + 'px', height: Math.max(vh - holeBottom, 0) + 'px' });
      Object.assign(this.shades.left.style,   { top: holeTop + 'px', left: '0px', width: holeLeft + 'px', height: holeHeight + 'px' });
      Object.assign(this.shades.right.style,  { top: holeTop + 'px', left: holeRight + 'px', width: Math.max(vw - holeRight, 0) + 'px', height: holeHeight + 'px' });

      this.spot.style.top = holeTop + 'px';
      this.spot.style.left = holeLeft + 'px';
      this.spot.style.width = holeWidth + 'px';
      this.spot.style.height = holeHeight + 'px';
      this.spot.classList.add('on');

      let cardTop = box.top + box.height + 14;
      let cardLeft = Math.min(Math.max(box.left, 10), window.innerWidth - 260);
      if (cardTop + 150 > window.innerHeight) cardTop = box.top - 160;
      this.card.style.top = cardTop + 'px';
      this.card.style.left = cardLeft + 'px';
      this.card.classList.add('on');
    }

    _renderCopy(step) {
      this.card.querySelector('.dap-eyebrow').textContent = `Step ${this.i + 1}/${this.steps.length}`;
      this.card.querySelector('h4').textContent = step.title;
      this.card.querySelector('p').textContent = step.body;
      this.card.querySelector('.next').textContent = this.i === this.steps.length - 1 ? 'End' : 'Next';
      const backBtn = this.card.querySelector('.back');
      backBtn.disabled = this.i === 0;
      backBtn.style.visibility = this.i === 0 ? 'hidden' : 'visible';
      this._clearError();
      this._clearHint();
    }

    _showHint(msg) {
      let hint = this.card.querySelector('.dap-hint');
      if (!hint) {
        hint = document.createElement('p');
        hint.className = 'dap-hint';
        this.card.querySelector('.dap-foot').before(hint);
      }
      hint.textContent = msg;
    }

    _clearHint() {
      const hint = this.card.querySelector('.dap-hint');
      if (hint) hint.remove();
    }

    _setNextEnabled(enabled) {
      const btn = this.card.querySelector('.next');
      btn.disabled = !enabled;
      btn.style.opacity = enabled ? '1' : '.4';
      btn.style.cursor = enabled ? 'pointer' : 'not-allowed';
    }

    _showError(msg) {
      let err = this.card.querySelector('.dap-error');
      if (!err) {
        err = document.createElement('p');
        err.className = 'dap-error';
        this.card.querySelector('.dap-foot').before(err);
      }
      err.textContent = msg;
    }

    _clearError() {
      const err = this.card.querySelector('.dap-error');
      if (err) err.remove();
    }

    // Validation rules: notEmpty | pattern | minLength
    _isValid(value, rule) {
      if (rule.type === 'notEmpty') return value.trim().length > 0;
      if (rule.type === 'minLength') return value.trim().length >= rule.value;
      if (rule.type === 'pattern') return new RegExp(rule.value).test(value);
      return true;
    }

    _wireValidation(target, step) {
      this._setNextEnabled(false);
      const check = () => {
        const ok = this._isValid(target.value ?? '', step.validate);
        if (ok) {
          this._clearError();
          this._setNextEnabled(true);
          if (step.autoAdvance !== false) {
            setTimeout(() => { if (this.i < this.steps.length) this.next(); }, 650);
          }
        } else if (target.value) {
          this._showError(step.validate.message || "That doesn't look right yet.");
          this._setNextEnabled(false);
        } else {
          this._clearError();
          this._setNextEnabled(false);
        }
      };
      target.addEventListener('input', check);
      this._activeListener = { target, event: 'input', handler: check };
    }

    // The user must actually click the highlighted element to continue —
    // "Next" is disabled so clicking it can't substitute for doing the
    // real action. Skip remains available as an escape hatch.
    _wireClickAction(target, step) {
      this._setNextEnabled(false);
      this._showHint(step.hint || 'Click the highlighted element to continue.');
      const handler = () => {
        // let the click's own effect run first, then advance
        setTimeout(() => { if (this.i < this.steps.length) this.next(); }, 400);
      };
      target.addEventListener('click', handler);
      this._activeListener = { target, event: 'click', handler };
    }
  }

  global.DAP = {
    init({ configUrl, config, collectUrl, siteId = 'default-site', tourId = 'default-tour' }) {
      if (config) {
        global.DAP.engine = new DAPEngine({ steps: config, siteId, tourId, collectUrl });
        return;
      }
      fetch(configUrl)
        .then(res => res.json())
        .then(steps => {
          global.DAP.engine = new DAPEngine({ steps, siteId, tourId, collectUrl });
        })
        .catch(err => console.error('[dap-engine] could not load config:', err));
    }
  };
})(window);
