(function(){
  "use strict";
  var LS_KEY = 'pdr_mistakes_v1';
  var MASTERY_STREAK = 4; /* more than 3 correct in a row during blitz removes the question from the pool */

  function load(){
    try{
      var raw = localStorage.getItem(LS_KEY);
      if(!raw) return [];
      var list = JSON.parse(raw);
      return Array.isArray(list) ? list : [];
    }catch(e){ return []; }
  }
  function save(list){
    try{ localStorage.setItem(LS_KEY, JSON.stringify(list)); }catch(e){ /* ignore */ }
  }
  function findIndex(list, topicId, qid){
    for(var i=0;i<list.length;i++){ if(list[i].topicId === topicId && list[i].qid === qid) return i; }
    return -1;
  }

  /* each stored entry is just {topicId, qid, correctStreak} - question content lives in src/data/, not here */
  function recordWrong(topicId, qid){
    var list = load();
    var idx = findIndex(list, topicId, qid);
    if(idx === -1){
      list.push({topicId: topicId, qid: qid, correctStreak: 0});
    } else {
      list[idx].correctStreak = 0;
    }
    save(list);
  }

  function recordCorrect(topicId, qid){
    var list = load();
    var idx = findIndex(list, topicId, qid);
    if(idx === -1) return {removed:false, streak:0};
    list[idx].correctStreak++;
    if(list[idx].correctStreak >= MASTERY_STREAK){
      list.splice(idx,1);
      save(list);
      return {removed:true, streak:MASTERY_STREAK};
    }
    save(list);
    return {removed:false, streak:list[idx].correctStreak};
  }

  function removeEntry(topicId, qid){
    save(load().filter(function(e){ return !(e.topicId === topicId && e.qid === qid); }));
  }

  function all(){ return load(); }
  function count(){ return load().length; }
  function byTopic(){
    var list = load();
    var map = {};
    list.forEach(function(e){
      if(!map[e.topicId]) map[e.topicId] = [];
      map[e.topicId].push(e);
    });
    return map;
  }

  window.PDRMistakes = {
    recordWrong: recordWrong,
    recordCorrect: recordCorrect,
    removeEntry: removeEntry,
    all: all,
    count: count,
    byTopic: byTopic,
    MASTERY_STREAK: MASTERY_STREAK
  };
})();
