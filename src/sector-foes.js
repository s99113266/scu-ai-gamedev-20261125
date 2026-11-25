export const TURRET=7, SAW=8;

export const edgeScroll=age=>Math.floor(age*23);
// Mount rows sampled from solid roof areas in the repeating edge textures.
const roofRows={"2": [[336, 564], [60, 672]], "3": [[228, 240, 384, 576, 588, 600, 612, 684], [228, 240, 288, 300, 312, 324, 384, 456, 468, 480, 492, 564, 576, 588, 600, 612]]};

export function addRoofTurret(scene,right){
  const scroll=edgeScroll(scene.age);
  const side=right?1:0;
  const row=Math.max(...roofRows[scene.stage][side].map(y=>y+720*Math.floor((-20-scroll-y)/720)));
  addSectorFoe(scene,TURRET,right?454:26);
  const turret=scene.foes.at(-1);
  turret.roofY=row;
  turret.y=row+scroll;
}

export function addSectorFoe(scene,kind,x){
  const hp=kind===TURRET?8:4;
  scene.foes.push({kind,x,base:x,y:-20,hp,max:hp,radius:kind===TURRET?15:13,fire:2,angle:Math.PI/2,age:0});
  scene.seen++;scene.total++;
}

export function moveSectorFoe(scene,f,dt){
  f.age+=dt;
  if(f.kind===SAW){
    f.y+=45*dt;
    f.x=f.base+Math.sin(f.age*.9)*34;
    f.angle+=3*dt;
    return;
  }
  f.y=f.roofY+edgeScroll(scene.age);
  f.angle=Math.atan2(scene.y-f.y,scene.x-f.x);
  f.fire-=dt;
  if(f.fire<=0 && f.y>20 && f.y<scene.y){
    const dx=Math.cos(f.angle),dy=Math.sin(f.angle);
    scene.hostile.push({x:f.x+17*dx,y:f.y+17*dy,vx:160*dx,vy:160*dy,missile:true});
    f.fire=2.9;
  }
}

export function drawSaw(g,f){
  const {x,y,angle}=f;
    g.fillStyle(0xc1cbd3);
    for(let i=0;i<10;i++){
      const a=angle+i*Math.PI/5;
      g.fillTriangle(x,y,x+16*Math.cos(a),y+16*Math.sin(a),x+10*Math.cos(a+.55),y+10*Math.sin(a+.55));
    }
    g.fillStyle(0x556572);g.fillCircle(x,y,8);
    g.fillStyle(0xf2a552);g.fillCircle(x,y,3);
}
