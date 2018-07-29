const WebSocket = require('ws');
const FinalMsg = require('./messages').FinalMsg
const StatusMsg = require('./messages').StatusMsg

// Load utils functions
const getHTTPContent = require('../netutils.js').getContent;
const sendAsJson = require('../netutils.js').sendAsJson;
const parseJson = require('../netutils').parseJson
const moveFromToArray = require('../jsutils.js').moveFromToArray;
const removeFromList = require('../jsutils.js').removeFromList;
const EventEmitter = require('events');

class Hardware{
  constructor(core,gpu,vaapi,omx){
    this.core = core;
    this.gpu = gpu;
    this.vaapi = vaapi;
    this.omx = omx;
  }
}

const PROCESS_STATUS = {
  NONE: 'NONE',
  QUEUED: 'QUEUED',
  RUNNING: 'RUNNING',
  WAITING: 'WAITING',
  STOPPED: 'STOPPED',
  TERMINATED: 'TERMINATED'
}

class Process extends EventEmitter{
   
  constructor(cmd,args,priority,hw,exclusive, onStart, onStop, onProgression, onFinal){
    super();
    this.cmd = cmd;
    this.args = args;
    this.hw = hw;
    this.priority = priority; //The lower the better
    this.status = PROCESS_STATUS.NONE;
    this.onStart = onStart;
    this.onStop = onStop;
    this.onProgression = onProgression;
    this.onFinal = onFinal;
    this._finished = false;
    this.ws = null;
    this.worker = null;
    this.autoRestart = true;
    this.exclusive = exclusive;
  }

  // System callbacks
  _onStop(autoRestart){
    if(this.status != PROCESS_STATUS.TERMINATED){
      if(autoRestart){
        this.status = PROCESS_STATUS.WAITING;
      }else{
        this.status = PROCESS_STATUS.STOPPED;
      }
      this.emit('stop',autoRestart);
    }
  }

  _onStart(){
      this.emit('start');
  }

  _onProgression(msg){
    this.emit('progression',msg);
  }
  
  _onFinal(msg){
    if(this.status != PROCESS_STATUS.TERMINATED){
      if(this.ws.readyState == WebSocket.CONNECTING || this.ws.readyState == WebSocket.OPEN ){
        this.ws.close(1000,"work finished");//1000 means close normal (cf https://developer.mozilla.org/fr/docs/Web/API/CloseEvent )
      }
      this.status = PROCESS_STATUS.TERMINATED;
      this.emit('final',msg);
    }
  }
}

class Worker{
  constructor(ip,port,ffmpegInfos,hwInfos){
    this.ip = ip;
    this.port = port;
    this.ffmpegInfos = ffmpegInfos;
    this.processes = [];
    this.hw = hwInfos;
    this.id = ip+":"+port.toString();
    this.ws_uri = "ws://"+ip+":"+port.toString();
    this.enabled = true;
    this.failures = 0;
    this.waitingProcesses = [];
    this.stoppedProcesses = [];
  }  
}

class FfmpegProcessManager extends EventEmitter{
  constructor(){
    super();
    this.workers = [];
    this.processes = [];
    this.waitingProcesses = []; // Processes not yet launched waiting
    this.stoppedProcesses = []; // Processes not yet launched stopped
  }

  async addWorker(ip,port){
    try{
      var ffmpegInfos = parseJson(await getHTTPContent("http://"+ip+":"+port.toString()+"/ffmpeg_infos" ));
      var rawHwInfos = parseJson(await getHTTPContent("http://"+ip+":"+port.toString()+"/hw_infos" ));
      var hwInfos =  {
        core:rawHwInfos.cpu.cores,
        gpu:rawHwInfos.graphics.length,//For the moment when don't check differences
        vaapi:0.0,//TODO
        omx:0.0  //TODO
      };
      //hwInfos = {core:1.0,gpu:1.6,vaapi:0.0,omx:0.0};
      var worker = new Worker(ip,port,ffmpegInfos,hwInfos);
      this.workers.push(worker);
      if(this.workers.length == 1){
        this.emit('workerAvailable');
      }
      console.log("Worker added ",ip,port);
      this.fillupWorker(worker);
      return true;
    }catch(err){
      console.error("Failed to add worker: ",ip," ",err);
      return false;
    } 
  }

  // Find a worker to run a task meeting hw properties and considering priorities.
  // return {worker,processesToStop}
  findAvailableWorker(process/*priority,hw*/){
    var worker = null;
    var processesToStop = [];

    // Check all worker and take the one which will stop less tasks with higher priority
    var bestWorker = null;
    var bestprocessesToStopPriority = null;
    for(var worker of this.workers){
      if(worker.enabled == false){
        continue;
      }
      var [available, processesToStop, processesToStopPriority] = this.checkWorkerAvailablity(worker,process);
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
  checkWorkerAvailablity(worker,inproc/*priority,hw*/){
    var available = false;
    var processesToStop = [];
    var processesToStopPriority = 20;

    // Check if base hw compatible
    if( worker.hw.core < inproc.hw.core
      && worker.hw.gpu < inproc.hw.gpu 
      && worker.hw.vaapi < inproc.hw.vaapi 
      && worker.hw.omx < inproc.hw.core ){
        return [available,processesToStop,processesToStopPriority];
    }

    /// Compute availablehw: remaining hardware considering only higher or equal priority running tasks
    //  Compute freehw: remaining hardware considering all running tasks
    var lowerProcesses = [];
    var availablehw = Object.assign({}, worker.hw);// this copy work only if hw does not contain objects
    var freehw = Object.assign({}, worker.hw);
    var isLocal = (worker.processes.indexOf(inproc) > 0);//Is the process already launched locally?

    // Remove ressource from higher or equal priority
    for( var process of worker.processes){
      if(inproc == process){
        continue;
      }
      if((process.status == PROCESS_STATUS.RUNNING || (process.status == PROCESS_STATUS.WAITING && !isLocal)) 
        && process.priority<=inproc.priority ){
        availablehw.core -= process.hw.core;
        availablehw.gpu -= process.hw.gpu;
        availablehw.vaapi -= process.hw.vaapi;
        availablehw.omx -= process.hw.omx;
        if(process.exclusive || inproc.exclusive){
          // The process argument cannot stop higher or equal priority running process 
          return [available,processesToStop,processesToStopPriority];
        }
      }else if(process.status == PROCESS_STATUS.RUNNING){
        lowerProcesses.push(process);
      }

      if(process.status == PROCESS_STATUS.RUNNING){
        freehw.core -= process.hw.core;
        freehw.gpu -= process.hw.gpu;
        freehw.vaapi -= process.hw.vaapi;
        freehw.omx -= process.hw.omx;
      }
    }

    var diffCore = availablehw.core-worker.hw.core;
    var diffGPU = availablehw.gpu-worker.hw.gpu;
    var diffVaapi = availablehw.vaapi-worker.hw.vaapi;
    var diffOmx = availablehw.omx-worker.hw.omx;

    // If not enough ressources availables
    if(availablehw.core < inproc.hw.core 
      || availablehw.diffGPU < inproc.hw.gpu  
      || availablehw.diffVaapi < inproc.hw.vaapi 
      || availablehw.diffOmx < inproc.hw.omx ){
        return [available,processesToStop,processesToStopPriority];
    }else{
      available = true;
    }

    //There is enough ressources without considering lower priorities,
    // check if we need to stop lower priority tasks
    var processesToStop = [];
    lowerProcesses.sort(this.compareProcesses).reverse(); // Put lower priority on top (so bigger priority)
    for( var lprocess of lowerProcesses){
      if(freehw.core<inproc.hw.core && lprocess.hw.core > 0 
        || freehw.gpu<inproc.hw.gpu && lprocess.hw.gpu > 0 
        || freehw.gpvaapiu<inproc.hw.vaapi && lprocess.hw.vaapi > 0 
        || freehw.omx<inproc.hw.omx && lprocess.hw.omx > 0 ){
          processesToStop.push(lprocess);
          processesToStopPriority = lprocess.priority;

          freehw.core += lprocess.hw.core;
          freehw.gpu += lprocess.hw.gpu;
          freehw.vaapi += lprocess.hw.vaapi;
          freehw.omx += lprocess.hw.omx;
      }
    }

    return [available,processesToStop,processesToStopPriority];
  }

  // Return true if worker is available for the process
  launchProcessOnWorker(process,worker){
    var self = this;
    var [available, processesToStop, processesToStopPriority] = this.checkWorkerAvailablity(worker,process);

    if(!available){
      return false;
    }

    console.log("launching process ",process," on worker ",worker);

    // Stop enough lower priority processes on that worker
    for(var proc of processesToStop){
      this.stopProcess(proc,true);
      worker.waitingProcesses.push(proc);
      //waitingProcesses.push(proc);
    }

    //Reserve ressource
    process.status = PROCESS_STATUS.RUNNING;
    process.worker = worker;

    worker.processes.push(process);

    // Setup the call
    if(process.ws == null){
      var ws = new WebSocket(worker.ws_uri);
      process.ws = ws;
      ws.on('open', function open() {
        console.log("Openning WebSocket for ",process);
        var msg = {};
        msg.command = process.cmd;
        msg.niceness = process.priority;
        msg.args = process.args;
  
        sendAsJson(ws,msg,
          ()=>{
            process._onStart();
            if(process.status != PROCESS_STATUS.RUNNING){//Stopped before open event
              if(process.status == PROCESS_STATUS.STOPPED){
                self.stopProcess(process,false);
              }else if(process.status == PROCESS_STATUS.WAITING){
                self.stopProcess(process,true);
              }
              
            }
          },
          (error)=>{
            process._onFinal(new FinalMsg(2,"Socket send error",error));
            worker.enabled = false;
          }
        );
      });
      ws.on('message', function incoming(data) {
        try {
          var jsonContent = parseJson(data);
  
          if(typeof jsonContent.progression !== 'undefined'){
            process._onProgression(jsonContent)
          }else if(typeof jsonContent.code !== 'undefined'){
            process._onFinal(jsonContent);
          }else{
            process._onFinal(new FinalMsg(3,"Unknown message",data));
            console.err("Invalid message received ",data);
          }
        }catch(error){
          var errdata = {};
          errdata.error = error;
          errdata.mesg = data;
          process._onFinal(new FinalMsg(3,"Invalid Json ",errdata));
          console.error("ffmpegProc: Invalid Json ",error)
        }
        
      });
      ws.on('close', function close() {
        //console.log('disconnected');
        process._onFinal(new FinalMsg(2,"Socket closed",null));
        if(!(removeFromList(process,worker.processes)
          || removeFromList(process,worker.waitingProcesses)
          || removeFromList(process,worker.stoppedProcesses))
        ){
          console.warn("Cannot remove unlisted worker process")
        }
        self.fillupWorker(worker);
      });
    }else{
      console.warn("process already launched",process);
    }
    
    return true;
  }

  // API Add process to be executed
  launchProcess(process){
    var [worker,processesToStop] = this.findAvailableWorker(process);

    // If there are no worker available, queue the task
    process.status = PROCESS_STATUS.WAITING;
    if(worker == null || !this.launchProcessOnWorker(process,worker)){
      this.waitingProcesses.push(process);
    }
    return;
  }

  _launchLocalProcess(process){
    var [worker,processesToStop] = this.findAvailableWorker(process);

    // If there are no worker available, queue the task
    process.status = PROCESS_STATUS.WAITING;
    if(worker == null || !this.launchProcessOnWorker(process,worker)){
      this.waitingProcesses.push(process);
    }
    return;
  }

  // API Start stopped launched process
  startProcess(process){
    console.log("Starting process ",process);
    //var self = this;
    
    if(process.status != PROCESS_STATUS.STOPPED && process.status != PROCESS_STATUS.WAITING){
      console.warn("Cannot start process that is not stopped or waiting",process);
      return false;
    }

    if(!process.ws){
      //If the process was in stoppedProcesses (not on worker) move try to launch it
      if(!(removeFromList(process,this.stoppedProcesses))){
        console.warn("Cannot start process that should be stopped",process);
      }else{
        this._launchLocalProcess(process);
        return true;
      }
    }else{
      //Check if there is availability
      var [available,processesToStop,processesToStopPriority] = this.checkWorkerAvailablity(process.worker,process);
      
      for(var proc of processesToStop){
        this.stopProcess(proc,true);
        //process.worker.waitingProcesses.push(proc);
        //waitingProcesses.push(proc);
      }

      //The process is on a worker
      if(process.ws.readyState == WebSocket.OPEN ){
        if(available && process.status != PROCESS_STATUS.RUNNING){
          process.status = PROCESS_STATUS.RUNNING;//Reserve it now
          sendAsJson(process.ws,{ command:"kill",signal:"SIGCONT" }
            ,() => { process._onStart(); }
            ,(error) => {
            //The worker made a socker error => disable it
            if(error){
              process._onFinal(new FinalMsg(2,"Socket send error",error));
              process.worker.enabled = false;
            }
          });
          return true;
        }else if(!available){
          return false;
        }
      }else if(process.ws.readyState == WebSocket.CONNECTING){
        // Set running to false so that on connection, stop request will be done
        //process.isRunning = false;
        process.status = PROCESS_STATUS.RUNNING;
      }
    }
  }

  stopProcess(process,autoRestart=false){
    console.log("Stopping process ",process);
    var self = this;

    if(process.ws){
      // The process is already launched, stop it on worker
      if(process.ws.readyState == WebSocket.OPEN ){//Can be true before onOpen event
        if(process.status == PROCESS_STATUS.RUNNING){
          sendAsJson(process.ws,{ command:"kill",signal:"SIGSTOP" }
            ,() => {
              var succeed = false;
              if(autoRestart){
                succeed = moveFromToArray(process,process.worker.processes,process.worker.waitingProcesses);
              }else{
                succeed = moveFromToArray(process,process.worker.processes,process.worker.stoppedProcesses);
              }
              if(succeed){
                process._onStop(autoRestart);
                self.fillupWorker(process.worker);
              }else{
                console.warn("Cannot stop process that should be running ",process);
              }
            }
            ,(error) => {
            //The worker made a socker error => disable it
            if(error){
              process._onFinal(new FinalMsg(2,"Socket send error",error));
              process.worker.enabled = false;
              //self.fillupWorker(process.worker);
            }
          });
        }else if(process.status == PROCESS_STATUS.WAITING){
          if(!autoRestart){
            if(moveFromToArray(process,process.worker.waitingProcesses,process.worker.stoppedProcesses)){
              process._onStop(autoRestart);
              self.fillupWorker(process.worker);
            }else{
              console.warn("Cannot stop process that should be waiting ",process);
            }
          }
        }
      }else if(process.ws.readyState == WebSocket.CONNECTING){
        // Set running to false so that on connection, stop request will be done
        //process.isRunning = false;
        if(autoRestart){
          process.status = PROCESS_STATUS.WAITING;
        }else{
          process.status = PROCESS_STATUS.STOPPED;
        }
      }
    }else{
      //The process is queued, not yet in a worker
      if(moveFromToArray(process,this.waitingProcesses,this.stoppedProcesses)){
        process._onStop(autoRestart);
      }else{
        console.warn("Cannot stop process that should be queued ",process);
      }
    }
  }

  //OnWorker process Done, try to push as many task as possible
  fillupWorker(worker){

    //First try to autostart local stopped processes if there are no higher task in queue
    worker.waitingProcesses.sort(this.compareProcesses);
    this.waitingProcesses.sort(this.compareProcesses);
    var queuedIdx = 0;
    for(var proc of worker.waitingProcesses){
      if(this.waitingProcesses.length == 0 || proc.priority <= this.waitingProcesses[0].priority){
        //If there are no queued process more with more priority, start waiting processes
        if(!this.launchProcessOnWorker(proc,worker)){
          //Not enough ressources for next priority task, stop
          return;
        }
      }else{
        //Try to start queued process
        if(!this.launchProcessOnWorker(this.waitingProcesses[0],worker)){
          //Not enough ressources for next priority task, stop
          return;
        }else{
          //Remove queued task
          this.waitingProcesses.shift();
        }
      }
      this.waitingProcesses;
    }

    while(this.waitingProcesses.length > 0){
      if(!this.launchProcessOnWorker(this.waitingProcesses[0],worker)){
        //Not enough ressources for next priority task, stop
        return;
      }else{
        this.waitingProcesses.shift();
      }
    }
  }

  removeProcess(process){
    if(!process.ws){
      removeFromList(process,this.waitingProcesses);
      removeFromList(process,this.waitingProcesses);
    }
  }

  compareProcesses(a,b) {
    if (a.priority < b.priority)
      return -1;
    if (a.priority > b.priority)
      return 1;
    return 0;
  }

  async ffprobe(file){
    try{
      if(this.workers.length == 0){
        return null;
      }
      //For the moment take only last worker to do ffprobe
      var worker = this.workers[this.workers.length-1];
      return JSON.parse(await getHTTPContent("http://"+worker.ip+":"+worker.port.toString()+"/ffprobe/"+file ));
    }catch(err){
      console.error("ffprobe failed with file ",file,err);
      return null;
    }
  }

}
module.exports.FfmpegProcessManager=FfmpegProcessManager
module.exports.Process=Process
module.exports.Hardware=Hardware
// const ws = new WebSocket('ws://127.0.0.1:8080/');

// var args = [
//   '-i',
//   'input.mp4',
//   '-y',
//   '-an',
//   '-sn',
//   '-c:v',
//   'libx264',
//   '-b:v:0',
//   '4800k',
//   '-profile',
//   'main',
//   '-keyint_min',
//   '120',
//   '-g',
//   '120',
//   '-b_strategy',
//   '0',
//   '-use_timeline',
//   '1',
//   '-use_template',
//   '1',
//   '-single_file',
//   '1',
//   '-single_file_name',
//   'video_1.mp4',
//   '-f',
//   'dash',
//   'kk.mpg'
// ]