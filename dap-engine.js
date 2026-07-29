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
            <button class="next">Next</button>
          </div>
        </div>`;

      this.launch = document.createElement('button');
      this.launch.className = 'dap-launch';
      this.launch.innerHTML = '<span class="dot"></span> Take the tour';

      document.body.append(this.backdrop, this.spot, this.card, this.launch);

      this.card.querySelector('.next').onclick = () => this.next();
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
      this.backdrop.classList.add('on');
      this._renderDots();
      this._show();
    }

    next() {
      this.emit('step_completed', { step_index: this.i });
      this.i++;
      if (this.i >= this.steps.length) {
        this.emit('tour_completed', {});
        this.close();
        return;
      }
      this._show();
    }

    abandon() {
      this.emit('tour_abandoned', { last_step_index: this.i });
      this.close();
    }

    close() {
      this.backdrop.classList.remove('on');
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

      const box = target.getBoundingClientRect();
      this.spot.style.top = (box.top - 6) + 'px';
      this.spot.style.left = (box.left - 6) + 'px';
      this.spot.style.width = (box.width + 12) + 'px';
      this.spot.style.height = (box.height + 12) + 'px';
      this.spot.classList.add('on');

      let cardTop = box.top + box.height + 14;
      let cardLeft = Math.min(Math.max(box.left, 10), window.innerWidth - 260);
      if (cardTop + 150 > window.innerHeight) cardTop = box.top - 160;
      this.card.style.top = cardTop + 'px';
      this.card.style.left = cardLeft + 'px';
      this.card.classList.add('on');

      this.card.querySelector('.dap-eyebrow').textContent = `Step ${this.i + 1}/${this.steps.length}`;
      this.card.querySelector('h4').textContent = step.title;
      this.card.querySelector('p').textContent = step.body;
      this._updateDots();

      target.scrollIntoView({ block: 'center', behavior: 'smooth' });
    }
  }

  global.DAP = {
    init({ configUrl, collectUrl, siteId = 'default-site', tourId = 'default-tour' }) {
      fetch(configUrl)
        .then(res => res.json())
        .then(steps => {
          global.DAP.engine = new DAPEngine({ steps, siteId, tourId, collectUrl });
        })
        .catch(err => console.error('[dap-engine] could not load config:', err));
    }
  };
})(window);
