const levels = {shot:.19, blast:.56, damage:.54, pickup:.32, warning:.32, correct:.26, counter:.5, laser:.23, victory:.58, threat:.63, engine:.58};
const samples = new Map();
let context, output, muted=false, lastBlast=-Infinity;
let musicMuted=false, currentTrack=null;
const tracks=new Map();
let engineWanted=false, engineVoice=null;

export function setEngine(active){
  engineWanted=active;
  const audible=active && !document.hidden && !muted;
  if(!audible && engineVoice){
    const {source,gain}=engineVoice;
    gain.gain.cancelAndHoldAtTime(context.currentTime);
    gain.gain.linearRampToValueAtTime(0,context.currentTime+.18);
    source.stop(context.currentTime+.19);
    engineVoice=null;
  }
  if(!audible || engineVoice || !samples.has('engine'))return;
  const source=context.createBufferSource(),gain=context.createGain();
  source.buffer=samples.get('engine');
  source.loop=true;
  gain.gain.setValueAtTime(0,context.currentTime);
  gain.gain.linearRampToValueAtTime(levels.engine,context.currentTime+1.2);
  source.connect(gain);gain.connect(output);
  source.onended=()=>{source.disconnect();gain.disconnect();};
  engineVoice={source,gain};
  source.start();
}

export function unlockAudio(){
  if(!window.AudioContext)return;
  if(!context){
    context=new AudioContext();
    output=context.createGain();
    output.gain.value=muted?0:1;
    const limiter=context.createDynamicsCompressor();
    output.connect(limiter);
    limiter.connect(context.destination);
    for(const name of Object.keys(levels)){
      fetch(import.meta.env.BASE_URL+'assets/audio/'+name+'.wav')
        .then(response=>response.arrayBuffer())
        .then(bytes=>context.decodeAudioData(bytes))
        .then(buffer=>{
          samples.set(name,buffer);
          if(name==='engine')setEngine(engineWanted);
        })
        .catch(error=>console.warn('Audio sample unavailable',name,error));
    }
  }
  if(context.state==='suspended')context.resume().catch(()=>{});
}

export function toggleAudio(){
  muted=!muted;
  unlockAudio();
  if(output)output.gain.setTargetAtTime(muted?0:1,context.currentTime,.01);
  setEngine(engineWanted);
  return muted;
}

export function sound(name,pitch=1){
  if(muted || context?.state!=='running' || !samples.has(name))return;
  if(name==='blast'){
    if(context.currentTime-lastBlast<.055)return;
    lastBlast=context.currentTime;
  }
  const source=context.createBufferSource(), gain=context.createGain();
  source.buffer=samples.get(name);
  source.playbackRate.value=pitch*(name==='blast'||name==='shot'?.95+Math.random()*.1:1);
  gain.gain.value=levels[name];
  source.connect(gain);
  gain.connect(output);
  source.onended=()=>{source.disconnect();gain.disconnect();};
  source.start();
  return source;
}

export function setMusic(name){
  if(currentTrack!==name){
    const previous=tracks.get(currentTrack);
    if(previous){previous.pause();previous.currentTime=0;}
    currentTrack=name;
  }
  if(!name)return;
  if(!tracks.has(name)){
    const track=new Audio(import.meta.env.BASE_URL+'assets/audio/'+name+'.ogg');
    track.loop=true;
    track.volume=.38;
    tracks.set(name,track);
  }
  const track=tracks.get(name);
  if(musicMuted || document.hidden)track.pause();
  else if(track.paused)track.play().catch(()=>{});
}

export function toggleMusic(){
  musicMuted=!musicMuted;
  setMusic(currentTrack);
  return musicMuted;
}

document.addEventListener('visibilitychange',()=>{setMusic(currentTrack);setEngine(engineWanted);});
