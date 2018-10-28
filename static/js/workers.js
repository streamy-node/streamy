class WorkerController{
    constructor(templates,sws){
        this.templates = templates;
        this.workersStatus = {};
        this.isInitialized = false;
        this.sws = sws;
    }

    render(div){
        if(!this.isInitialized){
            this.initialize();
            this.isInitialized = true;
        }

        var self = this;
        $(div).html(this.templates.workers);
        $.getJSON( "workers", function( workers ) {
            self.renderWorkers(workers);;
        });

        $("#addWorkerButton").click(function(){
            let ip = $("#worker_host").val()
            let port = parseInt($("#worker_port").val())
            let data = {ip:ip,port:port}
            postAsJson(data,"/workers", function(response){
            },function(response){
                alert("Failed to add worker "+response);
            },false)
        });
    }

    initialize(){
        var self = this;
        //Websocket
        //var ws = io('/notifications/workers');
        var ws_worker = this.sws.subscribe('/notifications/workers')
        // this.ws.emit('join_room', "workers");
        // this.ws.on('connect', function() {
        //     // Connected, let's sign-up for to receive messages for this room
        //     this.ws.emit('join_room', "workers");
        // });
        //this.ws.emit('join_room', "workers");
            // this.ws.join('workers')
        ws_worker.on('workerAdded', function(worker){
            self.appendWorker(worker);
        });
        ws_worker.on('workerEnabled', function(ip,port){
            self.setWorkerEnabled(ip+":"+port,true)
        });
        ws_worker.on('workerDisabled', function(ip,port){
            self.setWorkerEnabled(ip+":"+port,false)
        });
        ws_worker.on('workerRemoved', function(ip,port){
            self.removeWorker(ip+":"+port)
        });
        ws_worker.on('workerStatus', function(ip,port,status){
            self.setWorkerStatus(ip+":"+port,status)
        });
    }

    renderWorkers(workers){
        for(var i=0; i<workers.length; i++){ 
            this.appendWorker(workers[i]);
        } 
    }

    appendWorker(worker){
        this.appendToContainer("#worker_list",this.renderWorker(worker));
    }
    
    renderWorker(worker){
        var template = $("#worker_status_tpl").clone();
        template.attr('id','');
        template.removeClass("hidden");
        template.find(".worker_ip").text(worker.ip+":"+worker.port);
        var id = worker.ip+":"+worker.port;
        this.workersStatus[id] = template;

        //connect buttons
        //'/workers/:id/status'
        template.find(".disable_worker_btn").click(function(){
            let data = {status:false}
            postAsJson(data,"/workers/"+id+"/status", function(response){
            },function(response){
                alert("Failed to disable worker "+response);
            },false)
        });
        template.find(".enable_worker_btn").click(function(){
            let data = {status:true}
            postAsJson(data,"/workers/"+id+"/status", function(response){
            },function(response){
                alert("Failed to enable worker "+response);
            },false)
        });
        template.find(".remove_worker_btn").click(function(){
            var r = confirm("You will remove the worker "+id);
            if(r){
                deleteReq("/workers/"+encodeURIComponent(id));
            }
        });
        template.find(".connect_worker_btn").click(function(){
            postAsJson({},"/workers/"+id+"/connect", function(response){
            },function(response){
                alert("Failed to reconnect worker "+response);
            },false)
        });

        // <button type="button" class="disable_worker_btn btn btn-warning mr-2">{{#__}}Disable{{/__}}</button>
        // <button type="button" class="enable_worker_btn btn btn-success mr-2">{{#__}}Enable{{/__}}</button>
        // <button type="button" class="remove_worker_btn btn btn-danger">{{#__}}Remove{{/__}}</button>


        this.setWorkerEnabled(id,worker.enabled);
        this.setWorkerStatus(id,worker.status);
        return template;
    }

    setWorkerEnabled(workerId,enabled){
        let workerElem = this.workersStatus[workerId]
        if(enabled){
            workerElem.find(".enable_worker_btn").addClass("hidden");
            workerElem.find(".disable_worker_btn").removeClass("hidden");
            workerElem.find(".remove_worker_btn").addClass("hidden");
            workerElem.find(".enabled_status").removeClass("hidden");
            workerElem.find(".disabled_status").addClass("hidden");
        }else{
            workerElem.find(".enable_worker_btn").removeClass("hidden");
            workerElem.find(".disable_worker_btn").addClass("hidden");
            workerElem.find(".remove_worker_btn").removeClass("hidden");
            workerElem.find(".enabled_status").addClass("hidden");
            workerElem.find(".disabled_status").removeClass("hidden");   
        }
    }

    setWorkerStatus(workerId,status){
        let workerElem = this.workersStatus[workerId]
        if(status == "online"){
            workerElem.find(".connect_worker_btn").addClass("hidden");
            workerElem.find(".online_status").removeClass("hidden");
            workerElem.find(".offline_status").addClass("hidden");
        }else{
            workerElem.find(".connect_worker_btn").removeClass("hidden");
            workerElem.find(".offline_status").removeClass("hidden");
            workerElem.find(".online_status").addClass("hidden");    
        }
    }

    removeWorker(workerId){
        let workerElem = this.workersStatus[workerId];
        workerElem.remove();
        
    }
    // <div class="online_status alert-success ml-2 mr-auto">Online</div>
    // <div class="offline_status alert-danger ml-2 mr-auto">Offline</div>

    // <button type="disable_worker_btn button" class="btn btn-warning mr-2">{{Disable}}</button>
    // <button type="enable_worker_btn button" class="btn btn-success mr-2">{{Enable}}</button>
    // <button type="remove_worker_btn button" class="btn btn-danger">{{Remove}}</button>

    appendToContainer(containerId,elem){
        $(containerId).first().append(elem);
        // let $container = $(containerId)
        // $container.append(elem);
    }    
}