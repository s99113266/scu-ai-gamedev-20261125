export function bossLineup(phase, score, rules){
  if(phase==='mini')return score>rules.doubleMiniAbove?['mini','mini']:['mini'];
  if(phase!=='final')return [];
  if(score>rules.doubleFinalAbove)return ['final','final'];
  if(score>rules.mixedAbove)return ['mini','final'];
  return ['final'];
}
