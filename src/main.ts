import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import './style.css';

type Bot = { root: THREE.Group; hp: number; alive: boolean; respawn: number; phase: number; state: 'wander'|'approach'|'retreat'|'guard'; target: THREE.Vector3; mood: number; speed: number; color: number; role:string; route:THREE.Vector3[]; waypoint:number; work:number; };
type Avatar = { root: THREE.Group; leftArm: THREE.Group; rightArm: THREE.Group; leftLeg: THREE.Group; rightLeg: THREE.Group; };
type RemotePlayer = { id:string; name:string; x:number; y:number; z:number; yaw:number; color:number };
type ServerMessage = { type:string; id?:string; players?:RemotePlayer[]; player?:RemotePlayer };
const isMobileDevice=/Mobi|Android|iPhone|iPad/i.test(navigator.userAgent)||innerWidth<760;
const $ = <T extends HTMLElement>(id:string) => document.getElementById(id) as T;
const canvas=$<HTMLCanvasElement>('game-canvas'), startScreen=$('start-screen'), gameUI=$('game-ui');
const nameInput=$<HTMLInputElement>('player-name'), healthFill=$('health-fill'), healthText=$('health-text'), killsText=$('kills'), playersText=$('players'), toast=$('toast'), netStatus=$('net-status');
const scene=new THREE.Scene(); scene.background=new THREE.Color(0x9bc9e9); scene.fog=new THREE.Fog(0x9bc9e9,100,330);
const camera=new THREE.PerspectiveCamera(68,innerWidth/innerHeight,.1,520);
const renderer=new THREE.WebGLRenderer({canvas,antialias:!isMobileDevice,powerPreference:'low-power'});
renderer.setPixelRatio(Math.min(devicePixelRatio,isMobileDevice?1:1.25)); renderer.setSize(innerWidth,innerHeight); renderer.outputColorSpace=THREE.SRGBColorSpace; renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.08;
const hemi=new THREE.HemisphereLight(0xd9efff,0x52604f,2.0); scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffe7c4,2.4); sun.position.set(-25,42,18); scene.add(sun);
const mat=(c:number,r=.88,m=0)=>new THREE.MeshStandardMaterial({color:c,roughness:r,metalness:m});
function proceduralTexture(base:string,detail:string,repeat=16){const c=document.createElement('canvas');c.width=128;c.height=128;const x=c.getContext('2d')!;x.fillStyle=base;x.fillRect(0,0,128,128);for(let i=0;i<260;i++){x.globalAlpha=Math.random()*.16;x.fillStyle=i%2?detail:'#ffffff';const px=Math.random()*256,py=Math.random()*256;x.fillRect(px,py,Math.random()*5+1,Math.random()*3+1);}x.globalAlpha=1;const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(repeat,repeat);t.colorSpace=THREE.SRGBColorSpace;return t;}
const groundMat=new THREE.MeshStandardMaterial({map:proceduralTexture('#547568','#a6b5a0',36),roughness:1});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(420,420),groundMat); floor.rotation.x=-Math.PI/2; floor.position.y=-.08; floor.receiveShadow=false; scene.add(floor);
const world=new THREE.Group(); scene.add(world);

// CC0 environment models from Kenney City Kit Suburban and Quaternius Stylized Nature MegaKit.
// Remote GLBs are cached by the browser; failures leave the rest of the world playable.
const assetLoader=new GLTFLoader();
const assetBase='https://raw.githubusercontent.com/petroulacl/fps-buildings-env-kit/main/';
const modelCache=new Map<string,THREE.Group>();
function loadWorldModel(path:string,position:THREE.Vector3,targetHeight:number,rotation=0){
 const cached=modelCache.get(path);
 const place=(source:THREE.Group)=>{const clone=source.clone(true);const bounds=new THREE.Box3().setFromObject(clone);const size=bounds.getSize(new THREE.Vector3());const scale=targetHeight/Math.max(size.y,.001);clone.scale.multiplyScalar(scale);const fitted=new THREE.Box3().setFromObject(clone);clone.position.set(position.x-fitted.min.x,position.y-fitted.min.y,position.z-fitted.min.z);clone.rotation.y=rotation;clone.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=false;mesh.receiveShadow=false;}});world.add(clone);};
 if(cached){place(cached);return;}
 assetLoader.load(assetBase+path.split('/').map(encodeURIComponent).join('/'),g=>{modelCache.set(path,g.scene);place(g.scene);},undefined,e=>console.warn('Optional CC0 world model failed:',path,e));
}

function loadWorldTile(path:string,position:THREE.Vector3,rotation=0,scale=1){
 const cached=modelCache.get(path);
 const place=(source:THREE.Group)=>{const clone=source.clone(true);clone.scale.setScalar(scale);const bounds=new THREE.Box3().setFromObject(clone);clone.position.set(position.x-(bounds.min.x+bounds.max.x)/2,position.y-bounds.min.y,position.z-(bounds.min.z+bounds.max.z)/2);clone.rotation.y=rotation;clone.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=false;mesh.receiveShadow=false;}});world.add(clone);};
 if(cached){place(cached);return;}
 assetLoader.load(assetBase+path.split('/').map(encodeURIComponent).join('/'),g=>{modelCache.set(path,g.scene);place(g.scene);},undefined,e=>console.warn('Optional CC0 road tile failed:',path,e));
}

// Quaternius Medieval Village MegaKit (CC0) modular glTF assets.
const medievalBase='https://raw.githubusercontent.com/J-Ponzo/gltf-medieval-village-megakit/main/glTF/';
function loadMedievalPiece(file:string,position:THREE.Vector3,rotation=0){
 const key='medieval:'+file;
 const place=(source:THREE.Group)=>{
  const clone=source.clone(true);clone.rotation.y=rotation;
  const bounds=new THREE.Box3().setFromObject(clone),center=bounds.getCenter(new THREE.Vector3());
  clone.position.set(position.x-center.x,position.y-bounds.min.y,position.z-center.z);
  clone.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}});
  world.add(clone);
 };
 const cached=modelCache.get(key);
 if(cached){place(cached);return;}
 assetLoader.load(medievalBase+file,g=>{modelCache.set(key,g.scene);place(g.scene);},undefined,e=>console.warn('Medieval village asset failed:',file,e));
}
function buildMedievalHouse(cx:number,cz:number){
 for(const dx of [-1,1])for(const dz of [-1,1])loadMedievalPiece('Floor_Brick.gltf',new THREE.Vector3(cx+dx,0,cz+dz));
 loadMedievalPiece('Wall_Plaster_Door_Round.gltf',new THREE.Vector3(cx-1,0,cz+2));
 loadMedievalPiece('Wall_Plaster_Window_Wide_Round.gltf',new THREE.Vector3(cx+1,0,cz+2));
 for(const x of [-1,1])loadMedievalPiece('Wall_Plaster_Straight.gltf',new THREE.Vector3(cx+x,0,cz-2),Math.PI);
 for(const z of [-1,1]){
  loadMedievalPiece('Wall_Plaster_Straight.gltf',new THREE.Vector3(cx-2,0,cz+z),Math.PI/2);
  loadMedievalPiece('Wall_Plaster_Straight.gltf',new THREE.Vector3(cx+2,0,cz+z),-Math.PI/2);
 }
 loadMedievalPiece('Roof_RoundTiles_4x4.gltf',new THREE.Vector3(cx,3.12,cz));
}

function box(parent:THREE.Object3D,w:number,h:number,d:number,c:number,x:number,y:number,z:number){const m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),mat(c));m.position.set(x,y,z);parent.add(m);return m;}
function buildWorld(){
  // Expanded district: central plaza, roads, residential blocks, shops and park.
  // Modular CC0 Kenney road kit tiles replace flat prototype road planes.
  const roadStraight='props/kenney-city-kit-roads/Models/GLB format/road-straight.glb',roadCross='props/kenney-city-kit-roads/Models/GLB format/road-crossroad.glb',roadCrossing='props/kenney-city-kit-roads/Models/GLB format/road-crossing.glb';
  for(let n=-17;n<=17;n+=isMobileDevice?2:1){const offset=n*12;if(n!==0){loadWorldTile(roadStraight,new THREE.Vector3(offset,0,0),Math.PI/2,1.2);loadWorldTile(roadStraight,new THREE.Vector3(0,0,offset),0,1.2);}}
  loadWorldTile(roadCross,new THREE.Vector3(0,0,0),0,1.2);
  for(const p of [-60,60]){loadWorldTile(roadCrossing,new THREE.Vector3(p,0,0),Math.PI/2,1.2);loadWorldTile(roadCrossing,new THREE.Vector3(0,0,p),0,1.2);}
  // Replace the old coloured box-building placeholders with licensed, textured GLB buildings.
  const buildingModels=['building-type-a.glb','building-type-b.glb','building-type-c.glb','building-type-d.glb','building-type-e.glb','building-type-f.glb','building-type-g.glb','building-type-h.glb','building-type-i.glb','building-type-j.glb','building-type-k.glb'];
  let buildingIndex=0;
  for(let z=-100;z<=100;z+=50){for(let x=-100;x<=100;x+=50){if(Math.abs(x)<24&&Math.abs(z)<24)continue;if(isMobileDevice&&(Math.abs(x)>50||Math.abs(z)>50))continue;const file=buildingModels[buildingIndex++%buildingModels.length];loadWorldModel('buildings/kenney-city-kit-suburban/Models/GLB format/'+file,new THREE.Vector3(x,0,z),13+(Math.abs(x*z)%9),((buildingIndex%4)*Math.PI/2));}}
  // town square and market lane
  box(world,18,.22,12,0x9b9b91,0,0,-15); box(world,7,.08,52,0xb5a98e,0,.02,0);
  // Real CC0 shopfront models replace the coloured box-building stand-ins.
  for(let i=0;i<4;i++){const x=-30+i*20;const file=buildingModels[(i+3)%buildingModels.length];loadWorldModel('buildings/kenney-city-kit-suburban/Models/GLB format/'+file,new THREE.Vector3(x,0,-30),10+(i%2)*2,(i%2)*Math.PI);}
  for(let i=0;i<3;i++){const x=-18+i*18;loadWorldModel('props/kenney-city-kit-roads/Models/GLB format/construction-cone.glb',new THREE.Vector3(x,0,14),.75,(i%2)*Math.PI);}
  // benches, crates, lamps, flower beds
  for(let i=0;i<6;i++){const x=-20+i*8; box(world,2.4,.25,.55,0x79563c,x,.65,7); box(world,.18,.6,.18,0x3c4850,x-1,.3,7);box(world,.18,.6,.18,0x3c4850,x+1,.3,7);}
  const treeFiles=['Tree.glb','Pine.glb','Twisted Tree.glb','Dead Tree.glb'];
  for(let i=0;i<(isMobileDevice?10:18);i++){const radius=44+(i%4)*18,x=Math.sin(i*2.2)*radius,z=Math.cos(i*2.2)*radius;const tree=treeFiles[i%treeFiles.length];loadWorldModel('environment/vegetation/polypizza-stylized-nature-gltf/'+tree,new THREE.Vector3(x,0,z),i%4===1?9:6.5,(i%7)*.72);}
  // Street-light props are real CC0 GLB models rather than cylinders and spheres.
  for(let i=0;i<(isMobileDevice?6:10);i++){const x=-78+i*16;loadWorldModel('props/kenney-city-kit-roads/Models/GLB format/light-square.glb',new THREE.Vector3(x,0,-8),5.2,Math.PI);}
  // Medieval old-town quarter built from modular Quaternius CC0 village pieces.
  buildMedievalHouse(138,126);
  buildMedievalHouse(151,126);
  buildMedievalHouse(144,140);
  for(let i=0;i<9;i++)loadMedievalPiece('Floor_UnevenBrick.gltf',new THREE.Vector3(140+i*2,0,117));
  loadMedievalPiece('Prop_Wagon.gltf',new THREE.Vector3(157,0,137),Math.PI/2);
  loadMedievalPiece('Prop_Crate.gltf',new THREE.Vector3(154,0,137));
  for(let i=0;i<8;i++)loadMedievalPiece('Prop_WoodenFence_Single.gltf',new THREE.Vector3(132+i*2,0,144),Math.PI/2);
}
buildWorld();

function makeAvatar(color:number, outfit='casual'):Avatar{
 const root=new THREE.Group();
 const skin=mat(0xe8b995), cloth=mat(color), pants=mat(outfit==='guard'?0x303c4a:0x202b3d), shoes=mat(0x151c28), hair=mat(0x30251f), dark=mat(0x231b1b);
 const torso=new THREE.Group(); torso.position.y=1.43; root.add(torso);
 const body=new THREE.Mesh(new THREE.CapsuleGeometry(.38,.55,4,8),cloth);body.scale.set(1,.94,.62);body.position.y=.05;torso.add(body);
 // neck and head with eyes, brows, nose, mouth, ears and hair
 const neck=new THREE.Mesh(new THREE.CylinderGeometry(.12,.14,.22,8),skin);neck.position.y=.54;torso.add(neck);
 const head=new THREE.Group();head.position.set(0,.91,0);torso.add(head);
 const skull=new THREE.Mesh(new THREE.SphereGeometry(.31,16,12),skin);skull.scale.set(.91,1.12,.88);head.add(skull);
 const faceZ=-.27;
 for(const x of [-.105,.105]){const eye=new THREE.Mesh(new THREE.SphereGeometry(.043,10,8),mat(0xf8f5ed));eye.position.set(x,.035,faceZ);head.add(eye);const pupil=new THREE.Mesh(new THREE.SphereGeometry(.022,8,6),mat(0x292b31));pupil.position.set(x,.035,faceZ-.035);head.add(pupil);const brow=new THREE.Mesh(new THREE.BoxGeometry(.105,.025,.035),hair);brow.position.set(x,.105,faceZ+.005);head.add(brow);}
 const nose=new THREE.Mesh(new THREE.SphereGeometry(.045,8,6),skin);nose.scale.set(.72,1,.8);nose.position.set(0,-.035,faceZ-.035);head.add(nose);
 const mouth=new THREE.Mesh(new THREE.BoxGeometry(.105,.018,.018),mat(0x824b4b));mouth.position.set(0,-.13,faceZ-.005);head.add(mouth);
 for(const x of [-.29,.29]){const ear=new THREE.Mesh(new THREE.SphereGeometry(.07,8,6),skin);ear.position.set(x,-.015,0);head.add(ear);}
 const cap=new THREE.Mesh(new THREE.SphereGeometry(.305,12,8,0,Math.PI*2,0,Math.PI*.55),hair);cap.position.y=.12;head.add(cap);
 // articulated limbs
 function limb(x:number,y:number,isArm:boolean){const pivot=new THREE.Group();pivot.position.set(x,y,0);root.add(pivot);const length=isArm?.62:.72;const upper=new THREE.Mesh(new THREE.CapsuleGeometry(isArm?.115:.145,length*.42,4,8),isArm?cloth:pants);upper.position.y=-length*.38;pivot.add(upper);const joint=new THREE.Mesh(new THREE.SphereGeometry(isArm?.105:.13,8,6),isArm?skin:pants);joint.position.y=-length*.72;pivot.add(joint);const lower=new THREE.Mesh(new THREE.CapsuleGeometry(isArm?.095:.12,length*.35,4,8),isArm?skin:pants);lower.position.y=-length*.98;pivot.add(lower);if(!isArm){const shoe=new THREE.Mesh(new THREE.BoxGeometry(.25,.14,.38),shoes);shoe.position.set(0,-length*1.27,-.07);pivot.add(shoe);}return pivot;}
 const leftArm=limb(-.45,1.87,true),rightArm=limb(.45,1.87,true),leftLeg=limb(-.19,.93,false),rightLeg=limb(.19,.93,false);
 // accessories: simple backpack
 const pack=box(root,.43,.55,.2,0x3b5366,0,1.48,.31);pack.rotation.x=-.08;
 return {root,leftArm,rightArm,leftLeg,rightLeg};
}
const player=makeAvatar(0x43cbb7);scene.add(player.root);
const petGroup=new THREE.Group();scene.add(petGroup);let petMixer:THREE.AnimationMixer|null=null;let petWalk:THREE.AnimationAction|null=null;let petIdle:THREE.AnimationAction|null=null;let petReady=false;let petTarget=new THREE.Vector3(13,0,18);let petPhase=0;
const petLoader=new GLTFLoader();if(!isMobileDevice)petLoader.load('https://gobkit.com/freebies/animal/Corgi.glb',g=>{const dog=g.scene;const bounds=new THREE.Box3().setFromObject(dog);const size=bounds.getSize(new THREE.Vector3());dog.scale.setScalar(1.15/Math.max(size.y,.001));dog.position.y=0;dog.rotation.y=Math.PI;dog.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=true;(o as THREE.Mesh).receiveShadow=true;}});petGroup.add(dog);petMixer=new THREE.AnimationMixer(dog);if(g.animations[0]){const idle=THREE.AnimationUtils.subclip(g.animations[0],'idle',0,30,24);const walk=THREE.AnimationUtils.subclip(g.animations[0],'walk',90,120,24);petIdle=petMixer.clipAction(idle);petWalk=petMixer.clipAction(walk);petIdle.play();}petReady=true;},undefined,()=>console.warn('Optional CC0 dog model failed to load; world remains playable.'));
const bots:Bot[]=[];const botColors=[0xff795f,0xffc857,0x9c83ff,0x70a7ff,0xe77ea9,0x91c46b,0xd19b6d,0x69b7c7,0xd98d54,0x65a9a0,0xb17ca1,0xc3b36d];
const jobs=[{role:'shopkeeper',route:[[-13,-15],[-13,-15],[-13,-15]]},{role:'courier',route:[[5,-8],[35,-8],[35,28],[5,28]]},{role:'gardener',route:[[-36,35],[-52,35],[-52,55],[-36,55]]},{role:'builder',route:[[40,-40],[58,-40],[58,-20],[40,-20]]},{role:'guard',route:[[0,-28],[0,28],[28,28],[28,-28]]},{role:'citizen',route:[[-30,-20],[-30,22],[25,22],[25,-20]]},{role:'vendor',route:[[14,14],[14,14],[14,14]]},{role:'cleaner',route:[[-20,0],[-20,22],[20,22],[20,0]]},{role:'student',route:[[48,48],[62,48],[62,62],[48,62]]},{role:'mechanic',route:[[70,5],[88,5],[88,22],[70,22]]},{role:'dog walker',route:[[-75,-20],[-60,-20],[-60,-38],[-75,-38]]},{role:'resident',route:[[80,-55],[98,-55],[98,-35],[80,-35]]}];
const activeJobs=isMobileDevice?jobs.slice(0,6):jobs;
for(let i=0;i<activeJobs.length;i++){const a=makeAvatar(botColors[i]);const job=activeJobs[i];const route=job.route.map(p=>new THREE.Vector3(p[0],0,p[1]));a.root.userData.limbs=[a.leftArm,a.rightArm,a.leftLeg,a.rightLeg];a.root.position.copy(route[0]);scene.add(a.root);bots.push({root:a.root,hp:100,alive:true,respawn:0,phase:i*1.7,state:'wander',target:route[0].clone(),mood:i%4,speed:job.role==='courier'?2.8:1.1+(i%3)*.35,color:botColors[i],role:job.role,route,waypoint:1,work:0});}

type CharacterGender='male'|'female';
const characterSources=new Map<CharacterGender,THREE.Group>();
const characterLoading=new Set<CharacterGender>();
const characterTargets:{root:THREE.Group;gender:CharacterGender}[]=[];
function attachCharacterModel(root:THREE.Group,gender:CharacterGender,source:THREE.Group){
 const model=cloneSkeleton(source) as THREE.Group;
 const bounds=new THREE.Box3().setFromObject(model);
 const size=bounds.getSize(new THREE.Vector3());
 const scale=1.82/Math.max(size.y,.001);
 model.scale.setScalar(scale);
 model.position.y=-bounds.min.y*scale;
 const characterBones:Record<string,{bone:THREE.Object3D;baseX:number;baseZ:number}>={};
 model.traverse(o=>{const mesh=o as THREE.Mesh;if(mesh.isMesh){mesh.castShadow=true;mesh.receiveShadow=true;}const n=o.name.toLowerCase();if(['upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','thigh_l','thigh_r','calf_l','calf_r','spine_02','head','neck_01'].includes(n))characterBones[n]={bone:o,baseX:o.rotation.x,baseZ:o.rotation.z};});
 root.userData.characterBones=characterBones;
 root.clear();
 root.add(model);
 root.userData.hasRealCharacterModel=true;
}
function useCharacterModel(root:THREE.Group,gender:CharacterGender){
 const cached=characterSources.get(gender);
 if(cached){attachCharacterModel(root,gender,cached);return;}
 characterTargets.push({root,gender});
 if(characterLoading.has(gender))return;
 characterLoading.add(gender);
 assetLoader.load(import.meta.env.BASE_URL+'assets/characters/Superhero_'+(gender==='male'?'Male':'Female')+'_FullBody.gltf',g=>{
  characterSources.set(gender,g.scene);
  for(const target of characterTargets.filter(t=>t.gender===gender&&t.root.parent))attachCharacterModel(target.root,gender,g.scene);
 },undefined,error=>console.warn('Character model failed to load:',gender,error));
}
useCharacterModel(player.root,'male');
bots.forEach((bot,index)=>useCharacterModel(bot.root,index%3===1?'female':'male'));

const remotes=new Map<string,{avatar:Avatar;target:THREE.Vector3;name:string}>();
const keys=new Set<string>(),playerPos=new THREE.Vector3(0,0,5),raycaster=new THREE.Raycaster(),clock=new THREE.Clock();
let yaw=0,pitch=-.12,vy=0,health=100,kills=0,playing=false,pointerLocked=false,fireCooldown=0,network:WebSocket|null=null,ownId='',joystick={x:0,y:0},touchLook=false,lastTouchX=0,lastTouchY=0,lastNetSend=0,toastTimer=0,walkPhase=0;
let equipped='Blaster',quality=isMobileDevice?'low':'medium',sensitivity=1,showInventory=false;
let cameraMode:'third'|'first'='third',sprintMode:'hold'|'toggle'='hold',crouchMode:'hold'|'toggle'='hold';
let sprintLatched=false,crouchLatched=false,invertLook=false,smoothCamera=true,reducedMotion=false,showCrosshair=true,leftHanded=false,cameraDistance=5.8,hudScale=1;
function saveGameSettings(){try{localStorage.setItem('vexora-game-settings',JSON.stringify({cameraMode,sprintMode,crouchMode,invertLook,smoothCamera,reducedMotion,showCrosshair,leftHanded,cameraDistance,hudScale,sensitivity}));}catch{}}
function loadGameSettings(){try{const s=JSON.parse(localStorage.getItem('vexora-game-settings')||'{}');cameraMode=s.cameraMode==='first'?'first':'third';sprintMode=s.sprintMode==='toggle'?'toggle':'hold';crouchMode=s.crouchMode==='toggle'?'toggle':'hold';invertLook=!!s.invertLook;smoothCamera=s.smoothCamera!==false;reducedMotion=!!s.reducedMotion;showCrosshair=s.showCrosshair!==false;leftHanded=!!s.leftHanded;cameraDistance=THREE.MathUtils.clamp(Number(s.cameraDistance)||5.8,3,12);hudScale=THREE.MathUtils.clamp(Number(s.hudScale)||1,.8,1.2);sensitivity=THREE.MathUtils.clamp(Number(s.sensitivity)||1,.4,2);}catch{}}

const showToast=(s:string)=>{toast.textContent=s;toast.classList.add('visible');toastTimer=2.4;};
function updateHealth(){healthFill.style.width=health+'%';healthText.textContent=String(Math.ceil(health));}
function setQuality(q:string){quality=q;const dpr=q==='low'?.75:q==='medium'?1:q==='high'?1.35:1;const shadowsEnabled=q==='high'&&!isMobileDevice;renderer.setPixelRatio(Math.min(devicePixelRatio,isMobileDevice?1:dpr));renderer.shadowMap.enabled=shadowsEnabled;renderer.shadowMap.type=THREE.BasicShadowMap;sun.castShadow=shadowsEnabled;sun.shadow.mapSize.set(shadowsEnabled?512:256,shadowsEnabled?512:256);sun.shadow.camera.left=-55;sun.shadow.camera.right=55;sun.shadow.camera.top=55;sun.shadow.camera.bottom=-55;scene.traverse(o=>{if((o as THREE.Mesh).isMesh){(o as THREE.Mesh).castShadow=shadowsEnabled;(o as THREE.Mesh).receiveShadow=shadowsEnabled;}});renderer.setSize(innerWidth,innerHeight);$('quality-select').querySelectorAll('option').forEach(o=>(o as HTMLOptionElement).selected=(o as HTMLOptionElement).value===q);try{localStorage.setItem('vexora-quality',q);}catch{}}
function addRemote(p:RemotePlayer){if(p.id===ownId||remotes.has(p.id))return;const avatar=makeAvatar(p.color||0x70a7ff);avatar.root.position.set(p.x,p.y,p.z);scene.add(avatar.root);remotes.set(p.id,{avatar,target:new THREE.Vector3(p.x,p.y,p.z),name:p.name});}
function connect(){const url=(import.meta as ImportMeta & {env:{VITE_WS_URL?:string}}).env.VITE_WS_URL;if(!url){netStatus.textContent='PRACTICE';return;}try{network=new WebSocket(url);network.onopen=()=>{netStatus.textContent='ONLINE';network?.send(JSON.stringify({type:'hello',name:nameInput.value}));};network.onmessage=e=>{let m:ServerMessage;try{m=JSON.parse(e.data) as ServerMessage;}catch{return;}if(m.type==='welcome'){ownId=m.id||'';(m.players||[]).forEach(addRemote);}if(m.type==='join'&&m.player)addRemote(m.player);if(m.type==='move'&&m.player){const r=remotes.get(m.player.id);if(r)r.target.set(m.player.x,m.player.y,m.player.z);else addRemote(m.player);}if(m.type==='leave'&&m.id){const r=remotes.get(m.id);if(r)scene.remove(r.avatar.root);remotes.delete(m.id);}};network.onclose=()=>netStatus.textContent='DISCONNECTED';network.onerror=()=>netStatus.textContent='CONNECTION ERROR';}catch{netStatus.textContent='PRACTICE';}}
function start(){if(playing)return;playing=true;startScreen.classList.add('hidden');gameUI.classList.remove('hidden');playerPos.set(0,0,5);health=100;updateHealth();connect();if(!/Mobi|Android/i.test(navigator.userAgent))canvas.requestPointerLock?.();showToast('Welcome to VEXORA! Explore the town.');}
function leave(){playing=false;document.exitPointerLock?.();network?.close();network=null;gameUI.classList.add('hidden');startScreen.classList.remove('hidden');}
function fire(){if(!playing||fireCooldown>0)return;fireCooldown=equipped==='Blaster'?.24:.48;const dir=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion).normalize();raycaster.set(camera.position,dir);raycaster.far=equipped==='Blaster'?48:3.2;const hits=raycaster.intersectObjects(bots.filter(b=>b.alive).map(b=>b.root),true);if(hits.length){const b=bots.find(b=>b.alive&&b.root===hits[0].object.parent?.parent?.parent?.parent)||bots.find(b=>b.alive&&b.root.getObjectById(hits[0].object.id));if(b){b.hp-=equipped==='Blaster'?50:25;if(b.hp<=0){b.alive=false;b.root.visible=false;b.respawn=5;kills++;killsText.textContent=String(kills);showToast('NPC defeated +1');}}}}
function damage(n:number){health=Math.max(0,health-n);updateHealth();if(!health){playerPos.set(0,0,5);health=100;updateHealth();showToast('You respawned at the town square.');}}
function look(dx:number,dy:number){yaw-=dx*.003*sensitivity;pitch=THREE.MathUtils.clamp(pitch+(invertLook?1:-1)*dy*.0025*sensitivity,-.9,.5);}
document.addEventListener('keydown',e=>{if(['Space','ArrowUp','ArrowDown'].includes(e.code))e.preventDefault();if(!keys.has(e.code)){if(sprintMode==='toggle'&&(e.code==='ShiftLeft'||e.code==='ShiftRight'))sprintLatched=!sprintLatched;if(crouchMode==='toggle'&&(e.code==='ControlLeft'||e.code==='ControlRight'))crouchLatched=!crouchLatched;}keys.add(e.code);if(e.code==='KeyE'||e.code==='KeyF')interact();if((!leftHanded&&e.code==='KeyI')||e.code==='Tab'){if(e.code==='Tab')e.preventDefault();toggleInventory();}if(e.code==='KeyV'){cameraMode=cameraMode==='third'?'first':'third';$<HTMLSelectElement>('camera-mode-select').value=cameraMode;saveGameSettings();showToast(cameraMode==='first'?'First-person view':'Third-person view');}if(e.code==='Escape'&&playing) $('settings-panel').classList.toggle('hidden');});
document.addEventListener('keyup',e=>keys.delete(e.code));document.addEventListener('pointerlockchange',()=>pointerLocked=document.pointerLockElement===canvas);document.addEventListener('mousemove',e=>{if(pointerLocked&&playing)look(e.movementX,e.movementY);});
canvas.addEventListener('click',()=>{if(playing&&!pointerLocked&&!/Mobi|Android/i.test(navigator.userAgent))canvas.requestPointerLock?.();else fire();});
$('play-btn').addEventListener('click',start);$('leave-btn').addEventListener('click',leave);
$('fire-btn').addEventListener('pointerdown',e=>{e.preventDefault();fire();});$('jump-btn').addEventListener('pointerdown',e=>{e.preventDefault();if(playerPos.y<.03)vy=7;});
$('sound-btn').addEventListener('click',()=>showToast('Sound options coming in a future update.'));
$('settings-btn').addEventListener('click',()=>$('settings-panel').classList.toggle('hidden'));
$('close-settings').addEventListener('click',()=>$('settings-panel').classList.add('hidden'));
$('inventory-btn').addEventListener('click',toggleInventory);$('close-inventory').addEventListener('click',toggleInventory);
$('quality-select').addEventListener('change',e=>setQuality((e.target as HTMLSelectElement).value));
$('fov-range').addEventListener('input',e=>{camera.fov=Number((e.target as HTMLInputElement).value);camera.updateProjectionMatrix();$('fov-value').textContent=String(camera.fov);});
$('sensitivity-range').addEventListener('input',e=>{sensitivity=Number((e.target as HTMLInputElement).value)/100;$('sensitivity-value').textContent=(sensitivity*100).toFixed(0)+'%';saveGameSettings();});
$('control-preset').addEventListener('change',e=>{leftHanded=(e.target as HTMLSelectElement).value==='left';saveGameSettings();showToast(leftHanded?'Left-handed IJKL controls':'Standard WASD controls');});
$('camera-mode-select').addEventListener('change',e=>{cameraMode=(e.target as HTMLSelectElement).value as 'first'|'third';saveGameSettings();});
$('sprint-mode-select').addEventListener('change',e=>{sprintMode=(e.target as HTMLSelectElement).value as 'hold'|'toggle';sprintLatched=false;saveGameSettings();});
$('crouch-mode-select').addEventListener('change',e=>{crouchMode=(e.target as HTMLSelectElement).value as 'hold'|'toggle';crouchLatched=false;saveGameSettings();});
$('invert-look').addEventListener('change',e=>{invertLook=(e.target as HTMLInputElement).checked;saveGameSettings();});
$('camera-smoothing').addEventListener('change',e=>{smoothCamera=(e.target as HTMLInputElement).checked;saveGameSettings();});
$('reduced-motion').addEventListener('change',e=>{reducedMotion=(e.target as HTMLInputElement).checked;saveGameSettings();});
$('show-crosshair').addEventListener('change',e=>{showCrosshair=(e.target as HTMLInputElement).checked;saveGameSettings();});
$('camera-distance').addEventListener('input',e=>{cameraDistance=Number((e.target as HTMLInputElement).value);$('camera-distance-value').textContent=cameraDistance.toFixed(1);saveGameSettings();});
$('hud-scale').addEventListener('input',e=>{hudScale=Number((e.target as HTMLInputElement).value)/100;$('hud-scale-value').textContent=Math.round(hudScale*100)+'%';$('game-ui').style.setProperty('--hud-scale',String(hudScale));saveGameSettings();});
$('equip-select').addEventListener('change',e=>{equipped=(e.target as HTMLSelectElement).value;showToast(equipped+' equipped');});
$('interact-btn').addEventListener('pointerdown',e=>{e.preventDefault();interact();});$('interact-btn-mobile').addEventListener('pointerdown',e=>{e.preventDefault();interact();});
function toggleInventory(){showInventory=!showInventory;$('inventory-panel').classList.toggle('hidden',!showInventory);}
function interact(){if(!playing)return;let nearest:Bot|null=null,dist=4;for(const b of bots){if(!b.alive)continue;const d=b.root.position.distanceTo(playerPos);if(d<dist){nearest=b;dist=d;}}showToast(nearest?'NPC: '+['Hello!','Nice weather today.','Want to train?','Stay alert!'][Math.floor(Math.random()*4)]:'No one nearby. Explore the town!');}
canvas.addEventListener('touchstart',e=>{if(!playing)return;const t=e.changedTouches[0];if(t.clientX>innerWidth*.42){touchLook=true;lastTouchX=t.clientX;lastTouchY=t.clientY;}},{passive:true});
canvas.addEventListener('touchmove',e=>{if(!touchLook)return;const t=e.changedTouches[0];look(t.clientX-lastTouchX,t.clientY-lastTouchY);lastTouchX=t.clientX;lastTouchY=t.clientY;},{passive:true});canvas.addEventListener('touchend',()=>touchLook=false);
const joy=$('joystick'),stick=$('stick');joy.addEventListener('pointerdown',e=>{joy.setPointerCapture(e.pointerId);updateJoy(e);});joy.addEventListener('pointermove',e=>{if(e.buttons)updateJoy(e);});joy.addEventListener('pointerup',()=>{joystick={x:0,y:0};stick.style.transform='translate(0,0)';});
function updateJoy(e:PointerEvent){const r=joy.getBoundingClientRect(),dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,len=Math.max(1,Math.hypot(dx,dy)),s=Math.min(1,40/len);joystick={x:dx/len*s,y:dy/len*s};stick.style.transform=`translate(${joystick.x*40}px,${joystick.y*40}px)`;}
function animateCharacter(root:THREE.Group,phase:number,moving:boolean,options:{sprinting?:boolean;crouching?:boolean;airborne?:boolean;working?:boolean}={}){
 const bones=root.userData.characterBones as Record<string,{bone:THREE.Object3D;baseX:number;baseZ:number}>|undefined;if(!bones)return;
 const stride=moving?Math.sin(phase)*(options.sprinting?.92:.62):0;const idle=Math.sin(phase*.8)*.025;const work=!!options.working&&!moving;
 const set=(name:string,x:number,z=0)=>{const b=bones[name];if(b){b.bone.rotation.x=b.baseX+x;b.bone.rotation.z=b.baseZ+z;}};
 set('thigh_l',-stride+(options.crouching?-.48:0));set('thigh_r',stride+(options.crouching?-.48:0));set('calf_l',Math.max(0,stride)*.65);set('calf_r',Math.max(0,-stride)*.65);
 set('upperarm_l',work?-.78:-stride*.72,work?.12:0);set('upperarm_r',work?-.52:stride*.72,work?-.12:0);set('lowerarm_l',work?-.35:0);set('lowerarm_r',work?-.28:0);
 set('spine_02',idle+(options.airborne?-.08:0));set('neck_01',Math.sin(phase*.45)*.018);set('head',Math.sin(phase*.55)*.018);
}
function update(dt:number){
 if(!playing)return;fireCooldown=Math.max(0,fireCooldown-dt);toastTimer-=dt;if(toastTimer<=0)toast.classList.remove('visible');
 const f=(keys.has(leftHanded?'KeyI':'KeyW')||keys.has('ArrowUp')?1:0)-(keys.has(leftHanded?'KeyK':'KeyS')||keys.has('ArrowDown')?1:0)-joystick.y,s=(keys.has(leftHanded?'KeyL':'KeyD')||keys.has('ArrowRight')?1:0)-(keys.has(leftHanded?'KeyJ':'KeyA')||keys.has('ArrowLeft')?1:0)+joystick.x;
 const forward=new THREE.Vector3(-Math.sin(yaw),0,-Math.cos(yaw)),right=new THREE.Vector3(Math.cos(yaw),0,-Math.sin(yaw)),move=forward.multiplyScalar(f).addScaledVector(right,s);if(move.lengthSq()>1)move.normalize();
 const sprintHeld=keys.has('ShiftLeft')||keys.has('ShiftRight'),crouchHeld=keys.has('ControlLeft')||keys.has('ControlRight');const sprint=sprintMode==='toggle'?sprintLatched:sprintHeld,crouch=crouchMode==='toggle'?crouchLatched:crouchHeld;const speed=crouch?3.1:sprint?12:7.5;playerPos.addScaledVector(move,speed*dt);playerPos.x=THREE.MathUtils.clamp(playerPos.x,-195,195);playerPos.z=THREE.MathUtils.clamp(playerPos.z,-195,195);
 if(keys.has('Space')&&playerPos.y<.03)vy=7;vy-=18*dt;playerPos.y=Math.max(0,playerPos.y+vy*dt);if(!playerPos.y)vy=0;
 player.root.position.copy(playerPos);player.root.rotation.y=yaw;const moving=move.lengthSq()>.01;if(moving)walkPhase+=dt*(sprint?13:8);animateCharacter(player.root,walkPhase,moving,{sprinting:sprint,crouching:crouch,airborne:playerPos.y>.08});
 for(const b of bots){
  if(!b.alive){b.respawn-=dt;if(b.respawn<=0){b.alive=true;b.hp=100;b.root.visible=true;b.root.position.copy(b.route[0]);b.waypoint=1;b.work=0;}continue;}
  b.phase+=dt;
  // NPCs follow assigned lives and routes. They do not target or chase the player.
  const workRole=['shopkeeper','vendor','builder','gardener','mechanic','cleaner'].includes(b.role);
  if(workRole){b.work+=dt;if(b.work>7){b.work=0;b.waypoint=(b.waypoint+1)%b.route.length;}}
  const goal=b.route[b.waypoint]||b.route[0];const dx=goal.x-b.root.position.x,dz=goal.z-b.root.position.z,dist=Math.hypot(dx,dz);
  let moving=false;
  if(dist>.65){const step=Math.min(dist,b.speed*dt);b.root.position.x+=dx/dist*step;b.root.position.z+=dz/dist*step;b.root.rotation.y=Math.atan2(-dx,-dz);moving=true;}
  else if(!workRole){b.work+=dt;if(b.work>2.5){b.work=0;b.waypoint=(b.waypoint+1)%b.route.length;}}
  else {b.root.rotation.y=Math.sin(b.phase*.45)*.35; }
  // small job-specific motions: sweeping, gardening, building, serving and shop idles
  const isWorking=!moving&&workRole;
  animateCharacter(b.root,b.phase*7,moving,{working:isWorking});
  b.root.position.y=moving?Math.abs(Math.sin(b.phase*8))*.035:Math.sin(b.phase*2)*.008;
 }
 
 for(const r of remotes.values())r.avatar.root.position.lerp(r.target,Math.min(1,dt*12));
 if(petReady){petPhase+=dt;const dog=petGroup.children[0];if(dog){const d=petTarget.clone().sub(dog.position);if(d.length()<1){petTarget.set(Math.sin(petPhase*.23)*38,0,Math.cos(petPhase*.19)*38);}else{d.normalize();dog.position.addScaledVector(d,dt*1.8);dog.rotation.y=Math.atan2(d.x,d.z);if(petWalk&&!petWalk.isRunning()){petIdle?.stop();petWalk.reset().play();}}if(petMixer)petMixer.update(dt);}}
 const target=new THREE.Vector3(playerPos.x,playerPos.y+(cameraMode==='first'?1.62:1.45),playerPos.z);const offset=cameraMode==='first'?new THREE.Vector3(0,.05,0):new THREE.Vector3(Math.sin(yaw)*cameraDistance,2.9+pitch*2,Math.cos(yaw)*cameraDistance);const desired=target.clone().add(offset);if(smoothCamera&&!reducedMotion)camera.position.lerp(desired,1-Math.exp(-dt*9));else camera.position.copy(desired);camera.lookAt(target);$('crosshair').classList.toggle('hidden',!showCrosshair||cameraMode==='third');
 if(network?.readyState===WebSocket.OPEN&&performance.now()-lastNetSend>65){network.send(JSON.stringify({type:'move',x:playerPos.x,y:playerPos.y,z:playerPos.z,yaw}));lastNetSend=performance.now();}
 playersText.textContent=String(1+remotes.size+bots.filter(b=>b.alive).length);
}
let lastRender=0;function render(){requestAnimationFrame(render);const now=performance.now();const frameLimit=isMobileDevice&&quality==='low'?33:quality==='medium'?20:0;if(frameLimit&&now-lastRender<frameLimit)return;lastRender=now;const dt=Math.min(clock.getDelta(),.05);update(dt);if(!playing){camera.position.set(Math.sin(clock.elapsedTime*.12)*30,19,36);camera.lookAt(0,0,0);}renderer.render(scene,camera);}
render();addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);setQuality(quality);});
loadGameSettings();try{setQuality(localStorage.getItem('vexora-quality')||(isMobileDevice?'low':'medium'));}catch{setQuality(isMobileDevice?'low':'medium');}camera.fov=68;camera.updateProjectionMatrix();$<HTMLSelectElement>('camera-mode-select').value=cameraMode;$<HTMLSelectElement>('control-preset').value=leftHanded?'left':'standard';$<HTMLSelectElement>('sprint-mode-select').value=sprintMode;$<HTMLSelectElement>('crouch-mode-select').value=crouchMode;$<HTMLInputElement>('invert-look').checked=invertLook;$<HTMLInputElement>('camera-smoothing').checked=smoothCamera;$<HTMLInputElement>('reduced-motion').checked=reducedMotion;$<HTMLInputElement>('show-crosshair').checked=showCrosshair;$<HTMLInputElement>('camera-distance').value=String(cameraDistance);$('camera-distance-value').textContent=cameraDistance.toFixed(1);$<HTMLInputElement>('hud-scale').value=String(Math.round(hudScale*100));$('hud-scale-value').textContent=Math.round(hudScale*100)+'%';$('game-ui').style.setProperty('--hud-scale',String(hudScale));
