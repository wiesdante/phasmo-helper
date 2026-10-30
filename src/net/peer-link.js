// Doğrudan bağlantı katmanı (WebRTC veri kanalı).
// Eşler birbirini PeerJS'in ücretsiz genel sinyal sunucusu üzerinden bulur; bağlantı kurulduktan
// sonra veriler doğrudan bilgisayarlar arasında akar (sunucudan geçmez).
// Host: kimliği oturum kodundan türetilir, gelen bağlantıları kabul eder (merkez).
// Katılan: host'a tek bir veri kanalı açar.
window.PeerLink = (() => {
  const SIGNAL_URL = 'wss://0.peerjs.com:443/peerjs?key=peerjs';
  const ICE_SERVERS = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }
  ];
  const ID_PREFIX = 'phasmohelper-v1-';
  const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // karışan harfler (0/O, 1/I) yok
  const CODE_LEN = 6;
  const CONNECT_TIMEOUT = 20000;

  const rand = (n, chars = 'abcdefghijklmnopqrstuvwxyz0123456789') => {
    const a = new Uint32Array(n); crypto.getRandomValues(a);
    return Array.from(a, x => chars[x % chars.length]).join('');
  };
  const newCode = () => rand(CODE_LEN, CODE_CHARS);
  const normalizeCode = s => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const isValidCode = c => c.length === CODE_LEN && [...c].every(ch => CODE_CHARS.includes(ch));

  // Sinyal sunucusuyla konuşan küçük istemci (PeerJS sunucu protokolü).
  // Not: genel sunucu OFFER / ANSWER / CANDIDATE mesajlarında payload.type ister ('data');
  // eksikse göndereni sessizce bağlantıdan atar.
  class Signal {
    constructor(id, handlers) {
      this.id = id; this.h = handlers; this.closed = false;
      this.ws = new WebSocket(`${PeerLink.SIGNAL_URL}&id=${encodeURIComponent(id)}&token=${rand(16)}&version=1.5.4`);
      this.ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } this.h.message(m); };
      this.ws.onclose = () => { clearInterval(this.hb); if (!this.closed) this.h.closed(); };
      this.ws.onerror = () => {};
      this.hb = setInterval(() => this.raw({ type: 'HEARTBEAT' }), 5000);
    }
    raw(m) { if (this.ws.readyState === 1) this.ws.send(JSON.stringify(m)); }
    send(type, dst, payload) { this.raw({ type, dst, payload }); }
    close() { this.closed = true; clearInterval(this.hb); try { this.ws.close(); } catch {} }
  }

  function makePc() {
    return new RTCPeerConnection({ iceServers: ICE_SERVERS });
  }

  // Ortak: bir veri kanalını JSON mesajlaşmasına bağla.
  function wire(dc, onMsg, onClose) {
    dc.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch { return; } onMsg(m); };
    dc.onclose = () => onClose();
  }
  const sendJson = (dc, m) => { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(m)); };

  // --- Host ---
  // events: ready(code), peerOpen(peerId), peerMessage(peerId, msg), peerClose(peerId), error(kind), closed()
  function host(events, tries = 3) {
    const code = newCode();
    const peers = new Map(); // peerId -> { pc, dc, connectionId }
    let sig;
    let done = false, opened = false;
    const api = {
      code,
      send(peerId, msg) { const p = peers.get(peerId); if (p) sendJson(p.dc, msg); },
      broadcast(msg) { for (const p of peers.values()) sendJson(p.dc, msg); },
      kick(peerId) { const p = peers.get(peerId); if (p) { try { p.pc.close(); } catch {} peers.delete(peerId); } },
      close() {
        done = true;
        for (const p of peers.values()) { try { p.dc && p.dc.close(); p.pc.close(); } catch {} }
        peers.clear();
        if (sig) sig.close();
      }
    };

    sig = new Signal(ID_PREFIX + code, {
      message: async m => {
        if (m.type === 'OPEN') { if (!opened) { opened = true; events.ready(code); } return; }
        if (m.type === 'ID-TAKEN') { sig.close(); if (tries > 1) Object.assign(api, host(events, tries - 1)); else events.error('server'); return; }
        if (m.type === 'ERROR') { sig.close(); return events.error('server'); }
        const src = m.src, pl = m.payload || {};
        if (!src || !src.startsWith(ID_PREFIX)) return;
        if (m.type === 'OFFER') {
          if (peers.has(src)) api.kick(src);
          const pc = makePc();
          const entry = { pc, dc: null, connectionId: pl.connectionId };
          peers.set(src, entry);
          pc.onicecandidate = e => { if (e.candidate) sig.send('CANDIDATE', src, { candidate: e.candidate, type: 'data', connectionId: pl.connectionId }); };
          pc.ondatachannel = e => {
            entry.dc = e.channel;
            e.channel.onopen = () => events.peerOpen(src);
            wire(e.channel, msg => events.peerMessage(src, msg), () => {
              if (peers.get(src) === entry) { peers.delete(src); events.peerClose(src); }
            });
          };
          pc.onconnectionstatechange = () => {
            if (['failed', 'closed'].includes(pc.connectionState) && peers.get(src) === entry) {
              peers.delete(src); events.peerClose(src);
            }
          };
          try {
            await pc.setRemoteDescription(pl.sdp);
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            sig.send('ANSWER', src, { sdp: pc.localDescription, type: 'data', connectionId: pl.connectionId });
          } catch { api.kick(src); }
        } else if (m.type === 'CANDIDATE') {
          const p = peers.get(src);
          if (p && pl.candidate) p.pc.addIceCandidate(pl.candidate).catch(() => {});
        } else if (m.type === 'LEAVE') {
          const p = peers.get(src);
          if (p && !p.dc) api.kick(src); // bağlantı kurulmadan ayrıldı
        }
      },
      // Sinyal sunucusu düşerse kurulu bağlantılar sürer, ama yeni kişi katılamaz: yeniden bağlan.
      closed: () => {
        if (done) return;
        if (!opened) { done = true; return events.error('server'); }
        setTimeout(() => { if (!done) sig = new Signal(ID_PREFIX + code, sig.h); }, 3000);
      }
    });
    return api;
  }

  // --- Katılan ---
  // events: open(), message(msg), closed(reason), error(kind: 'notFound' | 'timeout' | 'server')
  function join(rawCode, events) {
    const code = normalizeCode(rawCode);
    const hostId = ID_PREFIX + code;
    const myId = ID_PREFIX + 'u' + rand(12);
    const connectionId = 'dc_' + rand(12);
    let pc, dc, opened = false, finished = false;
    const fail = kind => { if (finished) return; finished = true; cleanup(); events.error(kind); };
    const cleanup = () => { clearTimeout(timer); try { dc && dc.close(); pc && pc.close(); } catch {} sig.close(); };
    const timer = setTimeout(() => { if (!opened) fail('timeout'); }, PeerLink.CONNECT_TIMEOUT);

    const sig = new Signal(myId, {
      message: async m => {
        if (m.type === 'OPEN') {
          pc = makePc();
          dc = pc.createDataChannel('sync', { ordered: true });
          pc.onicecandidate = e => { if (e.candidate) sig.send('CANDIDATE', hostId, { candidate: e.candidate, type: 'data', connectionId }); };
          dc.onopen = () => {
            opened = true; clearTimeout(timer);
            sig.close(); // bağlantı kuruldu; sinyal sunucusuna artık gerek yok
            events.open();
          };
          wire(dc, msg => events.message(msg), () => {
            if (opened && !finished) { finished = true; try { pc.close(); } catch {} events.closed('lost'); }
          });
          pc.onconnectionstatechange = () => {
            if (pc.connectionState === 'failed') { if (opened) { if (!finished) { finished = true; events.closed('lost'); } } else fail('timeout'); }
          };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          sig.send('OFFER', hostId, { sdp: pc.localDescription, type: 'data', connectionId, label: 'sync', reliable: true, serialization: 'json' });
        } else if (m.type === 'ANSWER' && m.src === hostId) {
          pc.setRemoteDescription(m.payload.sdp).catch(() => fail('timeout'));
        } else if (m.type === 'CANDIDATE' && m.src === hostId) {
          if (m.payload && m.payload.candidate) pc.addIceCandidate(m.payload.candidate).catch(() => {});
        } else if (m.type === 'EXPIRE') {
          fail('notFound'); // bu kodla açık bir oturum yok
        } else if (m.type === 'ERROR' || m.type === 'ID-TAKEN') {
          fail('server');
        }
      },
      closed: () => { if (!opened) fail('server'); }
    });

    return {
      code,
      send(msg) { sendJson(dc, msg); },
      close() { finished = true; cleanup(); }
    };
  }

  return { SIGNAL_URL, CONNECT_TIMEOUT, host, join, normalizeCode, isValidCode, CODE_LEN };
})();
