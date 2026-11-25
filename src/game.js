import {TURRET,SAW,edgeScroll,addRoofTurret,addSectorFoe,moveSectorFoe,drawSaw} from './sector-foes.js';
import {updateDrill,drawDrill} from './cross-drill.js';
import {advanceCarrier,createTurrets,drawTurrets,drawCarrierHealth,deckHeight} from './carrier.js';
import { setEngine, sound, toggleAudio, unlockAudio, setMusic, toggleMusic } from './audio.js';
import { bossLineup } from './encounter.js';
import Phaser from 'phaser';
import balance from '../config/game-balance.json';
import { updateSectorWaves } from './sector.js';
import { Defense } from './defense.js';
import { moveRaider, raiderFormation, makeScout, moveScout } from './combat.js';

const W=480, H=720, cyan=0x78f8d4, orange=0xff935e;
const panel=document.querySelector('#panel'), hud=document.querySelector('#hud');

const clamp=Phaser.Math.Clamp;
const rand=Phaser.Math.Between;
const laserCapacity=balance.laser.capacitySeconds;
const laserStages=balance.laser.stages;
const fadeSeconds=balance.laser.fadeSeconds;
const enemyTextures=['patrol','crosswing','runner','raider','armor','rock','hidden_scout'];
const shieldDuration=3;
const shieldMounts=[-1,1].map(side=>{
  const angle=-side*Math.PI/6;
  return {side,x:side*32,y:-11,angle,cos:Math.cos(angle),sin:Math.sin(angle)};
});
function hitsShield(x,y){
  return shieldMounts.some(mount=>{
    const dx=x-mount.x,dy=y-mount.y;
    return Math.abs(dx*mount.cos+dy*mount.sin)<11 && Math.abs(dy*mount.cos-dx*mount.sin)<26;
  });
}
const ammoStats={pulse:{rate:1,damage:1},lance:{rate:1.75,damage:0.8},crescent:{rate:.85,damage:2}};
const routes=['homeport','shipyard','blockade'];
class Flight extends Phaser.Scene {
  preload(){
    this.load.image('side-shield','/assets/images/side-shield.png');
    for(const key of ['roof-mount','roof-launcher'])this.load.image(key,'/assets/images/'+key+'.png');
    this.load.image('carrier-deck','/assets/images/carrier-deck.png');
    this.load.spritesheet('pulse','/assets/vfx/pulse.png',{frameWidth:12,frameHeight:20});
    for(const key of ['laser-muzzle','laser-muzzle-magenta']){
      this.load.spritesheet(key,'/assets/vfx/'+key+'.png',{frameWidth:32,frameHeight:32});
    }
    for(const key of ['mini-closed','mini-open','flagship-closed','flagship-left','flagship-right'])this.load.image(key,'/assets/images/'+key+'.png');
    for(const route of routes)for(const layer of ['back','edge']){
      const key=route+'-'+layer;
      this.load.image(key,'/assets/images/'+key+'.png');
    }
    for(const id of [...enemyTextures,'repair','weapon'])this.load.image(id,'/assets/images/'+id+'-base.png');
    this.load.image('scout','/assets/images/scout-base.png');
    this.load.spritesheet('boss-impact','/assets/vfx/impact.png',{frameWidth:48,frameHeight:48});
  }
  create(){
    const blade=this.textures.createCanvas('crescent-blade',32,24);
    const ctx=blade.context;
    const metal=ctx.createLinearGradient(0,2,0,19);
    metal.addColorStop(0,'#fff9cb');
    metal.addColorStop(.35,'#ffd573');
    metal.addColorStop(1,'#bb642e');
    ctx.fillStyle=metal;
    ctx.beginPath();
    ctx.moveTo(1,20);
    ctx.bezierCurveTo(3,-3,29,-3,31,20);
    ctx.bezierCurveTo(22,8,10,8,1,20);
    ctx.fill();
    blade.refresh();
    this.routeLayers=['back','edge'].map(layer=>this.add.tileSprite(0,0,W,H,'homeport-'+layer).setOrigin(0));
    this.carrierDeck=this.add.image(0,0,'carrier-deck').setOrigin(0).setVisible(false);
    this.g=this.add.graphics();
    this.enemyImages=this.add.group();
    this.pulseImages=this.add.group();
    this.muzzle=this.add.image(0,0,'laser-muzzle').setDepth(3).setVisible(false);
    this.bossImages=Array.from({length:2},()=>this.add.image(0,0,'mini-closed').setVisible(false));
    this.overlay=this.add.graphics().setDepth(2);
    this.wreckage=[];
    const hull=this.textures.get('scout');
    for(let row=0;row<2;row++)for(let col=0;col<3;col++){
      const left=Math.floor(col*40/3),right=Math.floor((col+1)*40/3);
      hull.add('debris-'+row+'-'+col,0,left,row*20,right-left,20);
    }
    this.sideShields=shieldMounts.map(mount=>this.add.image(0,0,'side-shield').setFlipX(mount.side===1).setRotation(mount.angle).setDepth(2).setVisible(false));
    this.scout=this.add.image(0,0,'scout','__BASE').setVisible(false);
    this.anims.create({key:'boss-impact',frames:this.anims.generateFrameNumbers('boss-impact',{start:0,end:7}),frameRate:17});
    this.gear=Object.entries({crescent:['半月刀',50],lance:['紫色長彈',50],shields:['左右護盾',16]}).map(([id,[label,price]])=>{
      const button=document.getElementById(id);
      button.onclick=()=>{this.equip(id,price);button.blur();};
      return {id,label,price,button};
    });
    const musicButton=document.querySelector('#music');
    musicButton.onclick=()=>{
      const muted=toggleMusic();
      musicButton.textContent=muted?'配樂：關':'配樂：開';
      musicButton.setAttribute('aria-pressed',String(!muted));
      musicButton.blur();
    };
    const audioButton=document.querySelector('#audio');
    audioButton.onclick=()=>{
      const muted=toggleAudio();
      audioButton.textContent=muted?'音效：關':'音效：開';
      audioButton.setAttribute('aria-pressed',String(!muted));
      audioButton.blur();
    };
    this.mode='title'; this.t=0; this.fx=[];
    this.stars=Array.from({length:90},()=>[rand(0,W),rand(0,H),rand(1,3)]);
    this.keys=this.input.keyboard.createCursorKeys();
    this.input.keyboard.on('keydown-SPACE', e=>{
      if(!e.repeat && this.mode==='play' && !this.def.active && this.energy>0)this.pressLaser();
    });
    const shieldKey=document.querySelector('#shield-key');
    shieldKey.onchange=()=>shieldKey.blur();
    this.input.keyboard.on('keydown', e=>{
      if(e.code===shieldKey.value && !e.repeat){this.activateShield();return;}
      if(e.repeat || this.mode!=='play' || !this.def.active) return;
      const owner=this.def.frames[0]?.owner;
      const result=this.def.input(this.t,e.code);
      if(result==='correct'||result==='evade'){
        sound(result==='evade'?'counter':'correct');
        this.burst(this.x,this.y-30,cyan);
        this.cameras.main.shake(90,0.004,true);
      }
      if(result==='evade'){
        const boss=this.bosses.find(b=>b.id===owner);
        if(boss){
          const impact=this.add.sprite(boss.x,boss.y,'boss-impact').setOrigin(.5).setScale(1.65).setDepth(4);
          impact.play('boss-impact').once('animationcomplete',()=>impact.destroy());
          boss.flashUntil=this.t+.14;
          this.cameras.main.shake(110,.005,true);
          this.damage(boss,2);

        }
      }
      if(result==='hit') this.hurt(true);
      if(!this.def.active && this.mode==='play') panel.replaceChildren();
    });
    document.querySelector('#start').onclick=()=>this.startFlight(false);
    document.querySelector('#drill').onclick=()=>this.startFlight(true);
    this.screen('孤機','你是最後一名軍人。突破封鎖線，逃離戰區。');
  }
  screen(title,msg,actions=[]){
    panel.replaceChildren();
    const heading=document.createElement('strong'); heading.textContent=title;
    panel.append(heading,document.createTextNode(msg));
    for(const [label,fn] of actions){
      const b=document.createElement('button'); b.textContent=label; b.onclick=fn; panel.append(b);
    }
  }
  activateShield(){
    if(this.mode!=='play' || this.def.active || this.shieldSeconds || this.shieldStock<1)return;
    this.shieldStock--;
    this.shieldSeconds=shieldDuration;
    sound('pickup');
  }
  gearPrice(id,basePrice){
    return id==='shields'?basePrice:basePrice+10*(this.weaponLevel-1);
  }
  equip(id,basePrice){
    const price=this.gearPrice(id,basePrice);
    if(!['play','shop'].includes(this.mode))return;
    if(id==='shields'){
      if(this.cash<price)return;
      this.cash-=price;this.shieldStock++;
    }else{
      if(!this[id]){
        if(this.cash<price)return;
        this.cash-=price;this[id]=true;
      }
      this.ammo=this.ammo===id?'pulse':id;
    }
    sound('pickup');
    if(this.mode==='shop')this.shop();
  }
  startFlight(drill){
    this.victoryCue?.stop();
    this.victoryCue=null;
    unlockAudio();
    Object.assign(this,{drill,ammo:'pulse',crescent:false,lance:false,shieldSeconds:0,shieldStock:0,beam:false,laserLevel:0,envelope:0,fadeWidth:0,energy:laserCapacity/2,hp:balance.player.maxHp,cash:balance.economy.startingCash,xpByAmmo:{pulse:0,crescent:0,lance:0},rapidSeconds:0,stage:1,elapsed:0,total:0,kills:0,score:0,t:0});
    document.activeElement?.blur?.(); this.enter(drill?'final':'sector');
  }
  enter(phase){
    setEngine(false);
    setMusic(phase==='sector'?'flight':phase==='mini'?'intercept':'siege');
    const route=phase==='final'?'blockade':routes[this.stage-1];
    this.routeLayers[0].setTexture(route+'-back');
    this.routeLayers[1].setTexture(route+'-edge');
    this.phase=phase; this.mode='play'; this.age=0; this.wave=0; this.spawnAt=balance.firstWaveDelaySeconds; this.lastResupplyCycle=-1; this.routeBeat='' ;
    this.launchIn=3;this.salvo=0;this.seen=0; this.down=0; this.resetField();
    const types=this.drill?['mini','final']:bossLineup(phase,this.score,balance.score);
    const durability=types.length===2?balance.boss.pairedHp:balance.boss.hp;
    this.bosses=types.map((type,slot)=>({
      id:type+slot,type,slot,hp:durability[type],max:durability[type],
      x:types.length===2?140+slot*200:240,y:type==='mini'?178:92,paired:types.length===2
    }));
    this.checkpoint=Object.fromEntries(['phase','stage','hp','energy','beam','laserLevel','envelope','fadeWidth','cash','ammo','crescent','lance','shieldSeconds','shieldStock','xpByAmmo','rapidSeconds','elapsed','total','kills','score'].map(k=>[k,this[k]]));
    panel.replaceChildren();
  }
  resetField(){
    for(const piece of this.wreckage)piece.destroy();
    this.wreckage=[];
    Object.assign(this,{x:240,y:610,foes:[],shots:[],hostile:[],parts:[],fx:[],pulse:0,inv:2,fire:0,bossFire:1,supplyAt:balance.boss.supplyIntervalSeconds,supplyCount:0});
    this.crossDrill=null;this.nextDrill=rand(3,6);
    this.def=new Defense(); this.def.rest(this.t);
  }
  burst(x,y,color){
    for(let i=0;i<14;i++){
      const a=Math.random()*Math.PI*2,v=rand(40,160);
      this.fx.push({x,y,vx:Math.cos(a)*v,vy:Math.sin(a)*v,color,life:.32});
    }
  }
  hurt(forced=false){
    if(this.mode!=='play' || (!forced && this.inv>0))return;
    sound('damage');
    this.hp--; this.inv=balance.player.invincibleSeconds; this.burst(this.x,this.y,orange);
    if(this.hp<=0){
      this.mode='dying';this.deathAge=0;
      setEngine(false);setMusic(null);sound('blast',.7);
      panel.replaceChildren();
      this.cameras.main.shake(230,.012);
      for(let row=0;row<2;row++)for(let col=0;col<3;col++){
        const dx=(col-1)*13,dy=(row-.5)*20;
        const piece=this.add.image(this.x+dx,this.y+dy,'scout','debris-'+row+'-'+col).setDepth(4);
        piece.vx=dx*6+rand(-24,24);piece.vy=dy*8+rand(-30,10);piece.spin=rand(-6,6);
        this.wreckage.push(piece);
      }
    }
  }
  updateWreckage(dt){
    const previous=this.deathAge;
    this.deathAge+=dt;
    for(const piece of this.wreckage){
      piece.x+=piece.vx*dt;piece.y+=piece.vy*dt;piece.vy+=90*dt;
      piece.rotation+=piece.spin*dt;
      piece.setAlpha(Math.min(1,Math.max(0,(1.35-this.deathAge)*2)));
    }
    if(previous<.16 && this.deathAge>=.16)this.burst(this.x+5,this.y-4,0xffdf80);
    if(this.deathAge<1.35)return;
    for(const piece of this.wreckage)piece.destroy();
    this.wreckage=[];
    this.mode='over';
    this.screen('訊號中斷','偵察機已被擊落。',[
      ['重試檢查點',()=>{Object.assign(this,this.checkpoint);this.enter(this.phase);}],
      ['重新開始',()=>this.startFlight(this.drill)]]);
  }
  shop(){
    this.mode='shop';
    const warning='航道掃描完成。';
    const actions=[];
    if(this.hp<balance.player.maxHp && this.cash>=5)actions.push(['修復 2 格 · 5 元',()=>{this.cash-=5;this.hp=Math.min(balance.player.maxHp,this.hp+2);this.shop();}]);
    actions.push(['繼續航行',()=>{
      if(this.stage===2){this.enter('mini');return;}
      this.nextSector();
    }]);
    this.screen('無人補給站',warning+'\n服務：5 元修復 2 格，剩餘資金可帶往下一站。\n資金 '+this.cash+'　耐久 '+this.hp+'/'+balance.player.maxHp+'\n',actions);
  }
  get weaponXp(){return this.xpByAmmo[this.ammo];}
  get weaponLevel(){
    return balance.weapon.thresholds.filter(minimum=>this.weaponXp>=minimum).length;
  }
  gainXp(amount){
    this.xpByAmmo={...this.xpByAmmo,[this.ammo]:Math.min(balance.weapon.thresholds.at(-1),this.weaponXp+amount)};
  }
  fireVolley(){
    sound('shot');
    const level=this.weaponLevel;
    let spacing=this.ammo==='lance'?12:level===2?22:7;
    if(this.ammo==='crescent' && level===2)spacing=36;
    for(let i=0;i<level;i++){
      const lane=i-(level-1)/2;
      const spread=this.ammo!=='lance' && level>2?lane*.075:0;
      const speed=balance.player.bulletSpeedPixelsPerSecond;
      this.shots.push({ammo:this.ammo,x:this.x+lane*spacing,y:this.y-17,
        angle:spread,trailIn:0,vx:Math.sin(spread)*speed,vy:-Math.cos(spread)*speed});
    }
  }
  nextSector(){if(this.stage===3)this.enter('final');else{this.stage++;this.enter('sector');}}
  spawn(intro=false){
    const pattern=intro?[0,0,1]:[0,3,1,4,2,5];
    const kind=pattern[this.wave++%pattern.length], base=rand(85,W-85);
    const turretInterval=this.stage===2?7:8;
    if(this.stage>=2 && this.wave%turretInterval===0)addRoofTurret(this,this.wave/turretInterval%2===0);
    if(this.stage===3 && this.wave%8===4)addSectorFoe(this,SAW,rand(55,W-55));
    if(kind===3){
      const squad=raiderFormation(rand(1,this.stage===1?Math.min(20,Math.max(2,Math.floor((this.age-20)/4))):20),W);
      this.foes.push(...squad);
      this.seen+=squad.length;this.total+=squad.length;
      return;
    }
    const count=intro?1:kind<3?3:1;
    const hp=[1,1,1,3,12,8][kind];
    for(let i=0;i<count;i++)this.foes.push({kind,x:base,y:-18-i*35,base,offset:i*.45,flightTime:0,intro,
      hp,max:hp,radius:kind>=4?25:13,state:'approach',timer:1.05,fire:intro?2.5:rand(40,125)/100});
    if(kind!==5){this.seen+=count;this.total+=count;}

  }
  weak(b){
    const side=Math.floor(this.age/2.5)%2?1:-1;
    return {x:b.x+(b.type==='final'?side*27:0),y:b.y+12,open:this.age%2.5>1.1};
  }
  get laser(){return laserStages[this.laserLevel];}
  pressLaser(){
    if(!this.beam){
      this.laserLevel=0;this.beam=true;this.envelope=0;this.fadeWidth=0;this.pulse=0;
    }else if(this.laserLevel<2){
      this.laserLevel++;
      this.envelope=1;
      this.pulse=Math.min(this.pulse,.15/this.laser.frequency);
    }
  }
  hitBossWithBeam(boss){
    if((boss.type!=='carrier' && (boss.y>=this.y || Math.abs(boss.x-this.x)>=40+this.beamWidth/2)) || this.age<(boss.nextBeamHit??0))return;
    const vent=this.weak(boss);
    const exposed=vent.open && Math.abs(vent.x-this.x)<8+this.beamWidth/2;
    boss.nextBeamHit=this.age+(boss.type==='mini'?.45:.6)/this.laser.frequency;
    this.damage(boss,(exposed?2:1)*this.laser.damage);
  }
  breakRock(rock){
    const roll=Math.random();
    if(roll<.35){
      const count=rand(5,30);
      for(let i=0;i<count;i++){
        const angle=Math.random()*Math.PI*2;
        const speed=rand(95,285), radius=rand(7,22);
        this.hostile.push({x:rock.x+radius*Math.cos(angle),y:rock.y+radius*Math.sin(angle),vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed});
      }
    }else if(roll<.65){
      this.foes.push(makeScout(rock.x,rock.y,this));
      this.seen++;this.total++;
    }
  }
  repelWithShield(f){
    if(!this.shieldSeconds || f.id || f.kind>=TURRET){
      f.touchingShield=false;
      return false;
    }
    const x=f.x-this.x,y=f.y-this.y;
    const contact=shieldMounts.find(m=>{
      const dx=x-m.x,dy=y-m.y;
      const edgeX=Math.max(0,Math.abs(dx*m.cos+dy*m.sin)-7);
      const edgeY=Math.max(0,Math.abs(dy*m.cos-dx*m.sin)-25);
      return edgeX*edgeX+edgeY*edgeY<=f.radius*f.radius;
    });
    if(!contact){f.touchingShield=false;return false;}
    if(!f.touchingShield){
      f.touchingShield=true;
      this.cameras.main.shake(95,.004,true);
      this.burst(this.x+contact.x,this.y+contact.y,cyan);
      this.damage(f,3);
      if(f.hp>0){
        f.recoilTime=.15;
        f.recoilX=contact.side*contact.cos*180;
        f.recoilY=contact.side*contact.sin*180;
      }
    }
    return true;
  }
  damage(target,amount){
    if(!target.id){
      if(!this.foes.includes(target))return;
      target.hp-=amount;
      if(target.hp>0){this.burst(target.x,target.y,0xffd090);return;}
      sound('blast');
      this.foes.splice(this.foes.indexOf(target),1);
      if(target.kind===5)this.breakRock(target);
      if(target.kind!==5){this.score+=target.kind===4?balance.score.armor:balance.score.enemy;this.kills++;this.down++;this.cash+=target.kind===4?balance.economy.armorBounty:balance.economy.enemyBounty;this.gainXp(target.kind===4?balance.weapon.armoredKillXp:balance.weapon.killXp);}
      if(target.summoned){
        const roll=Math.random();
        if(roll<.5)this.parts.push({x:target.x,y:target.y,weapon:roll<.25});
      }else if(target.kind===4 && Math.random()<balance.pickup.armoredModuleChance)this.parts.push({x:target.x,y:target.y,weapon:true});
      else if(Math.random()<balance.pickup.repairDropChance)this.parts.push({x:target.x,y:target.y});
    }else{
      if(!this.bosses.includes(target))return;
      target.hp-=target.type==='carrier'?amount*.5:amount;
      if(target.hp<=0){
        this.bosses=this.bosses.filter(b=>b!==target);
        this.def.removeOwner(target.id,this.t);
        sound('blast',.65);
        this.score+=balance.score[target.type];
        if(target.type==='mini'){this.cash+=10;this.gainXp(balance.weapon.miniBossXp);}
        if(this.bosses.length){this.burst(target.x,target.y,orange);return;}
        const victory=sound('victory');
        if(this.phase==='final' && target.type!=='carrier' && this.score>balance.score.carrierAbove){
          this.victoryCue=victory;
          this.mode='ambush';
          this.ambushTime=0;
          setMusic(null);
          return;
        }
        if(this.phase==='mini')this.nextSector();
        else{setEngine(false);setMusic(null);this.mode='win';this.screen('已逃離戰區','得分 '+this.score+'　通關時間 '+Math.floor(this.elapsed/60)+' 分 '+Math.floor(this.elapsed%60)+' 秒　擊破率 '+Math.round(100*this.kills/Math.max(1,this.total))+'%',[['重新開始',()=>this.startFlight(this.drill)]]);}
      }
    }
    this.burst(target.x,target.y,orange);
  }
  update(_,ms){
    const dt=Math.min(ms/1000,.06);
    if(this.mode==='dying')this.updateWreckage(dt);
    else if(this.mode==='ambush'){
      const previous=this.ambushTime;
      this.ambushTime+=dt;
      if(previous<.35 && this.ambushTime>=.35){
        this.victoryCue?.stop();
        this.victoryCue=null;
        sound('threat');
        setEngine(true);
        this.screen('警告　究極 Boss 突襲','偵測到母艦逼近！');
      }
      if(this.ambushTime>=2.15){
        const hp=balance.boss.hp.carrier;
        this.bosses=[{id:'carrier0',type:'carrier',turrets:createTurrets(),slot:0,x:W/2,y:92,hp,max:hp}];
        this.launchIn=3;this.salvo=0;this.bossFire=2.3;
        this.def=new Defense();this.def.rest(this.t);
        panel.replaceChildren();
        setMusic('siege');
        this.mode='play';
      }
    }else if(this.mode==='play'){
      this.t+=dt;this.elapsed+=dt;
      if(this.def.active){

        const hits=this.def.tick(this.t);
        for(let i=0;i<hits && this.mode==='play';i++)this.hurt(true);
        if(this.mode==='play'){
          panel.replaceChildren();
          for(const f of this.def.frames){
            const card=document.createElement('div');
            card.className='command '+(f.owner.startsWith('mini')?'mini':'final');
            const title=document.createElement('b');
            title.textContent=f.owner.startsWith('mini')?'攔截艦 · 整串輸入':'指揮艦 · 逐鍵輸入';
            const letters=document.createElement('strong');
            letters.textContent=f.owner.startsWith('mini')?f.sequence.map((key,i)=>i<f.index?'✓':key.slice(3)).join('　'):f.sequence[f.index].slice(3);
            card.append(title,letters,document.createTextNode((f.index+1)+' / '+f.sequence.length+'　'+(f.deadline-this.t).toFixed(1)+' 秒'));
            panel.append(card);
          }
        }
      }else this.advance(dt);
    }
    this.draw(dt);
  }
  movePlayer(dt){
    const k=this.keys;
    this.x=clamp(this.x+(Number(k.right.isDown)-Number(k.left.isDown))*balance.player.speedPixelsPerSecond*dt,14,W-14);
    const forward=this.beam?this.laser.forward:1;
    const drift=this.beam && !k.up.isDown?this.laser.drift:0;
    this.y=clamp(this.y+(balance.player.speedPixelsPerSecond*Number(k.down.isDown)-balance.player.speedPixelsPerSecond*forward*Number(k.up.isDown)+drift)*dt,25,H-20);
  }
  advance(dt){
    this.shieldSeconds=Math.max(0,this.shieldSeconds-dt);
    this.rapidSeconds=Math.max(0,this.rapidSeconds-dt);this.age+=dt;this.inv-=dt;this.fire-=dt;
    this.movePlayer(dt);

    if(this.beam){
      this.envelope=Math.min(1,this.envelope+dt/.1);
      this.energy=Math.max(0,this.energy-dt*this.laser.drain);
      if(this.laser.shake)this.cameras.main.shake(100,this.laser.shake,false);
      this.pulse-=dt;
      if(this.pulse<=0){
        this.pulse+=.15/this.laser.frequency;
        sound('laser',1+this.laserLevel*.4);
        const power=3*this.laser.damage;
        for(const f of [...this.foes])if(f.y>=0 && f.y<this.y && Math.abs(f.x-this.x)<f.radius+this.beamWidth/2)this.damage(f,power);

      }
      for(const b of [...this.bosses])this.hitBossWithBeam(b);
      if(this.energy===0){
        this.fadeWidth=this.beamWidth;
        this.beam=false;this.envelope=1;
      }
    }else{
      this.envelope=Math.max(0,this.envelope-dt/fadeSeconds);
      if(this.fire<=0){
      this.fire=balance.player.fireIntervalSeconds/ammoStats[this.ammo].rate/(this.rapidSeconds>0?balance.weapon.rapidMultiplier:1);
      this.fireVolley();
      }
    }
    if(this.mode!=='play')return;
    if(this.phase==='sector'){
      if(this.age>=balance.sectors[this.stage-1].durationSeconds){sound('victory');this.shop();return;}
      updateSectorWaves(this,balance);
      if(this.stage===3){updateDrill(this,dt,W,H);if(this.mode!=='play')return;}
    }
    for(const f of [...this.foes]){
      if(f.recoilTime>0){
        const step=Math.min(dt,f.recoilTime);
        f.x+=f.recoilX*step;f.y+=f.recoilY*step;
        f.recoilTime-=step;
      }else if(f.kind===TURRET || f.kind===SAW)moveSectorFoe(this,f,dt);
      else if(f.kind===3)moveRaider(f,dt,this);
      else if(f.kind===6)moveScout(f,dt,this);
      else if(f.kind===1){
        f.flightTime+=dt;
        f.y+=52*dt;
        const startAngle=Math.asin((f.base-W/2)/(W/2-32));
        f.x=W/2+(W/2-32)*Math.sin(startAngle+f.flightTime*.85+f.offset);
      }else f.y+=dt*[75,0,180,0,53,88][f.kind];
      if(f.kind<TURRET){
        f.fire-=dt;
        if(f.fire<0 && f.y>0 && f.kind!==5 && f.kind!==3){this.fireEnemy(f);f.fire=f.intro?4:rand(115,195)/100;}
      }
      if(this.repelWithShield(f))continue;
      if(Math.hypot(f.x-this.x,f.y-this.y)<f.radius+8)this.hurt();
      if(this.mode!=='play')return;
    }
    this.foes=this.foes.filter(f=>f.y<H+30 && f.x>-35 && f.x<W+35 && !((f.state==='dash'||f.kind===6) && f.y< -30));
    for(const b of this.bosses)if(b.type!=='carrier')b.x=(b.paired?140+b.slot*200:W/2)+Math.sin(this.age*.8+b.slot*2)*(b.paired?48:135);
    if(this.bosses.length){
      if(this.age>=this.supplyAt){
        this.parts.push({x:rand(70,W-70),y:H*.46,weapon:this.supplyCount%2===1});
        this.supplyCount++;
        this.supplyAt=this.age+balance.boss.supplyIntervalSeconds;
      }
      if(this.def.begin(this.t,this.bosses.map(b=>b.id))){sound('warning');return;}
      if(this.bosses[0].type==='carrier')advanceCarrier(this,dt);
      else{
      this.bossFire-=dt;
      if(this.bossFire<=0){this.bossFire=1;for(const b of this.bosses)for(const vx of [-62,0,62])this.hostile.push({x:b.x,y:b.y+20,vx,vy:185});}
      }
    }
    for(const s of this.shots){
      s.x+=s.vx*dt;s.y+=s.vy*dt;
      if(s.ammo==='crescent'){
        s.trailIn-=dt;
        if(s.trailIn<=0){
          s.trailIn+=.035;
          const side=rand(-11,11), drift=rand(-20,20);
          const cos=Math.cos(s.angle),sin=Math.sin(s.angle);
          this.fx.push({x:s.x+side*cos-3*sin,y:s.y+side*sin+3*cos,
            vx:drift*cos-45*sin,vy:drift*sin+45*cos,life:.24,
            color:side<0?0xffba58:0xffe59b,radius:rand(1,2)});
        }
      }
      const f=this.foes.find(f=>Math.abs(f.x-s.x)<f.radius+(s.ammo==='crescent'?12:0) && Math.abs(f.y-s.y)<f.radius+4);
      const b=this.bosses.find(b=>b.type==='carrier'?s.y<=deckHeight:Math.abs(b.x-s.x)<43 && Math.abs(b.y-s.y)<20);
      if(f||b){s.y=-100;this.damage(f||b,ammoStats[s.ammo].damage);if(this.mode!=='play')return;}
    }
    this.shots=this.shots.filter(s=>s.y>0);
    this.advanceHostileShots(dt);
    if(this.mode!=='play')return;
    for(const p of this.parts){
      p.y+=dt*(p.weapon?110:64);
      if(Math.hypot(p.x-this.x,p.y-this.y)<24){
        sound('pickup',p.weapon?1.2:1);
        if(p.weapon){this.gainXp(balance.weapon.moduleXp);this.rapidSeconds=balance.weapon.rapidSeconds;}
        else if(this.hp<balance.player.maxHp)this.hp++;
        else this.energy=Math.min(laserCapacity,this.energy+balance.pickup.energySeconds);
        this.burst(p.x,p.y,p.weapon?0xffdf68:cyan);p.y=H+20;
      }
    }
    this.parts=this.parts.filter(p=>p.y<H);
  }
  get beamWidth(){return this.beam?(22+4*Math.sin(this.t*45))*this.laser.width*this.envelope:this.fadeWidth*this.envelope;}
  fireEnemy(f){
    if(f.intro){
      let angle=0;
      if(f.kind===1 && !f.usedAimedShot && f.y<this.y){
        angle=Math.atan2(this.x-f.x,this.y-f.y);
        f.usedAimedShot=true;
      }
      this.hostile.push({x:f.x,y:f.y,vx:135*Math.sin(angle),vy:135*Math.cos(angle)});
      return;
    }
    const roll=Math.random();
    const aim=clamp(Math.atan2(this.x-f.x,Math.max(1,this.y-f.y)),-0.85,0.85);
    const count=roll<0.32?rand(3,5):1;
    const spacing=rand(12,20)*Math.PI/180;
    for(let i=0;i<count;i++){
      const angle=aim+(i-(count-1)/2)*spacing;
      const shell=roll>0.86;
      const speed=shell?125:180;
      this.hostile.push({x:f.x,y:f.y,vx:Math.sin(angle)*speed,vy:Math.cos(angle)*speed,
        fuse:shell?rand(65,155)/100:undefined});
    }
  }
  advanceHostileShots(dt){
    // Include the four-pixel projectile radius along the bright beam.
    const width=this.beamWidth+8;
    const corridor=this.beam && new Phaser.Geom.Rectangle(this.x-width/2,-4,width,this.y-6);
    const fragments=[];
    this.hostile=this.hostile.filter(s=>{
      const fromX=s.x, fromY=s.y;
      s.x+=s.vx*dt;
      s.y+=s.vy*dt;
      if(corridor && Phaser.Geom.Intersects.LineToRectangle({x1:fromX,y1:fromY,x2:s.x,y2:s.y},corridor)){
        this.burst(s.x,s.y,cyan);
        return false;
      }
      if(this.shieldSeconds && hitsShield(s.x-this.x,s.y-this.y)){
        this.burst(s.x,s.y,cyan);return false;
      }
      if(Math.hypot(s.x-this.x,s.y-this.y)<12){this.hurt();return false;}
      if(s.y>=H+10 || s.y<=-12 || s.x<=-12 || s.x>=W+12)return false;
      if(s.fuse!==undefined && (s.fuse-=dt)<=0){
        const count=rand(5,9),offset=Math.random()*2*Math.PI;
        for(let i=0;i<count;i++){
          const angle=offset+i*2*Math.PI/count,speed=rand(95,155);
          fragments.push({x:s.x,y:s.y,vx:Math.cos(angle)*speed,vy:Math.sin(angle)*speed,fragment:true});
        }
        this.burst(s.x,s.y,orange);
        return false;
      }
      return true;
    });
    this.hostile.push(...fragments);
  }
  draw(dt){
    let g=this.g;g.clear();this.overlay.clear();this.routeLayers[0].tilePositionY=-Math.floor((this.age||0)*8);
    this.routeLayers[1].tilePositionY=-edgeScroll(this.age||0);
    for(const [x,y,r] of this.stars){g.fillStyle(0x7292a0,r*.24);g.fillCircle(x,(y+(this.age||0)*12*r)%H,r*.65);}
    if(this.mode==='title')return;
    this.scout.setPosition(Math.round(this.x),Math.round(this.y)).setVisible(this.hp>0 && (this.inv<=0||Math.floor(this.inv*10)%2===0));
    const carrier=this.bosses.find(b=>b.type==='carrier');
    this.carrierDeck.setVisible(Boolean(carrier));
    if(carrier){drawTurrets(this.overlay,carrier.turrets);drawCarrierHealth(this.overlay,carrier);}
    let used=0;
    const pool=this.enemyImages.getChildren();
    for(const f of this.foes){

      if(f.kind===TURRET){
        for(const key of ['roof-mount','roof-launcher']){
          const img=pool[used++]??this.enemyImages.create(0,0,key);
          img.setTexture(key).setPosition(Math.round(f.x),Math.round(f.y))
            .setRotation(key==='roof-launcher'?f.angle:0).setVisible(true);
        }
        continue;
      }
      if(f.kind===SAW){drawSaw(this.overlay,f);continue;}
      const key=enemyTextures[f.kind];
      const img=pool[used++]??this.enemyImages.create(0,0,key);
      const angle=f.kind===6?f.heading:f.state==='dash'?Math.atan2(f.vy,f.vx):Math.PI/2;
      img.setTexture(key).setPosition(Math.round(f.x),Math.round(f.y)).setRotation(angle-Math.PI/2).setVisible(true);
    }
    for(const part of this.parts){
      const key=part.weapon?'weapon':'repair';
      const img=pool[used++]??this.enemyImages.create(0,0,key);
      img.setTexture(key).setPosition(Math.round(part.x),Math.round(part.y)).setRotation(0).setVisible(true);
    }
    for(let i=used;i<pool.length;i++)pool[i].setVisible(false);
    g=this.overlay;
    drawDrill(g,this.crossDrill,W);
    const fxFrame=Math.floor((this.age||0)*20)%4;
    this.muzzle.setVisible(false);
    if(this.beamWidth>0 && this.mode==='play' && !this.def.active){
      const width=this.beamWidth;
      const tint=this.laserLevel===2?0xff199c:cyan;
      for(const [size,color,alpha] of [[width*1.6,tint,.22],[width,tint,.85],[width*.32,0xfff0ff,1]]){
        g.fillStyle(color,alpha);g.fillRect(this.x-size/2,0,size,this.y-14);
      }
      this.muzzle.setTexture(this.laserLevel===2?'laser-muzzle-magenta':'laser-muzzle',fxFrame).setPosition(this.x,this.y-14).setDisplaySize(width*1.1,width*1.1).setVisible(true);
    }
    for(const f of this.foes){
      if(f.state==='aim'){g.lineStyle(2,0xff715a,.65);g.lineBetween(f.x,f.y,f.x+f.vx*2,f.y+f.vy*2);}
      if(f.max>1){g.fillStyle(orange);g.fillRect(f.x-14,f.y-26,28*f.hp/f.max,2);}
    }
    for(const img of Object.values(this.bossImages))img.setVisible(false);
    for(const b of this.bosses){
      if(b.type==='carrier')continue;
      const vent=this.weak(b);
      const state=!vent.open?'closed':b.type==='mini'?'open':vent.x<b.x?'left':'right';
      const texture=(b.type==='mini'?'mini-':'flagship-')+state;
      const img=this.bossImages[b.slot].setTexture(texture).setPosition(Math.round(b.x),Math.round(b.y)).setVisible(true);
      if(this.t<b.flashUntil){
        g.fillStyle(0xffedbd,.8);g.fillCircle(b.x,b.y,10);
      }
      g.fillStyle(orange);g.fillRect(b.x-img.width/2,b.y-img.height/2-4,img.width*b.hp/b.max,3);
    }
    const pulses=this.pulseImages.getChildren();
    for(let i=0;i<this.shots.length;i++){
      const shot=this.shots[i];
      const img=pulses[i]??this.pulseImages.create(0,0,'pulse').setDepth(1);
      if(shot.ammo!=='pulse'){
        img.setVisible(false);
        if(shot.ammo==='lance'){
          g.fillStyle(0x994aff);g.fillRect(shot.x-3,shot.y-17,6,30);
          g.fillStyle(0xf3cbff);g.fillRect(shot.x-1,shot.y-16,2,24);
        }else{
          img.setTexture('crescent-blade').setOrigin(.5).setRotation(shot.angle)
            .setPosition(Math.round(shot.x),Math.round(shot.y)).setVisible(true);
        }
        continue;
      }
      img.setTexture('pulse',fxFrame).setRotation(0).setOrigin(.5,.25).setPosition(Math.round(shot.x),Math.round(shot.y)).setVisible(true);
    }
    for(let i=this.shots.length;i<pulses.length;i++)pulses[i].setVisible(false);
    for(const s of this.hostile){
      if(s.missile){
        const dx=s.vx/160,dy=s.vy/160;
        g.lineStyle(3,0xfe8449);g.lineBetween(s.x-12*dx,s.y-12*dy,s.x,s.y);
        g.lineStyle(5,0xe4e7d6);g.lineBetween(s.x-4*dx,s.y-4*dy,s.x+5*dx,s.y+5*dy);
        continue;
      }
      if(s.fuse!==undefined){
        g.lineStyle(2,0xffec94,1);g.strokeCircle(s.x,s.y,7+Math.sin(this.t*20));
      }
      g.fillStyle(s.fragment?0xffdb80:orange);g.fillCircle(s.x,s.y,s.fragment?3:4);
    }
    for(const p of this.fx){p.life-=dt;p.x+=dt*p.vx;p.y+=dt*p.vy;g.fillStyle(p.color,Math.max(0,p.life/.32));g.fillCircle(p.x,p.y,p.radius??3);}
    this.fx=this.fx.filter(p=>p.life>0);
    this.sideShields.forEach((shield,index)=>{
      const mount=shieldMounts[index];
      shield.setPosition(Math.round(this.x)+mount.x,Math.round(this.y)+mount.y)
        .setVisible(this.hp>0 && this.shieldSeconds>0);
    });
    document.querySelector('#shield-stock').textContent='庫存 '+this.shieldStock+(this.shieldSeconds?' · 護盾 '+(Math.ceil(this.shieldSeconds*10)/10).toFixed(1)+' 秒':'');
    for(const {id,label,price:basePrice,button} of this.gear){
      const price=this.gearPrice(id,basePrice);
      const ready=id!=='shields' && this[id];
      button.disabled=!['play','shop'].includes(this.mode)||(!ready && this.cash<price);
      const status=ready?(this.ammo===id?'使用中':'切換'):price+' 元';
      const caption=label+' · '+status;
      if(button.textContent!==caption)button.textContent=caption;
    }
    document.querySelector('#laser').value=this.energy;
    document.querySelector('#remaining').textContent=(this.beam?'第 '+(this.laserLevel+1)+' 階　':'')+(this.energy/(this.beam?this.laser.drain:1)).toFixed(1)+' 秒';
    const level=this.weaponLevel;
    const thresholds=balance.weapon.thresholds;
    const xpBar=document.querySelector('#weapon-xp');
    xpBar.max=level===thresholds.length?1:thresholds[level]-thresholds[level-1];
    xpBar.value=level===thresholds.length?1:this.weaponXp-thresholds[level-1];
    document.querySelector('#xp-label').textContent=level===thresholds.length?'滿級':xpBar.value+' / '+xpBar.max;
    hud.textContent=(this.drill?'雙 Boss 演練':'封鎖區 '+this.stage+' / 3　'+(this.phase==='sector'?this.routeBeat:carrier?'母艦決戰':'Boss 戰'))+'\n耐久 '+this.hp+'/'+balance.player.maxHp+'　資金 '+this.cash+'\n得分 '+this.score+'　擊破 '+this.kills+'　火力 '+level+' / 5'+(this.rapidSeconds>0?'　攻速 ×'+balance.weapon.rapidMultiplier+' · '+Math.ceil(this.rapidSeconds)+' 秒':'');
  }
}
new Phaser.Game({type:Phaser.CANVAS,pixelArt:true,width:W,height:H,parent:'flight',scene:Flight,backgroundColor:'#081929',audio:{noAudio:true}});






