const WebSocket = require("ws");
const FinalMsg = require("./messages").FinalMsg;
const StatusMsg = require("./messages").StatusMsg;

// Load utils functions
const getHTTPContent = require("../utils/netutils.js").getContent;
const sendAsJson = require("../utils/netutils.js").sendAsJson;
const parseJson = require("../utils/netutils").parseJson;
const moveFromToArray = require("../utils/jsutils.js").moveFromToArray;
const removeFromList = require("../utils/jsutils.js").removeFromList;
const EventEmitter = require("events");

class Hardware {
  constructor(core, gpu, vaapi, omx) {
    this.core = core;
    this.gpu = gpu;
    this.vaapi = vaapi;
    this.omx = omx;
  }
}

const PROCESS_STATUS = {
  NONE: "NONE",
  QUEUED: "QUEUED",
  RUNNING: "RUNNING",
  WAITING: "WAITING",
  STOPPED: "STOPPED",
  TERMINATED: "TERMINATED"
};

class Process extends EventEmitter {
  constructor(
    cmd,
    args,
    priority,
    hw,
    exclusive,
    onStart,
    onStop,
    onProgression,
    onFinal
  ) {
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
    this.creationDate = new Date();
  }

  setProcessStatus(status) {
    switch (status) {
      case value:
        break;

      default:
        break;
    }
  }
  // System callbacks
  // _onstop(autoRestart){
  //   if(this.status != PROCESS_STATUS.TERMINATED){
  //     if(autoRestart){
  //       this.status = PROCESS_STATUS.WAITING;
  //       this._onWaiting()
  //     }else{
  //       this.status = PROCESS_STATUS.STOPPED;
  //       this.emit('stop',autoRestart);
  //     }
  //   }
  // }

  _setWaiting() {
    if (this.status != PROCESS_STATUS.TERMINATED) {
      this.status = PROCESS_STATUS.WAITING;
      this.emit("waiting");
    }
  }

  _setRunning() {
    this.status = PROCESS_STATUS.RUNNING;
    this.emit("running");
  }

  _setStopped() {
    if (this.status != PROCESS_STATUS.TERMINATED) {
      this.status = PROCESS_STATUS.STOPPED;
      this.emit("stopped");
    }
  }

  _onProgression(msg) {
    this.emit("progression", msg);
  }

  _onFinal(msg) {
    if (this.status != PROCESS_STATUS.TERMINATED) {
      if (
        this.ws.readyState == WebSocket.CONNECTING ||
        this.ws.readyState == WebSocket.OPEN
      ) {
        this.ws.close(1000, "work finished"); //1000 means close normal (cf https://developer.mozilla.org/fr/docs/Web/API/CloseEvent )
      }
      this.status = PROCESS_STATUS.TERMINATED;
      this.emit("final", msg);
    }
  }

  clearWorkerInfos() {
    this.ws = null;
    this.worker = null;
    this.progression = 0;
  }
}

class Worker {
  constructor(ip, port) {
    this.ip = ip;
    this.port = port;
    this.ffmpegInfos = null;
    this.processes = [];
    this.hw = null;
    this.id = ip + ":" + port.toString();
    this.ws_uri = "ws://" + ip + ":" + port.toString();
    this.enabled = true;
    this.error_msg;
    this.failures = 0;
    this.waitingProcesses = [];
    this.stoppedProcesses = [];
    this.status = "offline";
    this.reached = false;
  }

  setupReached(ffmpegInfos, hwInfos) {
    this.hw = hwInfos;
    this.ffmpegInfos = ffmpegInfos;
    this.reached = true;
    this.status = "online";
  }
}

class FfmpegProcessManager extends EventEmitter {
  constructor() {
    super();
    this.workers = [];
    this.unreachedWorkers = [];
    this.processes = [];
    this.waitingProcesses = []; // Processes not yet launched waiting
    this.stoppedProcesses = []; // Processes not yet launched stopped
    this.minTimeBetweenProgresses = 0;
  }

  setMinTimeBetweenProgresses(val) {
    this.minTimeBetweenProgresses = val;
  }

  setWorkerStatus(worker, status) {
    if (status != worker.status) {
      worker.status = status;
      this.emit("workerStatus", worker.ip, worker.port, worker.status);
    }
  }

  getWorkers() {
    return this.workers.concat(this.unreachedWorkers);
  }

  getWorker(id) {
    let worker = this.getReachedWorker(id);
    if (worker) {
      return worker;
    }
    //Try with unreachable workers
    worker = this.getUnreachedWorker(id);
    return worker;
  }

  getReachedWorker(id) {
    for (let i = 0; i < this.workers.length; i++) {
      let worker = this.workers[i];
      if (worker.id == id) {
        return worker;
      }
    }
    return null;
  }

  getUnreachedWorker(id) {
    for (let i = 0; i < this.unreachedWorkers.length; i++) {
      let worker = this.unreachedWorkers[i];
      if (worker.id == id) {
        return worker;
      }
    }
    return null;
  }

  _removeUnreachedWorkerFromList(id) {
    for (let i = 0; i < this.unreachedWorkers.length; i++) {
      let worker = this.unreachedWorkers[i];
      if (worker.id == id) {
        this.unreachedWorkers.splice(i, 1);
        return true;
      }
    }
    return false;
  }
  _removeReachedWorkerFromList(id) {
    for (let i = 0; i < this.workers.length; i++) {
      let worker = this.workers[i];
      if (worker.id == id) {
        this.workers.splice(i, 1);
        return true;
      }
    }
    return false;
  }

  _removeWorkerFromList(id) {
    if (!this._removeReachedWorkerFromList(id)) {
      return this._removeUnreachedWorkerFromList(id);
    } else {
      return true;
    }
  }

  enableWorkerFromId(id, value) {
    let worker = this.getWorker(id);
    if (worker) {
      this.enableWorker(worker, value);
    }
  }

  async enableWorker(worker, value) {
    if (worker.enabled != value) {
      worker.enabled = value;
      if (value) {
        this.emit("workerEnabled", worker);
        this.fillupWorker(worker);
      } else {
        this.removeWorkerProcesses(worker);
        this.emit("workerDisabled", worker);
      }
    }
  }

  async tryConnectWorker(id) {
    let worker = this.getWorker(id);
    if (worker && (await this.reachWorkerInfos(worker))) {
      //this.setWorkerStatus(worker,"online")
    } else {
      console.warn("Failed reconnect " + worker.id + " not reachable");
      worker.enabled = false;
    }
  }

  // Remove all processes on a worker and queue them
  removeWorkerProcesses(worker) {
    let socketsToClose = [];
    let processesToRelaunch = [];

    //Transfert active processes
    for (let i = 0; i < worker.processes.length; i++) {
      socketsToClose.push(worker.processes[i].ws);
      worker.processes[i].clearWorkerInfos();
    }
    processesToRelaunch = processesToRelaunch.concat(worker.processes);
    worker.processes = [];

    //Transfert waiting processes
    for (let i = 0; i < worker.waitingProcesses.length; i++) {
      socketsToClose.push(worker.waitingProcesses[i].ws);
      worker.waitingProcesses[i].clearWorkerInfos();
    }
    processesToRelaunch = processesToRelaunch.concat(worker.waitingProcesses);
    worker.waitingProcesses = [];

    //Transfert stopped processes
    for (let i = 0; i < worker.stoppedProcesses.length; i++) {
      socketsToClose.push(worker.stoppedProcesses[i].ws);
      worker.stoppedProcesses[i].clearWorkerInfos();
    }
    this.stoppedProcesses = this.stoppedProcesses.concat(
      worker.stoppedProcesses
    );
    worker.stoppedProcesses = [];

    //Close all sockets
    for (let i = 0; i < socketsToClose.length; i++) {
      socketsToClose[i].close();
    }

    //Re-launch all active processes
    for (let i = 0; i < processesToRelaunch.length; i++) {
      this.launchProcess(processesToRelaunch[i]);
    }
  }

  removeWorker(id) {
    let worker = this.getWorker(id);
    if (worker) {
      if (worker.enabled == false) {
        this.emit("workerRemoved", worker);
        this._removeWorkerFromList(worker.id);
      } else {
        console.warn("removeWorker cannot remove a worker which is enabled");
        return false;
      }
    }
    // for(let i=0; i<this.workers.length; i++){
    //   let worker = this.workers[i];
    //   if(worker.id == id){
    //     if(worker.enabled == false){
    //       this.emit('workerRemoved',worker);
    //       this.workers.splice(i, 1)
    //     }else{
    //       console.warn("removeWorker cannot remove a worker which is enabled")
    //       return false
    //     }
    //     break;
    //   }
    // }
    return true;
  }

  async reachWorkerInfos(worker) {
    try {
      var ffmpegInfos = parseJson(
        await getHTTPContent(
          "http://" + worker.ip + ":" + worker.port.toString() + "/ffmpeg_infos"
        )
      );
      var rawHwInfos = parseJson(
        await getHTTPContent(
          "http://" + worker.ip + ":" + worker.port.toString() + "/hw_infos"
        )
      );
      var hwInfos = {
        core: rawHwInfos.cpu.cores,
        gpu: rawHwInfos.graphics.length, //For the moment when don't check differences
        vaapi: 0.0, //TODO
        omx: 0.0 //TODO
      };
      let wasReached = worker.reached;
      this.setWorkerStatus(worker, "online");
      worker.setupReached(ffmpegInfos, hwInfos);

      // If it never reached before, add it to worker pool
      if (!wasReached) {
        this._removeUnreachedWorkerFromList(worker.id);
        this.workers.push(worker);
        if (this.workers.length == 1) {
          this.emit("workerAvailable", worker);
        }
      }
      return true;
    } catch (err) {
      this.setWorkerStatus(worker, "offline");
      return false;
    }
  }

  async addWorker(ip, port, enabled = true, force = false) {
    //  try{
    var worker = new Worker(ip, port);
    if (this.getWorker(worker.id)) {
      console.error("Worker already added: ", ip, ":", port);
      return false;
    }

    this.unreachedWorkers.push(worker);

    worker.enabled = enabled;
    let success = await this.reachWorkerInfos(worker);
    if (success) {
      this.emit("workerAdded", worker);
      console.log("Worker added ", ip, port);
      if (worker.enabled) {
        this.fillupWorker(worker);
      }

      // this.workers.push(worker);
      // if(this.workers.length == 1){
      //   this.emit('workerAvailable',worker);
      // }
      // this.emit('workerAdded',worker);
      // console.log("Worker added ",ip,port);
      // this.fillupWorker(worker);

      return true;
    } else {
      console.error("Failed to add worker: ", ip, ":", port);
      if (force) {
        this.unreachedWorkers.push(worker);
      }
      return false;
    }
    //   // var ffmpegInfos = parseJson(await getHTTPContent("http://"+ip+":"+port.toString()+"/ffmpeg_infos" ));
    //   // var rawHwInfos = parseJson(await getHTTPContent("http://"+ip+":"+port.toString()+"/hw_infos" ));
    //   // var hwInfos =  {
    //   //   core:rawHwInfos.cpu.cores,
    //   //   gpu:rawHwInfos.graphics.length,//For the moment when don't check differences
    //   //   vaapi:0.0,//TODO
    //   //   omx:0.0  //TODO
    //   // };
    //   //hwInfos = {core:1.0,gpu:1.6,vaapi:0.0,omx:0.0};
    //   //worker.setupReached(ffmpegInfos,hwInfos);
    //   //worker.status = "online"
    //   //worker.enabled = enabled;
    //   this.workers.push(worker);
    //   if(this.workers.length == 1){
    //     this.emit('workerAvailable',worker);
    //   }
    //   this.emit('workerAdded',worker);
    //   console.log("Worker added ",ip,port);
    //   this.fillupWorker(worker);

    //   return true;
    // }catch(err){
    //   console.error("Failed to add worker: ",ip," ",err);
    //   if(force){
    //     var worker = new Worker(ip,port);
    //     this.unreachedWorkers.push(worker)
    //   }
    //   return false;
    // }
  }

  // Find a worker to run a task meeting hw properties and considering priorities.
  // return {worker,processesToStop}
  findAvailableWorker(process /*priority,hw*/) {
    var worker = null;
    var processesToStop = [];

    // Check all worker and take the one which will stop less tasks with higher priority
    var bestWorker = null;
    var bestprocessesToStopPriority = null;
    for (var worker of this.workers) {
      if (worker.enabled == false) {
        continue;
      }
      var [
        available,
        processesToStop,
        processesToStopPriority
      ] = this.checkWorkerAvailablity(worker, process);
      if (available) {
        if (processesToStop.length == 0) {
          //This worker won't stop anything so it's a perfect choice
          return [worker, []];
        } else {
          if (
            !bestWorker ||
            processesToStopPriority < bestprocessesToStopPriority
          ) {
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
  checkWorkerAvailablity(worker, inproc /*priority,hw*/) {
    var available = false;
    var processesToStop = [];
    var processesToStopPriority = 20;

    // Check if base hw compatible
    if (
      worker.hw.core < inproc.hw.core &&
      worker.hw.gpu < inproc.hw.gpu &&
      worker.hw.vaapi < inproc.hw.vaapi &&
      worker.hw.omx < inproc.hw.core
    ) {
      return [available, processesToStop, processesToStopPriority];
    }

    /// Compute availablehw: remaining hardware considering only higher or equal priority running tasks
    //  Compute freehw: remaining hardware considering all running tasks
    var lowerProcesses = [];
    var availablehw = Object.assign({}, worker.hw); // this copy work only if hw does not contain objects
    var freehw = Object.assign({}, worker.hw);
    var isLocal = worker.processes.indexOf(inproc) > 0; //Is the process already launched locally?

    // Remove ressource from higher or equal priority
    for (var process of worker.processes) {
      if (inproc == process) {
        continue;
      }
      if (
        (process.status == PROCESS_STATUS.RUNNING ||
          (process.status == PROCESS_STATUS.WAITING && !isLocal)) &&
        process.priority <= inproc.priority
      ) {
        availablehw.core -= process.hw.core;
        availablehw.gpu -= process.hw.gpu;
        availablehw.vaapi -= process.hw.vaapi;
        availablehw.omx -= process.hw.omx;
        if (process.exclusive || inproc.exclusive) {
          // The process argument cannot stop higher or equal priority running process
          return [available, processesToStop, processesToStopPriority];
        }
      } else if (process.status == PROCESS_STATUS.RUNNING) {
        lowerProcesses.push(process);
      }

      if (process.status == PROCESS_STATUS.RUNNING) {
        freehw.core -= process.hw.core;
        freehw.gpu -= process.hw.gpu;
        freehw.vaapi -= process.hw.vaapi;
        freehw.omx -= process.hw.omx;
      }
    }

    var diffCore = availablehw.core - worker.hw.core;
    var diffGPU = availablehw.gpu - worker.hw.gpu;
    var diffVaapi = availablehw.vaapi - worker.hw.vaapi;
    var diffOmx = availablehw.omx - worker.hw.omx;

    // If not enough ressources availables
    if (
      availablehw.core < inproc.hw.core ||
      availablehw.diffGPU < inproc.hw.gpu ||
      availablehw.diffVaapi < inproc.hw.vaapi ||
      availablehw.diffOmx < inproc.hw.omx
    ) {
      return [available, processesToStop, processesToStopPriority];
    } else {
      available = true;
    }

    //There is enough ressources without considering lower priorities,
    // check if we need to stop lower priority tasks
    var processesToStop = [];
    lowerProcesses.sort(this.compareProcesses).reverse(); // Put lower priority on top (so bigger priority)
    for (var lprocess of lowerProcesses) {
      if (
        (freehw.core < inproc.hw.core && lprocess.hw.core > 0) ||
        (freehw.gpu < inproc.hw.gpu && lprocess.hw.gpu > 0) ||
        (freehw.gpvaapiu < inproc.hw.vaapi && lprocess.hw.vaapi > 0) ||
        (freehw.omx < inproc.hw.omx && lprocess.hw.omx > 0)
      ) {
        processesToStop.push(lprocess);
        processesToStopPriority = lprocess.priority;

        freehw.core += lprocess.hw.core;
        freehw.gpu += lprocess.hw.gpu;
        freehw.vaapi += lprocess.hw.vaapi;
        freehw.omx += lprocess.hw.omx;
        //available not setted here, TODO
      }
    }

    return [available, processesToStop, processesToStopPriority];
  }

  // Return true if worker is available for the process
  launchProcessOnWorker(process, worker) {
    var self = this;
    var [
      available,
      processesToStop,
      processesToStopPriority
    ] = this.checkWorkerAvailablity(worker, process);

    if (!available) {
      return false;
    }

    console.log(
      "launching process ",
      process.args,
      " on worker ",
      worker.ip,
      ":",
      worker.port
    );

    // Stop enough lower priority processes on that worker
    for (var proc of processesToStop) {
      this.stopProcess(proc, true);
      worker.waitingProcesses.push(proc);
      //waitingProcesses.push(proc);
    }

    // Setup the call
    if (process.ws == null) {
      //Reserve ressource
      process._setRunning();
      process.worker = worker;
      worker.processes.push(process);

      var ws = new WebSocket(worker.ws_uri);
      process.ws = ws;
      ws.on("open", function open() {
        console.log("Openning WebSocket for ", process.args);
        var msg = {};
        msg.command = process.cmd;
        msg.niceness = process.priority;
        msg.args = process.args;
        msg.min_time_btw_progressions = self.minTimeBetweenProgresses;

        sendAsJson(
          ws,
          msg,
          () => {
            //process._onStart();
            if (process.status != PROCESS_STATUS.RUNNING) {
              //Stopped before open event
              if (process.status == PROCESS_STATUS.STOPPED) {
                self.stopProcess(process, false);
              } else if (process.status == PROCESS_STATUS.WAITING) {
                self.stopProcess(process, true);
              }
            }
          },
          error => {
            process._onFinal(new FinalMsg(2, "Socket send error", error));
            //worker.enabled = false;
            worker.error = error;
            this.setWorkerStatus(worker, "offline");
            this.enableWorker(worker, false);

            //this.emit('workerDisabled',worker);
          }
        );
      });
      ws.on("message", function incoming(data) {
        try {
          var jsonContent = parseJson(data);

          if (typeof jsonContent.progression !== "undefined") {
            process._onProgression(jsonContent);
          } else if (typeof jsonContent.code !== "undefined") {
            process._onFinal(jsonContent);
          } else {
            process._onFinal(new FinalMsg(3, "Unknown message", data));
            console.err("Invalid message received ", data);
          }
        } catch (error) {
          var errdata = {};
          errdata.error = error;
          errdata.mesg = data;
          process._onFinal(new FinalMsg(3, "Invalid Json ", errdata));
          console.error("ffmpegProc: Invalid Json ", error);
        }
      });
      ws.on("close", function close() {
        //console.log('disconnected');
        if (process.ws == null) {
          //This means that the task is no longer on the worker (this can be due to worker disabled)
          return;
        }

        process._onFinal(new FinalMsg(2, "Socket closed", null));
        if (
          !(
            removeFromList(process, worker.processes) ||
            removeFromList(process, worker.waitingProcesses) ||
            removeFromList(process, worker.stoppedProcesses)
          )
        ) {
          console.warn("Cannot remove unlisted worker process");
        }
        self.fillupWorker(worker);
      });
      ws.on("error", function(error) {
        console.warn("worker socket error");
        process._onFinal(new FinalMsg(2, "Socket error", error));
        //worker.enabled = false;
        worker.error = error;
        self.setWorkerStatus(worker, "offline");
        self.enableWorker(worker, false);

        //console.log('disconnected');
        if (process.ws == null) {
          //This means that the task is no longer on the worker (this can be due to worker disabled)
          return;
        }

        process._onFinal(new FinalMsg(2, "Socket error", null));
        if (
          !(
            removeFromList(process, worker.processes) ||
            removeFromList(process, worker.waitingProcesses) ||
            removeFromList(process, worker.stoppedProcesses)
          )
        ) {
          console.warn("Cannot remove unlisted worker process");
        }
      });
    } else {
      console.warn("process already launched", process.args);
    }

    return true;
  }

  // API Add process to be executed
  launchProcess(process) {
    var [worker, processesToStop] = this.findAvailableWorker(process);

    // If there are no worker available, queue the task
    process._setWaiting();
    if (worker == null || !this.launchProcessOnWorker(process, worker)) {
      this.waitingProcesses.push(process);
    }
    return;
  }

  _launchLocalProcess(process) {
    var [worker, processesToStop] = this.findAvailableWorker(process);

    // If there are no worker available, queue the task
    process._setWaiting();
    if (worker == null || !this.launchProcessOnWorker(process, worker)) {
      this.waitingProcesses.push(process);
    }
    return;
  }

  // API Start stopped launched process
  // TODO POSSIBLE BUG: worker.processes not updated here
  startProcess(process) {
    console.log("Starting process ", process.args);
    //var self = this;

    if (
      process.status != PROCESS_STATUS.STOPPED &&
      process.status != PROCESS_STATUS.WAITING
    ) {
      console.warn(
        "Cannot start process that is not stopped or waiting",
        process.args
      );
      return false;
    }

    if (!process.ws) {
      //If the process was in stoppedProcesses (not on worker) move try to launch it
      if (!removeFromList(process, this.stoppedProcesses)) {
        console.warn(
          "Cannot start process that should be stopped",
          process.args
        );
        return false;
      } else {
        this._launchLocalProcess(process);
        return true;
      }
    } else {
      //Check if there is availability
      var [
        available,
        processesToStop,
        processesToStopPriority
      ] = this.checkWorkerAvailablity(process.worker, process);

      for (var proc of processesToStop) {
        this.stopProcess(proc, true);
        //process.worker.waitingProcesses.push(proc);
        //waitingProcesses.push(proc);
      }

      //

      //The process is on a worker
      var self = this;
      if (process.ws.readyState == WebSocket.OPEN) {
        if (available && process.status != PROCESS_STATUS.RUNNING) {
          var previousStatus = process.status;
          process._setRunning(); //Reserve it now
          let succeed = false;
          if (previousStatus == PROCESS_STATUS.WAITING) {
            succeed = moveFromToArray(
              process,
              process.worker.waitingProcesses,
              process.worker.processes
            );
          } else {
            succeed = moveFromToArray(
              process,
              process.worker.stoppedProcesses,
              process.worker.processes
            );
          }
          if (!succeed) {
            console.warn(
              "Cannot start process that should be stopped or waiting ",
              process.args
            );
          }

          sendAsJson(
            process.ws,
            { command: "kill", signal: "SIGCONT" },
            () => {
              //process._onStart();
              self.setWorkerStatus(process.worker, "online");
              // let succeed = false;
              // if(previousStatus == PROCESS_STATUS.WAITING){
              //   succeed = moveFromToArray(process,process.worker.waitingProcesses,process.worker.processes);
              // }else{
              //   succeed = moveFromToArray(process,process.worker.stoppedProcesses,process.worker.processes)
              // }
            },
            error => {
              //The worker made a socker error => disable it
              if (error) {
                process._onFinal(new FinalMsg(2, "Socket send error", error));
                //process.worker.enabled = false;
                process.worker.error = error;
                this.setWorkerStatus(process.worker, "offline");
                this.enableWorker(worker, false);
                //this.emit('workerDisabled',worker);
              }
            }
          );
          return true;
        } else if (!available) {
          if (process.status == PROCESS_STATUS.STOPPED) {
            process._setWaiting();
            let succeed = moveFromToArray(
              process,
              process.worker.stoppedProcesses,
              process.worker.waitingProcesses
            );
            //ADD here a signal from stoped to waitinh
            //process._onStart();
          }
          return false;
        }
      } else if (process.ws.readyState == WebSocket.CONNECTING) {
        // Set running to false so that on connection, stop request will be done
        //process.isRunning = false;
        var previousStatus = process.status;
        process._setRunning(); //Reserve it now
        let succeed = false;
        if (previousStatus == PROCESS_STATUS.WAITING) {
          succeed = moveFromToArray(
            process,
            process.worker.waitingProcesses,
            process.worker.processes
          );
        } else {
          succeed = moveFromToArray(
            process,
            process.worker.stoppedProcesses,
            process.worker.processes
          );
        }
        if (!succeed) {
          console.warn(
            "Cannot start process that should be stopped or waiting ",
            process.args
          );
        }
        //process._setRunning();
        return true;
      }
    }
  }

  stopProcess(process, autoRestart = false) {
    console.log("Stopping process ", process.args);
    var self = this;

    if (process.ws) {
      // The process is already launched, stop it on worker
      if (process.ws.readyState == WebSocket.OPEN) {
        //Can be true before onOpen event
        if (process.status == PROCESS_STATUS.RUNNING) {
          sendAsJson(
            process.ws,
            { command: "kill", signal: "SIGSTOP" },
            () => {
              var succeed = false;
              if (autoRestart) {
                succeed = moveFromToArray(
                  process,
                  process.worker.processes,
                  process.worker.waitingProcesses
                );
              } else {
                succeed = moveFromToArray(
                  process,
                  process.worker.processes,
                  process.worker.stoppedProcesses
                );
              }
              if (succeed) {
                if (autoRestart) {
                  process._setWaiting();
                } else {
                  process._setStopped();
                }
                // process._onStop(autoRestart);
                self.fillupWorker(process.worker);
              } else {
                console.warn(
                  "Cannot stop process that should be running ",
                  process.args
                );
              }
            },
            error => {
              //The worker made a socker error => disable it
              if (error) {
                process._onFinal(new FinalMsg(2, "Socket send error", error));
                //process.worker.enabled = false;
                process.worker.error = error;
                this.setWorkerStatus(process.worker, "offline");
                this.enableWorker(worker, false);
                //this.emit('workerDisabled',worker);
                //self.fillupWorker(process.worker);
              }
            }
          );
        } else if (process.status == PROCESS_STATUS.WAITING) {
          if (!autoRestart) {
            if (
              moveFromToArray(
                process,
                process.worker.waitingProcesses,
                process.worker.stoppedProcesses
              )
            ) {
              if (autoRestart) {
                process._setWaiting();
              } else {
                process._setStopped();
              }
              //process._onStop(autoRestart);
              self.fillupWorker(process.worker);
              return true;
            } else {
              console.warn(
                "Cannot stop process that should be waiting ",
                process.args
              );
              return false;
            }
          }
        }
      } else if (process.ws.readyState == WebSocket.CONNECTING) {
        // Set running to false so that on connection, stop request will be done
        //process.isRunning = false;
        if (autoRestart) {
          process._setWaiting();
        } else {
          process._setStopped();
        }
        return true;
      }
    } else {
      //The process is queued, not yet in a worker
      if (
        moveFromToArray(process, this.waitingProcesses, this.stoppedProcesses)
      ) {
        if (autoRestart) {
          process._setWaiting();
        } else {
          process._setStopped();
        }
        //process._onStop(autoRestart);
        return true;
      } else {
        console.warn(
          "Cannot stop process that should be queued ",
          process.args
        );
        return false;
      }
    }
  }

  //OnWorker process Done, try to push as many task as possible
  fillupWorker(worker) {
    if (!worker.enabled || worker.status == "offline") {
      return;
    }
    //First try to autostart local stopped processes if there are no higher task in queue
    worker.waitingProcesses.sort(this.compareProcesses);
    this.waitingProcesses.sort(this.compareProcesses);
    var queuedIdx = 0;
    for (var proc of worker.waitingProcesses) {
      if (
        this.waitingProcesses.length == 0 ||
        proc.priority <= this.waitingProcesses[0].priority
      ) {
        //If there are no queued process more with more priority, start local waiting processes
        var [
          available,
          processesToStop,
          processesToStopPriority
        ] = this.checkWorkerAvailablity(worker, proc);

        if (available) {
          this.startProcess(proc);
        }

        // if(!this.launchProcessOnWorker(proc,worker)){
        //   //Not enough ressources for next priority task, stop
        //   return;
        // }
      } else {
        //Try to start queued process
        if (!this.launchProcessOnWorker(this.waitingProcesses[0], worker)) {
          //Not enough ressources for next priority task, stop
          return;
        } else {
          //Remove queued task
          this.waitingProcesses.shift();
        }
      }
      //this.waitingProcesses;
    }

    while (this.waitingProcesses.length > 0) {
      let waitingProcess = this.waitingProcesses[0];
      if (!this.launchProcessOnWorker(waitingProcess, worker)) {
        //Not enough ressources for next priority task, stop
        return;
      } else {
        this.waitingProcesses.shift();
      }
    }
  }

  removeProcess(process) {
    if (!process.ws) {
      removeFromList(process, this.waitingProcesses);
      removeFromList(process, this.waitingProcesses);
    }
  }

  compareProcesses(a, b) {
    if (a.priority < b.priority) return -1;
    if (a.priority > b.priority) return 1;
    if (a.creationDate < b.creationDate) return -1;
    if (a.creationDate > b.creationDate) return 1;
    return 0;
  }

  getConnectedWorker(enabled = false) {
    for (let i = 0; i < this.workers.length; i++) {
      let worker = this.workers[i];
      if (worker.status == "online") {
        if (enabled && worker.enabled == 0) {
          continue;
        }
        return worker;
      }
    }
    return null;
  }

  async ffprobe(file) {
    var worker = null;
    try {
      if (this.workers.length == 0) {
        console.error("ffprobe cannot be used, no workers availables ");
        return null;
      }
      //For the moment take first online worker (enabled if possible)
      worker = this.getConnectedWorker(true);
      if (!worker) {
        worker = this.getConnectedWorker(false);
      }

      if (worker) {
        return JSON.parse(
          await getHTTPContent(
            "http://" +
              worker.ip +
              ":" +
              worker.port.toString() +
              "/ffprobe/" +
              file
          )
        );
      } else {
        console.error("ffprobe cannot be used, no workers online ");
        return null;
      }
    } catch (err) {
      if (worker) {
        this.setWorkerStatus(worker, "offline");
      }
      console.error("ffprobe failed with file ", file, err);
      return null;
    }
    return null;
  }

  getLightWorker(worker) {
    let lightWorker = {};
    lightWorker.ip = worker.ip;
    lightWorker.port = worker.port;
    lightWorker.processes_count = worker.processes.length;
    lightWorker.hw = worker.hw;
    lightWorker.ws_uri = worker.ws_uri;
    lightWorker.id = worker.id;
    lightWorker.enabled = worker.enabled;
    lightWorker.failures = worker.failures;
    lightWorker.waitingProcesses_count = worker.waitingProcesses.length;
    lightWorker.stoppedProcesses_count = worker.stoppedProcesses.length;
    lightWorker.status = worker.status;
    return lightWorker;
  }

  getLightWorkers() {
    let workers = [];
    let fullWorkers = this.getWorkers();
    for (let i = 0; i < fullWorkers.length; i++) {
      let worker = this.getLightWorker(fullWorkers[i]);
      workers.push(worker);
    }
    return workers;
  }

  /////////// OPTIONAL METHODS /////////////
  async addWorkersFromDB(dbMgr, linkWithDB) {
    let workers = await dbMgr.getFfmpegWorkers();
    for (let i = 0; i < workers.length; i++) {
      let worker = workers[i];
      await this.addWorker(worker.ipv4, worker.port, worker.enabled, true);
    }
    if (linkWithDB) {
      this._linkWithDB(dbMgr);
    }
  }

  _linkWithDB(dbMgr) {
    this.on("workerAdded", function(worker) {
      dbMgr.insertWorker(worker.ip, worker.port, worker.enabled);
    });
    this.on("workerEnabled", function(worker) {
      dbMgr.setWorkerEnabled(worker.ip, worker.port, worker.enabled);
    });
    this.on("workerDisabled", function(worker) {
      dbMgr.setWorkerEnabled(worker.ip, worker.port, worker.enabled);
    });
    this.on("workerRemoved", function(worker) {
      dbMgr.removeWorker(worker.ip, worker.port);
    });
  }
}
module.exports.FfmpegProcessManager = FfmpegProcessManager;
module.exports.Process = Process;
module.exports.Hardware = Hardware;
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
