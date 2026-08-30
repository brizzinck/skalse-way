(function(){
  "use strict";
  var CFG = window.PDR_EXAM_CONFIG;
  var RECENT_KEY = 'pdr_exam_recent_v1';
  var LAST_RESULT_KEY = 'pdr_exam_last_v1';

  /* the 41 official topic ids, in a fixed order - recent-history entries keep a
     1-based numeric topic_id into this list instead of repeating a string like "16_2" */
  var TOPIC_ORDER = [
    "01","02","03","04","05","06","07","08_1","08_2","09","10","11","12","13","14","15",
    "16_1","16_2","17","18","19","20","21","22","23","24","25","26","27","28","29","30",
    "31","32","33","34","35","36","37","38","39"
  ];
  function topicNumId(topicId){
    var n = TOPIC_ORDER.indexOf(topicId);
    return n === -1 ? 0 : n + 1;
  }

  var els = {
    viewIntro: document.getElementById('view-intro'),
    viewQuiz: document.getElementById('view-quiz'),
    viewSummary: document.getElementById('view-summary'),
    catBreakdown: document.getElementById('cat-breakdown'),
    lastResult: document.getElementById('last-result'),
    btnStart: document.getElementById('btn-start'),
    introLoading: document.getElementById('intro-loading'),
    examTimer: document.getElementById('exam-timer'),
    quizPos: document.getElementById('quiz-pos'),
    quizFill: document.getElementById('quiz-fill'),
    answeredCount: document.getElementById('answered-count'),
    qgrid: document.getElementById('qgrid'),
    quizQnum: document.getElementById('quiz-qnum'),
    quizQtext: document.getElementById('quiz-qtext'),
    quizImgnote: document.getElementById('quiz-imgnote'),
    quizOptions: document.getElementById('quiz-options'),
    btnBack: document.getElementById('btn-back'),
    btnNext: document.getElementById('btn-next'),
    btnQuit: document.getElementById('btn-quit'),
    sumScore: document.getElementById('sum-score'),
    sumTotal: document.getElementById('sum-total'),
    sumPct: document.getElementById('sum-pct'),
    sumWrong: document.getElementById('sum-wrong'),
    verdictBanner: document.getElementById('verdict-banner'),
    sumTimedout: document.getElementById('sum-timedout'),
    reviewItems: document.getElementById('review-items'),
    btnAgain: document.getElementById('btn-again')
  };

  var views = {intro: els.viewIntro, quiz: els.viewQuiz, summary: els.viewSummary};
  function showView(name){
    Object.keys(views).forEach(function(k){ views[k].hidden = (k!==name); });
    window.scrollTo({top:0, behavior: (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth')});
  }

  function shuffle(arr){
    var a = arr.slice();
    for(var i=a.length-1;i>0;i--){
      var j = Math.floor(Math.random()*(i+1));
      var t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  /* ---------------- intro: static breakdown + last result ---------------- */
  function renderBreakdown(){
    els.catBreakdown.innerHTML = '';
    CFG.CATEGORIES.forEach(function(cat){
      var row = document.createElement('div');
      row.className = 'catrow';
      var title = document.createElement('span');
      title.className = 'cattitle';
      title.textContent = cat.title;
      var weight = document.createElement('span');
      weight.className = 'catweight';
      weight.textContent = cat.weight + ' пит.';
      row.appendChild(title);
      row.appendChild(weight);
      els.catBreakdown.appendChild(row);
    });
  }

  function loadLastResult(){
    try{
      var raw = localStorage.getItem(LAST_RESULT_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch(e){ return null; }
  }
  function saveLastResult(r){
    try{ localStorage.setItem(LAST_RESULT_KEY, JSON.stringify(r)); }catch(e){ /* ignore */ }
  }
  function renderLastResult(){
    var r = loadLastResult();
    if(!r){ els.lastResult.hidden = true; return; }
    els.lastResult.hidden = false;
    var date = new Date(r.timestamp);
    els.lastResult.textContent = 'Останній іспит: ' + r.score + '/' + r.total +
      ' (' + (r.passed ? 'складено' : 'не складено') + ') · ' + date.toLocaleDateString('uk-UA');
  }

  /* ---------------- recent-exam history (avoids near-term repeats) ---------------- */
  /* each history entry is {topic_id: <number>, question_id: <number>} - no strings */
  function getRecentHistory(){
    try{
      var raw = localStorage.getItem(RECENT_KEY);
      var arr = raw ? JSON.parse(raw) : [];
      return Array.isArray(arr) ? arr : [];
    }catch(e){ return []; }
  }
  function saveRecentExam(refs){
    try{
      var hist = getRecentHistory();
      hist.push(refs);
      while(hist.length > CFG.RECENT_EXAMS_TO_AVOID) hist.shift();
      localStorage.setItem(RECENT_KEY, JSON.stringify(hist));
    }catch(e){ /* ignore */ }
  }
  function recentlyUsedSet(){
    var set = {};
    getRecentHistory().forEach(function(refs){
      refs.forEach(function(r){ set[r.topic_id + ':' + r.question_id] = true; });
    });
    return set;
  }

  /* split a category's weight across a handful of its topics, chosen at random each time */
  function pickCounts(weight, n){
    var base = Math.floor(weight/n);
    var rem = weight % n;
    var counts = [];
    for(var i=0;i<n;i++) counts.push(base + (i<rem ? 1 : 0));
    return shuffle(counts);
  }

  function buildExamSet(onProgress){
    var recent = recentlyUsedSet();
    var plan = CFG.CATEGORIES.map(function(cat){
      var n = Math.min(cat.weight, cat.topics.length);
      var activeTopics = shuffle(cat.topics).slice(0, n);
      var counts = pickCounts(cat.weight, n);
      return {activeTopics: activeTopics, counts: counts};
    });
    var topicIds = {};
    plan.forEach(function(p){ p.activeTopics.forEach(function(t){ topicIds[t] = true; }); });
    topicIds = Object.keys(topicIds);

    var loaded = 0;
    var pools = {};
    return Promise.all(topicIds.map(function(t){
      return window.PDRTopicLoader.loadTopic(t).then(function(qs){
        pools[t] = qs;
        loaded++;
        if(onProgress) onProgress(loaded, topicIds.length);
        return qs;
      });
    })).then(function(){
      var result = [];
      plan.forEach(function(p){
        p.activeTopics.forEach(function(topicId, idx){
          var need = p.counts[idx];
          var pool = pools[topicId] || [];
          var topicNum = topicNumId(topicId);
          var filtered = pool.filter(function(q){ return !recent[topicNum + ':' + q.id]; });
          var source = filtered.length >= need ? filtered : pool;
          var picked = shuffle(source).slice(0, Math.min(need, source.length));
          picked.forEach(function(q){
            result.push({topicId: topicId, qid: q.id, question: q});
          });
        });
      });
      return shuffle(result);
    });
  }

  /* ---------------- exam run state ---------------- */
  /* answers[i] is the 0-based index of the chosen option, or null if unanswered;
     correctness is always derived from examSet[i].question.options[answers[i]].correct */
  var examSet = [];
  var qi = 0;
  var answers = [];
  var timerInterval = null;
  var timeLeft = 0;
  var finished = false;
  var timedOut = false;

  els.btnStart.addEventListener('click', function(){
    els.btnStart.disabled = true;
    els.introLoading.hidden = false;
    els.introLoading.textContent = 'Завантаження банку питань…';
    buildExamSet(function(loaded, total){
      els.introLoading.textContent = 'Завантаження банку питань… ' + loaded + '/' + total;
    }).then(function(set){
      examSet = set;
      qi = 0;
      answers = new Array(examSet.length).fill(null);
      finished = false;
      timedOut = false;
      els.btnStart.disabled = false;
      els.introLoading.hidden = true;
      showView('quiz');
      startTimer();
      renderQuestionGrid();
      renderQuestion();
    }).catch(function(err){
      els.introLoading.textContent = 'Не вдалося завантажити питання. Перевір з`єднання і спробуй ще раз.';
      els.btnStart.disabled = false;
      console.error(err);
    });
  });

  function startTimer(){
    timeLeft = CFG.TIME_LIMIT_SEC;
    updateTimerDisplay();
    clearInterval(timerInterval);
    timerInterval = setInterval(function(){
      timeLeft--;
      updateTimerDisplay();
      if(timeLeft <= 0){
        clearInterval(timerInterval);
        timedOut = true;
        finishExam();
      }
    }, 1000);
  }
  function stopTimer(){ clearInterval(timerInterval); timerInterval = null; }
  function updateTimerDisplay(){
    var t = Math.max(timeLeft, 0);
    var m = Math.floor(t/60), s = t%60;
    els.examTimer.textContent = (m<10?'0':'')+m + ':' + (s<10?'0':'')+s;
    els.examTimer.classList.toggle('low', t <= 120);
  }

  function answeredCount(){
    var n = 0;
    answers.forEach(function(a){ if(a !== null) n++; });
    return n;
  }

  function renderQuestionGrid(){
    els.qgrid.innerHTML = '';
    examSet.forEach(function(entry, idx){
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'qgbtn' + (answers[idx] !== null ? ' answered' : '') + (idx===qi ? ' current' : '');
      b.textContent = String(idx+1);
      b.addEventListener('click', function(){ qi = idx; renderQuestion(); renderQuestionGrid(); });
      els.qgrid.appendChild(b);
    });
  }

  function renderQuestion(){
    var entry = examSet[qi];
    var q = entry.question;
    var chosen = answers[qi];
    els.quizPos.textContent = (qi+1) + ' / ' + examSet.length;
    els.quizFill.style.width = ((qi/examSet.length)*100) + '%';
    els.answeredCount.textContent = answeredCount() + '/' + examSet.length;
    els.quizQnum.textContent = 'ПИТАННЯ ' + (qi+1);
    els.quizQtext.textContent = q.text;
    var existingImg = els.quizQtext.parentNode.querySelector('.qimg');
    if(existingImg) existingImg.remove();
    if(q.image){
      var img = document.createElement('img');
      img.className = 'qimg';
      img.src = q.image;
      img.alt = 'Ілюстрація до питання';
      els.quizImgnote.insertAdjacentElement('afterend', img);
      els.quizImgnote.hidden = true;
    } else {
      els.quizImgnote.hidden = !q.has_image;
    }
    els.btnBack.disabled = (qi === 0);
    els.btnNext.textContent = (qi === examSet.length-1) ? 'Завершити іспит' : 'Далі';

    els.quizOptions.innerHTML = '';
    q.options.forEach(function(opt, optIdx){
      var b = document.createElement('button');
      b.className = 'opt' + (chosen === optIdx ? ' selected' : '');
      b.innerHTML = '<span class="badge">'+(optIdx+1)+'</span><span class="otext"></span><span class="mark">✓</span>';
      b.querySelector('.otext').textContent = opt.text;
      b.addEventListener('click', function(){ selectOption(optIdx); });
      els.quizOptions.appendChild(b);
    });
  }

  function selectOption(optIdx){
    answers[qi] = optIdx;
    renderQuestion();
    renderQuestionGrid();
  }

  els.btnNext.addEventListener('click', function(){
    if(qi === examSet.length-1){
      maybeConfirmFinish();
    } else {
      qi++;
      renderQuestion();
      renderQuestionGrid();
    }
  });
  els.btnBack.addEventListener('click', function(){
    if(qi === 0) return;
    qi--;
    renderQuestion();
    renderQuestionGrid();
  });
  els.btnQuit.addEventListener('click', function(){
    if(confirm('Завершити іспит достроково? Відповіли на ' + answeredCount() + ' із ' + examSet.length + '. Питання без відповіді зарахуються як неправильні.')){
      finishExam();
    }
  });
  function maybeConfirmFinish(){
    var n = answeredCount();
    if(n < examSet.length){
      if(confirm('Ви відповіли на ' + n + ' із ' + examSet.length + ' питань. Завершити іспит?')){ finishExam(); }
    } else {
      finishExam();
    }
  }

  function finishExam(){
    if(finished) return;
    finished = true;
    stopTimer();
    var correct = 0, wrong = 0;
    examSet.forEach(function(entry, idx){
      var chosen = answers[idx];
      var isCorrect = chosen !== null && entry.question.options[chosen].correct;
      if(isCorrect) correct++; else wrong++;
      if(!isCorrect && window.PDRMistakes){ window.PDRMistakes.recordWrong(entry.topicId, entry.qid); }
    });
    saveRecentExam(examSet.map(function(e){ return {topic_id: topicNumId(e.topicId), question_id: e.qid}; }));
    var result = {
      score: correct, total: examSet.length, wrong: wrong,
      passed: wrong <= CFG.MAX_WRONG_TO_PASS,
      timestamp: Date.now(), timed_out: timedOut
    };
    saveLastResult(result);
    renderSummary(result);
    showView('summary');
  }

  function renderSummary(result){
    els.sumScore.textContent = result.score;
    els.sumTotal.textContent = result.total;
    els.sumPct.textContent = Math.round(result.score/result.total*100) + '%';
    els.sumWrong.textContent = result.wrong;
    els.verdictBanner.className = 'verdictbanner ' + (result.passed ? 'verdict-pass' : 'verdict-fail');
    els.verdictBanner.textContent = result.passed
      ? ('✅ Складено! Дозволено максимум ' + CFG.MAX_WRONG_TO_PASS + ' помилки — у тебе ' + result.wrong + '.')
      : ('❌ Не складено. Дозволено максимум ' + CFG.MAX_WRONG_TO_PASS + ' помилки — у тебе ' + result.wrong + '.');
    els.sumTimedout.hidden = !result.timed_out;
    renderReview();
  }

  function renderReview(){
    els.reviewItems.innerHTML = '';
    examSet.forEach(function(entry, idx){
      var q = entry.question;
      var chosen = answers[idx];
      var isWrong = !(chosen !== null && q.options[chosen].correct);

      var item = document.createElement('div');
      item.className = 'litem' + (isWrong ? ' litem-wrong' : '');

      var head = document.createElement('button');
      head.className = 'lq';
      head.setAttribute('aria-expanded', 'false');

      var num = document.createElement('span');
      num.className = 'lnum';
      num.textContent = '№' + (idx+1);

      var body = document.createElement('div');
      body.className = 'lbody';

      var qtext = document.createElement('p');
      qtext.className = 'lqtext';
      qtext.textContent = q.text;
      body.appendChild(qtext);

      if(q.image){
        var img = document.createElement('img');
        img.className = 'limg';
        img.src = q.image;
        img.alt = 'Ілюстрація до питання';
        body.insertBefore(img, qtext);
      } else if(q.has_image){
        var note = document.createElement('span');
        note.className = 'limgnote';
        note.textContent = '🖼️ ілюстрація на сайті';
        body.insertBefore(note, qtext);
      }

      var opts = document.createElement('div');
      opts.className = 'lopts';
      q.options.forEach(function(o, oIdx){
        var row = document.createElement('div');
        row.className = 'lopt' + (o.correct ? ' correct' : '') + (oIdx===chosen && !o.correct ? ' chosen-wrong' : '');
        row.innerHTML = '<span class="lletter">'+(oIdx+1)+')</span>';
        var suffix = o.correct ? '  ✓' : (oIdx===chosen ? '  ← твоя відповідь' : '');
        row.appendChild(document.createTextNode(o.text + suffix));
        opts.appendChild(row);
      });
      body.appendChild(opts);

      if(chosen === null){
        var skipped = document.createElement('div');
        skipped.className = 'skipped-note';
        skipped.textContent = 'Питання залишилось без відповіді.';
        body.appendChild(skipped);
      }

      var chevron = document.createElement('span');
      chevron.className = 'chevron';
      chevron.textContent = '▾';

      head.appendChild(num);
      head.appendChild(body);
      head.appendChild(chevron);

      var explain = document.createElement('div');
      explain.className = 'lexplain';
      explain.innerHTML = '<b>Пояснення</b>';
      explain.appendChild(document.createTextNode(q.explanation || 'Пояснення до цього питання відсутнє в базі сайту.'));

      head.addEventListener('click', function(){
        var open = item.classList.toggle('open');
        head.setAttribute('aria-expanded', String(open));
      });

      item.appendChild(head);
      item.appendChild(explain);
      els.reviewItems.appendChild(item);
    });
  }

  els.btnAgain.addEventListener('click', function(){
    renderLastResult();
    showView('intro');
  });

  renderBreakdown();
  renderLastResult();
})();
