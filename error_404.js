(function devToolsTrap() {
  const threshold = 160;
  const check = () => {
    if (
      window.outerWidth - window.innerWidth > threshold ||
      window.outerHeight - window.innerHeight > threshold
    ) {
      window.location.replace("error_401.js");
    }
  };
  setInterval(check, 1000);
})();

// Redirect on debugger detection
(function debuggerTrap() {
  setInterval(() => {
    const start = performance.now();
    debugger;
    if (performance.now() - start > 100) {
      window.location.replace("https://yoursite.com/caught.html");
    }
  }, 1000);
})();

// Block right-click and key shortcuts
document.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('keydown', e => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I','J','C'].includes(e.key)) ||
    (e.ctrlKey && e.key === 'U')
  ) {
    e.preventDefault();
    window.location.replace("https://yoursite.com/caught.html");
  }
});
(function() {
  const code = arguments.callee.toString();
  if (code.indexOf("expectedString") === -1) {
    // Code was tampered — crash or redirect
    window.location = "about:blank";
  }
})();

setInterval(() => {
  const start = performance.now();
  debugger;
  if (performance.now() - start > 100) {
    document.body.innerHTML = ""; // DevTools detected
  }
}, 1000);
(function(){

/* 1. Check every CDN lib loaded before touching anything */
var missing = window.__missingLib || (typeof THREE === 'undefined' ? 'Three.js (3D engine)' : null);
if(missing){
  document.getElementById('errorMsg').textContent =
    missing + ' failed to load. Check your internet connection, or run bundler.py once while online to create a file that never needs a network.';
  document.getElementById('loadingOverlay').classList.remove('show');
  document.getElementById('errorOverlay').classList.add('show');
  return;
}
document.getElementById('loadDetail').textContent = 'Starting game\u2026';
document.getElementById('loadingOverlay').classList.remove('show');

/* 2. Game code — wrapped in try/catch so any startup crash shows a readable message */
try{

/* Box Hunt — 6-tier full game with themes, Pro unlock, shake, tier sounds */
const GRID=4, TEX_SIZE=512, CELL=TEX_SIZE/GRID;
const SIDE_FACES=[0,1,4,5];

const TIER_AT={beginner:0,middle:120,pro:350,masterPro:700,legendDemon:1200,overallMaster:2000};
const TIERS={
  beginner:    {name:'BEGINNER',          roundTime:25,lenMin:3,lenMax:4,spinBase:0.010,wrongPenalty:1.0,mult:1.0, color:'#39ff8c',cubeDur:4.0 },
  middle:      {name:'MIDDLE',            roundTime:20,lenMin:4,lenMax:5,spinBase:0.020,wrongPenalty:1.5,mult:1.4, color:'#ffd23f',cubeDur:2.4 },
  pro:         {name:'PRO',              roundTime:19,lenMin:5,lenMax:6,spinBase:0.034,wrongPenalty:1.0,mult:1.8, color:'#ff5577',cubeDur:1.1 },
  masterPro:   {name:'MASTER PRO',       roundTime:17,lenMin:6,lenMax:7,spinBase:0.042,wrongPenalty:1.5,mult:2.5, color:'#ff8c00',cubeDur:0.75},
  legendDemon: {name:'LEGEND DEMON',     roundTime:16, lenMin:7,lenMax:8,spinBase:0.064,wrongPenalty:1.0,mult:3.5, color:'#bf00ff',cubeDur:0.5 },
  overallMaster:{name:'THE OVERALL MASTER',roundTime:14,lenMin:8,lenMax:9,spinBase:0.049,wrongPenalty:2.2,mult:5.0,color:'#fff700',cubeDur:0.3 },
};

/* ── Themes (colors applied to Three.js scene + canvas digit cells) ── */
const THEMES={
  green:{
    clearColor:0x000000,clearAlpha:0,
    boxColor:0x00c84a,boxRough:0.3,boxMetal:0.5,boxEmissive:0x000000,boxEmInt:0,
    faceEmissive:0x0c2616,faceEmInt:0.3,
    ambColor:0x0a1a0a,ambInt:0.6,
    keyColor:0xffffff,keyInt:1.6,
    fillColor:0x00ff60,fillInt:0.45,
    rimColor:0x00ffaa,rimInt:1.2,
    floorColor:0x050d06,partColor:0x00ff70,
    getCell:(r,c)=>({bg:'#04130a',inner:'rgba(0,255,90,0.06)',border:'rgba(0,255,110,0.35)',text:'#39ff8c'}),
    flashRight:'#00ff66',flashWrong:'#ff3344',
  },
  white:{
    clearColor:0xf0f5f0,clearAlpha:1,
    boxColor:0xffffff,boxRough:0.12,boxMetal:0.08,boxEmissive:0xcccccc,boxEmInt:0.04,
    faceEmissive:0x999999,faceEmInt:0.04,
    ambColor:0xffffff,ambInt:1.0,
    keyColor:0xfffdf5,keyInt:1.6,
    fillColor:0xe8f0ff,fillInt:0.5,
    rimColor:0xfff5e8,rimInt:0.7,
    floorColor:0xe0eee0,partColor:0x336699,
    getCell:(r,c)=>{
      /* 8 deeply saturated colours — same families as before (blue, red, yellow,
         purple, green, orange, pink, teal) but fully rich, zero pastel */
      const DEEP=[
        '#1a4f9c',  /* deep royal blue   */
        '#9c1a1a',  /* deep crimson red  */
        '#8a6000',  /* deep amber gold   */
        '#5a0d8a',  /* deep violet       */
        '#0d5c25',  /* deep forest green */
        '#9c0d35',  /* deep ruby         */
        '#c45000',  /* deep burnt orange */
        '#0d5c5c',  /* deep teal         */
      ];
      const bg=DEEP[(r*4+c)%DEEP.length];
      return{bg,inner:'rgba(255,255,255,0.18)',border:'rgba(0,0,0,0.25)',text:'#ffffff'};
    },
    flashRight:'#00aa33',flashWrong:'#cc1111',
  },
  neon:{
    clearColor:0x02000a,clearAlpha:1,
    boxColor:0x1a0030,boxRough:0.04,boxMetal:0.95,boxEmissive:0x5500aa,boxEmInt:0.4,
    faceEmissive:0x330055,faceEmInt:0.6,
    ambColor:0x110022,ambInt:0.4,
    keyColor:0xff00ff,keyInt:1.8,
    fillColor:0x00ffff,fillInt:0.6,
    rimColor:0xffff00,rimInt:1.4,
    floorColor:0x05000f,partColor:0xff00ff,
    getCell:(r,c)=>{
      const D=['#00006b','#006b00','#6b0000','#006b6b','#6b006b','#6b6b00','#00336b','#33006b'];
      const L=['#00ffff','#00ff00','#ff3333','#ffff00','#ff00ff','#ff8800','#0088ff','#ff0088'];
      const idx=(r*4+c)%8, light=(r+c)%2===0;
      return{bg:light?L[idx]:D[idx],inner:'rgba(255,255,255,0.08)',border:'rgba(255,0,255,0.4)',text:light?'#000':'#fff'};
    },
    flashRight:'#00ffff',flashWrong:'#ff00ff',
  },
};

/* ── DOM refs ── */
const topPane=document.getElementById('topPane');
const hudScoreEl=document.getElementById('hudScore');
const hudHighEl=document.getElementById('hudHigh');
const hudLivesEl=document.getElementById('hudLives');
const hudTierEl=document.getElementById('hudTier');
const targetRow=document.getElementById('targetRow');
const timerInner=document.getElementById('timerBarInner');
const bannerEl=document.getElementById('banner');
const btnPause=document.getElementById('btnPause');

/* ── Game state ── */
let score=0,highScore=0,lives=3;
let targetSequence=[],foundIndex=0;
let timeLeft=0,roundTime=25,roundStartTs=0;
let gameRunning=false,paused=false,menuOpen=false,pauseAllowed=true;
let prevTier='beginner';
let soundOn=true,vibrationOn=true,wireframeOn=false,currentTheme='green';
let proUnlocked=false,proStartMode=false,proFailsInMode=0,proRoundsCompleted=0;

/* ── Persistence ── */
function loadProgress(){
  highScore=Number(localStorage.getItem('boxhunt_hs')||0);
  proUnlocked=localStorage.getItem('boxhunt_prounlock')==='1';
  const s=JSON.parse(localStorage.getItem('boxhunt_settings')||'{}');
  soundOn=s.sound!==false; vibrationOn=s.vibration!==false;
  wireframeOn=!!s.wireframe; currentTheme=s.theme||'green';
}
function saveHighScore(){ if(score>highScore)highScore=score; localStorage.setItem('boxhunt_hs',String(highScore)); }
function saveSettings(){ localStorage.setItem('boxhunt_settings',JSON.stringify({sound:soundOn,vibration:vibrationOn,wireframe:wireframeOn,theme:currentTheme})); }
loadProgress();

/* ── Tier helpers ── */
function currentTierKey(){
  if(score>=2000)return'overallMaster'; if(score>=1200)return'legendDemon';
  if(score>=700)return'masterPro'; if(score>=350)return'pro';
  if(score>=120)return'middle'; return'beginner';
}
function tierParams(){return TIERS[currentTierKey()];}
function randomTargetLength(){const p=tierParams();return p.lenMin+Math.floor(Math.random()*(p.lenMax-p.lenMin+1));}
function computeSpinSpeed(){const p=tierParams();return p.spinBase+Math.min(0.04,score*0.000018);}

/* ═════ THREE.JS SCENE ═════ */
const scene=new THREE.Scene();
const camera=new THREE.PerspectiveCamera(45,1,0.1,100);
camera.position.set(4,3.2,5); camera.lookAt(0,0,0);
const renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});
renderer.setPixelRatio(devicePixelRatio);
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.1;
topPane.prepend(renderer.domElement);

const ambientLight=new THREE.AmbientLight(0x0a1a0a,0.6); scene.add(ambientLight);
const keyLight=new THREE.DirectionalLight(0xffffff,1.6);
keyLight.position.set(5,8,6); keyLight.castShadow=true;
keyLight.shadow.mapSize.set(2048,2048);
keyLight.shadow.camera.near=0.5; keyLight.shadow.camera.far=30;
keyLight.shadow.camera.left=keyLight.shadow.camera.bottom=-6;
keyLight.shadow.camera.right=keyLight.shadow.camera.top=6;
scene.add(keyLight);
const fillLight=new THREE.DirectionalLight(0x00ff60,0.45); fillLight.position.set(-4,2,-3); scene.add(fillLight);
const rimLight=new THREE.PointLight(0x00ffaa,1.2,15); rimLight.position.set(-3,5,-4); scene.add(rimLight);

const floor=new THREE.Mesh(new THREE.PlaneGeometry(20,20),new THREE.MeshStandardMaterial({color:0x050d06,roughness:1,metalness:0}));
floor.rotation.x=-Math.PI/2; floor.position.y=-2.8; floor.receiveShadow=true; scene.add(floor);

const pts=[];
for(let i=0;i<280;i++)pts.push((Math.random()-0.5)*18,(Math.random()-0.5)*12,(Math.random()-0.5)*14);
const particleGeo=new THREE.BufferGeometry();
particleGeo.setAttribute('position',new THREE.Float32BufferAttribute(pts,3));
const particles=new THREE.Points(particleGeo,new THREE.PointsMaterial({color:0x00ff70,size:0.04,transparent:true,opacity:0.4}));
scene.add(particles);

/* applyTheme defined after all vars below */

/* ── Face grid canvases / textures ── */
const gridData={},faceCanvas={},faceCtx={},faceTextures={};
SIDE_FACES.forEach(f=>{
  gridData[f]=Array.from({length:GRID},()=>Array.from({length:GRID},()=>0));
  const cv=document.createElement('canvas'); cv.width=TEX_SIZE; cv.height=TEX_SIZE;
  faceCanvas[f]=cv; faceCtx[f]=cv.getContext('2d');
  const tex=new THREE.CanvasTexture(cv); tex.minFilter=THREE.LinearFilter;
  faceTextures[f]=tex;
});

function drawCell(fi,row,col){
  const ctx=faceCtx[fi], x=col*CELL, y=row*CELL;
  const {bg,inner,border,text}=THEMES[currentTheme].getCell(row,col);
  ctx.fillStyle=bg; ctx.fillRect(x,y,CELL,CELL);
  ctx.fillStyle=inner; ctx.fillRect(x+3,y+3,CELL-6,CELL-6);
  ctx.strokeStyle=border; ctx.lineWidth=2; ctx.strokeRect(x+3,y+3,CELL-6,CELL-6);
  ctx.fillStyle=text;
  ctx.font=`bold ${Math.floor(CELL*0.5)}px "Courier New",monospace`;
  ctx.textAlign='center'; ctx.textBaseline='middle';
  ctx.fillText(String(gridData[fi][row][col]),x+CELL/2,y+CELL/2+CELL*0.03);
  faceTextures[fi].needsUpdate=true;
}
function drawFace(fi){for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++)drawCell(fi,r,c);}

function flashCell(fi,row,col,color,revertDigit){
  const ctx=faceCtx[fi], x=col*CELL, y=row*CELL;
  ctx.fillStyle=color; ctx.globalAlpha=0.55;
  ctx.fillRect(x+3,y+3,CELL-6,CELL-6); ctx.globalAlpha=1;
  faceTextures[fi].needsUpdate=true;
  setTimeout(()=>{if(revertDigit!==undefined)gridData[fi][row][col]=revertDigit; drawCell(fi,row,col);},240);
}

function regenerateWholeGrid(){
  SIDE_FACES.forEach(f=>{for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++)gridData[f][r][c]=Math.floor(Math.random()*10);});
  const needed={};
  targetSequence.forEach(d=>needed[d]=(needed[d]||0)+1);
  const allCells=[];
  SIDE_FACES.forEach(f=>{for(let r=0;r<GRID;r++)for(let c=0;c<GRID;c++)allCells.push([f,r,c]);});
  const locked=new Set();
  Object.keys(needed).forEach(dStr=>{
    const d=Number(dStr); let have=allCells.filter(([f,r,c])=>gridData[f][r][c]===d).length;
    let deficit=needed[d]-have,guard=0;
    while(deficit>0&&guard<500){
      guard++; const idx=Math.floor(Math.random()*allCells.length);
      const key=allCells[idx].join(','); if(locked.has(key))continue;
      const [f,r,c]=allCells[idx]; gridData[f][r][c]=d; locked.add(key); deficit--;
    }
  });
  SIDE_FACES.forEach(drawFace);
}

/* ── Box mesh ── */
const geo=new THREE.BoxGeometry(2,2,2);
const plainMat=new THREE.MeshStandardMaterial({color:0x00c84a,roughness:0.3,metalness:0.5});
const materials=[];
for(let i=0;i<6;i++){
  materials[i]=SIDE_FACES.includes(i)
    ?new THREE.MeshStandardMaterial({map:faceTextures[i],roughness:0.35,metalness:0.22,emissive:new THREE.Color(0x0c2616),emissiveIntensity:0.3})
    :plainMat;
}
const wireMat=new THREE.MeshBasicMaterial({color:0x00ff70,wireframe:true,transparent:true,opacity:0.6});
const box=new THREE.Mesh(geo,materials); box.castShadow=true; box.receiveShadow=true; box.rotation.x=0.12;
const pivot=new THREE.Group(); pivot.add(box);
const edgeGeo=new THREE.EdgesGeometry(geo);
const edges=new THREE.LineSegments(edgeGeo,new THREE.LineBasicMaterial({color:0x55ffaa,transparent:true,opacity:0.5}));
edges.rotation.x=0.12; pivot.add(edges);
scene.add(pivot);

/* ── Theme application (defined here so plainMat, materials, faceCtx, faceTextures, drawFace all exist) ── */
function applyTheme(name){
  currentTheme=name;
  document.body.classList.remove('theme-green','theme-white','theme-neon');
  document.body.classList.add('theme-'+name);
  const t=THEMES[name];
  renderer.setClearColor(t.clearColor,t.clearAlpha);
  plainMat.color.setHex(t.boxColor); plainMat.roughness=t.boxRough; plainMat.metalness=t.boxMetal;
  plainMat.emissive.setHex(t.boxEmissive); plainMat.emissiveIntensity=t.boxEmInt;
  plainMat.needsUpdate=true;
  SIDE_FACES.forEach(fi=>{
    materials[fi].emissive.setHex(t.faceEmissive);
    materials[fi].emissiveIntensity=t.faceEmInt;
    materials[fi].needsUpdate=true;
  });
  ambientLight.color.setHex(t.ambColor); ambientLight.intensity=t.ambInt;
  keyLight.color.setHex(t.keyColor); keyLight.intensity=t.keyInt;
  fillLight.color.setHex(t.fillColor); fillLight.intensity=t.fillInt;
  rimLight.color.setHex(t.rimColor); rimLight.intensity=t.rimInt;
  floor.material.color.setHex(t.floorColor);
  particles.material.color.setHex(t.partColor);
  SIDE_FACES.forEach(drawFace);
  /* highlight active theme button with a visible ring */
  document.querySelectorAll('.theme-btn').forEach(b=>{
    const active = b.dataset.theme === name;
    b.style.outline = active ? '3px solid #fff' : 'none';
    b.style.outlineOffset = '2px';
  });
  /* auto-close the quick picker after selection */
  const tp=document.getElementById('themePickerOverlay');
  if(tp&&tp.classList.contains('show')){
    setTimeout(()=>{tp.classList.remove('show');menuOpen=false;},280);
  }
  saveSettings();
}
applyTheme(currentTheme);

/* ═════ HUD ═════ */
function updateScoreHUD(){hudScoreEl.textContent=score;hudHighEl.textContent=Math.max(highScore,score);}
function updateLivesHUD(){hudLivesEl.textContent='❤'.repeat(Math.max(0,lives))+'♡'.repeat(Math.max(0,3-lives));}
function updateTierHUD(){
  const p=tierParams();
  hudTierEl.textContent=p.name; hudTierEl.style.color=p.color;
  document.getElementById('settingsTier').textContent=p.name;
  document.getElementById('miniCube').style.animationDuration=p.cubeDur+'s';
}
function updateTargetHUD(){
  targetRow.innerHTML='';
  targetSequence.forEach((d,i)=>{
    const div=document.createElement('div');
    div.className='digit-box '+(i<foundIndex?'found':i===foundIndex?'next':'');
    div.textContent=d; targetRow.appendChild(div);
  });
}
function updateTimerHUD(){
  const ratio=Math.max(0,timeLeft/roundTime);
  timerInner.style.width=(ratio*100)+'%';
  timerInner.style.background=ratio>0.5?'#39ff8c':ratio>0.2?'#ffd23f':'#ff5577';
}
function showBanner(text,ms=1100){
  bannerEl.textContent=text; bannerEl.classList.add('show');
  clearTimeout(showBanner._t);
  showBanner._t=setTimeout(()=>bannerEl.classList.remove('show'),ms);
}
function updatePauseButton(){
  btnPause.disabled=!gameRunning||(!pauseAllowed&&!paused);
  btnPause.textContent=paused?'▶ Resume':'|| Pause';
}
function updateProUI(){
  document.getElementById('proStartOption').classList.toggle('hidden',!proUnlocked);
  document.getElementById('btnPlayAgainPro').classList.toggle('hidden',!proUnlocked);
  document.getElementById('proUnlockLine').style.display=proUnlocked?'flex':'none';
}

/* ═════ GAME FLOW ═════ */
function startRound(isFirst){
  const len=isFirst?4:randomTargetLength();
  targetSequence=Array.from({length:len},()=>Math.floor(Math.random()*10));
  regenerateWholeGrid();
  foundIndex=0;
  roundTime=tierParams().roundTime;
  timeLeft=roundTime;
  roundStartTs=performance.now();
  pauseAllowed=true;
  updateTargetHUD(); updateTimerHUD(); updatePauseButton();
}

function maybeLevelUp(){
  const t=currentTierKey();
  if(t!==prevTier){
    showBanner('LEVEL UP: '+TIERS[t].name,1600); playSound('round'); prevTier=t;
  }
  updateTierHUD();
}

function completeRound(){
  const wasPro=!proUnlocked&&currentTierKey()==='pro';
  const p=tierParams();
  const timeBonus=Math.round(timeLeft*2);
  const gained=Math.round((30+targetSequence.length*12+timeBonus)*p.mult);
  score+=gained;
  showBanner('+'+gained+'  FOUND IT!');
  playSound('round');
  updateScoreHUD();
  if(wasPro){
    proRoundsCompleted++;
    if(proRoundsCompleted>=2){
      proUnlocked=true;
      localStorage.setItem('boxhunt_prounlock','1');
      setTimeout(()=>{ showBanner('PRO START UNLOCKED!',2500); updateProUI(); },700);
    }
  }
  if(proStartMode&&currentTierKey()==='pro') proFailsInMode=0;
  maybeLevelUp();
  saveHighScore();
  startRound(false);
}

function failRound(){
  lives--;
  updateLivesHUD();
  showBanner('TIME UP!');
  playSound('wrong');
  if(proStartMode&&currentTierKey()==='pro'){
    proFailsInMode++;
    if(proFailsInMode>=3){
      proStartMode=false; proFailsInMode=0;
      score=200;
      updateScoreHUD();
      setTimeout(()=>{ showBanner('DROPPED TO MIDDLE!',2500); updateTierHUD(); },350);
    }
  }
  if(lives<=0){ gameOver(); }
  else{ startRound(false); }
}

function gameOver(){
  gameRunning=false;
  saveHighScore();
  playSound('gameover');
  document.getElementById('finalScore').textContent=score;
  document.getElementById('finalHigh').textContent=highScore;
  document.getElementById('finalNote').textContent=score>=highScore?'New high score!':'Final score';
  document.getElementById('finalTier').textContent=tierParams().name;
  updateProUI();
  document.getElementById('gameOverOverlay').classList.add('show');
  sendMP({type:'gameover',score});
}

function startGame(fromPro){
  ensureAudio();
  lives=3; gameRunning=true; paused=false; menuOpen=false;
  proStartMode=!!fromPro; proFailsInMode=0;
  if(fromPro){ score=TIER_AT.pro; prevTier='pro'; }
  else{ score=0; prevTier='beginner'; }
  document.getElementById('startScreen').classList.remove('show');
  document.getElementById('gameOverOverlay').classList.remove('show');
  updateScoreHUD(); updateLivesHUD(); updateTierHUD();
  startRound(true);
}

document.getElementById('btnPlay').addEventListener('click',()=>startGame(false));
document.getElementById('btnPlayAgain').addEventListener('click',()=>startGame(false));
document.getElementById('btnStartFromPro').addEventListener('click',()=>startGame(true));
document.getElementById('btnPlayAgainPro').addEventListener('click',()=>startGame(true));

/* ═════ TAP DETECTION + RAYCAST ═════ */
function handleCellTap(fi,row,col){
  const digit=gridData[fi][row][col], needed=targetSequence[foundIndex];
  const t=THEMES[currentTheme];
  if(digit===needed){
    flashCell(fi,row,col,t.flashRight,Math.floor(Math.random()*10));
    playSound('correct'); vibrate(30);
    foundIndex++;
    updateTargetHUD();
    if(foundIndex>=targetSequence.length)completeRound();
  }else{
    flashCell(fi,row,col,t.flashWrong);
    playSound('wrong'); vibrate([20,40,20]);
    shakeScreen();
    timeLeft=Math.max(0,timeLeft-tierParams().wrongPenalty);
  }
}

function shakeScreen(){
  const cv=renderer.domElement;
  cv.classList.remove('shake'); void cv.offsetWidth;
  cv.classList.add('shake');
  clearTimeout(shakeScreen._t);
  shakeScreen._t=setTimeout(()=>cv.classList.remove('shake'),420);
}

let isDragging=false,lastX=0,lastY=0,downX=0,downY=0,movedDist=0;
let camTheta=Math.atan2(camera.position.x,camera.position.z);
let camPhi=Math.asin(camera.position.y/camera.position.length());
let camDist=camera.position.length();
const raycaster=new THREE.Raycaster(), pointerNDC=new THREE.Vector2();

function handlePointerTap(cx,cy){
  if(!gameRunning||paused||menuOpen)return;
  const rect=renderer.domElement.getBoundingClientRect();
  pointerNDC.x=((cx-rect.left)/rect.width)*2-1;
  pointerNDC.y=-((cy-rect.top)/rect.height)*2+1;
  raycaster.setFromCamera(pointerNDC,camera);
  const hits=raycaster.intersectObject(box);
  if(!hits.length)return;
  const hit=hits[0], mi=hit.face.materialIndex;
  if(!SIDE_FACES.includes(mi))return;

  /* ── Local-coordinate hit detection ───────────────────────────────────
     UV coordinates are unreliable because Three.js BoxGeometry mirrors
     the U-axis on some faces (-Z and -X), causing col to be inverted.
     Instead we convert the 3D hit point into the box's local space and
     derive row/col directly from the local axes of each face:

       Face +X (mi=0): looking from +x → left = +z, right = -z, up = +y
       Face -X (mi=1): looking from -x → left = -z, right = +z, up = +y
       Face +Z (mi=4): looking from +z → left = -x, right = +x, up = +y
       Face -Z (mi=5): looking from -z → left = +x, right = -x, up = +y

     The canvas is drawn with row 0 = top, col 0 = left.
     Local coordinates run -1 to +1 on a box of size 2.
  ──────────────────────────────────────────────────────────────────────── */
  const lp = box.worldToLocal(hit.point.clone());
  const cl = v => Math.min(GRID-1, Math.max(0, Math.floor(v*GRID)));
  let row, col;
  if(mi===0){      // +X face
    col = cl((1 - lp.z) / 2);
    row = cl((1 - lp.y) / 2);
  } else if(mi===1){ // -X face
    col = cl((lp.z + 1) / 2);
    row = cl((1 - lp.y) / 2);
  } else if(mi===4){ // +Z face
    col = cl((lp.x + 1) / 2);
    row = cl((1 - lp.y) / 2);
  } else {           // -Z face (mi===5)
    col = cl((1 - lp.x) / 2);
    row = cl((1 - lp.y) / 2);
  }
  handleCellTap(mi,row,col);
}

function updateCamera(){
  camera.position.x=camDist*Math.cos(camPhi)*Math.sin(camTheta);
  camera.position.y=camDist*Math.sin(camPhi);
  camera.position.z=camDist*Math.cos(camPhi)*Math.cos(camTheta);
  camera.lookAt(0,0,0);
}

renderer.domElement.addEventListener('mousedown',e=>{isDragging=true;lastX=downX=e.clientX;lastY=downY=e.clientY;movedDist=0;});
window.addEventListener('mousemove',e=>{
  if(!isDragging)return;
  camTheta-=(e.clientX-lastX)*0.008;
  camPhi=Math.max(-1.2,Math.min(1.2,camPhi-(e.clientY-lastY)*0.008));
  lastX=e.clientX;lastY=e.clientY;
  movedDist=Math.hypot(e.clientX-downX,e.clientY-downY);
  updateCamera();
});
window.addEventListener('mouseup',e=>{if(isDragging&&movedDist<6)handlePointerTap(e.clientX,e.clientY);isDragging=false;});
renderer.domElement.addEventListener('touchstart',e=>{isDragging=true;lastX=downX=e.touches[0].clientX;lastY=downY=e.touches[0].clientY;movedDist=0;},{passive:true});
window.addEventListener('touchmove',e=>{
  if(!isDragging)return;
  camTheta-=(e.touches[0].clientX-lastX)*0.008;
  camPhi=Math.max(-1.2,Math.min(1.2,camPhi-(e.touches[0].clientY-lastY)*0.008));
  lastX=e.touches[0].clientX;lastY=e.touches[0].clientY;
  movedDist=Math.hypot(e.touches[0].clientX-downX,e.touches[0].clientY-downY);
  updateCamera();
},{passive:true});
window.addEventListener('touchend',e=>{if(isDragging&&movedDist<6&&e.changedTouches.length)handlePointerTap(e.changedTouches[0].clientX,e.changedTouches[0].clientY);isDragging=false;},{passive:true});
window.addEventListener('wheel',e=>{camDist=Math.max(2.5,Math.min(14,camDist+e.deltaY*0.01));updateCamera();});

/* ═════ PAUSE / SETTINGS / OVERLAYS ═════ */
btnPause.addEventListener('click',()=>{if(btnPause.disabled)return;paused=!paused;updatePauseButton();});
function openOverlay(id){menuOpen=true;document.getElementById(id).classList.add('show');}
function closeOverlay(id){document.getElementById(id).classList.remove('show');menuOpen=false;}

document.getElementById('btnSettings').addEventListener('click',()=>{
  document.getElementById('toggleSound').checked=soundOn;
  document.getElementById('toggleVibration').checked=vibrationOn;
  document.getElementById('toggleWireframe').checked=wireframeOn;
  document.getElementById('settingsHigh').textContent=highScore;
  updateProUI();
  openOverlay('settingsOverlay');
});
document.getElementById('btnCloseSettings').addEventListener('click',()=>closeOverlay('settingsOverlay'));
document.getElementById('toggleSound').addEventListener('change',e=>{soundOn=e.target.checked;saveSettings();});
document.getElementById('toggleVibration').addEventListener('change',e=>{vibrationOn=e.target.checked;saveSettings();});
document.getElementById('toggleWireframe').addEventListener('change',e=>{
  wireframeOn=e.target.checked;saveSettings();
  box.material=wireframeOn?wireMat:materials;
});
document.querySelectorAll('.theme-btn').forEach(b=>b.addEventListener('click',()=>applyTheme(b.dataset.theme)));
document.getElementById('btnResetScores').addEventListener('click',()=>{
  if(!confirm('Reset all scores and settings on this device?'))return;
  ['boxhunt_hs','boxhunt_settings','boxhunt_prounlock'].forEach(k=>localStorage.removeItem(k));
  highScore=0;soundOn=true;vibrationOn=true;wireframeOn=false;proUnlocked=false;
  proRoundsCompleted=0;
  document.getElementById('settingsHigh').textContent=0;
  applyTheme('green');
  updateProUI();
});

/* ── Clear ALL caches + service workers + localStorage then hard-reload ── */
async function clearAllAndRestart(){
  const status=document.getElementById('clearCacheStatus');
  status.style.display='block';
  status.textContent='Clearing localStorage…';
  try{ localStorage.clear(); }catch(e){}
  try{ sessionStorage.clear(); }catch(e){}

  status.textContent='Unregistering service workers…';
  if('serviceWorker' in navigator){
    const regs=await navigator.serviceWorker.getRegistrations().catch(()=>[]);
    for(const r of regs) await r.unregister().catch(()=>{});
  }

  status.textContent='Clearing cache storage…';
  if('caches' in window){
    const keys=await caches.keys().catch(()=>[]);
    for(const k of keys) await caches.delete(k).catch(()=>{});
  }

  status.textContent='Done — reloading…';
  // Force hard reload bypassing all browser caches
  setTimeout(()=>{ window.location.href=window.location.href.split('?')[0]+'?bust='+Date.now(); },400);
}
document.getElementById('btnClearCache').addEventListener('click',()=>{
  if(!confirm('This clears ALL cached files, service workers, and saved scores, then reloads the game fresh. Continue?'))return;
  clearAllAndRestart();
});

/* ═════ SOUND — 6 tier themes ═════ */
let audioCtx;
function ensureAudio(){if(!audioCtx)try{audioCtx=new(window.AudioContext||window.webkitAudioContext)();}catch(e){}}
function beep(freq,dur,type='sine',vol=0.15){
  if(!soundOn||!audioCtx)return;
  const o=audioCtx.createOscillator(),g=audioCtx.createGain();
  o.type=type;o.frequency.value=freq;g.gain.value=vol;
  o.connect(g);g.connect(audioCtx.destination);o.start();
  g.gain.exponentialRampToValueAtTime(0.0001,audioCtx.currentTime+dur);
  o.stop(audioCtx.currentTime+dur);
}
const SOUND_THEMES={
  beginner:    {correct:[{f:660,d:0.12,t:'square'}],wrong:[{f:160,d:0.18,t:'sawtooth'}],round:[{f:880,d:0.22,t:'triangle'},{f:1320,d:0.22,t:'triangle',dl:90}],gameover:[{f:110,d:0.6,t:'sawtooth'}]},
  middle:      {correct:[{f:740,d:0.09,t:'square'},{f:1100,d:0.07,t:'square',dl:60}],wrong:[{f:200,d:0.15,t:'sawtooth'}],round:[{f:990,d:0.16,t:'square'},{f:1480,d:0.16,t:'square',dl:70},{f:1980,d:0.16,t:'square',dl:140}],gameover:[{f:130,d:0.55,t:'sawtooth'}]},
  pro:         {correct:[{f:880,d:0.07,t:'square'},{f:1320,d:0.06,t:'square',dl:40},{f:1760,d:0.05,t:'square',dl:80}],wrong:[{f:90,d:0.22,t:'sawtooth'}],round:[{f:1100,d:0.13,t:'square'},{f:1650,d:0.13,t:'square',dl:55},{f:2200,d:0.15,t:'square',dl:110}],gameover:[{f:80,d:0.7,t:'sawtooth'}]},
  masterPro:   {correct:[{f:1000,d:0.06,t:'square'},{f:1500,d:0.06,t:'square',dl:32},{f:2000,d:0.06,t:'square',dl:64},{f:2500,d:0.05,t:'square',dl:96}],wrong:[{f:70,d:0.25,t:'sawtooth'}],round:[{f:1200,d:0.11,t:'square'},{f:1800,d:0.11,t:'square',dl:42},{f:2400,d:0.12,t:'square',dl:84},{f:3000,d:0.12,t:'square',dl:126}],gameover:[{f:60,d:0.8,t:'sawtooth'}]},
  legendDemon: {correct:[{f:1200,d:0.05,t:'square'},{f:1800,d:0.05,t:'square',dl:26},{f:2400,d:0.05,t:'square',dl:52},{f:3000,d:0.05,t:'square',dl:78},{f:3600,d:0.04,t:'square',dl:104}],wrong:[{f:55,d:0.28,t:'sawtooth'}],round:[{f:1400,d:0.10,t:'square'},{f:2100,d:0.10,t:'square',dl:36},{f:2800,d:0.10,t:'square',dl:72},{f:3500,d:0.12,t:'square',dl:108}],gameover:[{f:45,d:0.9,t:'sawtooth'}]},
  overallMaster:{correct:[{f:1500,d:0.04,t:'square'},{f:2000,d:0.04,t:'square',dl:20},{f:2500,d:0.04,t:'square',dl:40},{f:3000,d:0.04,t:'square',dl:60},{f:3500,d:0.04,t:'square',dl:80},{f:4000,d:0.04,t:'square',dl:100}],wrong:[{f:40,d:0.3,t:'sawtooth'}],round:[{f:1760,d:0.09,t:'square'},{f:2640,d:0.09,t:'square',dl:30},{f:3520,d:0.09,t:'square',dl:60},{f:4400,d:0.11,t:'square',dl:90}],gameover:[{f:35,d:1.0,t:'sawtooth'}]},
};
function playSound(kind){
  const notes=SOUND_THEMES[currentTierKey()][kind];
  if(!notes)return;
  notes.forEach(n=>setTimeout(()=>beep(n.f,n.d,n.t),n.dl||0));
}
function vibrate(pattern){if(vibrationOn&&navigator.vibrate)navigator.vibrate(pattern);}

/* ═════ MULTIPLAYER — WebRTC, manual/QR code exchange ═════ */
let pc=null,dc=null,mpConnected=false,friendState={};
document.getElementById('btnMultiplayer').addEventListener('click',()=>openOverlay('multiplayerOverlay'));
document.getElementById('btnThemePicker').addEventListener('click',()=>openOverlay('themePickerOverlay'));
document.getElementById('btnCloseThemePicker').addEventListener('click',()=>closeOverlay('themePickerOverlay'));
document.getElementById('btnOpenMPFromSettings').addEventListener('click',()=>{closeOverlay('settingsOverlay');openOverlay('multiplayerOverlay');});
document.getElementById('btnCloseMP').addEventListener('click',()=>closeOverlay('multiplayerOverlay'));
document.getElementById('tabHostBtn').addEventListener('click',()=>{
  document.getElementById('tabHostBtn').classList.add('active');document.getElementById('tabJoinBtn').classList.remove('active');
  document.getElementById('hostPanel').classList.add('active');document.getElementById('joinPanel').classList.remove('active');
});
document.getElementById('tabJoinBtn').addEventListener('click',()=>{
  document.getElementById('tabJoinBtn').classList.add('active');document.getElementById('tabHostBtn').classList.remove('active');
  document.getElementById('joinPanel').classList.add('active');document.getElementById('hostPanel').classList.remove('active');
});
function setMPStatus(msg){document.getElementById('mpStatus').textContent=msg;}
function createPC(){
  pc=new RTCPeerConnection({iceServers:[]});
  pc.onconnectionstatechange=()=>{
    if(['disconnected','failed','closed'].includes(pc.connectionState)){
      mpConnected=false;setMPStatus('Disconnected');document.getElementById('btnStartMatch').disabled=true;exitSplitMode();
    }
  };
  return pc;
}
function waitIce(conn){return new Promise(r=>{if(conn.iceGatheringState==='complete')return r();const f=()=>{if(conn.iceGatheringState==='complete'){conn.removeEventListener('icegatheringstatechange',f);r();}};conn.addEventListener('icegatheringstatechange',f);setTimeout(r,2500);});}
function encSDP(d){return btoa(JSON.stringify(d));}
function decSDP(s){return JSON.parse(atob(s.trim()));}
function setupDC(){
  dc.onopen=()=>{mpConnected=true;setMPStatus('Connected to friend!');document.getElementById('btnStartMatch').disabled=false;};
  dc.onclose=()=>{mpConnected=false;setMPStatus('Disconnected');document.getElementById('btnStartMatch').disabled=true;exitSplitMode();};
  dc.onmessage=e=>handleMPMsg(JSON.parse(e.data));
}
function sendMP(obj){if(dc&&dc.readyState==='open')dc.send(JSON.stringify(obj));}
document.getElementById('btnHostCreate').addEventListener('click',async()=>{
  if(!window.RTCPeerConnection){setMPStatus('WebRTC not supported in this browser.');return;}
  createPC(); dc=pc.createDataChannel('game'); setupDC();
  const offer=await pc.createOffer(); await pc.setLocalDescription(offer);
  await waitIce(pc); document.getElementById('hostCodeOut').value=encSDP(pc.localDescription);
  setMPStatus('Code ready — share it, then paste the reply code.');
});
document.getElementById('btnHostConnect').addEventListener('click',async()=>{
  try{await pc.setRemoteDescription(decSDP(document.getElementById('hostAnswerIn').value));setMPStatus('Connecting...');}
  catch(e){setMPStatus('Bad code — try again.');}
});
document.getElementById('btnHostCopy').addEventListener('click',()=>copyEl('hostCodeOut'));
document.getElementById('btnJoinGenerate').addEventListener('click',async()=>{
  if(!window.RTCPeerConnection){setMPStatus('WebRTC not supported.');return;}
  try{
    createPC(); pc.ondatachannel=e=>{dc=e.channel;setupDC();};
    await pc.setRemoteDescription(decSDP(document.getElementById('joinCodeIn').value));
    const ans=await pc.createAnswer(); await pc.setLocalDescription(ans);
    await waitIce(pc); document.getElementById('joinCodeOut').value=encSDP(pc.localDescription);
    setMPStatus('Reply code ready — send it back to your friend.');
  }catch(e){setMPStatus('Bad code — try again.');}
});
document.getElementById('btnJoinCopy').addEventListener('click',()=>copyEl('joinCodeOut'));
function copyEl(id){const el=document.getElementById(id);el.select();el.setSelectionRange(0,99999);try{navigator.clipboard.writeText(el.value);}catch(e){document.execCommand('copy');}}
document.getElementById('btnDisconnectMP').addEventListener('click',()=>{
  if(dc)dc.close();if(pc)pc.close();dc=null;pc=null;mpConnected=false;
  setMPStatus('Not connected');document.getElementById('btnStartMatch').disabled=true;exitSplitMode();
});

/* QR code show/scan */
function showSubOv(id){document.getElementById(id).classList.add('show');}
function hideSubOv(id){document.getElementById(id).classList.remove('show');}
function showQR(text){
  if(!text){setMPStatus('Generate a code first.');return;}
  const t=document.getElementById('qrDisplayTarget');t.innerHTML='';
  try{
    new QRCode(t,{text,width:220,height:220,colorDark:THEMES[currentTheme].clearAlpha?'#000':'#04130a',colorLight:currentTheme==='white'?'#fff':'#39ff8c',correctLevel:QRCode.CorrectLevel.L});
    showSubOv('qrDisplayOverlay');
  }catch(e){setMPStatus('Could not generate QR for this code.');}
}
document.getElementById('btnCloseQRDisplay').addEventListener('click',()=>hideSubOv('qrDisplayOverlay'));
document.getElementById('btnHostShowQR').addEventListener('click',()=>showQR(document.getElementById('hostCodeOut').value));
document.getElementById('btnJoinShowQR').addEventListener('click',()=>showQR(document.getElementById('joinCodeOut').value));
let qrStream=null,qrTarget=null,qrRAF=null;
async function startScan(targetId){
  if(typeof jsQR!=='function'){setMPStatus('jsQR library not loaded — paste manually.');return;}
  qrTarget=targetId;document.getElementById('qrScanStatus').textContent='Point camera at the code...';
  showSubOv('qrScanOverlay');
  try{
    qrStream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});
    const v=document.getElementById('qrVideo');v.srcObject=qrStream;await v.play();qrLoop();
  }catch(e){document.getElementById('qrScanStatus').textContent='Camera not available or page not on https/localhost. Paste the code manually.';}
}
function qrLoop(){
  const v=document.getElementById('qrVideo'),cv=document.getElementById('qrScanCanvas');
  if(v.readyState===v.HAVE_ENOUGH_DATA&&v.videoWidth){
    cv.width=v.videoWidth;cv.height=v.videoHeight;
    const ctx=cv.getContext('2d');ctx.drawImage(v,0,0,cv.width,cv.height);
    const img=ctx.getImageData(0,0,cv.width,cv.height);
    const code=jsQR(img.data,img.width,img.height);
    if(code&&code.data){document.getElementById(qrTarget).value=code.data;document.getElementById('qrScanStatus').textContent='Code captured!';stopScan();return;}
  }
  qrRAF=requestAnimationFrame(qrLoop);
}
function stopScan(){if(qrRAF)cancelAnimationFrame(qrRAF);qrRAF=null;if(qrStream){qrStream.getTracks().forEach(t=>t.stop());qrStream=null;}setTimeout(()=>hideSubOv('qrScanOverlay'),400);}
document.getElementById('btnCancelScan').addEventListener('click',()=>{stopScan();hideSubOv('qrScanOverlay');});
document.getElementById('btnHostScanQR').addEventListener('click',()=>startScan('hostAnswerIn'));
document.getElementById('btnJoinScanQR').addEventListener('click',()=>startScan('joinCodeIn'));

document.getElementById('btnStartMatch').addEventListener('click',()=>{
  if(!mpConnected)return;
  const ts=Date.now()+3000;sendMP({type:'startMatch',ts});scheduleSyncedStart(ts);closeOverlay('multiplayerOverlay');
});
function scheduleSyncedStart(ts){
  enterSplitMode();
  const wait=Math.max(0,ts-Date.now());showBanner('MATCH STARTING...',wait);setTimeout(()=>startGame(false),wait);
}
function handleMPMsg(msg){
  if(msg.type==='state'){friendState=msg;updateFriendPanel();}
  else if(msg.type==='startMatch'){scheduleSyncedStart(msg.ts);}
  else if(msg.type==='gameover'){document.getElementById('friendStatusMsg').textContent='Friend finished: '+msg.score+' pts';}
}
function enterSplitMode(){document.body.classList.add('split-mode');document.getElementById('friendStatusMsg').textContent='Waiting for friend...';resizeRenderer();}
function exitSplitMode(){document.body.classList.remove('split-mode');resizeRenderer();}
function updateFriendPanel(){
  const fp=friendState;
  document.getElementById('friendScore').textContent=fp.score||0;
  const fl=Math.max(0,fp.lives!=null?fp.lives:3);
  document.getElementById('friendLives').textContent='❤'.repeat(fl)+'♡'.repeat(Math.max(0,3-fl));
  const ft=TIERS[fp.tier||'beginner'];
  const tb=document.getElementById('friendTier');tb.textContent=ft.name.split(' ')[0];tb.style.color=ft.color;
  document.getElementById('miniCube').style.animationDuration=ft.cubeDur+'s';
  const ratio=fp.roundTime?Math.max(0,(fp.timeLeft||0)/fp.roundTime):1;
  const fti=document.getElementById('friendTimerBarInner');
  fti.style.width=(ratio*100)+'%';fti.style.background=ratio>0.5?'#39ff8c':ratio>0.2?'#ffd23f':'#ff5577';
  const dots=document.getElementById('friendDots');dots.innerHTML='';
  for(let i=0;i<(fp.total||0);i++){const d=document.createElement('div');d.className='fdot'+(i<(fp.found||0)?' filled':'');dots.appendChild(d);}
  document.getElementById('friendStatusMsg').textContent='Live';
}
setInterval(()=>{if(mpConnected&&gameRunning)sendMP({type:'state',score,lives,tier:currentTierKey(),timeLeft,roundTime,found:foundIndex,total:targetSequence.length});},400);

/* ═════ RESIZE ═════ */
function resizeRenderer(){
  requestAnimationFrame(()=>{
    const w=topPane.clientWidth,h=topPane.clientHeight||1;
    renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();
  });
}
window.addEventListener('resize',resizeRenderer);resizeRenderer();

/* ═════ PWA ═════ */
const CACHE_VERSION='boxhunt-v6';
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('service-worker.js').catch(()=>{}));

/* On every startup: silently delete any cache buckets from old versions */
if('caches'in window){
  caches.keys().then(keys=>{
    keys.filter(k=>k!==CACHE_VERSION).forEach(k=>caches.delete(k));
  }).catch(()=>{});
}

/* Guard against corrupted localStorage (e.g. from a crashed old version) */
try{
  const test='__bh_test__';
  localStorage.setItem(test,'1');
  if(localStorage.getItem(test)!=='1')throw new Error();
  localStorage.removeItem(test);
}catch(e){
  /* localStorage broken or blocked — clear it and carry on */
  try{ localStorage.clear(); }catch(_){}
}
let deferredInstall=null;
const btnInstallApp=document.getElementById('btnInstallApp');
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;btnInstallApp.classList.remove('hidden');});
btnInstallApp.addEventListener('click',async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;btnInstallApp.classList.add('hidden');});
window.addEventListener('appinstalled',()=>btnInstallApp.classList.add('hidden'));

/* ═════ MAIN LOOP ═════ */
const clock=new THREE.Clock();
let lastFrame=performance.now();
function animate(){
  requestAnimationFrame(animate);
  const now=performance.now(),dt=(now-lastFrame)/1000;lastFrame=now;
  const t=clock.getElapsedTime();
  const active=gameRunning&&!paused&&!menuOpen;
  if(active){
    pivot.rotation.y+=computeSpinSpeed();
    if(pauseAllowed&&(now-roundStartTs>5000)){pauseAllowed=false;updatePauseButton();}
    timeLeft-=dt;
    if(timeLeft<=0){timeLeft=0;failRound();}
    updateTimerHUD();
  }else if(!gameRunning){pivot.rotation.y+=0.004;}
  pivot.position.y=Math.sin(t*0.8)*0.12;
  particles.rotation.y=t*0.04;
  renderer.render(scene,camera);
}

/* ── Init ── */
updateProUI();
updateScoreHUD();
updateLivesHUD();
updateTierHUD();
animate();

}catch(err){
  /* Catch any runtime error during init and show it clearly */
  document.getElementById('errorMsg').textContent = 'Startup error: ' + err.message + '. Try reloading, or use bundler.py to make a fully offline file.';
  document.getElementById('loadingOverlay').classList.remove('show');
  document.getElementById('errorOverlay').classList.add('show');
  console.error('Box Hunt init error:', err);
}

})(); /* end game IIFE */

