(function(){
  "use strict";
  /* stratified draw modeled on the real category-B exam: 20 questions, 20 min, max 2 wrong to pass */
  var CATEGORIES = [
    {id:"termsGeneral", title:"Терміни та загальні положення", topics:["01"], weight:2},
    {id:"participantDuties", title:"Обов`язки і права учасників руху", topics:["02","03","04","05","06","07"], weight:1},
    {id:"signs", title:"Дорожні знаки", topics:["33"], weight:4},
    {id:"markings", title:"Дорожня розмітка", topics:["34"], weight:1},
    {id:"trafficControl", title:"Регулювання дорожнього руху", topics:["08_1","08_2"], weight:2},
    {id:"speedManeuvers", title:"Швидкість, дистанція, обгін, маневрування", topics:["10","11","12","13","14"], weight:3},
    {id:"intersections", title:"Перехрестя і пішохідні переходи", topics:["16_1","16_2","17","18","20"], weight:3},
    {id:"stoppingLighting", title:"Зупинка, стоянка, освітлення", topics:["15","19"], weight:1},
    {id:"transportCargo", title:"Перевезення пасажирів/вантажу, буксирування", topics:["21","22","23","25"], weight:1},
    {id:"docsAndSpecial", title:"Документи, техстан, право, спецрежими руху", topics:["24","26","27","28","29","30","31","32","36"], weight:1},
    {id:"safetyFirstAid", title:"Безпека руху, перша допомога, етика, європротокол", topics:["09","35","37","38","39"], weight:1}
  ];
  var TOTAL = 20;
  var sum = 0;
  CATEGORIES.forEach(function(c){ sum += c.weight; });
  if(sum !== TOTAL){ console.warn('PDR_EXAM_CONFIG: category weights sum to ' + sum + ', expected ' + TOTAL); }

  window.PDR_EXAM_CONFIG = {
    TOTAL: TOTAL,
    MAX_WRONG_TO_PASS: 2,
    TIME_LIMIT_SEC: 20*60,
    RECENT_EXAMS_TO_AVOID: 3,
    CATEGORIES: CATEGORIES
  };
})();
