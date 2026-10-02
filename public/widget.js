/**
 * Embeddable chat widget.
 *
 * Usage on any website:
 *   <script src="https://YOUR-SERVER/widget.js"
 *           data-api="https://YOUR-SERVER/api/chat"
 *           data-title="Al-Shifa Dental Clinic"
 *           data-color="#6C63FF"></script>
 */
(function () {
  const script = document.currentScript;
  const API = script.dataset.api || "/api/chat";
  const TITLE = script.dataset.title || "Chat with us";
  const COLOR = script.dataset.color || "#6C63FF";
  const GREETING =
    script.dataset.greeting ||
    "Assalam u alaikum! Ask me about our services, prices, timings, or book an appointment.";

  let sessionId = sessionStorage.getItem("zee-chat-session") || null;

  const style = document.createElement("style");
  style.textContent = `
    .zc-btn{position:fixed;right:20px;bottom:20px;width:60px;height:60px;border-radius:50%;border:0;background:${COLOR};color:#fff;font-size:26px;cursor:pointer;box-shadow:0 8px 24px rgba(0,0,0,.25);z-index:99999;transition:transform .2s}
    .zc-btn:hover{transform:scale(1.08)}
    .zc-panel{position:fixed;right:20px;bottom:92px;width:360px;max-width:calc(100vw - 40px);height:520px;max-height:calc(100vh - 120px);background:#fff;border-radius:16px;box-shadow:0 12px 40px rgba(0,0,0,.25);display:flex;flex-direction:column;overflow:hidden;z-index:99999;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;opacity:0;transform:translateY(12px);pointer-events:none;transition:opacity .2s,transform .2s}
    .zc-panel.open{opacity:1;transform:none;pointer-events:auto}
    .zc-head{background:${COLOR};color:#fff;padding:14px 16px;font-weight:600;display:flex;justify-content:space-between;align-items:center}
    .zc-head small{display:block;font-weight:400;opacity:.85;font-size:12px}
    .zc-close{background:none;border:0;color:#fff;font-size:20px;cursor:pointer}
    .zc-msgs{flex:1;overflow-y:auto;padding:14px;background:#f5f6fa;display:flex;flex-direction:column;gap:10px}
    .zc-msg{max-width:85%;padding:10px 13px;border-radius:14px;font-size:14px;line-height:1.45;white-space:pre-wrap;word-wrap:break-word}
    .zc-user{align-self:flex-end;background:${COLOR};color:#fff;border-bottom-right-radius:4px}
    .zc-bot{align-self:flex-start;background:#fff;color:#222;border-bottom-left-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,.08)}
    .zc-typing span{display:inline-block;width:6px;height:6px;margin:0 2px;background:#999;border-radius:50%;animation:zc-b 1.2s infinite}
    .zc-typing span:nth-child(2){animation-delay:.2s}.zc-typing span:nth-child(3){animation-delay:.4s}
    @keyframes zc-b{0%,80%,100%{transform:translateY(0)}40%{transform:translateY(-5px)}}
    .zc-form{display:flex;gap:8px;padding:10px;border-top:1px solid #eee;background:#fff}
    .zc-form input{flex:1;border:1px solid #ddd;border-radius:999px;padding:10px 14px;font-size:14px;outline:none}
    .zc-form input:focus{border-color:${COLOR}}
    .zc-form button{border:0;background:${COLOR};color:#fff;border-radius:999px;padding:0 16px;font-weight:600;cursor:pointer}
    .zc-form button:disabled{opacity:.5;cursor:default}
  `;
  document.head.appendChild(style);

  const btn = document.createElement("button");
  btn.className = "zc-btn";
  btn.setAttribute("aria-label", "Open chat");
  btn.textContent = "💬";

  const panel = document.createElement("div");
  panel.className = "zc-panel";
  panel.innerHTML = `
    <div class="zc-head"><div>${escapeHtml(TITLE)}<small>Usually replies instantly</small></div><button class="zc-close" aria-label="Close">×</button></div>
    <div class="zc-msgs"></div>
    <form class="zc-form"><input type="text" placeholder="Type your message..." autocomplete="off" /><button type="submit">Send</button></form>`;

  document.body.append(btn, panel);

  const msgs = panel.querySelector(".zc-msgs");
  const form = panel.querySelector(".zc-form");
  const input = form.querySelector("input");
  const send = form.querySelector("button");

  addMsg("bot", GREETING);

  btn.onclick = () => { panel.classList.toggle("open"); if (panel.classList.contains("open")) input.focus(); };
  panel.querySelector(".zc-close").onclick = () => panel.classList.remove("open");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    input.value = "";
    send.disabled = true;
    addMsg("user", text);

    const bot = addMsg("bot", "");
    bot.innerHTML = '<span class="zc-typing"><span></span><span></span><span></span></span>';

    try {
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, message: text }),
      });
      const sid = res.headers.get("X-Session-Id");
      if (sid) { sessionId = sid; sessionStorage.setItem("zee-chat-session", sid); }
      if (!res.ok || !res.body) throw new Error("Request failed");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let full = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        full += decoder.decode(value, { stream: true });
        bot.innerHTML = format(full);
        msgs.scrollTop = msgs.scrollHeight;
      }
    } catch (err) {
      bot.textContent = "Sorry, I couldn't reach the server. Please try again.";
    } finally {
      send.disabled = false;
      input.focus();
    }
  };

  function addMsg(who, text) {
    const el = document.createElement("div");
    el.className = "zc-msg zc-" + who;
    el.innerHTML = format(text);
    msgs.appendChild(el);
    msgs.scrollTop = msgs.scrollHeight;
    return el;
  }

  // Minimal markdown: **bold** and bullet lines. Everything is HTML-escaped first.
  function format(text) {
    return escapeHtml(text)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/^[-•] /gm, "• ");
  }
  function escapeHtml(s) {
    return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  }
})();
