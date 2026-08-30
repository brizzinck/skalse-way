(function(){
  "use strict";
  var cache = {};
  function loadTopic(topicId){
    if(!cache[topicId]){
      var base = window.PDR_DATA_BASE || 'src/data/';
      cache[topicId] = fetch(base + topicId + '.json').then(function(r){ return r.json(); });
    }
    return cache[topicId];
  }
  window.PDRTopicLoader = { loadTopic: loadTopic };
})();
