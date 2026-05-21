// server.js - Bir Kelime Bir İşlem (Çoklu Cihaz) v2
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

const VOWELS = ['A','A','A','A','A','A','A','A','A','A','A','A','E','E','E','E','E','E','E','E','I','I','I','I','I','İ','İ','İ','İ','İ','İ','İ','İ','İ','İ','O','O','O','O','O','Ö','Ö','U','U','U','U','Ü','Ü'];
const CONSONANTS = ['B','B','B','C','C','Ç','Ç','D','D','D','D','F','G','G','Ğ','H','J','K','K','K','K','K','K','K','L','L','L','L','L','L','L','M','M','M','M','N','N','N','N','N','N','N','P','P','P','R','R','R','R','R','R','S','S','S','S','Ş','Ş','T','T','T','T','T','V','Y','Y','Y','Y','Z','Z'];

function randomLetters() {
  const letters = [];
  const vowelCount = 3 + Math.floor(Math.random()*2);
  const consCount = 9 - vowelCount;
  for (let i = 0; i < vowelCount; i++) letters.push(VOWELS[Math.floor(Math.random()*VOWELS.length)]);
  for (let i = 0; i < consCount; i++) letters.push(CONSONANTS[Math.floor(Math.random()*CONSONANTS.length)]);
  for (let i = letters.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [letters[i], letters[j]] = [letters[j], letters[i]];
  }
  return letters;
}

// Bir sayı kombinasyonundan ulaşılabilen tüm sonuçları bul (çözülebilirlik kontrolü için)
function reachableTargets(numbers) {
  const results = new Set();
  function recurse(nums) {
    nums.forEach(n => { if (n >= 100 && n <= 999) results.add(n); });
    if (nums.length < 2) return;
    for (let i = 0; i < nums.length; i++) {
      for (let j = 0; j < nums.length; j++) {
        if (i === j) continue;
        const rest = nums.filter((_, k) => k !== i && k !== j);
        const a = nums[i], b = nums[j];
        const ops = [a+b, a-b, a*b];
        if (b !== 0 && a % b === 0) ops.push(a/b);
        ops.forEach(r => {
          if (r > 0 && Number.isInteger(r)) {
            recurse([...rest, r]);
          }
        });
      }
    }
  }
  recurse(numbers);
  return results;
}

// Çözülebilir bulmaca üret
function randomMathPuzzle() {
  let tries = 0;
  while (tries < 50) {
    tries++;
    const large = [25, 50, 75, 100];
    const nums = [];
    const largeCount = 1 + Math.floor(Math.random()*2);
    const usedLarge = [...large];
    for (let i = 0; i < largeCount; i++) {
      const idx = Math.floor(Math.random()*usedLarge.length);
      nums.push(usedLarge.splice(idx,1)[0]);
    }
    while (nums.length < 6) nums.push(1 + Math.floor(Math.random()*10));
    for (let i = nums.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [nums[i], nums[j]] = [nums[j], nums[i]];
    }
    // Çözülebilir hedeflerden birini seç
    const reachable = reachableTargets(nums);
    const valid = [...reachable].filter(n => n >= 101 && n <= 999);
    if (valid.length > 0) {
      const target = valid[Math.floor(Math.random()*valid.length)];
      return { numbers: nums, target };
    }
  }
  // Fallback: en azından yaklaşılabilir bir bulmaca
  const nums = [1+Math.floor(Math.random()*10), 1+Math.floor(Math.random()*10), 1+Math.floor(Math.random()*10), 1+Math.floor(Math.random()*10), 25, 100];
  return { numbers: nums, target: 100 + Math.floor(Math.random()*400) };
}

function generateRoomCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
}

const rooms = {};

function createRoom(hostSocketId) {
  let code;
  do { code = generateRoomCode(); } while (rooms[code]);
  rooms[code] = {
    code,
    host: hostSocketId,
    players: [],
    settings: { rounds: 6, timeLimit: 45, jokersPerPlayer: 1, order: 'alternate' },
    state: 'lobby',
    currentRound: 0,
    rounds_plan: [],
    currentData: null,
    answers: {},
    timerInterval: null,
    timeLeft: 0,
  };
  return code;
}

function broadcastRoom(code) {
  const room = rooms[code];
  if (!room) return;
  io.to(code).emit('room_state', getPublicState(room));
}

function getPublicState(room) {
  return {
    code: room.code,
    state: room.state,
    settings: room.settings,
    players: room.players.map(p => ({
      id: p.id, name: p.name, score: p.score,
      jokersLeft: p.jokersLeft, connected: p.connected,
      hasAnswered: room.answers[p.id] !== undefined,
    })),
    currentRound: room.currentRound,
    totalRounds: room.settings.rounds,
    roundType: room.currentData ? room.currentData.type : null,
    letters: room.currentData && room.currentData.type === 'word' ? room.currentData.letters : null,
    numbers: room.currentData && room.currentData.type === 'math' ? room.currentData.numbers : null,
    target: room.currentData && room.currentData.type === 'math' ? room.currentData.target : null,
    timeLeft: room.timeLeft,
    hostId: room.host,
  };
}

function endRoundAnswering(code) {
  const room = rooms[code];
  if (!room) return;
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  // Cevap vermeyen oyuncular için boş cevap
  room.players.forEach(p => {
    if (p.connected && room.answers[p.id] === undefined) {
      room.answers[p.id] = { empty: true };
    }
  });
  room.state = 'answering';
  room.timeLeft = 0;
  io.to(code).emit('tick', { timeLeft: 0 });
  broadcastRoom(code);
}

function startTimer(code) {
  const room = rooms[code];
  if (!room) return;
  room.timeLeft = room.settings.timeLimit;
  room.state = 'playing';
  broadcastRoom(code);
  if (room.timerInterval) clearInterval(room.timerInterval);
  room.timerInterval = setInterval(() => {
    room.timeLeft--;
    io.to(code).emit('tick', { timeLeft: room.timeLeft });
    if (room.timeLeft <= 0) {
      endRoundAnswering(code);
    }
  }, 1000);
}

function setupNextRound(code) {
  const room = rooms[code];
  if (!room) return;
  if (room.timerInterval) {
    clearInterval(room.timerInterval);
    room.timerInterval = null;
  }
  const type = room.rounds_plan[room.currentRound];
  if (type === 'word') {
    room.currentData = { type: 'word', letters: randomLetters() };
  } else {
    const puzzle = randomMathPuzzle();
    room.currentData = { type: 'math', ...puzzle };
  }
  room.answers = {};
  room.state = 'ready';
  room.timeLeft = room.settings.timeLimit;
  broadcastRoom(code);
}

function computeResults(room) {
  const isWord = room.currentData.type === 'word';
  const results = [];
  if (isWord) {
    room.players.forEach(p => {
      const ans = room.answers[p.id];
      let pts = 0, info = {};
      if (ans && ans.word && !ans.empty) {
        if (ans.tdkValid || ans.tdkUnknown) {
          pts = ans.word.length - (ans.jokerCount || 0) * 2;
          if (pts < 0) pts = 0;
        }
        info = {
          word: ans.word,
          tdkValid: ans.tdkValid,
          tdkUnknown: ans.tdkUnknown,
          jokerCount: ans.jokerCount || 0,
        };
        if (ans.jokerCount > 0 && (ans.tdkValid || ans.tdkUnknown)) {
          p.jokersLeft = Math.max(0, p.jokersLeft - ans.jokerCount);
        }
      }
      p.score += pts;
      results.push({ id: p.id, name: p.name, points: pts, ...info });
    });
  } else {
    const target = room.currentData.target;
    let minDiff = Infinity;
    room.players.forEach(p => {
      const ans = room.answers[p.id];
      if (ans && ans.result !== undefined && !ans.empty) {
        const d = Math.abs(ans.result - target);
        if (d < minDiff) minDiff = d;
      }
    });
    room.players.forEach(p => {
      const ans = room.answers[p.id];
      let pts = 0, info = {};
      if (ans && ans.result !== undefined && !ans.empty) {
        const diff = Math.abs(ans.result - target);
        if (diff === 0) pts = 10;
        else if (diff === minDiff && diff <= 10) pts = 7;
        else if (diff <= 5) pts = 5;
        else if (diff <= 10) pts = 3;
        info = { result: ans.result, diff, steps: ans.steps || [], expression: ans.expression || '' };
      }
      p.score += pts;
      results.push({ id: p.id, name: p.name, points: pts, ...info });
    });
  }
  return results;
}

io.on('connection', (socket) => {
  socket.on('create_room', ({ name }, cb) => {
    const code = createRoom(socket.id);
    socket.join(code);
    const room = rooms[code];
    room.players.push({
      id: socket.id,
      name: (name || 'Sunucu').slice(0, 20),
      score: 0,
      jokersLeft: room.settings.jokersPerPlayer,
      connected: true,
    });
    socket.data.roomCode = code;
    cb({ ok: true, code });
    broadcastRoom(code);
  });

  socket.on('join_room', ({ code, name }, cb) => {
    code = (code || '').toUpperCase().trim();
    const room = rooms[code];
    if (!room) return cb({ ok: false, error: 'Oda bulunamadı' });
    if (room.state !== 'lobby') {
      const existing = room.players.find(p => p.name.toLowerCase() === (name||'').toLowerCase());
      if (existing) {
        existing.id = socket.id;
        existing.connected = true;
        socket.join(code);
        socket.data.roomCode = code;
        cb({ ok: true, code, rejoin: true });
        broadcastRoom(code);
        return;
      }
      return cb({ ok: false, error: 'Oyun başladı, yeni oyuncu eklenemez' });
    }
    if (room.players.length >= 8) return cb({ ok: false, error: 'Oda dolu (max 8)' });
    const cleanName = (name || 'Oyuncu').slice(0, 20).trim() || 'Oyuncu';
    if (room.players.some(p => p.name.toLowerCase() === cleanName.toLowerCase())) {
      return cb({ ok: false, error: 'Bu isim alınmış' });
    }
    socket.join(code);
    socket.data.roomCode = code;
    room.players.push({
      id: socket.id, name: cleanName, score: 0,
      jokersLeft: room.settings.jokersPerPlayer, connected: true,
    });
    cb({ ok: true, code });
    broadcastRoom(code);
  });

  socket.on('update_settings', (settings) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id || room.state !== 'lobby') return;
    if (settings.rounds) room.settings.rounds = parseInt(settings.rounds);
    if (settings.timeLimit) room.settings.timeLimit = parseInt(settings.timeLimit);
    if (settings.jokersPerPlayer !== undefined) {
      room.settings.jokersPerPlayer = parseInt(settings.jokersPerPlayer);
      room.players.forEach(p => p.jokersLeft = room.settings.jokersPerPlayer);
    }
    if (settings.order) room.settings.order = settings.order;
    broadcastRoom(code);
  });

  socket.on('start_game', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id || room.state !== 'lobby') return;
    if (room.players.length < 1) return;

    room.currentRound = 0;
    room.rounds_plan = [];
    const order = room.settings.order;
    if (order === 'alternate') {
      for (let i = 0; i < room.settings.rounds; i++) room.rounds_plan.push(i % 2 === 0 ? 'word' : 'math');
    } else if (order === 'word-first') {
      const half = Math.ceil(room.settings.rounds/2);
      for (let i = 0; i < room.settings.rounds; i++) room.rounds_plan.push(i < half ? 'word' : 'math');
    } else {
      for (let i = 0; i < room.settings.rounds; i++) room.rounds_plan.push(Math.random() < 0.5 ? 'word' : 'math');
    }
    setupNextRound(code);
  });

  socket.on('start_timer', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    if (room.state !== 'ready') return;
    startTimer(code);
  });

  socket.on('submit_answer', (answer, cb) => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return cb && cb({ ok: false });
    if (room.state !== 'answering' && room.state !== 'playing' && room.state !== 'ready') return cb && cb({ ok: false, error: 'Cevap zamanı değil' });
    const player = room.players.find(p => p.id === socket.id);
    if (!player) return cb && cb({ ok: false });
    room.answers[player.id] = answer;

    const connectedPlayers = room.players.filter(p => p.connected);
    const allAnswered = connectedPlayers.every(p => room.answers[p.id] !== undefined);
    if (allAnswered && (room.state === 'playing' || room.state === 'ready')) {
      endRoundAnswering(code);
    } else {
      broadcastRoom(code);
    }
    cb && cb({ ok: true });
  });

  socket.on('clear_answer', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room) return;
    if (room.state === 'results') return; // Sonuçlar açıklandıktan sonra değiştirilemez
    delete room.answers[socket.id];
    // State'i geri çek
    if (room.state === 'answering') {
      // Eğer timer hâlâ aktif olabilecek bir durumdaysa eski state'e dön
    }
    broadcastRoom(code);
  });

  socket.on('show_results', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    if (room.state !== 'answering') return;
    const results = computeResults(room);
    room.state = 'results';
    room.lastResults = results;
    io.to(code).emit('round_results', { results, roundType: room.currentData.type, target: room.currentData.target });
    broadcastRoom(code);
  });

  socket.on('force_end_round', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    if (room.state !== 'playing' && room.state !== 'ready') return;
    endRoundAnswering(code);
  });

  socket.on('next_round', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    if (room.state !== 'results') return; // sadece results state'inden geçilebilir
    room.currentRound++;
  
    if (room.currentRound >= room.settings.rounds) {
      room.state = 'finished';
      const ranked = [...room.players].sort((a,b) => b.score - a.score);
      io.to(code).emit('game_finished', { ranking: ranked.map(p => ({ name: p.name, score: p.score })) });
      broadcastRoom(code);
    } else {
      setupNextRound(code);
    }
  });

  socket.on('restart_lobby', () => {
    const code = socket.data.roomCode;
    const room = rooms[code];
    if (!room || room.host !== socket.id) return;
    room.state = 'lobby';
    room.currentRound = 0;
    room.rounds_plan = [];
    room.currentData = null;
    room.answers = {};
    room.players.forEach(p => {
      p.score = 0;
      p.jokersLeft = room.settings.jokersPerPlayer;
    });
    if (room.timerInterval) { clearInterval(room.timerInterval); room.timerInterval = null; }
    broadcastRoom(code);
  });

  socket.on('disconnect', () => {
    const code = socket.data.roomCode;
    if (!code) return;
    const room = rooms[code];
    if (!room) return;
    const player = room.players.find(p => p.id === socket.id);
    if (player) player.connected = false;
    if (room.host === socket.id) {
      setTimeout(() => {
        if (rooms[code] && rooms[code].players.every(p => !p.connected)) {
          if (rooms[code].timerInterval) clearInterval(rooms[code].timerInterval);
          delete rooms[code];
        }
      }, 5 * 60 * 1000);
    }
    broadcastRoom(code);
  });
});

server.listen(PORT, () => {
  console.log(`Bir Kelime Bir İşlem v2 sunucusu: http://localhost:${PORT}`);
});
