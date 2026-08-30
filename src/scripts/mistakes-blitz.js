(function(){
  "use strict";
  var TOPIC_TITLES = window.PDR_TOPICS.titles;

  var els = {
    selTotalCount: document.getElementById('sel-total-count'),
    selEmpty: document.getElementById('sel-empty'),
    selBody: document.getElementById('sel-body'),
    mlist: document.getElementById('mlist'),
    btnPickAll: document.getElementById('btn-pick-all'),
    btnPickNone: document.getElementById('btn-pick-none'),
    selPickedCount: document.getElementById('sel-picked-count'),
    btnStartBlitz: document.getElementById('btn-start-blitz'),
    viewSelect: document.getElementById('view-select'),
    viewQuiz: document.getElementById('view-quiz'),
    viewSummary: document.getElementById('view-summary'),
    quizPos: document.getElementById('quiz-pos'),
    quizFill: document.getElementById('quiz-fill'),
    quizScore: document.getElementById('quiz-score'),
    quizQnum: document.getElementById('quiz-qnum'),
    quizQtext: document.getElementById('quiz-qtext'),
    quizImgnote: document.getElementById('quiz-imgnote'),
    quizOptions: document.getElementById('quiz-options'),
    quizExplain: document.getElementById('quiz-explain'),
    quizExplainText: document.getElementById('quiz-explain-text'),
    quizMasteryNote: document.getElementById('quiz-mastery-note'),
    btnNext: document.getElementById('btn-next'),
    btnBack: document.getElementById('btn-back'),
    btnQuit: document.getElementById('btn-quit'),
    sumScore: document.getElementById('sum-score'),
    sumTotal: document.getElementById('sum-total'),
    sumPct: document.getElementById('sum-pct'),
    sumVerdict: document.getElementById('sum-verdict'),
    sumMastered: document.getElementById('sum-mastered'),
    btnAgain: document.getElementById('btn-again'),
    startLoading: document.getElementById('start-loading')
  };

  var byTopic = {};
  var selectedTopics = {};

  function refreshSelectView(){
    byTopic = window.PDRMistakes.byTopic();
    var topics = Object.keys(byTopic).sort(function(a,b){
      return a.localeCompare(b, undefined, {numeric:true});
    });
    var total = window.PDRMistakes.count();
    els.selTotalCount.textContent = total;
    if(total === 0){
      els.selEmpty.hidden = false;
      els.selBody.hidden = true;
      return;
    }
    els.selEmpty.hidden = true;
    els.selBody.hidden = false;

    var newSelected = {};
    topics.forEach(function(t){ newSelected[t] = selectedTopics.hasOwnProperty(t) ? selectedTopics[t] : true; });
    selectedTopics = newSelected;

    els.mlist.innerHTML = '';
    topics.forEach(function(t){
      var row = document.createElement('label');
      row.className = 'mrow';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!selectedTopics[t];
      cb.addEventListener('change', function(){
        selectedTopics[t] = cb.checked;
        refreshPickedCount();
      });
      var title = document.createElement('span');
      title.className = 'mtitle';
      title.textContent = (t + ' · ' + (TOPIC_TITLES[t] || 'Тема ' + t));
      var cnt = document.createElement('span');
      cnt.className = 'mcount';
      cnt.textContent = byTopic[t].length;
      row.appendChild(cb);
      row.appendChild(title);
      row.appendChild(cnt);
      els.mlist.appendChild(row);
    });
    refreshPickedCount();
  }

  function refreshPickedCount(){
    var n = 0;
    Object.keys(selectedTopics).forEach(function(t){
      if(selectedTopics[t]) n += (byTopic[t] ? byTopic[t].length : 0);
    });
    els.selPickedCount.textContent = n;
    els.btnStartBlitz.disabled = (n === 0);
  }

  els.btnPickAll.addEventListener('click', function(){
    Object.keys(selectedTopics).forEach(function(t){ selectedTopics[t] = true; });
    Array.prototype.forEach.call(els.mlist.querySelectorAll('input'), function(cb){ cb.checked = true; });
    refreshPickedCount();
  });
  els.btnPickNone.addEventListener('click', function(){
    Object.keys(selectedTopics).forEach(function(t){ selectedTopics[t] = false; });
    Array.prototype.forEach.call(els.mlist.querySelectorAll('input'), function(cb){ cb.checked = false; });
    refreshPickedCount();
  });

  function shuffle(arr){
    var a = arr.slice();
    for(var i=a.length-1;i>0;i--){
      var j = Math.floor(Math.random()*(i+1));
      var t=a[i]; a[i]=a[j]; a[j]=t;
    }
    return a;
  }

  var views = {select: els.viewSelect, quiz: els.viewQuiz, summary: els.viewSummary};
  function showView(name){
    Object.keys(views).forEach(function(k){ views[k].hidden = (k!==name); });
    window.scrollTo({top:0, behavior: (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto':'smooth')});
  }

  /* answers[i] is the 0-based index of the chosen option, or null if unanswered;
     correctness is always derived from order[i].question.options[answers[i]].correct */
  var order = [];
  var qi = 0;
  var answers = [];

  function computeScore(){
    var s = 0;
    answers.forEach(function(a, i){ if(a !== null && order[i].question.options[a].correct) s++; });
    return s;
  }

  function startBlitz(){
    var pool = [];
    Object.keys(selectedTopics).forEach(function(t){
      if(selectedTopics[t] && byTopic[t]) pool = pool.concat(byTopic[t]);
    });
    if(!pool.length) return;

    var topicIds = {};
    pool.forEach(function(e){ topicIds[e.topicId] = true; });
    topicIds = Object.keys(topicIds);

    els.btnStartBlitz.disabled = true;
    els.startLoading.hidden = false;
    els.startLoading.textContent = 'Завантаження питань…';

    Promise.all(topicIds.map(function(t){
      return window.PDRTopicLoader.loadTopic(t).then(function(qs){
        var qmap = {};
        qs.forEach(function(q){ qmap[q.id] = q; });
        return {topicId: t, qmap: qmap};
      });
    })).then(function(loadedTopics){
      var qmaps = {};
      loadedTopics.forEach(function(lt){ qmaps[lt.topicId] = lt.qmap; });

      var built = [];
      pool.forEach(function(e){
        var q = qmaps[e.topicId] && qmaps[e.topicId][e.qid];
        if(!q){
          /* question no longer exists in the bank - drop the stale mistake entry too */
          window.PDRMistakes.removeEntry(e.topicId, e.qid);
          return;
        }
        built.push({topicId: e.topicId, qid: e.qid, question: q});
      });

      els.btnStartBlitz.disabled = false;
      els.startLoading.hidden = true;
      if(!built.length) return;

      order = shuffle(built);
      qi = 0;
      answers = new Array(order.length).fill(null);
      showView('quiz');
      renderQuestion();
    }).catch(function(err){
      els.startLoading.textContent = 'Не вдалося завантажити питання. Перевір з`єднання і спробуй ще раз.';
      els.btnStartBlitz.disabled = false;
      console.error(err);
    });
  }
  els.btnStartBlitz.addEventListener('click', startBlitz);

  /* the live store, not a value stashed at answer-time, is the source of truth here -
     a question is only ever answered once per blitz session, so this stays accurate on revisit */
  function masteryNoteFor(entry, idx){
    if(idx === null) return '';
    if(!entry.question.options[idx].correct) return 'Лічильник правильних відповідей поспіль скинуто.';
    var live = window.PDRMistakes.get(entry.topicId, entry.qid);
    if(!live) return '✅ Вивчено! Питання прибрано з помилок.';
    return 'Правильно ' + live.correctStreak + '/' + window.PDRMistakes.MASTERY_STREAK + ' поспіль — ще трохи, і питання зникне з помилок.';
  }

  function renderQuestion(){
    var entry = order[qi];
    var q = entry.question;
    var existingAnswer = answers[qi];
    var answered = existingAnswer !== null;
    els.quizPos.textContent = (qi+1) + ' / ' + order.length;
    els.quizFill.style.width = (((qi)/order.length)*100) + '%';
    els.quizScore.textContent = computeScore() + ' ✓';
    els.quizQnum.textContent = 'ТЕМА ' + entry.topicId + ' · ПИТАННЯ ' + q.id;
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
    els.quizMasteryNote.textContent = answered ? masteryNoteFor(entry, existingAnswer) : '';
    els.btnNext.disabled = !answered;
    els.btnNext.textContent = (qi === order.length-1) ? 'Завершити' : 'Далі';
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
        b.addEventListener('click', function(){ selectOption(optIdx, entry); });
      }
      els.quizOptions.appendChild(b);
    });
  }

  function selectOption(optIdx, entry){
    if(answers[qi] !== null) return;
    answers[qi] = optIdx;
    var opt = entry.question.options[optIdx];
    if(opt.correct){ window.PDRMistakes.recordCorrect(entry.topicId, entry.qid); }
    else { window.PDRMistakes.recordWrong(entry.topicId, entry.qid); }
    Array.prototype.forEach.call(els.quizOptions.children, function(el, idx){
      var o = entry.question.options[idx];
      el.disabled = true;
      if(o.correct){ el.classList.add('correct'); }
      else if(idx === optIdx){ el.classList.add('wrong'); }
      else { el.classList.add('dim'); }
    });
    els.quizScore.textContent = computeScore() + ' ✓';
    els.quizExplain.classList.add('show');
    els.quizMasteryNote.textContent = masteryNoteFor(entry, optIdx);
    els.btnNext.disabled = false;
    els.btnNext.focus({preventScroll: true});
    els.quizExplain.scrollIntoView({
      block: 'start',
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth'
    });
  }

  els.btnNext.addEventListener('click', function(){
    if(answers[qi] === null) return;
    if(qi === order.length-1){
      finishBlitz();
    } else {
      qi++;
      renderQuestion();
    }
  });

  function goBack(){
    if(qi === 0) return;
    qi--;
    renderQuestion();
  }
  els.btnBack.addEventListener('click', goBack);

  els.btnQuit.addEventListener('click', function(){
    if(confirm('Завершити бліц достроково? Прогрес до цього моменту буде враховано.')){
      finishBlitz();
    }
  });

  function finishBlitz(){
    var score = computeScore();
    var mastered = 0;
    answers.forEach(function(a, i){
      var entry = order[i];
      if(a !== null && entry.question.options[a].correct && !window.PDRMistakes.get(entry.topicId, entry.qid)) mastered++;
    });
    els.quizFill.style.width = '100%';
    els.sumScore.textContent = score;
    els.sumTotal.textContent = order.length;
    var pct = order.length ? Math.round(score/order.length*100) : 0;
    els.sumPct.textContent = pct + '%';
    var verdict;
    if(pct === 100) verdict = 'Усі питання цього бліцу — правильно! Так тримати.';
    else if(pct >= 70) verdict = 'Непогано, але над рештою варто ще попрацювати.';
    else verdict = 'Ще є над чим працювати — повтори ці теми і спробуй бліц ще раз.';
    els.sumVerdict.textContent = verdict;
    els.sumMastered.textContent = mastered + (mastered === 1 ? ' питання вивчено й прибрано з помилок.' : ' питань вивчено й прибрано з помилок.');
    showView('summary');
  }

  els.btnAgain.addEventListener('click', function(){
    refreshSelectView();
    showView('select');
  });

  refreshSelectView();
})();
