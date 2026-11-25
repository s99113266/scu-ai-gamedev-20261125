const trail=135, speed=560;

export function updateDrill(scene,dt,width,height,random=Math.random){
  if(!scene.crossDrill){
    if(scene.age<scene.nextDrill)return;
    const direction=random()<.5?1:-1;
    scene.crossDrill={direction,x:direction===1?-24:width+24,
      y:Math.max(35,Math.min(height-35,scene.y+(random()-.5)*150)),warning:.9,time:0,hit:false};
  }
  const d=scene.crossDrill;
  d.time+=dt;
  if(d.warning>0){d.warning-=dt;return;}
  const previous=d.x;
  d.x+=d.direction*speed*dt;
  const ahead=(scene.x-d.x)*d.direction;
  const crossed=(scene.x-previous)*d.direction;
  const dy=Math.abs(scene.y-d.y);
  if(!d.hit && ((ahead<=28 && crossed>=-14 && dy<17)||(ahead<=0 && ahead>=-trail && dy<9))){
    d.hit=true;scene.hurt();
  }
  if(d.x>width+trail+30 || d.x< -trail-30){
    scene.crossDrill=null;
    scene.nextDrill=scene.age+5+random()*6;
  }
}

export function drawDrill(g,d,width){
  if(!d)return;
  const {x,y,direction:s}=d;
  if(d.warning>0){
    const edge=s===1?0:width;
    g.lineStyle(1,0xe59bff,.48);g.lineBetween(0,y,width,y);
    g.fillStyle(0xf3bbff,.7+.3*Math.sin(d.time*24));
    g.fillTriangle(edge,y-9,edge+14*s,y,edge,y+9);
    return;
  }
  for(const [thickness,color,alpha] of [[15,0x8029df,.30],[6,0xbf55ff,.85],[2,0xf9d3ff,1]]){
    g.lineStyle(thickness,color,alpha);g.lineBetween(x-s*trail,y,x,y);
  }
  for(let i=1;i<=4;i++){
    const offset=(i*32+d.time*125)%trail;
    g.lineStyle(2,0xc876ff,1-offset/trail);g.strokeEllipse(x-s*offset,y,5,10+offset*.12);
  }
  g.fillStyle(0x33263f);g.fillRect(x-12,y-9,24,18);
  g.fillStyle(0xc9a9dd);g.fillTriangle(x-5*s,y-11,x+24*s,y,x-5*s,y+11);
  for(let i=0;i<3;i++){
    const pos=(i*8+d.time*32)%24;
    const half=(24-pos)*.37;
    g.lineStyle(2,0x645075);g.lineBetween(x+s*(pos-5),y-half,x+s*pos,y+half);
  }
}
