export const deckHeight=240;

const barrelLength=17;

export function createTurrets(){
  return [174,306].map((x,index)=>({x,y:185,angle:Math.PI/2,cooldown:1+index*.65,rounds:4,flash:0}));
}

function fireTurrets(scene,dt){
  for(const gun of scene.bosses[0].turrets){
    const target=Math.atan2(scene.y-gun.y,scene.x-gun.x);
    const error=Math.atan2(Math.sin(target-gun.angle),Math.cos(target-gun.angle));
    gun.angle+=Math.max(-1.6*dt,Math.min(1.6*dt,error));
    gun.flash=Math.max(0,gun.flash-dt);
    gun.cooldown-=dt;
    if(gun.cooldown>0)continue;
    const dx=Math.cos(gun.angle),dy=Math.sin(gun.angle);
    scene.hostile.push({x:gun.x+barrelLength*dx,y:gun.y+barrelLength*dy,vx:230*dx,vy:230*dy});
    gun.flash=.08;
    gun.rounds--;
    gun.cooldown=gun.rounds===0?1.75:.20;
    if(gun.rounds===0)gun.rounds=4;
  }
}

export function drawTurrets(g,turrets){
  for(const gun of turrets){
    const tipX=gun.x+barrelLength*Math.cos(gun.angle),tipY=gun.y+barrelLength*Math.sin(gun.angle);
    g.fillStyle(0x17232d);g.fillCircle(gun.x,gun.y,11);
    g.fillStyle(0x77848b);g.fillCircle(gun.x,gun.y-1,9);
    g.fillStyle(0x495764);g.fillCircle(gun.x,gun.y,7);
    g.lineStyle(7,0x192531);g.lineBetween(gun.x,gun.y,tipX,tipY);
    g.lineStyle(3,0xc39a65);g.lineBetween(gun.x,gun.y-1,tipX,tipY-1);
    if(gun.flash>0){
      g.fillStyle(0xffa438);g.fillCircle(tipX,tipY,5);
      g.fillStyle(0xfff1af);g.fillCircle(tipX,tipY,3);
    }
  }
}

export function advanceCarrier(scene,dt){
  fireTurrets(scene,dt);
  scene.launchIn-=dt;
  if(scene.launchIn<=0){
    scene.launchIn=7;
    for(const x of [124,356]){
      scene.foes.push({kind:0,x,y:deckHeight,hp:3,max:3,radius:13,fire:1.4,summoned:true});
      scene.seen++;scene.total++;
    }
  }
  scene.bossFire-=dt;
  if(scene.bossFire>0)return;
  scene.salvo++;
  scene.bossFire=2.3;
  if(scene.salvo%2){
    for(const x of [68,412]){
      for(let i=-4;i<=4;i++){
        const angle=i*.16+(x<240?.26:-.26);
        scene.hostile.push({x,y:deckHeight,vx:170*Math.sin(angle),vy:170*Math.cos(angle)});
      }
    }
  }else{
    const gap=(scene.salvo*31)%360+60;
    for(let x=12;x<480;x+=24){
      if(Math.abs(x-gap)>42)scene.hostile.push({x,y:deckHeight,vx:0,vy:215});
    }
  }
}

export function drawCarrierHealth(g,b){
  g.fillStyle(0x1a232a);g.fillRect(12,8,456,6);
  g.fillStyle(0xff945e);g.fillRect(12,8,456*b.hp/b.max,6);
}
