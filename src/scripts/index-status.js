(function(){
  "use strict";
  var cards = Array.prototype.slice.call(document.querySelectorAll('.card.topic[data-topic]'));
  var total = cards.length;
  var doneCount = 0, progressCount = 0;

  cards.forEach(function(card){
    var id = card.getAttribute('data-topic');
    var pill = card.querySelector('.pill');
    var hasProgress = false, hasBest = false;
    try{ hasProgress = !!localStorage.getItem('pdr_t'+id+'_progress_v1'); }catch(e){ /* ignore */ }
    try{ hasBest = !!localStorage.getItem('pdr_t'+id+'_best_v1'); }catch(e){ /* ignore */ }

    if(hasProgress){
      progressCount++;
      pill.className = 'pill pill-inprogress';
      pill.textContent = 'У процесі';
    } else if(hasBest){
      doneCount++;
      pill.className = 'pill pill-done';
      pill.textContent = 'Завершено';
    } else {
      pill.className = 'pill pill-notstarted';
      pill.textContent = 'Не почато';
    }
  });

  var pct = total ? Math.round(doneCount/total*100) : 0;
  var fill = document.getElementById('overall-fill');
  var text = document.getElementById('overall-text');
  if(fill) fill.style.width = pct + '%';
  if(text){
    text.textContent = doneCount + '/' + total + ' тем завершено' +
      (progressCount ? ' · ' + progressCount + ' у процесі' : '');
  }

  var mistakesCount = document.getElementById('mistakes-count');
  if(mistakesCount && window.PDRMistakes){
    var n = window.PDRMistakes.count();
    mistakesCount.textContent = n ? (n + ' питань чекають на повторення') : 'Немає жодної помилки — так тримати';
  }

  var examPill = document.getElementById('exam-last-pill');
  if(examPill){
    try{
      var raw = localStorage.getItem('pdr_exam_last_v1');
      var r = raw ? JSON.parse(raw) : null;
      if(r){
        examPill.hidden = false;
        examPill.className = 'pill ' + (r.passed ? 'pill-done' : 'pill-notstarted');
        examPill.textContent = r.score + '/' + r.total + (r.passed ? ' · складено' : ' · не складено');
      }
    }catch(e){ /* ignore */ }
  }
})();
