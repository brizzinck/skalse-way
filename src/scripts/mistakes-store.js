(function(){
  "use strict";
  var LS_KEY = 'pdr_mistakes_v1';
  var MASTERY_STREAK = 4; /* more than 3 correct in a row during blitz removes the question from the pool */

  /* the 41 official topic ids, in a fixed order - stored entries keep a 1-based
     numeric topic_id into this list instead of repeating a string like "16_2" every time */
  var TOPIC_ORDER = [
    "01","02","03","04","05","06","07","08_1","08_2","09","10","11","12","13","14","15",
    "16_1","16_2","17","18","19","20","21","22","23","24","25","26","27","28","29","30",
    "31","32","33","34","35","36","37","38","39"
  ];
  function topicNumId(topicId){
    var n = TOPIC_ORDER.indexOf(topicId);
    return n === -1 ? 0 : n + 1;
  }
  function topicIdOf(numId){ return TOPIC_ORDER[numId - 1]; }

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
  /* stored entry shape: {topic_id: <number>, question_id: <number>, correct_streak: <number>} -
     no strings, and no copy of the question itself */
  function findIndex(list, topicNum, questionId){
    for(var i=0;i<list.length;i++){
      if(list[i].topic_id === topicNum && list[i].question_id === questionId) return i;
    }
    return -1;
  }
  function toPublic(e){
    return {topicId: topicIdOf(e.topic_id), qid: e.question_id, correctStreak: e.correct_streak};
  }

  function recordWrong(topicId, questionId){
    var list = load();
    var topicNum = topicNumId(topicId);
    var idx = findIndex(list, topicNum, questionId);
    if(idx === -1) list.push({topic_id: topicNum, question_id: questionId, correct_streak: 0});
    else list[idx].correct_streak = 0;
    save(list);
  }

  function recordCorrect(topicId, questionId){
    var list = load();
    var idx = findIndex(list, topicNumId(topicId), questionId);
    if(idx === -1) return {removed:false, streak:0};
    list[idx].correct_streak++;
    if(list[idx].correct_streak >= MASTERY_STREAK){
      list.splice(idx,1);
      save(list);
      return {removed:true, streak:MASTERY_STREAK};
    }
    save(list);
    return {removed:false, streak:list[idx].correct_streak};
  }

  function get(topicId, questionId){
    var list = load();
    var idx = findIndex(list, topicNumId(topicId), questionId);
    return idx === -1 ? null : toPublic(list[idx]);
  }

  function removeEntry(topicId, questionId){
    var topicNum = topicNumId(topicId);
    save(load().filter(function(e){ return !(e.topic_id === topicNum && e.question_id === questionId); }));
  }

  function all(){ return load().map(toPublic); }
  function count(){ return load().length; }
  function byTopic(){
    var map = {};
    all().forEach(function(e){
      if(!map[e.topicId]) map[e.topicId] = [];
      map[e.topicId].push(e);
    });
    return map;
  }

  window.PDRMistakes = {
    recordWrong: recordWrong,
    recordCorrect: recordCorrect,
    get: get,
    removeEntry: removeEntry,
    all: all,
    count: count,
    byTopic: byTopic,
    MASTERY_STREAK: MASTERY_STREAK
  };
})();
