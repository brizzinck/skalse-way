(function(){
  "use strict";
  var QUESTIONS = JSON.parse(document.getElementById('quiz-data').textContent);
  var TOTAL = QUESTIONS.length;
  var QMAP = {};
  QUESTIONS.forEach(function(q){ QMAP[q.id] = q; });

  var LS_KEY = 'pdr_t' + window.PDR_TOPIC_ID + '_best_v1';
  var LS_KEY_PROGRESS = LS_KEY.replace(/_best_v1$/, '_progress_v1');
  function loadBest(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(!raw) return null;
      return JSON.parse(raw);
    }catch(e){ return null; }
  }
  function saveBest(score,total){
    try{
      var cur = loadBest();
      if(!cur || score > cur.score){
        localStorage.setItem(LS_KEY, JSON.stringify({score:score, total:total, date:new Date().toISOString()}));
      }
    }catch(e){ /* ignore */ }
  }
  function loadProgress(){
    try{
      var raw = localStorage.getItem(LS_KEY_PROGRESS);
      if(!raw) return null;
      var p = JSON.parse(raw);
      if(!p || !Array.isArray(p.orderIds) || p.orderIds.length !== TOTAL) return null;
      if(!p.orderIds.every(function(id){ return QMAP.hasOwnProperty(id); })) return null;
      if(!Array.isArray(p.answers) || p.answers.length !== TOTAL) return null;
      return p;
    }catch(e){ return null; }
  }
  function saveProgress(){
    try{
      localStorage.setItem(LS_KEY_PROGRESS, JSON.stringify({
        orderIds: order.map(function(q){ return q.id; }),
        answers: answers,
        qi: qi,
        date: new Date().toISOString()
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

  els.factImages.textContent = QUESTIONS.filter(function(q){return q.hasImage;}).length;

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
      els.continuePos.textContent = (p.qi+1) + '/' + TOTAL;
    } else {
      els.btnContinue.hidden = true;
    }
  }
  refreshContinueButton();

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
    if(btn.getAttribute('data-view')==='list'){ renderList(); showView('list'); }
    else { refreshBestLine(); refreshContinueButton(); showView('start'); }
  });

  /* ---------------- quiz engine ---------------- */
  var order = [];
  var qi = 0;
  var answers = [];

  function computeScore(){
    var s = 0;
    answers.forEach(function(a){ if(a && a.correct) s++; });
    return s;
  }
  function computeMissed(){
    var m = [];
    answers.forEach(function(a, idx){ if(a && !a.correct) m.push(order[idx]); });
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
    order = p.orderIds.map(function(id){ return QMAP[id]; });
    answers = p.answers.slice();
    qi = Math.min(p.qi, TOTAL-1);
    showView('quiz');
    renderQuestion();
  }

  function renderQuestion(){
    var q = order[qi];
    var existingAnswer = answers[qi];
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
      els.quizImgnote.hidden = !q.hasImage;
    }
    els.quizExplain.classList.toggle('show', !!existingAnswer);
    els.quizExplainText.textContent = q.explanation || 'Пояснення до цього питання відсутнє в базі сайту.';
    els.btnNext.disabled = !existingAnswer;
    els.btnNext.textContent = (qi === TOTAL-1) ? 'Завершити' : 'Далі';
    els.btnBack.disabled = (qi === 0);

    els.quizOptions.innerHTML = '';
    q.options.forEach(function(opt){
      var b = document.createElement('button');
      b.className = 'opt';
      b.innerHTML = '<span class="badge">'+opt.letter+'</span><span class="otext"></span><span class="mark">✓</span>';
      b.querySelector('.otext').textContent = opt.text;
      if(existingAnswer){
        b.disabled = true;
        if(opt.correct){ b.classList.add('correct'); }
        else if(opt.letter === existingAnswer.letter){ b.classList.add('wrong'); }
        else { b.classList.add('dim'); }
      } else {
        b.addEventListener('click', function(){ selectOption(b, opt, q); });
      }
      els.quizOptions.appendChild(b);
    });
  }

  function selectOption(btn, opt, q){
    if(answers[qi]) return;
    answers[qi] = {letter: opt.letter, correct: !!opt.correct};
    Array.prototype.forEach.call(els.quizOptions.children, function(el, idx){
      var o = q.options[idx];
      el.disabled = true;
      if(o.correct){ el.classList.add('correct'); }
      else if(el===btn){ el.classList.add('wrong'); }
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
    if(!answers[qi]) return;
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

  els.btnStart.addEventListener('click', startQuiz);
  els.btnContinue.addEventListener('click', resumeQuiz);
  els.btnRetry.addEventListener('click', startQuiz);
  els.btnToList.addEventListener('click', function(){ renderList(); showView('list'); });

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
      } else if(q.hasImage){
        var note = document.createElement('span');
        note.className = 'limgnote';
        note.textContent = '🖼️ ілюстрація на сайті';
        body.insertBefore(note, qtext);
      }

      var opts = document.createElement('div');
      opts.className = 'lopts';
      q.options.forEach(function(o){
        var row = document.createElement('div');
        row.className = 'lopt' + (o.correct ? ' correct':'');
        row.innerHTML = '<span class="lletter">'+o.letter+')</span>';
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
})();
