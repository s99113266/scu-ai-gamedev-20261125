
export function moveRaider(f, dt, player) {
  if (f.state === 'dash') {
    f.x += f.vx * dt;
    f.y += f.vy * dt;
  } else if (f.y < f.stationY) {
    f.y = Math.min(f.stationY, f.y + 210 * dt);
  } else {
    f.state = 'aim';
    f.timer -= dt;
    const angle = Math.atan2(player.y - f.y, player.x - f.x);
    f.vx = Math.cos(angle) * 455;
    f.vy = Math.sin(angle) * 455;
    if (f.timer <= 0) f.state = 'dash';
  }
}

export function raiderFormation(count, width, random = Math.random) {
  const ranks = Array.from({length:count}, (_, i) => i);
  for (let i=count-1; i>0; i--) {
    const j=Math.floor(random()*(i+1));
    [ranks[i],ranks[j]]=[ranks[j],ranks[i]];
  }
  return ranks.map((rank,i)=>{
    const angle=count===1 ? Math.PI/2 : Math.PI*i/(count-1);
    const radius=width*.43;
    const stationY=265-radius*Math.sin(angle);
    return {kind:3,x:width/2+radius*Math.cos(angle),y:stationY-300,stationY,
      hp:3,max:3,radius:12,state:'approach',timer:.8+rank*.19+random()*.1,fire:Infinity};
  });
}

export function makeScout(x,y,player) {
  const launch=Math.atan2(player.y-y,player.x-x);
  return {kind:6,x,y,launch,heading:launch,hp:2,max:2,radius:9,fire:Infinity};
}

export function moveScout(f,dt,player) {
  const target=Math.atan2(player.y-f.y,player.x-f.x);
  // Keep the turn inside the launch direction's forward half-plane.
  const relative=Math.atan2(Math.sin(target-f.launch),Math.cos(target-f.launch));
  const goal=f.launch+Math.max(-1.18,Math.min(1.18,relative));
  f.heading+=Math.max(-2.3*dt,Math.min(2.3*dt,goal-f.heading));
  f.x+=Math.cos(f.heading)*330*dt;
  f.y+=Math.sin(f.heading)*330*dt;
}

