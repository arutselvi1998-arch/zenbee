import {spawn} from 'node:child_process';
import path from 'node:path';
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const browser=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless=new','--disable-gpu','--no-first-run','--remote-debugging-port=9232',
  `--user-data-dir=${path.resolve('../.tools/edge-zenbee-auth')}`,'about:blank'
],{windowsHide:true,stdio:'ignore'});
let socket;
try {
  let target;
  for(let n=0;n<30;n++) {try{target=(await(await fetch('http://127.0.0.1:9232/json')).json()).find(t=>t.type==='page');if(target)break;}catch{}await delay(300);}
  if(!target)throw Error('Browser unavailable');
  socket=new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve);socket.addEventListener('error',reject);});
  let seq=0;const pending=new Map();const errors=[];
  socket.addEventListener('message',event=>{const data=JSON.parse(event.data);if(data.id){const entry=pending.get(data.id);pending.delete(data.id);data.error?entry.reject(data.error):entry.resolve(data.result);}if(data.method==='Runtime.exceptionThrown')errors.push(data.params.exceptionDetails.text);});
  const call=(method,params={})=>new Promise((resolve,reject)=>{const id=++seq;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>(await call('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true})).result.value;
  const authStatus=await(await fetch('http://localhost:8000/api/auth/status')).json();
  const requireLogin=authStatus.required;
  await call('Runtime.enable');await call('Page.enable');await call('Page.navigate',{url:'http://localhost:3000'});
  for(let n=0;n<40;n++){if(await evaluate(requireLogin ? "!!document.querySelector('input[name=username]')" : "!!document.querySelector('.z-hero h2')"))break;await delay(250);}
  const results=[];
  for(const width of [1440,390]){
    await call('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width===390});
    results.push(await evaluate("({heading:document.querySelector('h2')?.textContent,password:document.querySelector('input[name=password]')?.type,dashboard:!!document.querySelector('.z-hero h2'),loginInput:!!document.querySelector('input[name=username]'),overflow:document.documentElement.scrollWidth>innerWidth})"));
  }
  const privateResponse=await fetch('http://localhost:8000/api/series');
  if(privateResponse.status!==(requireLogin?401:200)||results.some(r=>r.overflow||(requireLogin ? r.password!=='password' : !r.dashboard||r.loginInput))||errors.length)throw Error(JSON.stringify({results,status:privateResponse.status,errors}));
  console.log(JSON.stringify({loginRequired:requireLogin,results,unauthenticatedApiStatus:privateResponse.status,errors}));
}finally{socket?.close();browser.kill();}
