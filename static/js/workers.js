class WorkerController{
    constructor(templates,langs){
        this.templates = templates;
        this.workersStatus = {};
        this.isInitialized = false;
    }

    render(div){
        if(!this.isInitialized){
            this.setup();
            this.isInitialized = true;
        }

        var self = this;
        $(div).html(this.templates.workers);
        $.getJSON( "workers", function( workers ) {
            self.renderWorkers(workers);;
        });
    }

    setup(){
        //Websocket
    }

    renderWorkers(workers){
        for(var i=0; i<workers.length; i++){ 
            this.appendToContainer("#worker_list",this.renderWorker(workers[i]));
        } 
    }
    
    renderWorker(worker){
        var template = $("#worker_status_tpl").clone();
        template.attr('id','');
        template.removeClass("hidden");
        template.find(".worker_ip").textContent = (worker.ip+":"+worker.port);
        let id = worker.ip+":"+worker.port;
        this.workersStatus[id] = template;

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
        }else{
            workerElem.find(".enable_worker_btn").removeClass("hidden");
            workerElem.find(".disable_worker_btn").addClass("hidden");
            workerElem.find(".remove_worker_btn").removeClass("hidden");     
        }
    }

    setWorkerStatus(workerId,status){
        let workerElem = this.workersStatus[workerId]
        if(status == "online"){
            workerElem.find(".online_status").removeClass("hidden");
            workerElem.find(".offline_status").addClass("hidden");
        }else{
            workerElem.find(".offline_status").removeClass("hidden");
            workerElem.find(".online_status").addClass("hidden");    
        }
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