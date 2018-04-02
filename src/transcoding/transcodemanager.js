const WebSocket = require('ws');
import  {FinalMsg, StatusMsg} from "./messages";


// Load utils functions
const getHTTPContent = require('../utils.js').getContent;

class Hardware{
  constructor(core,gpu,vaapi,omx){
    this.core = cores;
    this.gpu = gpu;
    this.vaapi = vaapi;
    this.omx = omx;
  }
}

class Process{
  constructor(cmd,args,priority,hw, onStart, onStop, onProgression, onFinal){
    this.cmd = cmd;
    this.args = args;
    this.hw = hw;
    this.priority = priority;
    this.isRunning = false;
    this.isWaiting = false;
    this.onStart = onStart;
    this.onStop = onStop;
    this.onProgression = onProgression;
    this.onFinal = onFinal;
    this.onError = onError;
    this._finished = false;
    this.ws = null;
  }

  // System callbacks
  _onStop(autoRestart){
    this.isRunning = false;
    this.autoRestart = autoRestart;
    onStop(autoRestart);
  }

  _onStart(){
    this.isRunning = true;
    onStart();
  }

  _onMessage(msg){
    
    if(msg)
    onProgression(msg);
    onFinal(msg);
  }
  
  _onFinal(msg){
    if(!this._finished){
      this.isRunning = false;
      onFinal(msg);
    }
  }
}

class Worker{
  constructor(ip,port,ffmpegInfos,hwInfos){
    this.ip = ip;
    this.port = port;
    this.ffmpegInfos = ffmpegInfos;
    this.processes = [];
    this.hw = hwInfos;//hwInfos
    this.id = ip+":"+port.toString();
    this.ws_uri = "ws://"+ip+":"+port.toString();
    this.enabled = true;
    this.failures = 0;
    this.waitingProcesses = [];
  }
  
  getStopedProcessesCount(){
    var count = 0;
    for(var process in this.processes){
      if(!process.isRunning){
        count++;
      }
    }
  }
}


class FfmpegProcessManager{
  constructor(){
    this.workers = [];
    this.processes = [];
    this.queuedProcesses = []; // Processes not ye launched
    this.waitingProcesses = []; //Process stopped by the manager to let higher task
  }

  async addWorker(ip,port){
    try{
      var ffmpegInfos = await getHTTPContent("http://"+ip+":"+port.toString()+"/ffmpeg_infos" );
      var hwInfos = await getHTTPContent("http://"+ip+":"+port.toString()+"/hw_infos" );
      hwInfos = {cores:6.0,gpu:1.6,vaapi:0.0,omx:0.0};
      var worker = new Worker(ip,port,ffmpeginfos,hwInfos);
      this.workers.push(worker);
    }catch(err){
      console.error("Failed to add worker: ",wuri," ",err);
    } 
  }

  // Find a worker to run a task meeting hw properties and considering priorities.
  // return {worker,processesToStop}
  findAvailableWorker(priority,hw){
    var worker = null;
    var processesToStop = [];

    // Check all worker and take the one which will stop less tasks with higher priority
    var bestWorker = null;
    var bestprocessesToStopPriority = null;
    for(var worker in this.workers){
      if(worker.enabled == false){
        continue;
      }
      [available, processesToStop, processesToStopPriority] = checkWorkerAvailablity(worker,priority,hw);
      if(available){
        if(processesToStop.length == 0){
          //This worker won't stop anything so it's a perfect choice
          return [worker,[]];
        }else{
          if(!bestWorker || processesToStopPriority < bestprocessesToStopPriority){
            bestWorker = worker;
            bestprocessesToStopPriority = processesToStopPriority;
            processesToStop = processesToStop;
          }
        }
      }
    }
    
    return [bestWorker, processesToStop];
  }


  //Check if a process requiring hw can run on daemon with priority
  checkWorkerAvailablity(worker,priority,hw){
    var available = false;
    var processesToStop = [];
    var processesToStopPriority = -1;

    // Check if base hw compatible
    if(worker.hw.cores < hw.cores 
      && worker.hw.gpu < hw.gpu 
      && worker.hw.vaapi < hw.vaapi 
      && worker.hw.omx < hw.cores ){
        return [available,processesToStop,processesToStopPriority];
    }

    /// Compute availablehw: remaining hardware considering only higher or equal priority running tasks
    //  Compute freehw: remaining hardware considering all running tasks
    var lowerProcesses = [];
    var availablehw = Object.assign({}, worker.hw);// this copy work only if hw does not contain objects
    var freehw = Object.assign({}, worker.hw);

    // Remove ressource from higher or equal priority
    for( var process in worker.processes){
      if((process.isRunning || process.autoRestart) && process.priority>=priority){
        availablehw.cores -= process.cores;
        availablehw.gpu -= process.gpu;
        availablehw.vaapi -= process.vaapi;
        availablehw.omx -= process.omx;
      }else if(process.isRunning){
        lowerProcesses.push(process);
      }

      if(process.isRunning){
        freehw.cores -= process.cores;
        freehw.gpu -= process.gpu;
        freehw.vaapi -= process.vaapi;
        freehw.omx -= process.omx;
      }
    }

    var diffCores = availablehw.cores-worker.hw.cores;
    var diffGPU = availablehw.gpu-worker.hw.gpu;
    var diffVaapi = availablehw.vaapi-worker.hw.vaapi;
    var diffOmx = availablehw.omx-worker.hw.omx;

    // If not enough ressources availables
    if(availablehw.cores < hw.cores 
      || availablehw.diffGPU < hw.gpu  
      || availablehw.diffVaapi < hw.vaapi 
      || availablehw.diffOmx < hw.omx ){
        return [available,processesToStop,processesToStopPriority];
    }else{
      available = true;
    }

    //There is enough ressources without considering lower priorities,
    // check if we need to stop lower priority tasks
    var processesToStop = [];
    lowerProcesses.sort(compareProcesses).reverse(); // Put lower priority on top
    for( var lprocess in lowerProcesses){
      if(freehw.cores<hw.cores && lprocess.cores > 0 
        || freehw.gpu<hw.gpu && lprocess.gpu > 0 
        || freehw.gpvaapiu<hw.vaapi && lprocess.vaapi > 0 
        || freehw.omx<hw.omx && lprocess.omx > 0 ){
          processesToStop.push(lprocess);
          processesToStopPriority = lprocess.priority;

          freehw.cores += lprocess.cores;
          freehw.gpu += lprocess.gpu;
          freehw.vaapi += lprocess.vaapi;
          freehw.omx += lprocess.omx;
      }
    }

    return [available,processesToStop,processesToStopPriority];
  }

  launchProcess(process){

    this.processes.push(process);
    [worker,processesToStop] = this.findAvailableWorker(process.priority,process.hw);

    // If there are no worker available, queue the task
    if(worker == null){
      queuedProcesses.push(process);
      return;
    }

    // Stop enough lower priority processes on that worker
    for(var proc in processesToStop){
      this.stopProcess(proc,true);
      worker.waitingProcesses.push(proc);
      //waitingProcesses.push(proc);
    }

    //Reserve ressource
    process.isRunning = true;

    // Setup the call
    var ws = new WebSocket(worker.ws_uri);
    process.ws = ws;
    ws.on('open', function open() {
      var msg = {};
      msg.command = process.cmd;
      msg.niceness = process.priority;
      msg.args = process.args;
      
      sendAsJson(ws,msg,process._onStart(),(error) => {
        //The worker made a socker error => disable it
        if(error){
          process._onFinal(new FinalMsg(2,"Socket send error",error));
          worker.enabled = false; 
        }
      });
    });
    ws.on('message', function incoming(data) {
      try {  
        jsonContent = JSON.parse(data);

        if(typeof jsonContent.status !== 'undefined'){
          process._onProgression(jsonContent)
        }else if(typeof jsonContent.error !== 'undefined'){
          process._onFinal(jsonContent);
        }else{
          process._onFinal(new FinalMsg(3,"Unknown message",error));
          console.err("Invalid message received ",data)
        }
      }catch(err){
        process._onFinal(new FinalMsg(3,"Invalid Json ",error));
      }
      
    });
    ws.on('close', function close() {
      //console.log('disconnected');
      process._onFinal(new FinalMsg(2,"Socket closed",error));
    });   
  }

  stopProcess(process,autoRestart=false){
    if(process.ws){
      sendAsJson(process.ws,msg
        ,() => {process._onStop(autoRestart);/*notify*/}
        ,(error) => {
        //The worker made a socker error => disable it
        if(error){
          process._onFinal(new FinalMsg(2,"Socket send error",error));
          worker.enabled = false; 
        }
      });
    }
  }

  //OnWorker process Done, try to push as many task as possible
  fillupWorker(worker){

    //First try to autostart local stopped processes if there are no higher task in queue
    worker.waitingProcesses.sort(compareProcesses);
    for(var proc in worker.waitingProcesses){
      proc;
      this.queuedProcesses;
    }

  }
    
  sendAsJson(ws,msg,onSuccess,onError){
    console.log('sending ',msg);
    ws.send(JSON.stringify(msg), function ack(error) {
      // If error is not defined, the send has been completed, otherwise the error
      // object will indicate what failed.
      if(error){
        console.log('socket error',error);
        onError(error);
      }else{
        onSuccess();
      }
    });
  }

  static compareProcesses(a,b) {
    if (a.priority < b.priority)
      return -1;
    if (a.priority > b.priority)
      return 1;
    return 0;
  }
}
module.exports= TranscodeManager

const ws = new WebSocket('ws://127.0.0.1:8080/');

var args = [
  '-i',
  'input.mp4',
  '-y',
  '-an',
  '-sn',
  '-c:v',
  'libx264',
  '-b:v:0',
  '4800k',
  '-profile',
  'main',
  '-keyint_min',
  '120',
  '-g',
  '120',
  '-b_strategy',
  '0',
  '-use_timeline',
  '1',
  '-use_template',
  '1',
  '-single_file',
  '1',
  '-single_file_name',
  'video_1.mp4',
  '-f',
  'dash',
  'kk.mpg'
]


