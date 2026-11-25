export function updateSectorWaves(scene, balance){
  const sector=balance.sectors[scene.stage-1];
  const clock=scene.age%balance.cycleSeconds;
  const finalPush=scene.stage===3 && scene.age>=sector.durationSeconds-balance.exitSurgeSeconds;
  const recovering=!finalPush && clock>=sector.pursuitSeconds && clock<sector.pursuitSeconds+sector.restSeconds;
  if(recovering){
    const cycle=Math.floor(scene.age/balance.cycleSeconds);
    if(scene.lastResupplyCycle!==cycle && (cycle%3===0 || (cycle+1)%balance.pickup.restCyclesPerRepair===0)){
      scene.parts.push({x:scene.x,y:Math.max(20,scene.y-120),weapon:cycle%3===0});
      scene.lastResupplyCycle=cycle;
    }
    scene.routeBeat='追擊暫歇';
    return;
  }
  const pursuit=clock<sector.pursuitSeconds;
  scene.routeBeat=finalPush?'出口封鎖':pursuit?'追擊中':'巡航交火';
  if(scene.age<scene.spawnAt)return;
  if(scene.stage===1 && scene.age<20){
    scene.spawn(true);
    scene.spawnAt=scene.age+4;
    return;
  }
  scene.spawn();
  const interval=finalPush?balance.exitWaveIntervalSeconds:pursuit?sector.pursuitWaveIntervalSeconds:sector.cruiseWaveIntervalSeconds;
  scene.spawnAt=scene.age+interval;
}
