(function(){
  "use strict";
  var QUESTIONS = [];
  var TOTAL = 0;
  var QMAP = {};

  var LS_KEY = 'pdr_t' + window.PDR_TOPIC_ID + '_best_v1';
  var LS_KEY_PROGRESS = LS_KEY.replace(/_best_v1$/, '_progress_v1');
  /* old option letters always matched the option's position in the array, so this is a
     lossless way to migrate an old saved answer's letter into the new index-based shape */
  var LETTER_TO_INDEX = {'а':0,'б':1,'в':2,'г':3,'д':4};
  function loadBest(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(!raw) return null;
      var b = JSON.parse(raw);
      if(b && b.date && !b.timestamp){
        b = {score: b.score, total: b.total, timestamp: new Date(b.date).getTime()};
        localStorage.setItem(LS_KEY, JSON.stringify(b));
      }
      return b;
    }catch(e){ return null; }
  }
  function saveBest(score,total){
    try{
      var cur = loadBest();
      if(!cur || score > cur.score){
        localStorage.setItem(LS_KEY, JSON.stringify({score:score, total:total, timestamp:Date.now()}));
      }
    }catch(e){ /* ignore */ }
  }
  function loadProgress(){
    try{
      var raw = localStorage.getItem(LS_KEY_PROGRESS);
      if(!raw) return null;
      var p = JSON.parse(raw);
      /* old shape: {orderIds, answers:[{letter,correct}|null], qi, date} */
      if(p && Array.isArray(p.orderIds)){
        p = {
          order_ids: p.orderIds,
          answers: (p.answers || []).map(function(a){
            if(a === null || a === undefined) return null;
            if(typeof a === 'number') return a;
            return LETTER_TO_INDEX.hasOwnProperty(a.letter) ? LETTER_TO_INDEX[a.letter] : null;
          }),
          question_index: p.qi || 0,
          timestamp: p.date ? new Date(p.date).getTime() : Date.now()
        };
        localStorage.setItem(LS_KEY_PROGRESS, JSON.stringify(p));
      }
      if(!p || !Array.isArray(p.order_ids) || p.order_ids.length !== TOTAL) return null;
      if(!p.order_ids.every(function(id){ return QMAP.hasOwnProperty(id); })) return null;
      if(!Array.isArray(p.answers) || p.answers.length !== TOTAL) return null;
      return p;
    }catch(e){ return null; }
  }
  function saveProgress(){
    try{
      localStorage.setItem(LS_KEY_PROGRESS, JSON.stringify({
        order_ids: order.map(function(q){ return q.id; }),
        answers: answers,
        question_index: qi,
        timestamp: Date.now()
      }));
    }catch(e){ /* ignore */ }
  }
  function clearProgress(){
    try{ localStorage.removeItem(LS_KEY_PROGRESS); }catch(e){ /* ignore */ }
  }

  var els = {
    navtabs: document.getElementById('navtabs'),
    viewStart: document.getElementById('view-start'),
    viewQuiz: document.getElementById('view-quiz'),
    viewSummary: document.getElementById('view-summary'),
    viewList: document.getElementById('view-list'),
    factImages: document.getElementById('fact-images'),
    btnStart: document.getElementById('btn-start'),
    btnContinue: document.getElementById('btn-continue'),
    continuePos: document.getElementById('continue-pos'),
    chkShuffle: document.getElementById('chk-shuffle'),
    bestLine: document.getElementById('best-line'),
    bestValue: document.getElementById('best-value'),
    quizPos: document.getElementById('quiz-pos'),
    quizFill: document.getElementById('quiz-fill'),
    quizScore: document.getElementById('quiz-score'),
    quizQnum: document.getElementById('quiz-qnum'),
    quizQtext: document.getElementById('quiz-qtext'),
    quizImgnote: document.getElementById('quiz-imgnote'),
    quizOptions: document.getElementById('quiz-options'),
    quizExplain: document.getElementById('quiz-explain'),
    quizExplainText: document.getElementById('quiz-explain-text'),
    btnNext: document.getElementById('btn-next'),
    btnBack: document.getElementById('btn-back'),
    btnQuit: document.getElementById('btn-quit'),
    sumScore: document.getElementById('sum-score'),
    sumTotal: document.getElementById('sum-total'),
    sumPct: document.getElementById('sum-pct'),
    sumVerdict: document.getElementById('sum-verdict'),
    sumMissedWrap: document.getElementById('sum-missed-wrap'),
    sumMissed: document.getElementById('sum-missed'),
    btnRetry: document.getElementById('btn-retry'),
    btnToList: document.getElementById('btn-tolist'),
    listItems: document.getElementById('list-items')
  };

  var best = loadBest();
  function refreshBestLine(){
    best = loadBest();
    if(best){
      els.bestLine.hidden = false;
      els.bestValue.textContent = best.score + '/' + best.total + ' (' + Math.round(best.score/best.total*100) + '%)';
    } else {
      els.bestLine.hidden = true;
    }
  }
  refreshBestLine();

  function refreshContinueButton(){
    var p = loadProgress();
    if(p){
      els.btnContinue.hidden = false;
      els.continuePos.textContent = (p.question_index+1) + '/' + TOTAL;
    } else {
      els.btnContinue.hidden = true;
    }
  }

  function shuffle(arr){
    var a = arr.slice();
    for(var i=a.length-1;i>0;i--){
      var j = Math.floor(Math.random()*(i+1));
      var t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  var views = {start:els.viewStart, quiz:els.viewQuiz, summary:els.viewSummary, list:els.viewList};
  function showView(name){
    Object.keys(views).forEach(function(k){ views[k].hidden = (k!==name); });
    var tabName = (name==='list') ? 'list' : 'start';
    Array.prototype.forEach.call(els.navtabs.querySelectorAll('button'), function(b){
      b.setAttribute('aria-selected', String(b.getAttribute('data-view')===tabName));
    });
    window.scrollTo({top:0, behavior: (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth')});
  }

  els.navtabs.addEventListener('click', function(e){
    var btn = e.target.closest('button[data-view]');
    if(!btn) return;
    if(btn.getAttribute('data-view')==='list'){
      dataReady.then(function(){ renderList(); showView('list'); });
    } else {
      refreshBestLine();
      dataReady.then(refreshContinueButton);
      showView('start');
    }
  });

  /* ---------------- quiz engine ---------------- */
  /* answers[i] is the 0-based index of the chosen option, or null if unanswered;
     correctness is always derived from order[i].options[answers[i]].correct, never stored redundantly */
  var order = [];
  var qi = 0;
  var answers = [];

  function isCorrect(idx, q){
    return idx !== null && q.options[idx].correct;
  }
  function computeScore(){
    var s = 0;
    answers.forEach(function(a, i){ if(isCorrect(a, order[i])) s++; });
    return s;
  }
  function computeMissed(){
    var m = [];
    answers.forEach(function(a, idx){ if(a !== null && !isCorrect(a, order[idx])) m.push(order[idx]); });
    return m;
  }

  function startQuiz(){
    order = els.chkShuffle.checked ? shuffle(QUESTIONS) : QUESTIONS.slice();
    qi = 0;
    answers = new Array(TOTAL).fill(null);
    showView('quiz');
    saveProgress();
    renderQuestion();
  }

  function resumeQuiz(){
    var p = loadProgress();
    if(!p) return;
    order = p.order_ids.map(function(id){ return QMAP[id]; });
    answers = p.answers.slice();
    qi = Math.min(p.question_index, TOTAL-1);
    showView('quiz');
    renderQuestion();
  }

  function renderQuestion(){
    var q = order[qi];
    var existingAnswer = answers[qi];
    var answered = existingAnswer !== null;
    els.quizPos.textContent = (qi+1) + ' / ' + TOTAL;
    els.quizFill.style.width = (((qi)/TOTAL)*100) + '%';
    els.quizScore.textContent = computeScore() + ' ✓';
    els.quizQnum.textContent = 'ПИТАННЯ ' + q.id;
    els.quizQtext.textContent = q.text;
    var existingImg = els.quizQtext.parentNode.querySelector('.qimg');
    if(existingImg) existingImg.remove();
    if(q.image){
      var img = document.createElement('img');
      img.className = 'qimg';
      img.src = q.image;
      img.alt = 'Ілюстрація до питання ' + q.id;
      els.quizImgnote.insertAdjacentElement('afterend', img);
      els.quizImgnote.hidden = true;
    } else {
      els.quizImgnote.hidden = !q.has_image;
    }
    els.quizExplain.classList.toggle('show', answered);
    els.quizExplainText.textContent = q.explanation || 'Пояснення до цього питання відсутнє в базі сайту.';
    els.btnNext.disabled = !answered;
    els.btnNext.textContent = (qi === TOTAL-1) ? 'Завершити' : 'Далі';
    els.btnBack.disabled = (qi === 0);

    els.quizOptions.innerHTML = '';
    q.options.forEach(function(opt, optIdx){
      var b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = '<span class="badge">'+(optIdx+1)+'</span><span class="otext"></span><span class="mark">✓</span>';
      b.querySelector('.otext').textContent = opt.text;
      if(answered){
        b.disabled = true;
        if(opt.correct){ b.classList.add('correct'); }
        else if(optIdx === existingAnswer){ b.classList.add('wrong'); }
        else { b.classList.add('dim'); }
      } else {
        b.addEventListener('click', function(){ selectOption(optIdx, q); });
      }
      els.quizOptions.appendChild(b);
    });
  }

  function selectOption(optIdx, q){
    if(answers[qi] !== null) return;
    answers[qi] = optIdx;
    var opt = q.options[optIdx];
    if(!opt.correct && window.PDRMistakes){ window.PDRMistakes.recordWrong(window.PDR_TOPIC_ID, q.id); }
    Array.prototype.forEach.call(els.quizOptions.children, function(el, idx){
      var o = q.options[idx];
      el.disabled = true;
      if(o.correct){ el.classList.add('correct'); }
      else if(idx === optIdx){ el.classList.add('wrong'); }
      else { el.classList.add('dim'); }
    });
    els.quizScore.textContent = computeScore() + ' ✓';
    els.quizExplain.classList.add('show');
    els.btnNext.disabled = false;
    els.btnNext.focus({preventScroll: true});
    els.quizExplain.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
    saveProgress();
  }

  els.btnNext.addEventListener('click', function(){
    if(answers[qi] === null) return;
    if(qi === TOTAL-1){
      finishQuiz();
    } else {
      qi++;
      renderQuestion();
      saveProgress();
    }
  });

  function goBack(){
    if(qi === 0) return;
    qi--;
    renderQuestion();
    saveProgress();
  }
  els.btnBack.addEventListener('click', goBack);

  /* swipe left on the quiz screen (phones) goes back one question */
  var swipeStartX = 0, swipeStartY = 0, swipeTracking = false;
  els.viewQuiz.addEventListener('touchstart', function(e){
    if(e.touches.length !== 1) return;
    swipeStartX = e.touches[0].clientX;
    swipeStartY = e.touches[0].clientY;
    swipeTracking = true;
  }, {passive: true});
  els.viewQuiz.addEventListener('touchend', function(e){
    if(!swipeTracking) return;
    swipeTracking = false;
    var t = e.changedTouches[0];
    var dx = t.clientX - swipeStartX;
    var dy = t.clientY - swipeStartY;
    if(dx < -60 && Math.abs(dx) > Math.abs(dy) * 1.5){
      goBack();
    }
  }, {passive: true});
  els.viewQuiz.addEventListener('touchcancel', function(){ swipeTracking = false; }, {passive: true});

  els.btnQuit.addEventListener('click', function(){
    if(confirm('Завершити тест достроково? Прогрес до цього моменту буде враховано.')){
      finishQuiz();
    }
  });

  function finishQuiz(){
    var score = computeScore();
    var missed = computeMissed();
    els.quizFill.style.width = '100%';
    saveBest(score, TOTAL);
    clearProgress();
    refreshBestLine();
    refreshContinueButton();
    els.sumScore.textContent = score;
    els.sumTotal.textContent = TOTAL;
    var pct = Math.round(score/TOTAL*100);
    els.sumPct.textContent = pct + '%';
    var verdict;
    if(pct === 100) verdict = 'Ідеально. Тема закрита — можна переходити далі за планом.';
    else if(pct >= 90) verdict = 'Дуже добре. Повтори пояснення до пропущених питань і тема закрита.';
    else if(pct >= 70) verdict = 'Непогано, але ще є прогалини. Переглянь пояснення нижче і пройди тест ще раз.';
    else verdict = 'Тему варто повторити за конспектом лекції, перш ніж переходити далі.';
    els.sumVerdict.textContent = verdict;

    if(missed.length){
      els.sumMissedWrap.hidden = false;
      els.sumMissed.innerHTML = '';
      missed.forEach(function(q){
        var chip = document.createElement('button');
        chip.className = 'chip';
        chip.textContent = '№' + q.id;
        chip.addEventListener('click', function(){
          renderList();
          showView('list');
          var target = document.getElementById('litem-'+q.id);
          if(target){
            target.classList.add('open');
            target.scrollIntoView({block:'center', behavior:(window.matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth')});
          }
        });
        els.sumMissed.appendChild(chip);
      });
    } else {
      els.sumMissedWrap.hidden = true;
    }
    showView('summary');
  }

  els.btnStart.addEventListener('click', function(){
    els.btnStart.disabled = true;
    dataReady.then(function(){ els.btnStart.disabled = false; startQuiz(); });
  });
  els.btnContinue.addEventListener('click', function(){ dataReady.then(resumeQuiz); });
  els.btnRetry.addEventListener('click', function(){ dataReady.then(startQuiz); });
  els.btnToList.addEventListener('click', function(){ dataReady.then(function(){ renderList(); showView('list'); }); });

  /* ---------------- list mode ---------------- */
  var listRendered = false;
  function renderList(){
    if(listRendered) return;
    listRendered = true;
    var frag = document.createDocumentFragment();
    QUESTIONS.forEach(function(q){
      var item = document.createElement('div');
      item.className = 'litem';
      item.id = 'litem-' + q.id;

      var head = document.createElement('button');
      head.className = 'lq';
      head.setAttribute('aria-expanded','false');

      var num = document.createElement('span');
      num.className = 'lnum';
      num.textContent = '№'+q.id;

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
        img.alt = 'Ілюстрація до питання ' + q.id;
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
        row.className = 'lopt' + (o.correct ? ' correct':'');
        row.innerHTML = '<span class="lletter">'+(oIdx+1)+')</span>';
        row.appendChild(document.createTextNode(o.text + (o.correct ? '  ✓':'')));
        opts.appendChild(row);
      });
      body.appendChild(opts);

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
      frag.appendChild(item);
    });
    els.listItems.appendChild(frag);
  }

  /* ---------------- load this topic's question bank, then unlock what depends on it ---------------- */
  var dataReady = window.PDRTopicLoader.loadTopic(window.PDR_TOPIC_ID).then(function(qs){
    QUESTIONS = qs;
    TOTAL = QUESTIONS.length;
    QUESTIONS.forEach(function(q){ QMAP[q.id] = q; });
    els.factImages.textContent = QUESTIONS.filter(function(q){ return q.has_image; }).length;
    refreshContinueButton();
  }).catch(function(err){
    console.error('Не вдалося завантажити банк питань:', err);
    els.btnStart.textContent = 'Помилка завантаження питань';
  });
})();
