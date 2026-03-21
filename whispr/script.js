/* ============================================================
   script.js – Whispr Anonymous Messaging App
   
   ARCHITECTURE:
   - State: single `app` object
   - Router: showScreen() / navigateTo()
   - Firebase: Firestore for messages + user profiles
   - Local fallback: localStorage when Firebase not configured
   ============================================================ */

'use strict';

/* ──────────────────────────────────────────────
   1. APP STATE
   ────────────────────────────────────────────── */
const app = {
  currentUser: null,     // { username, displayName, createdAt }
  targetUser:  null,     // username being sent to (from URL param)
  messages:    [],       // inbox messages
  newCount:    0,        // unread messages
  ratingValue: 0,        // selected star rating
  selectedHint: null,    // hint chip selected
  recording:   false,    // voice recording in progress
  mediaRecorder: null,
  audioBlob:   null,
  voiceTimer:  null,
  voiceSeconds: 0,
  unlockedShare: false,  // has user shared to unlock
  linkViews:   0,
  firebaseReady: false,  // true when firebase config is set
};

/* ──────────────────────────────────────────────
   2. STARTER / FAKE MESSAGES (Engagement hook)
   These are seeded when a new user is created to
   make the inbox feel active immediately.
   ────────────────────────────────────────────── */
const STARTER_MESSAGES = [
  { type: 'text', content: "I have a crush on you but I'm too scared to say it 👀", hint: null },
  { type: 'text', content: "You honestly don't know how much I think about you 😮‍💨", hint: "Closer than you think 😏" },
  { type: 'rating', rating: 9, content: "Genuinely one of the most attractive people I know. Don't question it." },
  { type: 'text', content: "Your energy is so contagious omg, I love being around you 🔥", hint: null },
  { type: 'poll', question: "Would you date me if I asked?", optA: "Yes instantly 💚", optB: "Maybe... 👀" },
];

/* ──────────────────────────────────────────────
   3. FIREBASE HELPERS
   Falls back to localStorage if Firebase not configured.
   ────────────────────────────────────────────── */

// Check if Firebase config looks real (not the placeholder)
function isFirebaseReady() {
  try {
    const app = firebase.app();
    return app.options.apiKey !== 'YOUR_API_KEY';
  } catch { return false; }
}

app.firebaseReady = isFirebaseReady();

async function saveUser(username, data) {
  if (app.firebaseReady) {
    await db.collection('users').doc(username).set(data, { merge: true });
  } else {
    localStorage.setItem(`whispr_user_${username}`, JSON.stringify(data));
  }
}

async function getUser(username) {
  if (app.firebaseReady) {
    const doc = await db.collection('users').doc(username).get();
    return doc.exists ? doc.data() : null;
  } else {
    const raw = localStorage.getItem(`whispr_user_${username}`);
    return raw ? JSON.parse(raw) : null;
  }
}

async function saveMessage(toUsername, msg) {
  const full = { ...msg, id: generateId(), createdAt: Date.now(), read: false };
  if (app.firebaseReady) {
    await db.collection('messages').doc(full.id).set({ ...full, to: toUsername });
  } else {
    const key = `whispr_msgs_${toUsername}`;
    const existing = JSON.parse(localStorage.getItem(key) || '[]');
    existing.unshift(full);
    localStorage.setItem(key, JSON.stringify(existing));
  }
  return full;
}

async function getMessages(username) {
  if (app.firebaseReady) {
    const snap = await db.collection('messages')
      .where('to', '==', username)
      .orderBy('createdAt', 'desc')
      .get();
    return snap.docs.map(d => d.data());
  } else {
    const key = `whispr_msgs_${username}`;
    return JSON.parse(localStorage.getItem(key) || '[]');
  }
}

async function deleteMessage(msgId) {
  if (app.firebaseReady) {
    await db.collection('messages').doc(msgId).delete();
  } else {
    // handled in local messages array + re-save
  }
}

async function incrementLinkViews(username) {
  if (app.firebaseReady) {
    await db.collection('users').doc(username).update({
      linkViews: firebase.firestore.FieldValue.increment(1)
    }).catch(() => {});
  } else {
    const key = `whispr_views_${username}`;
    const v = parseInt(localStorage.getItem(key) || '0') + 1;
    localStorage.setItem(key, String(v));
  }
}

/* ──────────────────────────────────────────────
   4. LOCAL SESSION
   ────────────────────────────────────────────── */
function saveSession(username) {
  localStorage.setItem('whispr_session', username);
}
function loadSession() {
  return localStorage.getItem('whispr_session');
}
function clearSession() {
  localStorage.removeItem('whispr_session');
}

/* ──────────────────────────────────────────────
   5. UTILITIES
   ────────────────────────────────────────────── */
function generateId() {
  return Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
}

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9_]/g, '').substring(0, 24);
}

function getAvatarColor(username) {
  const colors = ['#c026d3','#7c3aed','#2563eb','#0891b2','#059669','#d97706','#dc2626','#db2777'];
  let hash = 0;
  for (let c of username) hash = (hash << 5) - hash + c.charCodeAt(0);
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(username) {
  return username.charAt(0).toUpperCase();
}

function timeAgo(ts) {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1)  return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)  return `${hrs}h ago`;
  return `${Math.floor(hrs/24)}d ago`;
}

function showToast(msg, duration = 2500) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  setTimeout(() => t.classList.remove('show'), duration);
}

function getBaseUrl() {
  // Supports localhost, Netlify, or custom domain
  return window.location.origin + window.location.pathname.replace(/\/$/, '');
}

function getMyLink(username) {
  return `${getBaseUrl()}?u=${encodeURIComponent(username)}`;
}

/* ──────────────────────────────────────────────
   6. SCREEN ROUTER
   ────────────────────────────────────────────── */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
  window.scrollTo(0, 0);
}

/* ──────────────────────────────────────────────
   7. LANDING SCREEN
   ────────────────────────────────────────────── */
function initLanding() {
  const input    = document.getElementById('username-input');
  const btnCreate = document.getElementById('btn-create');
  const btnLogin  = document.getElementById('btn-login');

  // Sanitize input
  input.addEventListener('input', () => {
    input.value = slugify(input.value);
  });

  btnCreate.addEventListener('click', () => createUser(input.value.trim()));
  input.addEventListener('keydown', e => { if (e.key === 'Enter') createUser(input.value.trim()); });

  btnLogin.addEventListener('click', () => {
    const name = prompt('Enter your username:');
    if (name) loginUser(slugify(name));
  });
}

async function createUser(username) {
  if (!username || username.length < 2) {
    showToast('⚠️ Username must be at least 2 characters'); return;
  }

  // Check if taken
  const existing = await getUser(username);
  if (existing) {
    showToast('⚠️ That username is taken – try another!'); return;
  }

  const userData = {
    username,
    createdAt: Date.now(),
    linkViews: 0,
  };

  await saveUser(username, userData);

  // Seed starter messages for engagement
  for (const starter of STARTER_MESSAGES) {
    await saveMessage(username, { ...starter, isStarter: true });
  }

  app.currentUser = userData;
  saveSession(username);
  await loadInbox();
  showScreen('screen-inbox');
  fireConfetti();
  showToast('🎉 Your link is ready! Share it now!');
}

async function loginUser(username) {
  if (!username) return;
  const user = await getUser(username);
  if (!user) {
    showToast('❌ Username not found. Create a new account!'); return;
  }
  app.currentUser = user;
  saveSession(username);
  await loadInbox();
  showScreen('screen-inbox');
}

/* ──────────────────────────────────────────────
   8. SEND SCREEN (Public page)
   ────────────────────────────────────────────── */
async function initSendScreen(username) {
  app.targetUser = username;

  // Increment view count
  await incrementLinkViews(username);

  // Populate header
  const av = document.getElementById('send-avatar');
  av.textContent = getInitials(username);
  av.style.background = `linear-gradient(135deg, ${getAvatarColor(username)}, ${getAvatarColor(username+'x')})`;

  document.getElementById('send-username-display').textContent = `@${username}`;
  document.getElementById('rating-username').textContent = username;

  // Random engagement lines
  const lines = [
    "🔒 100% anonymous – they will NEVER know it's you",
    "👀 Be honest. They can't see who sent it.",
    "🤫 Your secret is safe. Send something real.",
    "😏 You've been thinking about this. Just send it.",
  ];
  document.getElementById('send-engagement').textContent = lines[Math.floor(Math.random() * lines.length)];

  showScreen('screen-send');
}

function initTypeSelector() {
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const type = btn.dataset.type;
      document.querySelectorAll('.msg-panel').forEach(p => {
        p.classList.toggle('active', p.id === `panel-${type}`);
      });
    });
  });
}

function initHintToggle() {
  const cb  = document.getElementById('hint-toggle-cb');
  const opts = document.getElementById('hint-options');
  cb.addEventListener('change', () => {
    opts.classList.toggle('hidden', !cb.checked);
  });

  document.querySelectorAll('.hint-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      document.querySelectorAll('.hint-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      app.selectedHint = chip.dataset.hint;
    });
  });
}

function initCharCounter() {
  const ta = document.getElementById('msg-text');
  const counter = document.getElementById('char-count');
  ta.addEventListener('input', () => { counter.textContent = ta.value.length; });
}

function initStarRating() {
  const stars = document.querySelectorAll('.star');
  const display = document.getElementById('rating-val');
  stars.forEach(star => {
    star.addEventListener('mouseover', () => highlightStars(parseInt(star.dataset.val)));
    star.addEventListener('mouseleave', () => highlightStars(app.ratingValue));
    star.addEventListener('click', () => {
      app.ratingValue = parseInt(star.dataset.val);
      highlightStars(app.ratingValue);
      display.textContent = `${app.ratingValue}/10 ⭐`;
    });
  });
}

function highlightStars(n) {
  document.querySelectorAll('.star').forEach(s => {
    s.classList.toggle('lit', parseInt(s.dataset.val) <= n);
  });
}

/* ---- Send handlers ---- */
async function sendTextMessage() {
  const text = document.getElementById('msg-text').value.trim();
  if (!text) { showToast('✏️ Write something first!'); return; }

  const hint = document.getElementById('hint-toggle-cb').checked ? app.selectedHint : null;
  const msg = { type: 'text', content: text, hint };

  await doSend(msg);
  document.getElementById('msg-text').value = '';
  document.getElementById('char-count').textContent = '0';
}

async function sendPoll() {
  const question = document.getElementById('poll-question').value.trim();
  const optA     = document.getElementById('poll-opt-a').value.trim();
  const optB     = document.getElementById('poll-opt-b').value.trim();
  if (!question) { showToast('✏️ Write a question!'); return; }

  const msg = { type: 'poll', question, optA, optB, content: question };
  await doSend(msg);
  document.getElementById('poll-question').value = '';
}

async function sendRating() {
  if (!app.ratingValue) { showToast('⭐ Tap a star to rate!'); return; }
  const note = document.getElementById('rating-note').value.trim();
  const msg = { type: 'rating', rating: app.ratingValue, content: note || `Rated you ${app.ratingValue}/10 ⭐` };
  await doSend(msg);
  app.ratingValue = 0;
  highlightStars(0);
  document.getElementById('rating-val').textContent = 'Tap to rate';
  document.getElementById('rating-note').value = '';
}

async function sendVoice() {
  if (!app.audioBlob) { showToast('🎤 Record something first!'); return; }

  // Convert voice blob to base64 for storage (no file hosting needed)
  const reader = new FileReader();
  reader.onloadend = async () => {
    const base64 = reader.result;
    const msg = { type: 'voice', content: '🎤 Voice message', audioData: base64 };
    await doSend(msg);
    app.audioBlob = null;
    document.getElementById('btn-send-voice').classList.add('hidden');
    document.getElementById('voice-visualizer').querySelector('.voice-idle').style.display = '';
  };
  reader.readAsDataURL(app.audioBlob);
}

async function doSend(msg) {
  const btn = document.querySelector('.msg-panel.active .btn-send, #btn-send-voice');
  if (btn) { btn.disabled = true; btn.textContent = 'Sending…'; }

  try {
    await saveMessage(app.targetUser, msg);
    showToast('✅ Sent anonymously! 🤫');
    fireConfetti();
  } catch (e) {
    showToast('❌ Something went wrong. Try again.');
    console.error(e);
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = btn.dataset.originalText || 'Send 🚀'; }
  }
}

/* ──────────────────────────────────────────────
   9. VOICE RECORDING
   ────────────────────────────────────────────── */
function initVoiceRecording() {
  const btnRec  = document.getElementById('btn-record');
  const btnSend = document.getElementById('btn-send-voice');

  btnRec.addEventListener('click', async () => {
    if (!app.recording) {
      await startRecording();
    } else {
      stopRecording();
    }
  });

  btnSend.addEventListener('click', sendVoice);
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    app.mediaRecorder = new MediaRecorder(stream);
    const chunks = [];

    app.mediaRecorder.ondataavailable = e => chunks.push(e.data);
    app.mediaRecorder.onstop = () => {
      app.audioBlob = new Blob(chunks, { type: 'audio/webm' });
      document.getElementById('btn-send-voice').classList.remove('hidden');
      document.getElementById('voice-bars').style.display = 'none';
      document.getElementById('voice-timer').classList.add('hidden');
    };

    app.mediaRecorder.start();
    app.recording = true;

    // Show bars
    document.getElementById('voice-bars').style.display = 'flex';
    document.querySelector('.voice-idle').style.display = 'none';
    document.getElementById('btn-record').textContent = '⏹ Stop Recording';
    document.getElementById('btn-record').classList.add('recording');

    // Timer
    app.voiceSeconds = 0;
    const timerEl = document.getElementById('voice-timer');
    timerEl.classList.remove('hidden');
    app.voiceTimer = setInterval(() => {
      app.voiceSeconds++;
      const m = Math.floor(app.voiceSeconds / 60);
      const s = app.voiceSeconds % 60;
      timerEl.textContent = `${m}:${s.toString().padStart(2,'0')}`;
      if (app.voiceSeconds >= 30) stopRecording(); // max 30s
    }, 1000);

  } catch (e) {
    showToast('🎤 Microphone permission denied');
  }
}

function stopRecording() {
  if (app.mediaRecorder) app.mediaRecorder.stop();
  app.recording = false;
  clearInterval(app.voiceTimer);
  document.getElementById('btn-record').textContent = '⏺ Re-record';
  document.getElementById('btn-record').classList.remove('recording');
  document.getElementById('voice-bars').style.display = 'none';
}

/* ──────────────────────────────────────────────
   10. INBOX
   ────────────────────────────────────────────── */
async function loadInbox() {
  const user = app.currentUser;
  if (!user) return;

  // Populate UI elements
  const chipAv = document.getElementById('inbox-chip-av');
  chipAv.textContent = getInitials(user.username);
  chipAv.style.background = `linear-gradient(135deg, ${getAvatarColor(user.username)}, ${getAvatarColor(user.username+'x')})`;
  document.getElementById('inbox-chip-name').textContent = `@${user.username}`;

  // My link
  const link = getMyLink(user.username);
  document.getElementById('my-link-text').textContent = link.replace('https://','').replace('http://','');
  document.getElementById('share-link-url').textContent = link;

  // Fetch messages
  app.messages = await getMessages(user.username);
  renderMessages();
  updateStats();
  setupShareButtons(link, user.username);
  updateNotifBadge();

  // Engagement notification bar
  updateNotifBar();
}

function renderMessages() {
  const feed  = document.getElementById('message-feed');
  const empty = document.getElementById('empty-state');
  feed.innerHTML = '';

  const msgs = app.messages;
  if (!msgs.length) {
    empty.classList.remove('hidden'); return;
  }
  empty.classList.add('hidden');

  // Lock messages after 3 if user hasn't shared
  msgs.forEach((msg, i) => {
    const locked = i >= 3 && !app.unlockedShare;
    const card = buildMsgCard(msg, i, locked);
    feed.appendChild(card);
  });
}

function buildMsgCard(msg, index, locked) {
  const card = document.createElement('div');
  card.className = `msg-card${locked ? ' locked' : ''}${msg.read === false && !msg.isStarter ? ' new' : ''}`;
  card.style.animationDelay = `${index * 0.05}s`;

  const typeEmoji = { text: '💬', poll: '📊', rating: '⭐', voice: '🎤' }[msg.type] || '💬';

  let contentHTML = '';
  if (msg.type === 'rating') {
    const stars = '★'.repeat(msg.rating) + '☆'.repeat(10 - msg.rating);
    contentHTML = `<div class="msg-stars">${stars}</div><p style="margin-top:6px;font-size:0.88rem;color:var(--text-sub)">${msg.content || ''}</p>`;
  } else if (msg.type === 'poll') {
    contentHTML = `<p style="font-weight:600">${msg.question}</p>
      <div class="poll-preview">
        <div class="poll-opt-badge">${msg.optA}</div>
        <div class="poll-opt-badge">${msg.optB}</div>
      </div>`;
  } else if (msg.type === 'voice') {
    contentHTML = `<p>🎤 Voice message – tap to play</p>`;
  } else {
    contentHTML = `<p class="msg-card-content">${escHtml(msg.content)}</p>`;
  }

  const hintHTML = msg.hint ? `<span class="msg-hint-tag">🕵️ ${escHtml(msg.hint)}</span>` : '';

  card.innerHTML = `
    <div class="msg-card-inner">
      <div class="msg-card-top">
        <div class="msg-type-icon">${typeEmoji}</div>
        <span class="msg-time">${timeAgo(msg.createdAt)}</span>
      </div>
      ${contentHTML}
      ${hintHTML}
    </div>
    ${locked ? '<div class="locked-overlay">🔓 Share your link to unlock</div>' : ''}
  `;

  card.addEventListener('click', () => {
    if (locked) {
      openShareModal(); return;
    }
    openMsgModal(msg);
  });

  return card;
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

/* ──────────────────────────────────────────────
   11. MESSAGE MODAL
   ────────────────────────────────────────────── */
function openMsgModal(msg) {
  const modal    = document.getElementById('msg-modal');
  const body     = document.getElementById('modal-body');
  const hint     = document.getElementById('modal-hint');
  const meta     = document.getElementById('modal-meta');
  const badge    = document.getElementById('modal-type-badge');

  const typeEmoji = { text: '💬', poll: '📊', rating: '⭐', voice: '🎤' }[msg.type] || '💬';
  badge.textContent = typeEmoji;

  if (msg.type === 'rating') {
    const stars = '★'.repeat(msg.rating) + '☆'.repeat(10 - msg.rating);
    body.innerHTML = `<div class="msg-stars" style="font-size:1.5rem">${stars}</div><p style="margin-top:10px">${escHtml(msg.content)}</p>`;
  } else if (msg.type === 'poll') {
    body.innerHTML = `<p style="font-size:1.1rem;font-weight:700">${escHtml(msg.question)}</p>
      <div class="poll-preview" style="margin-top:12px">
        <div class="poll-opt-badge">${escHtml(msg.optA)}</div>
        <div class="poll-opt-badge">${escHtml(msg.optB)}</div>
      </div>`;
  } else if (msg.type === 'voice' && msg.audioData) {
    const audio = `<audio controls src="${msg.audioData}" style="width:100%;margin-top:8px;border-radius:8px"></audio>`;
    body.innerHTML = `<p>🎤 Voice message</p>${audio}`;
  } else {
    body.innerHTML = `<p>${escHtml(msg.content)}</p>`;
  }

  hint.textContent = msg.hint ? `🕵️ Hint: ${msg.hint}` : '';
  meta.textContent = `Received ${timeAgo(msg.createdAt)}`;

  // Delete handler
  document.getElementById('btn-delete-msg').onclick = async () => {
    app.messages = app.messages.filter(m => m.id !== msg.id);
    if (app.firebaseReady) await deleteMessage(msg.id);
    else {
      const key = `whispr_msgs_${app.currentUser.username}`;
      localStorage.setItem(key, JSON.stringify(app.messages));
    }
    closeMsgModal();
    renderMessages();
    updateStats();
    showToast('🗑️ Message deleted');
  };

  // Share as story
  document.getElementById('btn-share-reply').onclick = () => {
    const text = `Someone sent me this anonymously 👀\n"${msg.content || '?'}"\n\nSend me one: ${getMyLink(app.currentUser.username)}`;
    if (navigator.share) {
      navigator.share({ text }).catch(() => {});
    } else {
      navigator.clipboard.writeText(text).then(() => showToast('📋 Copied to share!'));
    }
  };

  modal.classList.remove('hidden');
}

function closeMsgModal() {
  document.getElementById('msg-modal').classList.add('hidden');
}

/* ──────────────────────────────────────────────
   12. SHARE SYSTEM
   ────────────────────────────────────────────── */
function setupShareButtons(link, username) {
  const waMsg = `Send me anonymous messages 👀\nI dare you to be honest...\n👇 ${link}`;
  const igMsg = `Ask me anything anonymously 🔓\n${link}`;
  const twMsg = `Send me an anonymous message 👀\n${link}`;
  const tgMsg = waMsg;

  // Inline share row (unlock banner)
  document.getElementById('btn-share-wa').onclick  = () => shareWA(waMsg);
  document.getElementById('btn-share-ig').onclick  = () => shareIG(link);
  document.getElementById('btn-share-copy').onclick = () => copyLink(link);

  // Share modal buttons
  document.getElementById('sl-wa').onclick = () => shareWA(waMsg);
  document.getElementById('sl-ig').onclick = () => shareIG(link);
  document.getElementById('sl-tw').onclick = () => openUrl(`https://twitter.com/intent/tweet?text=${encodeURIComponent(twMsg)}`);
  document.getElementById('sl-tg').onclick = () => openUrl(`https://t.me/share/url?url=${encodeURIComponent(link)}&text=${encodeURIComponent(tgMsg)}`);

  // Copy buttons
  document.getElementById('btn-copy-link').onclick = () => copyLink(link);
  document.getElementById('copy-inline-btn').onclick = () => copyLink(link);

  // Empty state share
  document.getElementById('btn-share-empty').onclick = openShareModal;

  // Nav share
  document.getElementById('nav-share-link').onclick = openShareModal;
}

function shareWA(msg) {
  markShared();
  openUrl(`https://api.whatsapp.com/send?text=${encodeURIComponent(msg)}`);
}
function shareIG(link) {
  markShared();
  navigator.clipboard.writeText(link).then(() => {
    showToast('📋 Link copied! Paste in your Instagram bio/story 🔥');
    setTimeout(() => openUrl('https://instagram.com'), 800);
  });
}
function copyLink(link) {
  navigator.clipboard.writeText(link).then(() => {
    markShared();
    showToast('📋 Link copied!');
  }).catch(() => {
    prompt('Copy your link:', link);
  });
}
function openUrl(url) {
  window.open(url, '_blank', 'noopener');
}

function markShared() {
  app.unlockedShare = true;
  localStorage.setItem('whispr_shared', '1');
  // Re-render to unlock locked messages
  renderMessages();
  document.getElementById('unlock-banner').style.opacity = '0.5';
}

function openShareModal() {
  document.getElementById('share-modal').classList.remove('hidden');
}
function closeShareModal() {
  document.getElementById('share-modal').classList.add('hidden');
}

/* ──────────────────────────────────────────────
   13. STATS & BADGES
   ────────────────────────────────────────────── */
function updateStats() {
  const msgs = app.messages;
  document.getElementById('stat-messages').textContent = msgs.length;

  // Link views (from DB or local)
  const viewsKey = `whispr_views_${app.currentUser?.username}`;
  const views = parseInt(localStorage.getItem(viewsKey) || app.currentUser?.linkViews || 0);
  document.getElementById('stat-views').textContent = views;

  // Average rating
  const ratings = msgs.filter(m => m.type === 'rating');
  if (ratings.length) {
    const avg = (ratings.reduce((s,m) => s + m.rating, 0) / ratings.length).toFixed(1);
    document.getElementById('stat-rating').textContent = avg;
  }

  app.linkViews = views;
}

function updateNotifBadge() {
  const unread = app.messages.filter(m => !m.read && !m.isStarter).length;
  app.newCount = unread;
  const badge = document.getElementById('nav-badge');
  badge.textContent = unread > 0 ? unread : '';
}

function updateNotifBar() {
  const bar = document.getElementById('notif-bar');
  const text = document.getElementById('notif-text');
  const total = app.messages.length;
  const lines = [
    `You have ${total} messages 👀`,
    `Someone sent you something… 🤫`,
    `${total} people left you a secret 🔓`,
    `New messages are waiting for you! 💌`,
  ];
  text.textContent = lines[Math.floor(Math.random() * lines.length)];
}

/* ──────────────────────────────────────────────
   14. CONFETTI
   ────────────────────────────────────────────── */
function fireConfetti() {
  const canvas = document.getElementById('confetti-canvas');
  const ctx    = canvas.getContext('2d');
  canvas.width  = window.innerWidth;
  canvas.height = window.innerHeight;

  const particles = Array.from({ length: 80 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    r: Math.random() * 6 + 3,
    d: Math.random() * 3 + 1,
    color: ['#c026d3','#7c3aed','#f97316','#22d3ee','#f43f5e','#fbbf24'][Math.floor(Math.random()*6)],
    tilt: Math.random() * 10 - 5,
    angle: 0,
  }));

  let frame = 0;
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
      p.y += p.d;
      p.x += Math.sin(p.angle) * 1.5;
      p.angle += 0.05;
    });
    frame++;
    if (frame < 120) requestAnimationFrame(draw);
    else ctx.clearRect(0, 0, canvas.width, canvas.height);
  }
  draw();
}

/* ──────────────────────────────────────────────
   15. APP INIT
   ────────────────────────────────────────────── */
async function init() {
  // Check URL params for public send page
  const params  = new URLSearchParams(window.location.search);
  const targetU = params.get('u');

  // Check existing session
  const session = loadSession();
  app.unlockedShare = localStorage.getItem('whispr_shared') === '1';

  if (targetU) {
    // Public send page
    const user = await getUser(targetU);
    if (!user) {
      showToast(`❌ User "${targetU}" not found`);
      showScreen('screen-landing');
    } else {
      await initSendScreen(targetU);
    }
  } else if (session) {
    // Resume inbox
    const user = await getUser(session);
    if (user) {
      app.currentUser = user;
      await loadInbox();
      showScreen('screen-inbox');
    } else {
      clearSession();
      showScreen('screen-landing');
    }
  } else {
    showScreen('screen-landing');
  }

  // Init landing
  initLanding();

  // Init send screen components
  initTypeSelector();
  initHintToggle();
  initCharCounter();
  initStarRating();
  initVoiceRecording();

  // Send buttons
  document.getElementById('btn-send-text').addEventListener('click', sendTextMessage);
  document.getElementById('btn-send-poll').addEventListener('click', sendPoll);
  document.getElementById('btn-send-rating').addEventListener('click', sendRating);

  // Modal close buttons
  document.getElementById('modal-close').addEventListener('click', closeMsgModal);
  document.getElementById('share-modal-close').addEventListener('click', closeShareModal);
  document.getElementById('msg-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('msg-modal')) closeMsgModal();
  });
  document.getElementById('share-modal').addEventListener('click', e => {
    if (e.target === document.getElementById('share-modal')) closeShareModal();
  });

  // Inbox nav
  document.getElementById('nav-inbox').addEventListener('click', () => {
    document.getElementById('nav-inbox').classList.add('active');
    document.getElementById('nav-share-link').classList.remove('active');
  });
  document.getElementById('nav-logout').addEventListener('click', () => {
    if (confirm('Log out?')) {
      clearSession();
      app.currentUser = null;
      app.messages = [];
      showScreen('screen-landing');
    }
  });

  // Settings button (stub)
  document.getElementById('btn-settings')?.addEventListener('click', () => {
    openShareModal(); // Reuse share modal as "settings" shortcut for now
  });

  // Responsive nav active states
  document.getElementById('nav-share-link').addEventListener('click', () => {
    document.getElementById('nav-share-link').classList.add('active');
    document.getElementById('nav-inbox').classList.remove('active');
  });
}

// Boot
document.addEventListener('DOMContentLoaded', init);
