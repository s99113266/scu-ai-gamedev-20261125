const keys = ['KeyA','KeyS','KeyD'];

export class Defense {
  frames = [];
  queue = [];
  nextAt = 0;
  readyAt = 0;
  get active(){ return this.frames.length > 0 || this.queue.length > 0; }

  rest(now){
    this.readyAt=now+6+Math.floor(Math.random()*13);
  }
  open(owner,now){
    const length=owner.startsWith('mini')?3:4;
    const sequence=Array.from({length},()=>keys[Math.floor(Math.random()*keys.length)]);
    this.frames.push({owner,index:0,sequence,deadline:now+(owner.startsWith('mini')?5:5.5)});
  }
  begin(now,owners){
    if(this.active || now<this.readyAt || !owners.length)return false;
    const count=1+Math.floor(Math.random()*8);
    const first=Math.floor(Math.random()*owners.length);
    for(let i=0;i<count;i++)this.queue.push(owners[(first+i)%owners.length]);
    this.open(this.queue.shift(),now);
    return true;
  }
  finish(frame,now){
    this.frames.splice(this.frames.indexOf(frame),1);
    if(this.queue.length)this.nextAt=now+.32;
    else this.rest(now);
  }
  removeOwner(owner,now){
    if(!this.queue.includes(owner))return;
    this.queue=this.queue.filter(id=>id!==owner);
    if(!this.active)this.rest(now);
  }
  tick(now){
    const frame=this.frames[0];
    const expired=frame && now>=frame.deadline;
    if(expired)this.finish(frame,now);
    if(!this.frames.length && this.queue.length && now>=this.nextAt){
      this.open(this.queue.shift(),now);
    }
    return expired?1:0;
  }
  input(now,key){
    const f=this.frames[0];
    if(!f || !keys.includes(key))return;
    if(now>=f.deadline){this.finish(f,now);return 'hit';}
    if(key!==f.sequence[f.index]){
      if(f.owner.startsWith('mini'))return 'retry';
      this.finish(f,now);return 'hit';
    }
    if(++f.index<f.sequence.length)return 'correct';
    this.finish(f,now);return 'evade';
  }
}


